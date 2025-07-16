// Test Integration Script for Sense API
// Run with: node test-integration.js

const { SenseAPI } = require('./index.js');

class SenseAPITester {
    constructor(username, password) {
        this.senseAPI = new SenseAPI(username, password, null, true);
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.senseAPI.on('authenticated', () => {
            console.log('✅ Authentication successful');
            this.runTests();
        });

        this.senseAPI.on('data', (data) => {
            console.log('📊 Real-time data received:', {
                power: `${data.power}W`,
                solar: `${data.solar_power}W`,
                voltage: `${data.voltage[0] || 0}V`,
                devices: data.devices.length
            });
        });

        this.senseAPI.on('realtime_update', () => {
            console.log('🔄 Realtime data updated');
        });

        this.senseAPI.on('trend_update', () => {
            console.log('📈 Trend data updated');
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
    }

    async runTests() {
        console.log('\n🧪 Starting comprehensive API tests...\n');

        try {
            // Test 1: Get monitor information
            console.log('Test 1: Getting monitor information...');
            const monitorInfo = await this.senseAPI.getMonitorInfo();
            console.log('✅ Monitor info:', {
                id: monitorInfo.id,
                name: monitorInfo.device_name || 'Unknown',
                timezone: monitorInfo.time_zone
            });

            // Test 2: Get devices
            console.log('\nTest 2: Getting detected devices...');
            const devices = await this.senseAPI.getDevices();
            console.log(`✅ Found ${devices.length} devices`);
            devices.slice(0, 5).forEach(device => {
                console.log(`  - ${device.name} (${device.type || 'Unknown type'})`);
            });

            // Test 3: Update real-time data
            console.log('\nTest 3: Updating real-time data...');
            await this.senseAPI.updateRealtime();
            console.log('✅ Real-time data:', {
                power: `${this.senseAPI.active_power}W`,
                solar: `${this.senseAPI.active_solar_power}W`,
                voltage: this.senseAPI.active_voltage.map(v => `${v}V`).join(', '),
                frequency: `${this.senseAPI.active_frequency}Hz`,
                activeDevices: this.senseAPI.active_devices.length
            });

            // Test 4: Update trend data
            console.log('\nTest 4: Updating trend data...');
            await this.senseAPI.updateTrendData();
            console.log('✅ Trend data:', {
                dailyUsage: `${this.senseAPI.daily_usage} kWh`,
                dailyProduction: `${this.senseAPI.daily_production} kWh`,
                weeklyUsage: `${this.senseAPI.weekly_usage} kWh`,
                monthlyUsage: `${this.senseAPI.monthly_usage} kWh`
            });

            // Test 5: Get usage data for last 7 days
            console.log('\nTest 5: Getting usage data for last 7 days...');
            const endDate = new Date().toISOString();
            const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const usageData = await this.senseAPI.getUsageData(startDate, endDate, 'DAY');
            console.log('✅ Usage data retrieved for 7 days');

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
        console.log(`Active devices: ${this.senseAPI.active_devices.join(', ') || 'None'}`);
        console.log('\n✅ All tests completed successfully!');
        
        process.exit(0);
    }

    async start() {
        try {
            await this.senseAPI.authenticate();
        } catch (error) {
            console.error('❌ Authentication failed:', error.message);
            process.exit(1);
        }
    }
}

// Main execution
if (require.main === module) {
    const username = process.env.SENSE_USERNAME || process.argv[2];
    const password = process.env.SENSE_PASSWORD || process.argv[3];

    if (!username || !password) {
        console.error('Usage: node test-integration.js <username> <password>');
        console.error('Or set SENSE_USERNAME and SENSE_PASSWORD environment variables');
        process.exit(1);
    }

    console.log('🚀 Starting Sense API Integration Test');
    console.log('=====================================');
    
    const tester = new SenseAPITester(username, password);
    tester.start();
}

module.exports = { SenseAPITester };