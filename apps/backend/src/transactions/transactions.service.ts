import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { BitcoinService } from '../blockchain/services/bitcoin.service';
import { EthereumService } from '../blockchain/services/ethereum.service';
import { WalletsService } from '../wallets/wallets.service';
import { SendTransactionDto } from './dto/send-transaction.dto';

export interface Transaction {
  id: string;
  userId: string;
  token: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: Date;
}

/**
 * Transactions Service
 * Handles sending crypto and transaction history
 */
@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  private pool: Pool;

  constructor(
    private configService: ConfigService,
    private bitcoinService: BitcoinService,
    private ethereumService: EthereumService,
    private walletsService: WalletsService,
  ) {
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

    this.logger.log('Transactions Service initialized');
  }

  /**
   * Send cryptocurrency
   */
  async sendTransaction(userId: string, dto: SendTransactionDto): Promise<Transaction> {
    const { token, toAddress, amount } = dto;

    // Validate amount
    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    // Get user's wallet for this token
    const chain = token === 'BTC' ? 'bitcoin' : 'ethereum';
    const wallet = await this.walletsService.findByUserIdAndChain(userId, chain);

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Validate address
    const isValidAddress = this.validateAddress(token, toAddress);
    if (!isValidAddress) {
      throw new BadRequestException('Invalid recipient address');
    }

    // Check balance
    const balance = await this.walletsService.getBalanceByToken(userId, token);
    const balanceFloat = parseFloat(balance.balance);

    if (balanceFloat < amountFloat) {
      throw new BadRequestException('Insufficient balance');
    }

    // Send transaction based on token
    let txHash: string;
    let gasUsed = '0';

    try {
      switch (token) {
        case 'BTC':
          const btcTx = await this.bitcoinService.sendTransaction(
            wallet.address,
            wallet.derivationPath,
            toAddress,
            this.bitcoinService.btcToSatoshis(amountFloat),
          );
          txHash = btcTx.txid;
          break;

        case 'ETH':
          const ethTx = await this.ethereumService.sendEth(wallet.derivationPath, toAddress, amount);
          txHash = ethTx.txHash;
          gasUsed = ethTx.gasUsed;
          break;

        case 'USDC':
          const usdcTx = await this.ethereumService.sendUsdc(wallet.derivationPath, toAddress, amount);
          txHash = usdcTx.txHash;
          gasUsed = usdcTx.gasUsed;
          break;

        case 'USDT':
          const usdtTx = await this.ethereumService.sendUsdt(wallet.derivationPath, toAddress, amount);
          txHash = usdtTx.txHash;
          gasUsed = usdtTx.gasUsed;
          break;

        default:
          throw new BadRequestException('Unsupported token');
      }

      // Save transaction to database
      const transaction = await this.saveTransaction({
        userId,
        token,
        fromAddress: wallet.address,
        toAddress,
        amount,
        txHash,
        status: 'pending',
      });

      this.logger.log(`Transaction sent: ${txHash} (${token})`);

      return transaction;
    } catch (error) {
      this.logger.error(`Failed to send transaction: ${error.message}`);
      throw new BadRequestException(`Failed to send transaction: ${error.message}`);
    }
  }

  /**
   * Get transaction history for user
   */
  async getTransactionHistory(userId: string, limit: number = 50): Promise<Transaction[]> {
    const query = `
      SELECT id, user_id as "userId", token, from_address as "fromAddress",
             to_address as "toAddress", amount, tx_hash as "txHash",
             status, created_at as "createdAt"
      FROM blockchain_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    try {
      const result = await this.pool.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      this.logger.error(`Failed to get transaction history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(userId: string, transactionId: string): Promise<Transaction | null> {
    const query = `
      SELECT id, user_id as "userId", token, from_address as "fromAddress",
             to_address as "toAddress", amount, tx_hash as "txHash",
             status, created_at as "createdAt"
      FROM blockchain_transactions
      WHERE id = $1 AND user_id = $2
    `;

    try {
      const result = await this.pool.query(query, [transactionId, userId]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error(`Failed to get transaction: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save transaction to database
   */
  private async saveTransaction(data: {
    userId: string;
    token: string;
    fromAddress: string;
    toAddress: string;
    amount: string;
    txHash: string;
    status: string;
  }): Promise<Transaction> {
    const query = `
      INSERT INTO blockchain_transactions (user_id, token, from_address, to_address, amount, tx_hash, status, chain, direction)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'outbound')
      RETURNING id, user_id as "userId", token, from_address as "fromAddress",
                to_address as "toAddress", amount, tx_hash as "txHash",
                status, created_at as "createdAt"
    `;

    const chain = data.token === 'BTC' ? 'bitcoin' : 'ethereum';

    const values = [
      data.userId,
      data.token,
      data.fromAddress,
      data.toAddress,
      data.amount,
      data.txHash,
      data.status,
      chain,
    ];

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      this.logger.error(`Failed to save transaction: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate cryptocurrency address
   */
  private validateAddress(token: string, address: string): boolean {
    switch (token) {
      case 'BTC':
        return this.bitcoinService.validateAddress(address);
      case 'ETH':
      case 'USDC':
      case 'USDT':
        return this.ethereumService.validateAddress(address);
      default:
        return false;
    }
  }

  /**
   * Close database connection (cleanup)
   */
  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log('Transactions Service connection pool closed');
  }
}
