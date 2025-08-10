#!/usr/bin/env node

// Test script for TOTP code generation
const crypto = require('crypto');

function generateTOTPCode(secret) {
    // Remove spaces and make uppercase
    const cleanSecret = secret.replace(/\s/g, '').toUpperCase();
    
    // Base32 decode
    const base32Decode = (encoded) => {
        const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let bits = '';
        let hex = '';
        
        for (let i = 0; i < encoded.length; i++) {
            const val = base32chars.indexOf(encoded.charAt(i));
            if (val === -1) continue;
            bits += val.toString(2).padStart(5, '0');
        }
        
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            const chunk = bits.substring(i, i + 8);
            hex += parseInt(chunk, 2).toString(16).padStart(2, '0');
        }
        
        return Buffer.from(hex, 'hex');
    };
    
    const key = base32Decode(cleanSecret);
    
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
    
    return code;
}

// Test the function
const testSecret = process.argv[2];

if (!testSecret) {
    console.log('Usage: node test-totp.js YOUR_BASE32_SECRET');
    console.log('Example: node test-totp.js JBSWY3DPEHPK3PXP');
    process.exit(1);
}

try {
    const code = generateTOTPCode(testSecret);
    console.log(`Generated TOTP code: ${code}`);
    console.log(`Time remaining: ${30 - (Math.floor(Date.now() / 1000) % 30)} seconds`);
    console.log('\nCompare this with your authenticator app to verify it matches.');
} catch (error) {
    console.error('Error generating TOTP code:', error.message);
    process.exit(1);
}