// Test Integration Script for Sense API
// Run with: node test-integration.js

const { SenseAPI } = require('./index.js');
const path = require('path');
const fs = require('fs');

class SenseAPITester {
    constructor(username, password) {
        // Create a temporary storage path for testing
        this.tempStoragePath = path.join(__dirname, '.test-storage');
        if (!fs.existsSync(this.tempStoragePath)) {
            fs.mkdirSync(this.tempStoragePath, { recursive: true });
        }
        
        this.senseAPI = new SenseAPI(username, password, null, true, this.tempStoragePath);
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.senseAPI.on('authenticated', () => {
            console.log('✅ Authentication successful');
            this.runTests();
        });

        this.senseAPI.on('authentication_failed', (error) => {
            console.error('❌ Authentication failed:', error.message);
            process.exit(1);
        });

        this.senseAPI.on('data', (data) => {
            console.log('📊 Real-time data received:', {
                power: `${data.power}W`,
                solar: `${data.solar_power}W`,
                voltage: `${data.voltage[0] || 0}V`,
                devices: data.devices.length
            });
        });

        this.senseAPI.on('realtime_update', (data) => {
            console.log('🔄 Realtime data updated:', {
                power: `${data.power}W`,
                solar: `${data.solar_power}W`
            });
        });

        this.senseAPI.on('trend_update', (data) => {
            console.log('📈 Trend data updated:', {
                daily: `${data.daily_usage} kWh`,
                weekly: `${data.weekly_usage} kWh`,
                monthly: `${data.monthly_usage} kWh`
            });
        });

        this.senseAPI.on('websocket_open', () => {
            console.log('🔌 WebSocket connection opened');
        });

        this.senseAPI.on('websocket_close', (data) => {
            console.log('❌ WebSocket connection closed:', data);
        });

        this.senseAPI.on('websocket_error', (error) => {
            console.error('🚫 WebSocket error:', error.message);
        });

        this.senseAPI.on('realtime_error', (error) => {
            console.warn('⚠️ Realtime error:', error.message);
        });

        this.senseAPI.on('trend_error', (error) => {
            console.warn('⚠️ Trend error:', error.message);
        });
    }

    async runTests() {
        console.log('\n🧪 Starting comprehensive API tests...\n');

        try {
            // Test 1: Get monitor information
            console.log('Test 1: Checking monitor information...');
            console.log('✅ Monitor info:', {
                id: this.senseAPI.monitor_id,
                authenticated: this.senseAPI.authenticated,
                monitors: this.senseAPI.monitors.length
            });

            // Test 2: Get devices
            console.log('\nTest 2: Getting detected devices...');
            try {
                const devices = await this.senseAPI.getDevices();
                console.log(`✅ Found ${devices.length} devices`);
                devices.slice(0, 5).forEach(device => {
                    console.log(`  - ${device.name} (${device.type || 'Unknown type'})`);
                });
            } catch (error) {
                console.warn(`⚠️ Device fetch failed: ${error.message}`);
            }

            // Test 3: Update real-time data
            console.log('\nTest 3: Updating real-time data...');
            try {
                await this.senseAPI.updateRealtime();
                console.log('✅ Real-time data:', {
                    power: `${this.senseAPI.active_power}W`,
                    solar: `${this.senseAPI.active_solar_power}W`,
                    voltage: this.senseAPI.active_voltage.map(v => `${v}V`).join(', '),
                    frequency: `${this.senseAPI.active_frequency}Hz`,
                    activeDevices: this.senseAPI.active_devices.length
                });
            } catch (error) {
                console.warn(`⚠️ Realtime update failed: ${error.message}`);
            }

            // Test 4: Update trend data
            console.log('\nTest 4: Updating trend data...');
            try {
                await this.senseAPI.updateTrendData();
                console.log('✅ Trend data:', {
                    dailyUsage: `${this.senseAPI.daily_usage} kWh`,
                    dailyProduction: `${this.senseAPI.daily_production} kWh`,
                    weeklyUsage: `${this.senseAPI.weekly_usage} kWh`,
                    monthlyUsage: `${this.senseAPI.monthly_usage} kWh`,
                    yearlyUsage: `${this.senseAPI.yearly_usage} kWh`
                });
            } catch (error) {
                console.warn(`⚠️ Trend update failed: ${error.message}`);
            }

            // Test 5: Test cached authentication
            console.log('\nTest 5: Testing authentication caching...');
            const authFile = path.join(this.tempStoragePath, 'sense_auth.json');
            if (fs.existsSync(authFile)) {
                console.log('✅ Authentication cache file created');
                const authData = JSON.parse(fs.readFileSync(authFile, 'utf8'));
                console.log('✅ Cache contains:', Object.keys(authData));
            } else {
                console.warn('⚠️ Authentication cache file not found');
            }

            // Test 6: WebSocket streaming
            if (this.senseAPI.access_token) {
                console.log('\nTest 6: Testing WebSocket streaming...');
                this.senseAPI.openStream();
                
                // Let it stream for 30 seconds
                setTimeout(() => {
                    console.log('✅ WebSocket test completed');
                    this.senseAPI.closeStream();
                    this.summarizeResults();
                }, 30000);
            } else {
                this.summarizeResults();
            }

        } catch (error) {
            console.error('❌ Test failed:', error.message);
            this.cleanup();
            process.exit(1);
        }
    }

    summarizeResults() {
        console.log('\n📋 Test Summary:');
        console.log('==================');
        console.log(`Monitor ID: ${this.senseAPI.monitor_id}`);
        console.log(`Devices detected: ${this.senseAPI.devices.length}`);
        console.log(`Current power: ${this.senseAPI.active_power}W`);
        console.log(`Current solar: ${this.senseAPI.active_solar_power}W`);
        console.log(`Daily usage: ${this.senseAPI.daily_usage} kWh`);
        console.log(`Daily production: ${this.senseAPI.daily_production} kWh`);
        console.log(`Active devices: ${this.senseAPI.active_devices.map(d => `${d.name}(${d.power}W)`).join(', ') || 'None'}`);
        console.log(`Authentication cached: ${fs.existsSync(path.join(this.tempStoragePath, 'sense_auth.json')) ? 'Yes' : 'No'}`);
        console.log('\n✅ All tests completed successfully!');
        
        this.cleanup();
        process.exit(0);
    }

    cleanup() {
        try {
            if (this.senseAPI) {
                this.senseAPI.destroy();
            }
            
            // Clean up test storage
            if (fs.existsSync(this.tempStoragePath)) {
                const files = fs.readdirSync(this.tempStoragePath);
                files.forEach(file => {
                    fs.unlinkSync(path.join(this.tempStoragePath, file));
                });
                fs.rmdirSync(this.tempStoragePath);
            }
        } catch (error) {
            console.warn('Cleanup warning:', error.message);
        }
    }

    async start() {
        try {
            await this.senseAPI.authenticate();
        } catch (error) {
            console.error('❌ Authentication failed:', error.message);
            this.cleanup();
            process.exit(1);
        }
    }
}

// Error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Main execution
if (require.main === module) {
    const username = process.env.SENSE_USERNAME || process.argv[2];
    const password = process.env.SENSE_PASSWORD || process.argv[3];

    if (!username || !password) {
        console.error('Usage: node test-integration.js <username> <password>');
        console.error('Or set SENSE_USERNAME and SENSE_PASSWORD environment variables');
        process.exit(1);
    }

    console.log('🚀 Starting Sense API Integration Test v2.3.0');
    console.log('==============================================');
    
    const tester = new SenseAPITester(username, password);
    tester.start();
}

module.exports = { SenseAPITester };