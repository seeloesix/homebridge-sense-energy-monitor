// Enhanced Homebridge Sense Power Meter Plugin
// Integrates comprehensive API from tadthies/sense
// index.js

const https = require('https');
const WebSocket = require('ws');
const EventEmitter = require('events');

let Service, Characteristic, FakeGatoHistoryService;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    
    try {
        FakeGatoHistoryService = require('fakegato-history')(homebridge);
    } catch (error) {
        // FakeGato is optional
        console.warn('[homebridge-sense-energy-monitor] FakeGato History Service not available');
    }
    
    homebridge.registerAccessory("homebridge-sense-energy-monitor", "SensePowerMeter", SensePowerMeterAccessory);
};

class SenseAPI extends EventEmitter {
    constructor(username, password, monitor_id = null, verbose = false) {
        super();
        this.username = username;
        this.password = password;
        this.monitor_id = monitor_id;
        this.verbose = verbose;
        
        // Authentication data
        this.access_token = null;
        this.user_id = null;
        this.account_id = null;
        this.monitors = [];
        this.devices = [];
        this.authenticated = false;
        
        // Data storage
        this.realtime_data = {};
        this.trend_data = {};
        this.device_data = {};
        
        // API configuration
        this.rate_limit = 30000; // 30 seconds default rate limit
        this.last_realtime_call = 0;
        this.auth_timeout = 15 * 60 * 1000; // 15 minutes
        this.last_auth_time = 0;
        
        // WebSocket
        this.ws = null;
        this.ws_reconnect_timeout = null;
        this.ws_reconnect_delay = 30000; // 30 seconds
        this.ws_max_reconnect_delay = 300000; // 5 minutes
        
        // API endpoints
        this.API_URL = 'https://api.sense.com/apiservice/api/v1/';
        this.WS_URL = 'wss://clientrt.sense.com/monitors/';
        
        // Data properties (matching tadthies/sense API)
        this.active_power = 0;
        this.active_solar_power = 0;
        this.active_voltage = [];
        this.active_frequency = 0;
        this.daily_usage = 0;
        this.daily_production = 0;
        this.weekly_usage = 0;
        this.weekly_production = 0;
        this.monthly_usage = 0;
        this.monthly_production = 0;
        this.yearly_usage = 0;
        this.yearly_production = 0;
        this.active_devices = [];
    }

    log(message) {
        if (this.verbose) {
            console.log(`[SenseAPI] ${message}`);
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
                
                // Use first monitor if none specified
                if (!this.monitor_id && this.monitors.length > 0) {
                    this.monitor_id = this.monitors[0].id;
                }
                
                this.log('Authentication successful');
                this.emit('authenticated');
                return true;
            }
            throw new Error('Authentication failed');
        } catch (error) {
            this.log(`Authentication error: ${error.message}`);
            this.authenticated = false;
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
            method: method,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'homebridge-sense-energy-monitor',
                'X-Sense-Protocol': '3',
                'cache-control': 'no-cache'
            },
            timeout: 30000
        };

        if (this.access_token) {
            options.headers['Authorization'] = `Bearer ${this.access_token}`;
        }

        // For authentication, use form data
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
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (postData) {
                req.write(postData);
            }
            
            req.end();
        });
    }

    async getDevices() {
        await this.ensureAuthenticated();
        
        try {
            // Try the correct devices endpoint - monitor_id should be the first monitor from auth
            const response = await this.makeRequest(`app/monitors/${this.monitor_id}/devices`);
            this.devices = response || [];
            this.log(`Retrieved ${this.devices.length} devices`);
            return this.devices;
        } catch (error) {
            // Try alternative endpoint format
            try {
                this.log('Trying alternative devices endpoint...');
                const response = await this.makeRequest(`monitors/${this.monitor_id}/devices`);
                this.devices = response || [];
                this.log(`Retrieved ${this.devices.length} devices (alternative endpoint)`);
                return this.devices;
            } catch (altError) {
                this.log(`Error fetching devices: ${error.message}`);
                // Don't throw error - continue without devices
                this.devices = [];
                return this.devices;
            }
        }
    }

    async getMonitorInfo() {
        await this.ensureAuthenticated();
        
        try {
            const response = await this.makeRequest(`app/monitors/${this.monitor_id}`);
            return response;
        } catch (error) {
            // Try alternative endpoint
            try {
                const response = await this.makeRequest(`monitors/${this.monitor_id}`);
                return response;
            } catch (altError) {
                this.log(`Error fetching monitor info: ${error.message}`);
                throw error;
            }
        }
    }

    async updateRealtime() {
        const now = Date.now();
        if (now - this.last_realtime_call < this.rate_limit) {
            this.log('Rate limited - skipping realtime update');
            return this.realtime_data;
        }

        await this.ensureAuthenticated();
        
        try {
            // Try the correct realtime endpoint
            const response = await this.makeRequest(`app/monitors/${this.monitor_id}/status`);
            this.realtime_data = response;
            this.last_realtime_call = now;
            
            // Update properties with safer property access
            this.active_power = response.channels?.[0]?.w || response.w || 0;
            this.active_solar_power = response.solar_w || 0;
            this.active_voltage = response.voltage || [120];
            this.active_frequency = response.hz || 60;
            
            // Extract active devices safely
            this.active_devices = [];
            if (response.devices) {
                this.active_devices = response.devices
                    .filter(device => device.state === 'on' || device.w > 0)
                    .map(device => device.name || 'Unknown Device');
            }
            
            this.log(`Realtime update: ${this.active_power}W, Solar: ${this.active_solar_power}W`);
            this.emit('realtime_update', this.realtime_data);
            return this.realtime_data;
        } catch (error) {
            this.log(`Error updating realtime data: ${error.message}`);
            // Don't throw error - continue with default values
            return this.realtime_data;
        }
    }

    async updateTrendData() {
        await this.ensureAuthenticated();
        
        try {
            const [daily, weekly, monthly, yearly] = await Promise.all([
                this.getTrendData('DAY'),
                this.getTrendData('WEEK'),
                this.getTrendData('MONTH'),
                this.getTrendData('YEAR')
            ]);
            
            this.trend_data = { daily, weekly, monthly, yearly };
            
            // Update properties
            this.daily_usage = daily.consumption?.total || 0;
            this.daily_production = daily.production?.total || 0;
            this.weekly_usage = weekly.consumption?.total || 0;
            this.weekly_production = weekly.production?.total || 0;
            this.monthly_usage = monthly.consumption?.total || 0;
            this.monthly_production = monthly.production?.total || 0;
            this.yearly_usage = yearly.consumption?.total || 0;
            this.yearly_production = yearly.production?.total || 0;
            
            this.log('Trend data updated');
            this.emit('trend_update', this.trend_data);
            return this.trend_data;
        } catch (error) {
            this.log(`Error updating trend data: ${error.message}`);
            throw error;
        }
    }

    async getTrendData(scale = 'DAY') {
        const endpoint = `monitors/${this.monitor_id}/timeline?scale=${scale}`;
        return await this.makeRequest(endpoint);
    }

    async getUsageData(start_date, end_date, scale = 'DAY') {
        const endpoint = `monitors/${this.monitor_id}/usage?start=${start_date}&end=${end_date}&scale=${scale}`;
        return await this.makeRequest(endpoint);
    }

    async getDeviceHistory(device_id, start_date, end_date) {
        const endpoint = `monitors/${this.monitor_id}/devices/${device_id}/timeline?start=${start_date}&end=${end_date}`;
        return await this.makeRequest(endpoint);
    }

    // WebSocket methods
    openStream() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.log('WebSocket already open');
            return;
        }

        if (!this.authenticated || !this.access_token) {
            this.log('Cannot open WebSocket - not authenticated');
            return;
        }

        const wsUrl = `${this.WS_URL}${this.monitor_id}/realtimefeed?access_token=${this.access_token}`;
        
        this.log('Opening WebSocket connection');
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
            this.log('WebSocket connected');
            this.emit('websocket_open');
            this.ws_reconnect_delay = 30000; // Reset reconnect delay
        });

        this.ws.on('message', (data) => {
            try {
                const parsedData = JSON.parse(data);
                this.handleWebSocketData(parsedData);
            } catch (error) {
                this.log(`Error parsing WebSocket data: ${error.message}`);
            }
        });

        this.ws.on('close', (code, reason) => {
            this.log(`WebSocket closed: ${code} ${reason}`);
            this.emit('websocket_close', { code, reason });
            this.scheduleReconnect();
        });

        this.ws.on('error', (error) => {
            this.log(`WebSocket error: ${error.message}`);
            this.emit('websocket_error', error);
        });
    }

    closeStream() {
        if (this.ws) {
            this.log('Closing WebSocket connection');
            this.ws.close();
            this.ws = null;
        }
        
        if (this.ws_reconnect_timeout) {
            clearTimeout(this.ws_reconnect_timeout);
            this.ws_reconnect_timeout = null;
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
            
            // Exponential backoff
            this.ws_reconnect_delay = Math.min(this.ws_reconnect_delay * 2, this.ws_max_reconnect_delay);
        }, this.ws_reconnect_delay);
    }

    handleWebSocketData(data) {
        if (data.payload && data.payload.channels) {
            const channels = data.payload.channels;
            
            if (channels.main) {
                this.active_power = channels.main.active_power || 0;
            }
            
            if (channels.solar) {
                this.active_solar_power = channels.solar.active_power || 0;
            }
            
            this.active_voltage = data.payload.voltage || [];
            this.active_frequency = data.payload.frequency || 0;
            
            // Update active devices
            if (data.payload.devices) {
                this.active_devices = data.payload.devices
                    .filter(device => device.state === 'active')
                    .map(device => device.name);
            }
            
            this.emit('data', {
                power: this.active_power,
                solar_power: this.active_solar_power,
                voltage: this.active_voltage,
                frequency: this.active_frequency,
                devices: this.active_devices
            });
        }
    }
}

class SensePowerMeterAccessory {
    constructor(log, config) {
        this.log = log;
        this.config = config;
        this.name = config.name || 'Sense Energy Meter';
        
        // Required config
        if (!config.username || !config.password) {
            throw new Error('Username and password are required');
        }
        
        // Configuration
        this.username = config.username;
        this.password = config.password;
        this.monitor_id = config.monitor_id || null;
        this.pollingInterval = (config.pollingInterval || 60) * 1000; // Convert to milliseconds
        this.useWebSocket = config.useWebSocket !== false; // Default true
        this.includeSolar = config.includeSolar !== false; // Default true
        this.includeDevices = config.includeDevices !== false; // Default true
        this.verbose = config.verbose || false;
        
        // State
        this.power = 0;
        this.solarPower = 0;
        this.voltage = 120;
        this.current = 0;
        this.totalConsumption = 0;
        this.dailyConsumption = 0;
        this.isOnline = false;
        
        // Initialize Sense API
        this.senseAPI = new SenseAPI(this.username, this.password, this.monitor_id, this.verbose);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize services
        this.setupServices();
        
        // Start monitoring
        this.startMonitoring();
    }

    setupEventListeners() {
        this.senseAPI.on('authenticated', () => {
            this.log('Sense API authenticated successfully');
            this.isOnline = true;
            this.updateAccessoryInformation();
        });

        this.senseAPI.on('data', (data) => {
            this.power = Math.round(data.power || 0);
            this.solarPower = Math.round(data.solar_power || 0);
            this.voltage = data.voltage && data.voltage.length > 0 ? Math.round(data.voltage[0]) : 120;
            this.current = this.voltage > 0 ? Math.round((this.power / this.voltage) * 100) / 100 : 0;
            
            this.updateCharacteristics();
            this.addHistoryEntry();
        });

        this.senseAPI.on('realtime_update', (data) => {
            this.log(`Power: ${this.power}W, Solar: ${this.solarPower}W`);
        });

        this.senseAPI.on('trend_update', (data) => {
            this.dailyConsumption = Math.round((data.daily?.consumption?.total || 0) * 100) / 100;
            this.log(`Daily consumption: ${this.dailyConsumption} kWh`);
        });

        this.senseAPI.on('websocket_error', (error) => {
            this.log(`WebSocket error: ${error.message}`);
            this.isOnline = false;
        });
    }

    setupServices() {
        // Accessory Information Service
        this.informationService = new Service.AccessoryInformation();
        this.informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Sense Labs')
            .setCharacteristic(Characteristic.Model, 'Energy Monitor')
            .setCharacteristic(Characteristic.SerialNumber, this.monitor_id || 'Unknown')
            .setCharacteristic(Characteristic.FirmwareRevision, '1.0.0');

        // Main power service (using Outlet service for power characteristics)
        this.powerService = new Service.Outlet(this.name);
        this.powerService
            .getCharacteristic(Characteristic.On)
            .on('get', this.getOnState.bind(this))
            .on('set', this.setOnState.bind(this));

        this.powerService
            .getCharacteristic(Characteristic.OutletInUse)
            .on('get', this.getOutletInUse.bind(this));

        // Add custom characteristics for power monitoring
        this.addCustomCharacteristics();

        // History service
        if (FakeGatoHistoryService) {
            this.historyService = new FakeGatoHistoryService('energy', this, {
                storage: 'fs'
            });
        }
    }

    addCustomCharacteristics() {
        // Create custom characteristics using proper HAP-NodeJS format
        const PowerConsumption = function() {
            Characteristic.call(this, 'Consumption', 'E863F10D-079E-48FF-8F27-9C2605A29F52');
            this.setProps({
                format: Characteristic.Formats.FLOAT,
                unit: 'W',
                minValue: 0,
                maxValue: 100000,
                minStep: 0.1,
                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
            });
            this.value = this.getDefaultValue();
        };
        PowerConsumption.UUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52';
        require('util').inherits(PowerConsumption, Characteristic);

        const ElectricVoltage = function() {
            Characteristic.call(this, 'Voltage', 'E863F10A-079E-48FF-8F27-9C2605A29F52');
            this.setProps({
                format: Characteristic.Formats.FLOAT,
                unit: 'V',
                minValue: 0,
                maxValue: 300,
                minStep: 0.1,
                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
            });
            this.value = this.getDefaultValue();
        };
        ElectricVoltage.UUID = 'E863F10A-079E-48FF-8F27-9C2605A29F52';
        require('util').inherits(ElectricVoltage, Characteristic);

        const ElectricCurrent = function() {
            Characteristic.call(this, 'Electric Current', 'E863F126-079E-48FF-8F27-9C2605A29F52');
            this.setProps({
                format: Characteristic.Formats.FLOAT,
                unit: 'A',
                minValue: 0,
                maxValue: 1000,
                minStep: 0.01,
                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
            });
            this.value = this.getDefaultValue();
        };
        ElectricCurrent.UUID = 'E863F126-079E-48FF-8F27-9C2605A29F52';
        require('util').inherits(ElectricCurrent, Characteristic);

        const TotalConsumption = function() {
            Characteristic.call(this, 'Total Consumption', 'E863F10C-079E-48FF-8F27-9C2605A29F52');
            this.setProps({
                format: Characteristic.Formats.FLOAT,
                unit: 'kWh',
                minValue: 0,
                maxValue: 100000000,
                minStep: 0.001,
                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
            });
            this.value = this.getDefaultValue();
        };
        TotalConsumption.UUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52';
        require('util').inherits(TotalConsumption, Characteristic);

        // Add characteristics to service
        this.powerService.addCharacteristic(PowerConsumption);
        this.powerService.addCharacteristic(ElectricVoltage);
        this.powerService.addCharacteristic(ElectricCurrent);
        this.powerService.addCharacteristic(TotalConsumption);

        // Store references for later updates
        this.powerConsumptionChar = this.powerService.getCharacteristic(PowerConsumption);
        this.voltageChar = this.powerService.getCharacteristic(ElectricVoltage);
        this.currentChar = this.powerService.getCharacteristic(ElectricCurrent);
        this.totalConsumptionChar = this.powerService.getCharacteristic(TotalConsumption);
    }

    async startMonitoring() {
        try {
            // Initial authentication and data fetch
            await this.senseAPI.authenticate();
            
            // Try to get devices (non-critical)
            try {
                await this.senseAPI.getDevices();
            } catch (error) {
                this.log(`Device fetch failed, continuing: ${error.message}`);
            }
            
            // Try to get trend data (non-critical)
            try {
                await this.senseAPI.updateTrendData();
            } catch (error) {
                this.log(`Trend data fetch failed, continuing: ${error.message}`);
            }
            
            // Start WebSocket if enabled
            if (this.useWebSocket) {
                this.senseAPI.openStream();
            }
            
            // Start polling for data
            this.startPolling();
            
        } catch (error) {
            this.log(`Failed to start monitoring: ${error.message}`);
            // Retry with longer delay
            setTimeout(() => this.startMonitoring(), 120000); // Retry in 2 minutes
        }
    }

    startPolling() {
        setInterval(async () => {
            try {
                if (!this.useWebSocket) {
                    await this.senseAPI.updateRealtime();
                }
                await this.senseAPI.updateTrendData();
            } catch (error) {
                this.log(`Polling error: ${error.message}`);
                this.isOnline = false;
            }
        }, this.pollingInterval);
    }

    updateCharacteristics() {
        // Update power characteristics using stored references
        if (this.powerConsumptionChar) {
            this.powerConsumptionChar.updateValue(this.power);
        }
        if (this.voltageChar) {
            this.voltageChar.updateValue(this.voltage);
        }
        if (this.currentChar) {
            this.currentChar.updateValue(this.current);
        }
        if (this.totalConsumptionChar) {
            this.totalConsumptionChar.updateValue(this.totalConsumption);
        }
        
        // Update outlet state based on power usage
        const isOn = this.power > 10; // Consider "on" if using more than 10W
        this.powerService.updateCharacteristic(Characteristic.On, isOn);
        this.powerService.updateCharacteristic(Characteristic.OutletInUse, isOn);
    }

    addHistoryEntry() {
        if (this.historyService) {
            this.historyService.addEntry({
                time: Math.round(Date.now() / 1000),
                power: this.power,
                voltage: this.voltage,
                current: this.current
            });
        }
    }

    updateAccessoryInformation() {
        if (this.senseAPI.monitors.length > 0) {
            const monitor = this.senseAPI.monitors[0];
            this.informationService
                .setCharacteristic(Characteristic.SerialNumber, monitor.id)
                .setCharacteristic(Characteristic.Model, monitor.device_name || 'Energy Monitor');
        }
    }

    // Characteristic handlers
    getOnState(callback) {
        callback(null, this.power > 10);
    }

    setOnState(value, callback) {
        // This is read-only, but we need to provide a setter
        callback(null);
    }

    getOutletInUse(callback) {
        callback(null, this.power > 10);
    }

    getServices() {
        const services = [this.informationService, this.powerService];
        
        if (this.historyService) {
            services.push(this.historyService);
        }
        
        return services;
    }

    identify(callback) {
        this.log('Identify requested');
        callback();
    }
}