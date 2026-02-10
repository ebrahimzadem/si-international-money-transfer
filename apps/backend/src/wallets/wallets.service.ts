import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { BitcoinService } from '../blockchain/services/bitcoin.service';
import { EthereumService } from '../blockchain/services/ethereum.service';

export interface Wallet {
  id: string;
  userId: string;
  chain: 'bitcoin' | 'ethereum';
  address: string;
  derivationPath: string;
  createdAt: Date;
}

export interface WalletBalance {
  token: 'BTC' | 'ETH' | 'USDC' | 'USDT';
  balance: string;
  balanceUsd: number;
  address: string;
}

/**
 * Wallets Service
 * Manages user crypto wallets and balances
 */
@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);
  private pool: Pool;

  constructor(
    private configService: ConfigService,
    private bitcoinService: BitcoinService,
    private ethereumService: EthereumService,
  ) {
    // Initialize PostgreSQL connection pool
    this.pool = new Pool({
      host: this.configService.get<string>('DATABASE_HOST'),
      port: this.configService.get<number>('DATABASE_PORT'),
      user: this.configService.get<string>('DATABASE_USER'),
      password: this.configService.get<string>('DATABASE_PASSWORD'),
      database: this.configService.get<string>('DATABASE_NAME'),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.logger.log('Wallets Service initialized');
  }

  /**
   * Create wallets for new user (BTC + ETH)
   */
  async createWalletsForUser(userId: string): Promise<Wallet[]> {
    try {
      // Check if user already has wallets
      const existing = await this.findByUserId(userId);
      if (existing.length > 0) {
        throw new ConflictException('User already has wallets');
      }

      // Generate Bitcoin wallet
      const btcWallet = await this.bitcoinService.generateAddress(parseInt(userId));

      // Generate Ethereum wallet (used for ETH, USDC, USDT)
      const ethWallet = await this.ethereumService.generateAddress(parseInt(userId));

      // Save to database
      const query = `
        INSERT INTO wallets (user_id, chain, address, derivation_path)
        VALUES
          ($1, 'bitcoin', $2, $3),
          ($1, 'ethereum', $4, $5)
        RETURNING id, user_id as "userId", chain, address, derivation_path as "derivationPath", created_at as "createdAt"
      `;

      const values = [
        userId,
        btcWallet.address,
        btcWallet.derivationPath,
        ethWallet.address,
        ethWallet.derivationPath,
      ];

      const result = await this.pool.query(query, values);

      this.logger.log(`Created wallets for user ${userId}`);

      return result.rows;
    } catch (error) {
      this.logger.error(`Failed to create wallets: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all wallets for a user
   */
  async findByUserId(userId: string): Promise<Wallet[]> {
    const query = `
      SELECT id, user_id as "userId", chain, address, derivation_path as "derivationPath", created_at as "createdAt"
      FROM wallets
      WHERE user_id = $1
      ORDER BY chain
    `;

    try {
      const result = await this.pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      this.logger.error(`Failed to find wallets: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get wallet by chain for user
   */
  async findByUserIdAndChain(userId: string, chain: 'bitcoin' | 'ethereum'): Promise<Wallet | null> {
    const query = `
      SELECT id, user_id as "userId", chain, address, derivation_path as "derivationPath", created_at as "createdAt"
      FROM wallets
      WHERE user_id = $1 AND chain = $2
    `;

    try {
      const result = await this.pool.query(query, [userId, chain]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error(`Failed to find wallet: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all balances for user
   */
  async getBalances(userId: string): Promise<WalletBalance[]> {
    try {
      // Get user's wallets
      const wallets = await this.findByUserId(userId);

      if (wallets.length === 0) {
        // Auto-create wallets if they don't exist
        await this.createWalletsForUser(userId);
        return this.getBalances(userId); // Recursive call after creation
      }

      const balances: WalletBalance[] = [];

      // Get Bitcoin wallet and balance
      const btcWallet = wallets.find(w => w.chain === 'bitcoin');
      if (btcWallet) {
        const btcBalance = await this.bitcoinService.getBalance(btcWallet.address);
        balances.push({
          token: 'BTC',
          balance: this.bitcoinService.satoshisToBtc(btcBalance.total).toString(),
          balanceUsd: 0, // TODO: Get price from CoinGecko
          address: btcWallet.address,
        });
      }

      // Get Ethereum wallet and balances (ETH, USDC, USDT)
      const ethWallet = wallets.find(w => w.chain === 'ethereum');
      if (ethWallet) {
        // ETH balance
        const ethBalance = await this.ethereumService.getEthBalance(ethWallet.address);
        balances.push({
          token: 'ETH',
          balance: ethBalance.eth,
          balanceUsd: 0, // TODO: Get price from CoinGecko
          address: ethWallet.address,
        });

        // USDC balance
        const usdcBalance = await this.ethereumService.getUsdcBalance(ethWallet.address);
        balances.push({
          token: 'USDC',
          balance: usdcBalance.formatted,
          balanceUsd: parseFloat(usdcBalance.formatted), // USDC is $1
          address: ethWallet.address,
        });

        // USDT balance
        const usdtBalance = await this.ethereumService.getUsdtBalance(ethWallet.address);
        balances.push({
          token: 'USDT',
          balance: usdtBalance.formatted,
          balanceUsd: parseFloat(usdtBalance.formatted), // USDT is ~$1
          address: ethWallet.address,
        });
      }

      return balances;
    } catch (error) {
      this.logger.error(`Failed to get balances: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get balance for specific token
   */
  async getBalanceByToken(userId: string, token: 'BTC' | 'ETH' | 'USDC' | 'USDT'): Promise<WalletBalance> {
    const balances = await this.getBalances(userId);
    const balance = balances.find(b => b.token === token);

    if (!balance) {
      throw new NotFoundException(`Wallet not found for token ${token}`);
    }

    return balance;
  }

  /**
   * Close database connection (cleanup)
   */
  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log('Wallets Service connection pool closed');
  }
}
