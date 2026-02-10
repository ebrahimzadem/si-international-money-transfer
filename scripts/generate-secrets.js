#!/usr/bin/env node

/**
 * Generate Production Secrets for Si Crypto Platform
 *
 * This script generates secure random secrets for production deployment.
 * Copy these values to your Railway environment variables.
 */

const crypto = require('crypto');

console.log('\n🔐 Generating Production Secrets for Si Crypto Platform\n');
console.log('=' .repeat(70));

// Generate secrets
const jwtSecret = crypto.randomBytes(64).toString('hex');
const jwtRefreshSecret = crypto.randomBytes(64).toString('hex');
const sessionSecret = crypto.randomBytes(64).toString('hex');
const masterSeedPassword = crypto.randomBytes(64).toString('base64');

console.log('\n📋 Copy these to your Railway Environment Variables:\n');
console.log('-'.repeat(70));

console.log('\n# JWT Authentication');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`JWT_REFRESH_SECRET=${jwtRefreshSecret}`);

console.log('\n# Session');
console.log(`SESSION_SECRET=${sessionSecret}`);

console.log('\n# Master Seed Password (CRITICAL - Save this securely!)');
console.log(`MASTER_SEED_PASSWORD=${masterSeedPassword}`);

console.log('\n' + '-'.repeat(70));

console.log('\n⚠️  IMPORTANT SECURITY NOTES:\n');
console.log('1. NEVER commit these secrets to Git');
console.log('2. Save MASTER_SEED_PASSWORD in a secure password manager');
console.log('3. If you lose MASTER_SEED_PASSWORD, you lose access to all wallets');
console.log('4. Rotate JWT secrets every 90 days');
console.log('5. Use different secrets for staging and production\n');

console.log('=' .repeat(70));

console.log('\n✅ Next Steps:\n');
console.log('1. Copy secrets above to Railway dashboard');
console.log('2. Sign up for required services:');
console.log('   - Infura: https://www.infura.io/');
console.log('   - Resend: https://resend.com/');
console.log('   - Firebase: https://console.firebase.google.com/');
console.log('3. Deploy using Railway or DigitalOcean');
console.log('4. Read full deployment guide: DEPLOYMENT.md\n');

console.log('🚀 Ready to deploy Si Crypto Platform!\n');
