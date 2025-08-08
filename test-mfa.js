#!/usr/bin/env node

// Test script for MFA authentication with Sense API (Two-Step Flow)
const https = require('https');

const CONFIG = {
    email: process.env.SENSE_EMAIL || 'your@email.com',
    password: process.env.SENSE_PASSWORD || 'your_password',
    mfaCode: process.env.SENSE_MFA_CODE || '123456'
};

const API_URL_AUTH = 'https://api.sense.com/apiservice/api/v1/authenticate';
const API_URL_MFA = 'https://api.sense.com/apiservice/api/v1/authenticate/mfa';

function makeRequest(url, postData) {
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'homebridge-sense-energy-monitor/2.3.2',
            'X-Sense-Protocol': '3',
            'cache-control': 'no-cache',
            'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 30000
    };

    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    resolve({ statusCode: res.statusCode, data: parsedData });
                } catch (parseError) {
                    reject(new Error(`Failed to parse response: ${parseError.message}. Raw: ${responseData}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout after 30 seconds'));
        });

        req.write(postData);
        req.end();
    });
}

async function testMFAAuth() {
    console.log('Testing Sense API MFA Authentication (Two-Step Flow)...');
    console.log('Email:', CONFIG.email);
    console.log('MFA Code:', CONFIG.mfaCode ? CONFIG.mfaCode.replace(/./g, '*') : 'Not provided');
    
    try {
        // Step 1: Initial authentication
        console.log('\n🔐 Step 1: Initial authentication...');
        const authData = `email=${encodeURIComponent(CONFIG.email)}&password=${encodeURIComponent(CONFIG.password)}`;
        const authResponse = await makeRequest(API_URL_AUTH, authData);
        
        if (authResponse.statusCode === 200 && authResponse.data.authorized) {
            console.log('✅ Direct authentication successful (no MFA required)!');
            console.log('Access Token:', authResponse.data.access_token.substring(0, 20) + '...');
            console.log('User ID:', authResponse.data.user_id);
            console.log('Monitor Count:', authResponse.data.monitors ? authResponse.data.monitors.length : 0);
            return;
        }
        
        if (authResponse.statusCode === 401 && authResponse.data.status === 'mfa_required') {
            console.log('📱 MFA required, proceeding to step 2...');
            console.log('MFA Token received:', authResponse.data.mfa_token.substring(0, 10) + '...');
            
            // Step 2: MFA validation
            console.log('\n🔐 Step 2: MFA validation...');
            const mfaData = `mfa_token=${encodeURIComponent(authResponse.data.mfa_token)}&totp=${encodeURIComponent(CONFIG.mfaCode)}`;
            const mfaResponse = await makeRequest(API_URL_MFA, mfaData);
            
            if (mfaResponse.statusCode === 200 && mfaResponse.data.authorized) {
                console.log('✅ MFA authentication successful!');
                console.log('Access Token:', mfaResponse.data.access_token.substring(0, 20) + '...');
                console.log('User ID:', mfaResponse.data.user_id);
                console.log('Monitor Count:', mfaResponse.data.monitors ? mfaResponse.data.monitors.length : 0);
                return;
            } else {
                console.error('❌ MFA validation failed!');
                console.error('Status Code:', mfaResponse.statusCode);
                console.error('Error:', mfaResponse.data.error_reason || 'Unknown error');
                console.error('💡 Check that your TOTP code is current and valid.');
            }
        } else {
            console.error('❌ Unexpected authentication response!');
            console.error('Status Code:', authResponse.statusCode);
            console.error('Response:', authResponse.data);
        }
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    }
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