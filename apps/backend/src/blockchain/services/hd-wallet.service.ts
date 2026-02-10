import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as crypto from 'crypto';

const bip32 = BIP32Factory(ecc);

/**
 * HD Wallet Service
 * Generates deterministic wallets using BIP39/BIP44
 *
 * Security:
 * - Master seed encrypted with AES-256-GCM
 * - Private keys derived on-demand (never stored)
 * - Supports Bitcoin (m/44'/0'/0'/0/{index}) and Ethereum (m/44'/60'/0'/0/{index})
 */
@Injectable()
export class HdWalletService {
  private readonly logger = new Logger(HdWalletService.name);
  private encryptedMasterSeed: string | null = null;
  private readonly algorithm = 'aes-256-gcm';

  constructor(private configService: ConfigService) {
    this.initializeMasterSeed();
  }

  /**
   * Initialize or load encrypted master seed
   */
  private async initializeMasterSeed() {
    const existingSeed = this.configService.get<string>('ENCRYPTED_MASTER_SEED');

    if (existingSeed && existingSeed !== 'will-be-generated-on-first-wallet-creation') {
      this.encryptedMasterSeed = existingSeed;
      this.logger.log('Loaded existing encrypted master seed');
    } else {
      this.logger.warn('No master seed found - will generate on first wallet creation');
    }
  }

  /**
   * Generate new master seed (only called once during setup)
   */
  async generateMasterSeed(): Promise<{ encryptedSeed: string; mnemonic: string }> {
    if (this.encryptedMasterSeed) {
      throw new Error('Master seed already exists');
    }

    // Generate 24-word mnemonic (256 bits of entropy)
    const mnemonic = bip39.generateMnemonic(256);
    const seed = await bip39.mnemonicToSeed(mnemonic);

    // Encrypt the seed
    const password = this.configService.get<string>('MASTER_SEED_PASSWORD');
    if (!password) {
      throw new Error('MASTER_SEED_PASSWORD not configured');
    }

    const encryptedSeed = this.encryptSeed(seed, password);
    this.encryptedMasterSeed = encryptedSeed;

    this.logger.log('Generated new master seed');

    return {
      encryptedSeed,
      mnemonic, // IMPORTANT: Save this offline in a secure location!
    };
  }

  /**
   * Derive Bitcoin address for user
   * Path: m/44'/0'/0'/0/{userId}
   */
  async deriveBitcoinAddress(userId: number): Promise<{ address: string; derivationPath: string }> {
    const seed = await this.decryptMasterSeed();
    const root = bip32.fromSeed(seed);

    // BIP44 path for Bitcoin: m/44'/0'/0'/0/{userId}
    const path = `m/44'/0'/0'/0/${userId}`;
    const child = root.derivePath(path);

    if (!child.publicKey) {
      throw new Error('Failed to derive public key');
    }

    // For testnet, we'll use a simple base58 encoding
    // In production, use proper address generation based on network
    const bitcoin = await import('bitcoinjs-lib');
    const network = this.configService.get<boolean>('TESTNET_MODE')
      ? bitcoin.networks.testnet
      : bitcoin.networks.bitcoin;

    const { address } = bitcoin.payments.p2wpkh({
      pubkey: child.publicKey,
      network,
    });

    if (!address) {
      throw new Error('Failed to generate Bitcoin address');
    }

    return {
      address,
      derivationPath: path,
    };
  }

  /**
   * Derive Ethereum address for user
   * Path: m/44'/60'/0'/0/{userId}
   */
  async deriveEthereumAddress(userId: number): Promise<{ address: string; derivationPath: string }> {
    const seed = await this.decryptMasterSeed();
    const root = bip32.fromSeed(seed);

    // BIP44 path for Ethereum: m/44'/60'/0'/0/{userId}
    const path = `m/44'/60'/0'/0/${userId}`;
    const child = root.derivePath(path);

    if (!child.privateKey) {
      throw new Error('Failed to derive private key');
    }

    // Generate Ethereum address from private key
    const ethers = await import('ethers');
    const wallet = new ethers.Wallet('0x' + Buffer.from(child.privateKey).toString('hex'));

    return {
      address: wallet.address,
      derivationPath: path,
    };
  }

  /**
   * Get private key for signing transactions
   * WARNING: Private key is returned in memory only - never store!
   */
  async getPrivateKey(derivationPath: string): Promise<Buffer> {
    const seed = await this.decryptMasterSeed();
    const root = bip32.fromSeed(seed);
    const child = root.derivePath(derivationPath);

    if (!child.privateKey) {
      throw new Error('Failed to derive private key');
    }

    return Buffer.from(child.privateKey);
  }

  /**
   * Encrypt seed with AES-256-GCM
   */
  private encryptSeed(seed: Buffer, password: string): string {
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    const encrypted = Buffer.concat([cipher.update(seed), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Combine iv + authTag + encrypted
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  /**
   * Decrypt master seed
   */
  private async decryptMasterSeed(): Promise<Buffer> {
    if (!this.encryptedMasterSeed) {
      throw new Error('Master seed not initialized');
    }

    const password = this.configService.get<string>('MASTER_SEED_PASSWORD');
    if (!password) {
      throw new Error('MASTER_SEED_PASSWORD not configured');
    }

    const combined = Buffer.from(this.encryptedMasterSeed, 'base64');
    const iv = combined.subarray(0, 16);
    const authTag = combined.subarray(16, 32);
    const encrypted = combined.subarray(32);

    const key = crypto.scryptSync(password, 'salt', 32);
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted;
  }

  /**
   * Validate mnemonic phrase
   */
  validateMnemonic(mnemonic: string): boolean {
    return bip39.validateMnemonic(mnemonic);
  }

  /**
   * Health check - verify encryption/decryption works
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.encryptedMasterSeed) {
        return false;
      }
      await this.decryptMasterSeed();
      return true;
    } catch (error) {
      this.logger.error('HD Wallet health check failed', error);
      return false;
    }
  }
}
