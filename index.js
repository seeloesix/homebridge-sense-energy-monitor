// Enhanced Homebridge Sense Energy Monitor Plugin
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
        console.warn('[homebridge-sense-energy-monitor] FakeGato History Service not available');
    }
    
    homebridge.registerAccessory("homebridge-sense-energy-monitor", "SensePowerMeter", SensePowerMeterAccessory);
    homebridge.registerPlatform("homebridge-sense-energy-monitor", "SensePowerMeter", SensePowerMeterPlatform);
};

class SenseAPI extends EventEmitter {
    constructor(username, password, monitor_id = null, verbose = false) {
        super();
        this.username = username;
        this.password = password;
        this.monitor_id = monitor_id;
        this.verbose = verbose;
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
        this.active_devices = [];
    }

    log(message) {
        if (this.verbose) {
            const now = new Date();
            const timestamp = now.toLocaleDateString('en-GB') + ', ' + now.toLocaleTimeString('en-GB');
            console.log(`[${timestamp}] [SenseAPI] ${message}`);
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
                this.log(`Error fetching devices: ${error.message}`);
                this.devices = [];
                return this.devices;
            }
        }
    }

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
            this.ws_reconnect_delay = 30000;
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
    }

    handleWebSocketData(data) {
        if (data.payload) {
            this.active_power = data.payload.w || data.payload.d_w || 0;
            this.active_solar_power = 0;
            this.active_voltage = data.payload.voltage || [120];
            this.active_frequency = data.payload.hz || 60;
            
            this.active_devices = [];
            if (data.payload.devices) {
                this.active_devices = data.payload.devices
                    .filter(device => device.w && device.w > 5)
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
        
        if (!config.username || !config.password) {
            throw new Error('Username and password are required');
        }
        
        this.username = config.username;
        this.password = config.password;
        this.monitor_id = config.monitor_id || null;
        this.pollingInterval = (config.pollingInterval || 60) * 1000;
        this.deviceLoggingInterval = (config.deviceLoggingInterval || 2) * 60 * 1000;
        this.useWebSocket = config.useWebSocket !== false;
        this.includeSolar = config.includeSolar !== false;
        this.useSolar = config.useSolar !== false;
        this.includeDevices = config.includeDevices !== false;
        this.verbose = config.verbose || false;
        this.solarEnabled = this.includeSolar && this.useSolar;
        this.power = 0;
        this.solarPower = 0;
        this.voltage = 120;
        this.current = 0;
        this.totalConsumption = 0;
        this.dailyConsumption = 0;
        this.isOnline = false;
        this.pollingTimer = null;
        this.deviceLoggingTimer = null;
        this.lastLogTime = 0;
        
        this.senseAPI = new SenseAPI(this.username, this.password, this.monitor_id, this.verbose);
        this.setupEventListeners();
        this.setupServices();
        this.startMonitoring();
    }

    setupEventListeners() {
        this.senseAPI.on('authenticated', () => {
            this.log('Sense API authenticated successfully');
            this.isOnline = true;
        });

        this.senseAPI.on('data', (data) => {
            this.power = Math.round(data.power || 0);
            this.solarPower = this.solarEnabled ? Math.round(data.solar_power || 0) : 0;
            this.voltage = data.voltage && data.voltage.length > 0 ? Math.round(data.voltage[0]) : 120;
            this.current = this.voltage > 0 ? Math.round((this.power / this.voltage) * 100) / 100 : 0;
            
            this.updateCharacteristics();
            this.addHistoryEntry();
            
            const now = Date.now();
            if (!this.lastLogTime || (now - this.lastLogTime) > 30000) {
                this.lastLogTime = now;
                const timestamp = new Date().toLocaleDateString('en-GB') + ', ' + new Date().toLocaleTimeString('en-GB');
                console.log(`[${timestamp}] [SenseAPI] Power: ${this.power}W, Active devices: ${data.devices.length}`);
            }
        });

        this.senseAPI.on('websocket_error', (error) => {
            this.log(`WebSocket error: ${error.message}`);
            this.isOnline = false;
        });
    }

    setupServices() {
        this.informationService = new Service.AccessoryInformation();
        this.informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Sense Labs')
            .setCharacteristic(Characteristic.Model, 'Energy Monitor')
            .setCharacteristic(Characteristic.SerialNumber, this.monitor_id || 'Unknown')
            .setCharacteristic(Characteristic.FirmwareRevision, '1.0.0');

        this.powerService = new Service.Outlet(this.name);
        this.powerService
            .getCharacteristic(Characteristic.On)
            .on('get', this.getOnState.bind(this))
            .on('set', this.setOnState.bind(this));

        this.powerService
            .getCharacteristic(Characteristic.OutletInUse)
            .on('get', this.getOutletInUse.bind(this));

        if (FakeGatoHistoryService) {
            this.historyService = new FakeGatoHistoryService('energy', this, {
                storage: 'fs'
            });
        }
    }

    async startMonitoring() {
        try {
            await this.senseAPI.authenticate();
            
            try {
                await this.senseAPI.getDevices();
            } catch (error) {
                this.log(`Device fetch failed, continuing: ${error.message}`);
            }
            
            if (this.useWebSocket) {
                this.senseAPI.openStream();
            }
            
        } catch (error) {
            this.log(`Failed to start monitoring: ${error.message}`);
            setTimeout(() => this.startMonitoring(), 120000);
        }
    }

    updateCharacteristics() {
        const isOn = this.power > 10;
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

    getOnState(callback) {
        callback(null, this.power > 10);
    }

    setOnState(value, callback) {
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

class SensePowerMeterPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.accessories = [];
        
        this.log('Initializing Sense Energy Monitor Platform...');
        
        if (this.api) {
            this.api.on('didFinishLaunching', () => {
                this.log('Platform finished launching, creating accessories...');
                this.createAccessories();
            });
        }
    }

    createAccessories() {
        const mainConfig = {
            ...this.config,
            name: this.config.name || 'Sense Energy Monitor',
            accessory: 'SensePowerMeter'
        };
        
        try {
            const mainAccessory = new SensePowerMeterAccessory(this.log, mainConfig);
            this.accessories.push(mainAccessory);
            this.log('Created main energy monitor accessory');
        } catch (error) {
            this.log('Error creating accessories:', error.message);
        }
    }

    configureAccessory(accessory) {
        this.log('Loading accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }

    accessories(callback) {
        callback(this.accessories);
    }
}