#!/usr/bin/env node

// Test script for MFA authentication with Sense API
const https = require('https');

const CONFIG = {
    email: process.env.SENSE_EMAIL || 'your@email.com',
    password: process.env.SENSE_PASSWORD || 'your_password',
    mfaCode: process.env.SENSE_MFA_CODE || '123456'
};

const API_URL = 'https://api.sense.com/apiservice/api/v1/authenticate';

function testMFAAuth() {
    console.log('Testing Sense API MFA Authentication...');
    console.log('Email:', CONFIG.email);
    console.log('MFA Code:', CONFIG.mfaCode ? CONFIG.mfaCode.replace(/./g, '*') : 'Not provided');
    
    const postData = `email=${encodeURIComponent(CONFIG.email)}&password=${encodeURIComponent(CONFIG.password)}&totp_code=${encodeURIComponent(CONFIG.mfaCode)}`;
    
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'homebridge-sense-energy-monitor/2.1.1',
            'X-Sense-Protocol': '3',
            'cache-control': 'no-cache',
            'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 30000
    };

    const req = https.request(API_URL, options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
            responseData += chunk;
        });

        res.on('end', () => {
            try {
                const parsedData = JSON.parse(responseData);
                
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log('\n✅ Authentication successful!');
                    console.log('Access Token:', parsedData.access_token ? parsedData.access_token.substring(0, 20) + '...' : 'Not received');
                    console.log('User ID:', parsedData.user_id);
                    console.log('Monitor Count:', parsedData.monitors ? parsedData.monitors.length : 0);
                } else {
                    console.error('\n❌ Authentication failed!');
                    console.error('Status Code:', res.statusCode);
                    console.error('Error:', parsedData.error_reason || 'Unknown error');
                    
                    if (parsedData.error_reason && parsedData.error_reason.includes('Multi-factor authentication required')) {
                        console.error('\n📱 MFA is required for this account.');
                        console.error('Please provide a valid TOTP code from your authenticator app.');
                        console.error('Set the SENSE_MFA_CODE environment variable or update the CONFIG in this script.');
                    }
                }
            } catch (parseError) {
                console.error('\n❌ Failed to parse response:', parseError.message);
                console.error('Raw response:', responseData);
            }
        });
    });

    req.on('error', (error) => {
        console.error('\n❌ Request failed:', error.message);
    });

    req.on('timeout', () => {
        req.destroy();
        console.error('\n❌ Request timeout after 30 seconds');
    });

    req.write(postData);
    req.end();
}

// Check if credentials are provided
if (CONFIG.email === 'your@email.com' || CONFIG.password === 'your_password') {
    console.log('Please set your Sense credentials:');
    console.log('  export SENSE_EMAIL=your@email.com');
    console.log('  export SENSE_PASSWORD=your_password');
    console.log('  export SENSE_MFA_CODE=123456  # If MFA is enabled');
    console.log('\nOr edit the CONFIG object in this script.');
    process.exit(1);
}

testMFAAuth();