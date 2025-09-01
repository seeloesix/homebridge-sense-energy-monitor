// Enhanced Homebridge Sense Energy Monitor Platform Plugin
// This is a COMPLETE REWRITE - Dynamic Platform Version 2.4.0
const https = require('https');
const WebSocket = require('ws');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

let Service, Characteristic, UUIDGen, FakeGatoHistoryService, homebridge;

const PLATFORM_NAME = 'SenseEnergyMonitor';
const PLUGIN_NAME = 'homebridge-sense-energy-monitor';

module.exports = function(homebridgeInstance) {
    homebridge = homebridgeInstance;
    ({ Service, Characteristic } = homebridge.hap);
    UUIDGen = homebridge.hap.uuid;

    try {
        FakeGatoHistoryService = require('fakegato-history')(homebridge);
    } catch (error) {
        // FakeGato is optional
    }

    homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, SenseEnergyMonitorPlatform, true);
};

class SenseAPI extends EventEmitter {
    constructor(username, password, monitor_id = null, verbose = false, storagePath = null, mfaEnabled = false, mfaSecret = null) {
        super();
        this.username = username;
        this.password = password;
        this.monitor_id = monitor_id;
        this.verbose = verbose;
        this.storagePath = storagePath;
        this.mfaEnabled = mfaEnabled;
        this.mfaSecret = mfaSecret;
        this.access_token = null;
        this.user_id = null;
        this.account_id = null;
        this.monitors = [];
        this.devices = [];
        this.authenticated = false;
        this.realtime_data = {};
        this.trend_data = {};
        this.rate_limit = 30000;
        this.last_realtime_call = 0;
        this.auth_timeout = 15 * 60 * 1000;
        this.last_auth_time = 0;
        this.ws = null;
        this.ws_reconnect_timeout = null;
        this.ws_reconnect_delay = 30000;
        this.ws_max_reconnect_delay = 300000;
        this.API_URL = 'https://api.sense.com/apiservice/api/v1/';
        this.WS_URL = 'wss://clientrt.sense.com/monitors/';
        this.active_power = 0;
        this.active_solar_power = 0;
        this.active_voltage = [];
        this.active_frequency = 0;
        this.daily_usage = 0;
        this.daily_production = 0;
        this.weekly_usage = 0;
        this.monthly_usage = 0;
        this.yearly_usage = 0;
        this.active_devices = [];

        // Initialize active_devices as empty array to prevent undefined errors
        if (!Array.isArray(this.active_devices)) {
            this.active_devices = [];
        }

        // Load cached authentication if available
        this.loadCachedAuth();
    }

    log(message) {
        if (this.verbose) {
            const now = new Date();
            const timestamp = `${now.toLocaleDateString('en-GB')}, ${now.toLocaleTimeString('en-GB')}`;
            console.log(`[${timestamp}] [SenseAPI] ${message}`);
        }
    }

    error(message, error = null) {
        const now = new Date();
        const timestamp = `${now.toLocaleDateString('en-GB')}, ${now.toLocaleTimeString('en-GB')}`;
        if (error) {
            console.error(`[${timestamp}] [SenseAPI] ERROR: ${message}`, error);
        } else {
            console.error(`[${timestamp}] [SenseAPI] ERROR: ${message}`);
        }
    }

    async authenticate() {
        const auth_data = {
            email: this.username,
            password: this.password
        };

        try {
            // Step 1: Initial authentication (never include TOTP in first request)
            const response = await this.makeRequest('authenticate', 'POST', auth_data);

            if (response.authorized) {
                // Direct authentication successful (no MFA required)
                return this.handleSuccessfulAuth(response);
            }
            throw new Error('Authentication failed - invalid credentials');
        } catch (error) {
            // Check if this is a parsable response with MFA requirement
            if (error.response && error.response.status === 'mfa_required' && error.response.mfa_token) {
                this.log('MFA required, proceeding with two-factor authentication...');
                return await this.validateMFA(error.response.mfa_token);
            }
            // Check for MFA requirement in error message (fallback)
            if (error.message && error.message.includes('Multi-factor authentication required')) {
                // Try to extract MFA token from the error response if available
                let mfaToken = null;
                try {
                    if (error.responseData) {
                        const parsedError = JSON.parse(error.responseData);
                        if (parsedError.mfa_token) {
                            mfaToken = parsedError.mfa_token;
                        }
                    }
                } catch (parseError) {
                    // Ignore parsing errors
                }

                if (mfaToken) {
                    this.log('MFA required, proceeding with two-factor authentication...');
                    return await this.validateMFA(mfaToken);
                }

                // No MFA token available - provide user guidance
                if (!this.mfaEnabled) {
                    this.error('MFA is required for this account. Please enable MFA in the plugin configuration and provide your TOTP secret.');
                } else if (!this.mfaSecret) {
                    this.error('MFA is enabled but no TOTP secret was provided. Please enter your TOTP secret from your authenticator app setup.');
                } else {
                    this.error('MFA authentication failed. Unable to extract MFA token from response.');
                }
            }

            this.error(`Authentication error: ${error.message}`, error);
            this.authenticated = false;
            this.emit('authentication_failed', error);
            throw error;
        }
    }

    async validateMFA(mfaToken) {
        if (!this.mfaEnabled || !this.mfaSecret) {
            const error = new Error('MFA is required but no TOTP secret provided. Please enable MFA and provide your TOTP secret.');
            this.error(error.message);
            this.emit('authentication_failed', error);
            throw error;
        }

        try {
            // Generate fresh TOTP code
            const totpCode = this.generateTOTPCode();
            this.log('Validating MFA with TOTP code...');
            // Step 2: MFA validation with the token
            const mfaData = {
                mfa_token: mfaToken,
                totp: totpCode // Note: API expects 'totp', not 'totp_code'
            };

            const response = await this.makeRequest('authenticate/mfa', 'POST', mfaData);

            if (response.authorized) {
                this.log('MFA validation successful');
                return this.handleSuccessfulAuth(response);
            }
            throw new Error('MFA validation failed - invalid TOTP code');
        } catch (error) {
            this.error(`MFA validation error: ${error.message}`, error);
            this.authenticated = false;
            this.emit('authentication_failed', error);
            throw error;
        }
    }

    handleSuccessfulAuth(response) {
        this.access_token = response.access_token;
        this.user_id = response.user_id;
        this.account_id = response.account_id;
        this.monitors = response.monitors || [];
        this.authenticated = true;
        this.last_auth_time = Date.now();

        if (!this.monitor_id && this.monitors.length > 0) {
            this.monitor_id = this.monitors[0].id;
        }

        this.saveCachedAuth();
        this.log('Authentication successful');
        this.emit('authenticated');
        return true;
    }

    async ensureAuthenticated() {
        const now = Date.now();
        if (!this.authenticated || (now - this.last_auth_time) > this.auth_timeout) {
            this.log('Re-authenticating...');
            await this.authenticate();
        }
    }

    generateTOTPCode() {
        if (!this.mfaSecret) {
            throw new Error('No TOTP secret available');
        }
        const crypto = require('crypto');
        // Remove spaces and make uppercase
        const secret = this.mfaSecret.replace(/\s/g, '').toUpperCase();
        // Base32 decode
        const base32Decode = (encoded) => {
            const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
            let bits = '';
            let hex = '';
            for (let i = 0; i < encoded.length; i++) {
                const val = base32chars.indexOf(encoded.charAt(i));
                if (val === -1) {
                    continue;
                }
                bits += val.toString(2).padStart(5, '0');
            }
            for (let i = 0; i + 8 <= bits.length; i += 8) {
                const chunk = bits.substring(i, i + 8);
                hex += parseInt(chunk, 2).toString(16).padStart(2, '0');
            }
            return Buffer.from(hex, 'hex');
        };
        const key = base32Decode(secret);
        // Get current time counter
        const timeCounter = Math.floor(Date.now() / 1000 / 30);
        // Convert counter to buffer
        const counterBuffer = Buffer.alloc(8);
        counterBuffer.writeUInt32BE(Math.floor(timeCounter / 0x100000000), 0);
        counterBuffer.writeUInt32BE(timeCounter & 0xffffffff, 4);
        // Generate HMAC
        const hmac = crypto.createHmac('sha1', key);
        hmac.update(counterBuffer);
        const hash = hmac.digest();
        // Get offset
        const offset = hash[hash.length - 1] & 0xf;
        // Get 4 bytes from hash starting at offset
        const binary =
            ((hash[offset] & 0x7f) << 24) |
            ((hash[offset + 1] & 0xff) << 16) |
            ((hash[offset + 2] & 0xff) << 8) |
            (hash[offset + 3] & 0xff);
        // Get 6-digit code
        const otp = binary % 1000000;
        const code = otp.toString().padStart(6, '0');
        this.log(`Generated TOTP code: ${code.substring(0, 2)}****`);
        return code;
    }

    async makeRequest(endpoint, method = 'GET', data = null) {
        const url = this.API_URL + endpoint;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'homebridge-sense-energy-monitor/2.4.0',
                'X-Sense-Protocol': '3',
                'cache-control': 'no-cache'
            },
            timeout: 30000
        };

        if (this.access_token) {
            options.headers.Authorization = `Bearer ${this.access_token}`;
        }

        let postData = null;
        if (data && (endpoint === 'authenticate' || endpoint === 'authenticate/mfa')) {
            // Handle form data for authentication endpoints
            const params = new URLSearchParams();
            Object.keys(data).forEach(key => {
                params.append(key, data[key]);
            });
            postData = params.toString();
            options.headers['Content-Length'] = Buffer.byteLength(postData);
        } else if (data) {
            options.headers['Content-Type'] = 'application/json';
            postData = JSON.stringify(data);
        }

        return new Promise((resolve, reject) => {
            const req = https.request(url, options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(responseData);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsedData);
                        } else {
                            // For MFA-related errors, include the parsed response data
                            const error = new Error(`HTTP ${res.statusCode}: ${parsedData.error_reason || 'Unknown error'}`);
                            error.responseData = responseData;
                            error.response = parsedData;
                            reject(error);
                        }
                    } catch (parseError) {
                        const error = new Error(`Failed to parse response: ${parseError.message}`);
                        error.responseData = responseData;
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout after 30 seconds'));
            });

            if (postData) {
                req.write(postData);
            }

            req.end();
        });
    }

    async getDevices() {
        try {
            await this.ensureAuthenticated();

            const response = await this.makeRequest(`app/monitors/${this.monitor_id}/devices`);
            this.devices = response || [];
            this.log(`Retrieved ${this.devices.length} devices`);
            return this.devices;
        } catch (error) {
            try {
                this.log('Trying alternative devices endpoint...');
                const response = await this.makeRequest(`monitors/${this.monitor_id}/devices`);
                this.devices = response || [];
                this.log(`Retrieved ${this.devices.length} devices (alternative endpoint)`);
                return this.devices;
            } catch (altError) {
                this.error(`Error fetching devices: ${error.message}`, error);
                this.devices = [];
                return this.devices;
            }
        }
    }

    async updateRealtime() {
        try {
            await this.ensureAuthenticated();

            const now = Date.now();
            if (now - this.last_realtime_call < this.rate_limit) {
                this.log('Rate limited - skipping realtime update');
                return;
            }

            const response = await this.makeRequest(`app/monitors/${this.monitor_id}/status`);
            this.last_realtime_call = now;

            if (response) {
                this.active_power = Math.round(response.w || 0);
                this.active_solar_power = Math.round(response.solar_w || 0);
                this.active_voltage = response.voltage || [120];
                this.active_frequency = response.hz || 60;

                this.emit('realtime_update', {
                    power: this.active_power,
                    solar_power: this.active_solar_power,
                    voltage: this.active_voltage,
                    frequency: this.active_frequency
                });
            }
        } catch (error) {
            this.error(`Error updating realtime data: ${error.message}`, error);
            this.emit('realtime_error', error);
        }
    }

    async updateTrendData() {
        try {
            await this.ensureAuthenticated();

            const response = await this.makeRequest(`app/monitors/${this.monitor_id}/status`);

            if (response) {
                this.daily_usage = response.daily_usage || 0;
                this.daily_production = response.daily_production || 0;
                this.weekly_usage = response.weekly_usage || 0;
                this.monthly_usage = response.monthly_usage || 0;
                this.yearly_usage = response.yearly_usage || 0;

                this.emit('trend_update', {
                    daily_usage: this.daily_usage,
                    daily_production: this.daily_production,
                    weekly_usage: this.weekly_usage,
                    monthly_usage: this.monthly_usage,
                    yearly_usage: this.yearly_usage
                });
            }
        } catch (error) {
            this.error(`Error updating trend data: ${error.message}`, error);
            this.emit('trend_error', error);
        }
    }

    openStream() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.log('WebSocket already open');
            return;
        }

        if (!this.authenticated || !this.access_token) {
            this.error('Cannot open WebSocket - not authenticated');
            return;
        }

        try {
            const wsUrl = `${this.WS_URL}${this.monitor_id}/realtimefeed?access_token=${this.access_token}`;

            this.log('Opening WebSocket connection');
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                this.log('WebSocket connected');
                this.emit('websocket_open');
                this.ws_reconnect_delay = 30000;

                if (this.ws_reconnect_timeout) {
                    clearTimeout(this.ws_reconnect_timeout);
                    this.ws_reconnect_timeout = null;
                }
            });

            this.ws.on('message', (data) => {
                try {
                    const parsedData = JSON.parse(data);
                    this.handleWebSocketData(parsedData);
                } catch (error) {
                    this.error(`Error parsing WebSocket data: ${error.message}`, error);
                }
            });

            this.ws.on('close', (code, reason) => {
                this.log(`WebSocket closed: ${code} ${reason}`);
                this.emit('websocket_close', { code, reason });
                this.scheduleReconnect();
            });

            this.ws.on('error', (error) => {
                this.error(`WebSocket error: ${error.message}`, error);
                this.emit('websocket_error', error);
                this.scheduleReconnect();
            });
        } catch (error) {
            this.error(`Failed to create WebSocket connection: ${error.message}`, error);
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (this.ws_reconnect_timeout) {
            return; // Already scheduled
        }

        this.log(`Scheduling WebSocket reconnect in ${this.ws_reconnect_delay}ms`);
        this.ws_reconnect_timeout = setTimeout(() => {
            this.ws_reconnect_timeout = null;
            this.openStream();
        }, this.ws_reconnect_delay);

        // Exponential backoff with max delay
        this.ws_reconnect_delay = Math.min(this.ws_reconnect_delay * 2, this.ws_max_reconnect_delay);
    }

    closeStream() {
        if (this.ws_reconnect_timeout) {
            clearTimeout(this.ws_reconnect_timeout);
            this.ws_reconnect_timeout = null;
        }

        if (this.ws) {
            this.log('Closing WebSocket connection');
            this.ws.close();
            this.ws = null;
        }
    }

    handleWebSocketData(data) {
        try {
            if (data.payload) {
                this.active_power = Math.round(data.payload.w || data.payload.d_w || 0);
                this.active_solar_power = Math.round(data.payload.solar_w || 0);
                this.active_voltage = data.payload.voltage || [120];
                this.active_frequency = data.payload.hz || 60;

                // Initialize active_devices as empty array
                this.active_devices = [];

                if (data.payload.devices && Array.isArray(data.payload.devices)) {
                    this.active_devices = data.payload.devices
                        .filter(device => {
                            return device &&
                                   typeof device === 'object' &&
                                   device.name &&
                                   typeof device.w === 'number' &&
                                   device.w > 5;
                        })
                        .map(device => ({
                            name: device.name,
                            power: Math.round(device.w)
                        }));
                }

                this.emit('data', {
                    power: this.active_power,
                    solar_power: this.active_solar_power,
                    voltage: this.active_voltage,
                    frequency: this.active_frequency,
                    devices: this.active_devices
                });
            }
        } catch (error) {
            this.error(`Error handling WebSocket data: ${error.message}`, error);
        }
    }

    saveCachedAuth() {
        if (!this.storagePath) {
            return;
        }

        try {
            const authData = {
                access_token: this.access_token,
                user_id: this.user_id,
                account_id: this.account_id,
                monitor_id: this.monitor_id,
                last_auth_time: this.last_auth_time,
                monitors: this.monitors
            };

            const authFile = path.join(this.storagePath, 'sense_auth.json');
            fs.writeFileSync(authFile, JSON.stringify(authData, null, 2));
            this.log('Authentication cached');
        } catch (error) {
            this.error(`Failed to cache authentication: ${error.message}`, error);
        }
    }

    loadCachedAuth() {
        if (!this.storagePath) {
            return;
        }

        try {
            const authFile = path.join(this.storagePath, 'sense_auth.json');
            if (fs.existsSync(authFile)) {
                const authData = JSON.parse(fs.readFileSync(authFile, 'utf8'));

                // Check if cached auth is still valid (within timeout)
                const now = Date.now();
                if (now - authData.last_auth_time < this.auth_timeout) {
                    this.access_token = authData.access_token;
                    this.user_id = authData.user_id;
                    this.account_id = authData.account_id;
                    this.monitor_id = authData.monitor_id || this.monitor_id;
                    this.last_auth_time = authData.last_auth_time;
                    this.monitors = authData.monitors || [];
                    this.authenticated = true;
                    this.log('Loaded cached authentication');
                }
            }
        } catch (error) {
            this.error(`Failed to load cached authentication: ${error.message}`, error);
        }
    }

    destroy() {
        this.closeStream();
        this.removeAllListeners();
    }
}

class SenseEnergyMonitorPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.accessories = [];
        this.accessoriesToRemove = [];
        this.senseAPI = null;
        this.isConfigured = false;

        this.log.info('Initializing Sense Energy Monitor Platform...');

        // Validate required configuration
        if (!this.validateConfig()) {
            this.log.error('Plugin not configured correctly. Please check your configuration.');
            return;
        }

        this.isConfigured = true;
        this.name = this.config.name || 'Sense Energy Monitor';
        this.username = this.config.username;
        this.password = this.config.password;
        this.monitor_id = this.config.monitor_id || null;
        this.pollingInterval = (this.config.pollingInterval || 60) * 1000;
        this.deviceLoggingInterval = (this.config.deviceLoggingInterval || 2) * 60 * 1000;
        this.useWebSocket = this.config.useWebSocket !== false;
        this.includeSolar = this.config.includeSolar !== false;
        this.includeDevices = this.config.includeDevices !== false;
        this.maxDevices = Math.min(this.config.maxDevices || 20, 50);
        this.devicePowerThreshold = this.config.devicePowerThreshold || 10;
        this.enableHistory = this.config.enableHistory !== false;
        this.verbose = this.config.verbose !== false;  // Default to true

        // Get storage path for caching
        this.storagePath = this.api?.user?.storagePath();

        if (this.api) {
            this.api.on('didFinishLaunching', () => {
                this.log.info('Platform finished launching, initializing accessories...');
                this.initializePlatform();
            });

            this.api.on('shutdown', () => {
                this.log.info('Homebridge is shutting down, cleaning up...');
                this.cleanup();
            });
        }
    }

    validateConfig() {
        if (!this.config) {
            this.log.error('No configuration provided');
            return false;
        }

        if (!this.config.username || !this.config.password) {
            this.log.error('Username and password are required');
            return false;
        }

        if (typeof this.config.username !== 'string' || typeof this.config.password !== 'string') {
            this.log.error('Username and password must be strings');
            return false;
        }

        if (this.config.pollingInterval && (this.config.pollingInterval < 30 || this.config.pollingInterval > 3600)) {
            this.log.warn('Polling interval should be between 30 and 3600 seconds, using default 60');
            this.config.pollingInterval = 60;
        }

        return true;
    }

    async initializePlatform() {
        if (!this.isConfigured) {
            this.log.error('Platform not configured, skipping initialization');
            return;
        }

        try {
            // NUCLEAR OPTION: Remove ALL existing accessories on startup
            if (this.accessories.length > 0) {
                this.log.warn(`Removing ${this.accessories.length} existing accessories to prevent callback conflicts`);
                this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, this.accessories);
                this.accessories = [];
            }

            // Also remove any cached accessories that were ignored
            if (this.accessoriesToRemove && this.accessoriesToRemove.length > 0) {
                this.log.warn(`Removing ${this.accessoriesToRemove.length} cached accessories to prevent callback conflicts`);
                this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, this.accessoriesToRemove);
                this.accessoriesToRemove = [];
            }

            // Initialize Sense API
            this.senseAPI = new SenseAPI(
                this.username,
                this.password,
                this.monitor_id,
                this.verbose,
                this.storagePath,
                this.config.mfaEnabled || false,
                this.config.mfaSecret || null
            );

            this.setupEventListeners();

            // Authenticate and discover devices
            await this.senseAPI.authenticate();

            // Wait a bit before creating accessories
            setTimeout(async() => {
                await this.discoverAccessories();

                if (this.useWebSocket) {
                    this.senseAPI.openStream();
                }

                // Start periodic updates
                this.startPeriodicUpdates();
            }, 3000);

        } catch (error) {
            this.log.error('Failed to initialize platform:', error.message);
            // Schedule retry
            setTimeout(() => {
                this.log.info('Retrying platform initialization...');
                this.initializePlatform();
            }, 120000);
        }
    }

    setupEventListeners() {
        this.senseAPI.on('authenticated', () => {
            this.log.info('Sense API authenticated successfully');
        });

        this.senseAPI.on('authentication_failed', (error) => {
            this.log.error('Sense API authentication failed:', error.message);
            if (error.message && error.message.includes('Multi-factor authentication required')) {
                this.log.error('Please update your configuration with MFA settings:');
                this.log.error('1. Set "mfaEnabled" to true');
                this.log.error('2. Enter the 6-digit code from your authenticator app in "mfaCode"');
                this.log.error('3. Restart Homebridge after updating the configuration');
            }
        });

        this.senseAPI.on('data', (data) => {
            this.updateAccessories(data);
        });

        this.senseAPI.on('realtime_update', (data) => {
            this.updateAccessories(data);
        });

        this.senseAPI.on('trend_update', (data) => {
            this.log.debug('Trend data updated:', data);
        });

        this.senseAPI.on('websocket_error', (error) => {
            this.log.warn('WebSocket error:', error.message);
        });

        this.senseAPI.on('realtime_error', (error) => {
            this.log.warn('Realtime data error:', error.message);
        });

        this.senseAPI.on('trend_error', (error) => {
            this.log.warn('Trend data error:', error.message);
        });
    }

    async discoverAccessories() {
        try {
            // Create main energy monitor accessory only
            const mainUUID = UUIDGen.generate('sense-main-monitor-v2');
            const mainAccessory = new this.api.platformAccessory(this.name, mainUUID);

            this.configureMainAccessory(mainAccessory);
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [mainAccessory]);
            this.accessories.push(mainAccessory);
            this.log.info('Created main energy monitor accessory');

            // Individual device accessories removed - feature was causing callback conflicts

        } catch (error) {
            this.log.error('Error discovering accessories:', error.message);
            throw error;
        }
    }

    configureMainAccessory(accessory) {
        try {
            // Information Service
            const informationService = accessory.getService(Service.AccessoryInformation) ||
                accessory.addService(Service.AccessoryInformation);

            informationService
                .setCharacteristic(Characteristic.Manufacturer, 'Sense Labs')
                .setCharacteristic(Characteristic.Model, 'Energy Monitor')
                .setCharacteristic(Characteristic.SerialNumber, this.monitor_id || 'Unknown')
                .setCharacteristic(Characteristic.FirmwareRevision, '2.4.0');

            // Remove existing outlet service if it exists to start fresh
            const existingOutletService = accessory.getService(Service.Outlet);
            if (existingOutletService) {
                accessory.removeService(existingOutletService);
                this.log.info('Removed existing outlet service to prevent conflicts');
            }

            // Create fresh outlet service
            const outletService = accessory.addService(Service.Outlet, this.name);

            // Use the simplest possible characteristic handlers
            outletService
                .getCharacteristic(Characteristic.On)
                .onGet(() => {
                    const power = this.senseAPI?.active_power || 0;
                    return power > this.devicePowerThreshold;
                })
                .updateValue(false); // Set initial value

            outletService
                .getCharacteristic(Characteristic.OutletInUse)
                .onGet(() => {
                    const power = this.senseAPI?.active_power || 0;
                    return power > this.devicePowerThreshold;
                })
                .updateValue(false); // Set initial value

            // Add history service if enabled and available
            if (this.enableHistory && FakeGatoHistoryService && !accessory.historyService) {
                try {
                    accessory.historyService = new FakeGatoHistoryService('energy', accessory, {
                        storage: 'fs',
                        path: this.storagePath
                    });
                } catch (historyError) {
                    this.log.warn('Failed to create history service:', historyError.message);
                }
            }

            accessory.context = {
                type: 'main',
                configured: true,
                version: '2.4.0'
            };

            this.log.info('Main accessory configured successfully');

        } catch (error) {
            this.log.error('Error configuring main accessory:', error.message);
            throw error;
        }
    }

    clearExistingHandlers(accessory) {
        try {
            // Clear handlers from outlet service if it exists
            const outletService = accessory.getService(Service.Outlet);
            if (outletService) {
                const onCharacteristic = outletService.getCharacteristic(Characteristic.On);
                const outletInUseCharacteristic = outletService.getCharacteristic(Characteristic.OutletInUse);

                if (onCharacteristic) {
                    onCharacteristic.removeAllListeners();
                }
                if (outletInUseCharacteristic) {
                    outletInUseCharacteristic.removeAllListeners();
                }
            }
        } catch (error) {
            this.log.warn('Error clearing existing handlers:', error.message);
        }
    }

    addCustomCharacteristics(_service) {
        // These would be custom characteristics for power monitoring
        // For now, we'll use standard characteristics where possible

        // You could add custom characteristics here for:
        // - Power consumption in watts
        // - Voltage
        // - Current
        // - Energy consumption in kWh
        // - Solar production
    }

    // Individual device accessories removed - was causing callback conflicts

    updateAccessories(data) {
        try {
            // Validate incoming data
            if (!data || typeof data !== 'object') {
                this.log.warn('Invalid data received for accessory update');
                return;
            }

            // Update main accessory
            const mainAccessory = this.accessories.find(acc => acc.context.type === 'main');
            if (mainAccessory) {
                const outletService = mainAccessory.getService(Service.Outlet);
                if (outletService) {
                    try {
                        const power = typeof data.power === 'number' ? data.power : 0;
                        const isOn = Boolean(power > this.devicePowerThreshold);

                        outletService.updateCharacteristic(Characteristic.On, isOn);
                        outletService.updateCharacteristic(Characteristic.OutletInUse, isOn);
                    } catch (error) {
                        this.log.error('Error updating main accessory characteristics:', error.message);
                    }
                }

                // Add history entry
                if (mainAccessory.historyService) {
                    try {
                        const power = typeof data.power === 'number' ? data.power : 0;
                        const voltage = (Array.isArray(data.voltage) && data.voltage[0]) ? data.voltage[0] : 120;
                        const current = voltage > 0 ? (power / voltage) : 0;

                        mainAccessory.historyService.addEntry({
                            time: Math.round(Date.now() / 1000),
                            power,
                            voltage,
                            current
                        });
                    } catch (error) {
                        this.log.error('Error adding history entry:', error.message);
                    }
                }
            }


            // Log periodic status
            if (this.verbose) {
                const now = Date.now();
                if (!this.lastLogTime || (now - this.lastLogTime) > 30000) {
                    this.lastLogTime = now;
                    const power = typeof data.power === 'number' ? data.power : 0;
                    const solarPower = typeof data.solar_power === 'number' ? data.solar_power : 0;
                    const deviceCount = Array.isArray(data.devices) ? data.devices.length : 0;

                    this.log.info(`Power: ${power}W, Solar: ${solarPower}W, Active devices: ${deviceCount}`);
                }
            }
        } catch (error) {
            this.log.error('Error updating accessories:', error.message);
        }
    }

    startPeriodicUpdates() {
        // Update trend data periodically
        if (this.pollingInterval > 0) {
            setInterval(async() => {
                try {
                    await this.senseAPI.updateTrendData();
                    if (!this.useWebSocket) {
                        await this.senseAPI.updateRealtime();
                    }
                } catch (error) {
                    this.log.warn('Periodic update failed:', error.message);
                }
            }, this.pollingInterval);
        }

        // Log device status periodically
        if (this.verbose && this.deviceLoggingInterval > 0) {
            setInterval(() => {
                if (this.senseAPI.active_devices.length > 0) {
                    this.log.info(`Active devices: ${this.senseAPI.active_devices.map(d => `${d.name}(${d.power}W)`).join(', ')}`);
                }
            }, this.deviceLoggingInterval);
        }
    }

    configureAccessory(accessory) {
        // NUCLEAR OPTION: Don't configure any cached accessories
        // This prevents callback conflicts from old cached accessories
        this.log.warn(`Ignoring cached accessory to prevent conflicts: ${accessory.displayName}`);

        // Add to list for removal
        if (!this.accessoriesToRemove) {
            this.accessoriesToRemove = [];
        }
        this.accessoriesToRemove.push(accessory);
    }

    // Method to clean up problematic cached accessories
    cleanupCachedAccessories() {
        try {
            // Remove accessories that might have old callback-style handlers
            const problematicAccessories = this.accessories.filter(accessory => {
                // Look for accessories without the 'configured' flag
                return !accessory.context.configured;
            });

            if (problematicAccessories.length > 0) {
                this.log.info(`Cleaning up ${problematicAccessories.length} potentially problematic cached accessories`);

                problematicAccessories.forEach(accessory => {
                    try {
                        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
                        this.accessories = this.accessories.filter(acc => acc.UUID !== accessory.UUID);
                        this.log.info(`Removed cached accessory: ${accessory.displayName}`);
                    } catch (error) {
                        this.log.error(`Error removing cached accessory ${accessory.displayName}:`, error.message);
                    }
                });
            }
        } catch (error) {
            this.log.error('Error during accessory cleanup:', error.message);
        }
    }

    cleanup() {
        if (this.senseAPI) {
            this.senseAPI.destroy();
        }
    }
}
