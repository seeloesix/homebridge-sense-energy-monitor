// Enhanced Homebridge Sense Energy Monitor Platform Plugin
// This is a COMPLETE REWRITE - Dynamic Platform Version 2.1.0
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
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    try {
        FakeGatoHistoryService = require('fakegato-history')(homebridge);
    } catch (error) {
        // FakeGato is optional
    }

    homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, SenseEnergyMonitorPlatform, true);
};

class SenseAPI extends EventEmitter {
    constructor(username, password, monitor_id = null, verbose = false, storagePath = null) {
        super();
        this.username = username;
        this.password = password;
        this.monitor_id = monitor_id;
        this.verbose = verbose;
        this.storagePath = storagePath;
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
            const response = await this.makeRequest('authenticate', 'POST', auth_data);

            if (response.authorized) {
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
            throw new Error('Authentication failed - invalid credentials');
        } catch (error) {
            this.error(`Authentication error: ${error.message}`, error);
            this.authenticated = false;
            this.emit('authentication_failed', error);
            throw error;
        }
    }

    async ensureAuthenticated() {
        const now = Date.now();
        if (!this.authenticated || (now - this.last_auth_time) > this.auth_timeout) {
            this.log('Re-authenticating...');
            await this.authenticate();
        }
    }

    async makeRequest(endpoint, method = 'GET', data = null) {
        const url = this.API_URL + endpoint;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'homebridge-sense-energy-monitor/2.1.0',
                'X-Sense-Protocol': '3',
                'cache-control': 'no-cache'
            },
            timeout: 30000
        };

        if (this.access_token) {
            options.headers.Authorization = `Bearer ${this.access_token}`;
        }

        let postData = null;
        if (data && endpoint === 'authenticate') {
            postData = `email=${encodeURIComponent(data.email)}&password=${encodeURIComponent(data.password)}`;
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
                            reject(new Error(`HTTP ${res.statusCode}: ${parsedData.error_reason || 'Unknown error'}`));
                        }
                    } catch (parseError) {
                        reject(new Error(`Failed to parse response: ${parseError.message}`));
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
        this.individualDevices = this.config.individualDevices || false;
        this.devicePowerThreshold = this.config.devicePowerThreshold || 10;
        this.maxDevices = Math.min(this.config.maxDevices || 20, 50);
        this.enableHistory = this.config.enableHistory !== false;
        this.verbose = this.config.verbose || false;

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
            // Initialize Sense API
            this.senseAPI = new SenseAPI(
                this.username,
                this.password,
                this.monitor_id,
                this.verbose,
                this.storagePath
            );

            this.setupEventListeners();

            // Authenticate and discover devices
            await this.senseAPI.authenticate();
            await this.discoverAccessories();

            if (this.useWebSocket) {
                this.senseAPI.openStream();
            }

            // Start periodic updates
            this.startPeriodicUpdates();
        } catch (error) {
            this.log.error('Failed to initialize platform:', error.message);
            // Schedule retry
            setTimeout(() => {
                this.log.info('Retrying platform initialization...');
                this.initializePlatform();
            }, 120000); // Retry in 2 minutes
        }
    }

    setupEventListeners() {
        this.senseAPI.on('authenticated', () => {
            this.log.info('Sense API authenticated successfully');
        });

        this.senseAPI.on('authentication_failed', (error) => {
            this.log.error('Sense API authentication failed:', error.message);
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
            // Create main energy monitor accessory
            const mainUUID = UUIDGen.generate('sense-main-monitor');
            let mainAccessory = this.accessories.find(acc => acc.UUID === mainUUID);

            if (!mainAccessory) {
                mainAccessory = new this.api.platformAccessory(this.name, mainUUID);
                this.configureMainAccessory(mainAccessory);
                this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [mainAccessory]);
                this.accessories.push(mainAccessory);
                this.log.info('Created main energy monitor accessory');
            } else {
                this.configureMainAccessory(mainAccessory);
                this.log.info('Restored main energy monitor accessory');
            }

            // Get devices if individual device monitoring is enabled
            if (this.includeDevices && this.individualDevices) {
                // Add a small delay to ensure API is fully ready
                setTimeout(async () => {
                    try {
                        await this.senseAPI.getDevices();
                        // Add another small delay before creating accessories
                        setTimeout(() => {
                            this.createDeviceAccessories();
                        }, 1000);
                    } catch (error) {
                        this.log.error('Error loading devices for individual accessories:', error.message);
                    }
                }, 2000);
            }
        } catch (error) {
            this.log.error('Error discovering accessories:', error.message);
            throw error;
        }
    }

    configureMainAccessory(accessory) {
        // Information Service
        const informationService = accessory.getService(Service.AccessoryInformation) ||
            accessory.addService(Service.AccessoryInformation);

        informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Sense Labs')
            .setCharacteristic(Characteristic.Model, 'Energy Monitor')
            .setCharacteristic(Characteristic.SerialNumber, this.monitor_id || 'Unknown')
            .setCharacteristic(Characteristic.FirmwareRevision, '2.1.0');

        // Main power outlet service
        const outletService = accessory.getService(Service.Outlet) ||
            accessory.addService(Service.Outlet, this.name);

        outletService
            .getCharacteristic(Characteristic.On)
            .onGet(() => {
                try {
                    if (!this.senseAPI || typeof this.senseAPI.active_power !== 'number') {
                        return false;
                    }
                    const isOn = this.senseAPI.active_power > this.devicePowerThreshold;
                    return Boolean(isOn);
                } catch (error) {
                    this.log.error('Error getting main accessory On state:', error.message);
                    return false;
                }
            });

        outletService
            .getCharacteristic(Characteristic.OutletInUse)
            .onGet(() => {
                try {
                    if (!this.senseAPI || typeof this.senseAPI.active_power !== 'number') {
                        return false;
                    }
                    const isInUse = this.senseAPI.active_power > this.devicePowerThreshold;
                    return Boolean(isInUse);
                } catch (error) {
                    this.log.error('Error getting main accessory OutletInUse state:', error.message);
                    return false;
                }
            });

        // Add custom characteristics for power monitoring
        this.addCustomCharacteristics(outletService);

        // Add history service if enabled and available
        if (this.enableHistory && FakeGatoHistoryService) {
            accessory.historyService = new FakeGatoHistoryService('energy', accessory, {
                storage: 'fs',
                path: this.storagePath
            });
        }

        accessory.context.type = 'main';
        accessory.reachable = true;
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

    createDeviceAccessories() {
        try {
            if (!this.senseAPI || !this.senseAPI.devices || !Array.isArray(this.senseAPI.devices)) {
                this.log.warn('No devices available for individual accessories');
                return;
            }

            // Filter devices and ensure they have required properties
            const validDevices = this.senseAPI.devices
                .filter(device => {
                    if (!device || !device.name) {
                        this.log.warn('Skipping device with missing name:', device);
                        return false;
                    }
                    return true;
                })
                .slice(0, this.maxDevices);

            this.log.info(`Creating individual accessories for ${validDevices.length} devices`);

            validDevices.forEach((device, index) => {
                try {
                    // Add a small delay to prevent overwhelming Homebridge
                    setTimeout(() => {
                        const deviceUUID = UUIDGen.generate(`sense-device-${device.id || device.name}`);
                        let deviceAccessory = this.accessories.find(acc => acc.UUID === deviceUUID);

                        if (!deviceAccessory) {
                            deviceAccessory = new this.api.platformAccessory(device.name, deviceUUID);
                            this.configureDeviceAccessory(deviceAccessory, device);
                            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [deviceAccessory]);
                            this.accessories.push(deviceAccessory);
                            this.log.info(`Created device accessory: ${device.name}`);
                        } else {
                            this.configureDeviceAccessory(deviceAccessory, device);
                            this.log.info(`Restored device accessory: ${device.name}`);
                        }
                    }, index * 100); // 100ms delay between each device
                } catch (error) {
                    this.log.error(`Error creating accessory for device ${device.name}:`, error.message);
                }
            });
        } catch (error) {
            this.log.error('Error creating device accessories:', error.message);
        }
    }

    configureDeviceAccessory(accessory, device) {
        // Information Service
        const informationService = accessory.getService(Service.AccessoryInformation) ||
            accessory.addService(Service.AccessoryInformation);

        informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Sense Labs')
            .setCharacteristic(Characteristic.Model, device.type || 'Smart Device')
            .setCharacteristic(Characteristic.SerialNumber, device.id || 'Unknown')
            .setCharacteristic(Characteristic.FirmwareRevision, '2.1.0');

        // Device outlet service
        const outletService = accessory.getService(Service.Outlet) ||
            accessory.addService(Service.Outlet, device.name);

        outletService
            .getCharacteristic(Characteristic.On)
            .onGet(() => {
                try {
                    if (!this.senseAPI || !this.senseAPI.active_devices) {
                        return false;
                    }
                    const activeDevice = this.senseAPI.active_devices.find(d => d.name === device.name);
                    const isOn = activeDevice && activeDevice.power > this.devicePowerThreshold;
                    return Boolean(isOn);
                } catch (error) {
                    this.log.error(`Error getting On state for ${device.name}:`, error.message);
                    return false;
                }
            });

        outletService
            .getCharacteristic(Characteristic.OutletInUse)
            .onGet(() => {
                try {
                    if (!this.senseAPI || !this.senseAPI.active_devices) {
                        return false;
                    }
                    const activeDevice = this.senseAPI.active_devices.find(d => d.name === device.name);
                    const isInUse = activeDevice && activeDevice.power > this.devicePowerThreshold;
                    return Boolean(isInUse);
                } catch (error) {
                    this.log.error(`Error getting OutletInUse state for ${device.name}:`, error.message);
                    return false;
                }
            });

        accessory.context.type = 'device';
        accessory.context.deviceId = device.id;
        accessory.context.deviceName = device.name;
        accessory.reachable = true;
    }

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
                            power: power,
                            voltage: voltage,
                            current: current
                        });
                    } catch (error) {
                        this.log.error('Error adding history entry:', error.message);
                    }
                }
            }

            // Update device accessories
            if (this.individualDevices && Array.isArray(data.devices)) {
                const deviceAccessories = this.accessories.filter(acc => acc.context.type === 'device');
                
                deviceAccessories.forEach(accessory => {
                    try {
                        const { deviceName } = accessory.context;
                        if (!deviceName) {
                            return;
                        }

                        const activeDevice = data.devices.find(d => d && d.name === deviceName);
                        const outletService = accessory.getService(Service.Outlet);

                        if (outletService) {
                            const devicePower = (activeDevice && typeof activeDevice.power === 'number') ? activeDevice.power : 0;
                            const isOn = Boolean(devicePower > this.devicePowerThreshold);
                            
                            outletService.updateCharacteristic(Characteristic.On, isOn);
                            outletService.updateCharacteristic(Characteristic.OutletInUse, isOn);
                        }
                    } catch (error) {
                        this.log.error(`Error updating device accessory ${accessory.context.deviceName}:`, error.message);
                    }
                });
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
        this.log.info('Loading accessory from cache:', accessory.displayName);

        // Configure based on accessory type
        if (accessory.context.type === 'main') {
            this.configureMainAccessory(accessory);
        } else if (accessory.context.type === 'device') {
            // Device will be reconfigured when devices are loaded
        }

        this.accessories.push(accessory);
    }

    cleanup() {
        if (this.senseAPI) {
            this.senseAPI.destroy();
        }
    }
}