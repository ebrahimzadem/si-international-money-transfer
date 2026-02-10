import * as crypto from 'crypto';
import * as bip39 from 'bip39';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generate Master Seed Script
 *
 * This script generates a secure BIP39 mnemonic (master seed) and encrypts it
 * with a strong password for the custodial wallet system.
 *
 * SECURITY WARNING: This seed controls ALL user wallets. Store securely!
 */

async function generateMasterSeed() {
  console.log('\n🔐 Si Crypto Platform - Master Seed Generator\n');
  console.log('⚠️  WARNING: This seed controls ALL user wallets!');
  console.log('⚠️  Store it securely and NEVER commit to version control!\n');

  // Generate a 256-bit mnemonic (24 words)
  const mnemonic = bip39.generateMnemonic(256);

  console.log('✅ Generated 24-word BIP39 mnemonic\n');
  console.log('📝 Master Seed Mnemonic (WRITE THIS DOWN AND STORE SECURELY):');
  console.log('─'.repeat(80));
  console.log(mnemonic);
  console.log('─'.repeat(80));
  console.log('\n⚠️  BACKUP THIS MNEMONIC IN MULTIPLE SECURE LOCATIONS!');
  console.log('   - Hardware security module (HSM)');
  console.log('   - Encrypted USB drive');
  console.log('   - Physical safe/vault');
  console.log('   - DO NOT store in cloud or email!\n');

  // Generate a strong encryption password (32 bytes = 256 bits)
  const encryptionPassword = crypto.randomBytes(32).toString('base64');

  console.log('🔑 Generated encryption password for .env file:');
  console.log('─'.repeat(80));
  console.log(encryptionPassword);
  console.log('─'.repeat(80));
  console.log('\n');

  // Encrypt the mnemonic with AES-256-GCM
  // Format matches HdWalletService: base64(iv + authTag + encrypted)
  const iv = crypto.randomBytes(16); // 128-bit IV
  const key = crypto.scryptSync(encryptionPassword, 'salt', 32); // Derive 256-bit key
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(mnemonic, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine iv + authTag + encrypted and encode as base64
  const combined = Buffer.concat([iv, authTag, encrypted]);
  const encryptedSeed = combined.toString('base64');

  // Read current .env file
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Update or add ENCRYPTED_MASTER_SEED and MASTER_SEED_PASSWORD
  const lines = envContent.split('\n');
  let hasSeed = false;
  let hasPassword = false;

  const updatedLines = lines.map(line => {
    if (line.startsWith('ENCRYPTED_MASTER_SEED=')) {
      hasSeed = true;
      return `ENCRYPTED_MASTER_SEED=${encryptedSeed}`;
    }
    if (line.startsWith('MASTER_SEED_PASSWORD=')) {
      hasPassword = true;
      return `MASTER_SEED_PASSWORD=${encryptionPassword}`;
    }
    return line;
  });

  // Add if not found
  if (!hasSeed) {
    updatedLines.push(`ENCRYPTED_MASTER_SEED=${encryptedSeed}`);
  }
  if (!hasPassword) {
    updatedLines.push(`MASTER_SEED_PASSWORD=${encryptionPassword}`);
  }

  // Write back to .env
  fs.writeFileSync(envPath, updatedLines.join('\n'));

  console.log('✅ Master seed saved to .env file (encrypted)');
  console.log('✅ Encryption password saved to .env file\n');

  console.log('📋 NEXT STEPS:');
  console.log('1. Backup the 24-word mnemonic to multiple secure locations');
  console.log('2. Restart the backend server to load the new master seed');
  console.log('3. NEVER commit .env file to version control');
  console.log('4. In production, use AWS Secrets Manager or HashiCorp Vault\n');

  console.log('🔒 Security Reminders:');
  console.log('   - Master seed = Full control of all user funds');
  console.log('   - Compromised seed = Total platform breach');
  console.log('   - Lost seed = All user funds permanently lost');
  console.log('   - Use hardware security modules (HSM) in production\n');
}

// Run the script
generateMasterSeed().catch(console.error);
