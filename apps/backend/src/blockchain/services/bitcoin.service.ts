import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HdWalletService } from './hd-wallet.service';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import axios from 'axios';

const ECPair = ECPairFactory(ecc);

/**
 * Bitcoin Service
 * Handles Bitcoin blockchain interactions
 *
 * Features:
 * - Address generation (SegWit bech32)
 * - Balance checking via Blockstream API
 * - Transaction broadcasting
 * - UTXO management
 * - Fee estimation
 */
@Injectable()
export class BitcoinService {
  private readonly logger = new Logger(BitcoinService.name);
  private readonly network: bitcoin.Network;
  private readonly apiBaseUrl: string;

  constructor(
    private hdWalletService: HdWalletService,
    private configService: ConfigService,
  ) {
    // Determine network (mainnet or testnet)
    const isTestnet = this.configService.get<boolean>('TESTNET_MODE', true);
    this.network = isTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;

    // Use Blockstream API (free, no signup)
    this.apiBaseUrl = isTestnet
      ? this.configService.get<string>('BLOCKSTREAM_TESTNET_URL', 'https://blockstream.info/testnet/api')
      : this.configService.get<string>('BLOCKSTREAM_API_URL', 'https://blockstream.info/api');

    this.logger.log(`Bitcoin Service initialized - Network: ${isTestnet ? 'TESTNET' : 'MAINNET'}`);
  }

  /**
   * Generate Bitcoin address for user
   */
  async generateAddress(userId: number): Promise<{ address: string; derivationPath: string }> {
    return await this.hdWalletService.deriveBitcoinAddress(userId);
  }

  /**
   * Get Bitcoin balance for an address
   * Returns balance in satoshis
   */
  async getBalance(address: string): Promise<{ confirmed: number; unconfirmed: number; total: number }> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/address/${address}`);
      const data = response.data;

      const confirmed = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
      const unconfirmed = data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum;

      return {
        confirmed,
        unconfirmed,
        total: confirmed + unconfirmed,
      };
    } catch (error) {
      this.logger.error(`Failed to get balance for ${address}:`, error.message);
      throw new Error('Failed to fetch Bitcoin balance');
    }
  }

  /**
   * Get UTXOs (Unspent Transaction Outputs) for an address
   */
  async getUtxos(address: string): Promise<
    Array<{
      txid: string;
      vout: number;
      value: number;
      status: { confirmed: boolean; block_height: number; block_hash: string };
    }>
  > {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/address/${address}/utxo`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get UTXOs for ${address}:`, error.message);
      throw new Error('Failed to fetch UTXOs');
    }
  }

  /**
   * Send Bitcoin transaction
   *
   * @param fromAddress - Sender address
   * @param derivationPath - Derivation path for private key
   * @param toAddress - Recipient address
   * @param amountSatoshis - Amount to send in satoshis
   * @returns Transaction ID (txid)
   */
  async sendTransaction(
    fromAddress: string,
    derivationPath: string,
    toAddress: string,
    amountSatoshis: number,
  ): Promise<{ txid: string; fee: number }> {
    try {
      // 1. Get UTXOs
      const utxos = await this.getUtxos(fromAddress);
      if (utxos.length === 0) {
        throw new Error('No UTXOs available');
      }

      // 2. Estimate fee (10 sats/vbyte for now - should be dynamic in production)
      const feeRate = 10;
      const estimatedSize = 150 + utxos.length * 68; // Rough estimate
      const estimatedFee = estimatedSize * feeRate;

      // 3. Select UTXOs (simple selection - use all for now)
      let inputSum = 0;
      const selectedUtxos: Array<{
        txid: string;
        vout: number;
        value: number;
        status: { confirmed: boolean; block_height: number; block_hash: string };
      }> = [];
      for (const utxo of utxos) {
        selectedUtxos.push(utxo);
        inputSum += utxo.value;
        if (inputSum >= amountSatoshis + estimatedFee) {
          break;
        }
      }

      if (inputSum < amountSatoshis + estimatedFee) {
        throw new Error('Insufficient funds');
      }

      // 4. Create transaction
      const psbt = new bitcoin.Psbt({ network: this.network });

      // Add inputs
      for (const utxo of selectedUtxos) {
        const txHex = await this.getTransactionHex(utxo.txid);
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: bitcoin.address.toOutputScript(fromAddress, this.network),
            value: BigInt(utxo.value),
          },
        });
      }

      // Add output (recipient)
      psbt.addOutput({
        address: toAddress,
        value: BigInt(amountSatoshis),
      });

      // Add change output if needed
      const change = inputSum - amountSatoshis - estimatedFee;
      if (change > 546) {
        // Dust limit
        psbt.addOutput({
          address: fromAddress,
          value: BigInt(change),
        });
      }

      // 5. Sign transaction
      const privateKey = await this.hdWalletService.getPrivateKey(derivationPath);
      const keyPair = ECPair.fromPrivateKey(privateKey, { network: this.network });

      for (let i = 0; i < selectedUtxos.length; i++) {
        psbt.signInput(i, keyPair);
      }

      psbt.finalizeAllInputs();

      // 6. Broadcast transaction
      const txHex = psbt.extractTransaction().toHex();
      const txid = await this.broadcastTransaction(txHex);

      this.logger.log(`Bitcoin transaction sent: ${txid}`);

      return {
        txid,
        fee: estimatedFee,
      };
    } catch (error) {
      this.logger.error('Failed to send Bitcoin transaction:', error.message);
      throw error;
    }
  }

  /**
   * Get transaction hex by txid
   */
  private async getTransactionHex(txid: string): Promise<string> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/tx/${txid}/hex`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get transaction hex for ${txid}:`, error.message);
      throw new Error('Failed to fetch transaction');
    }
  }

  /**
   * Broadcast transaction to network
   */
  async broadcastTransaction(txHex: string): Promise<string> {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/tx`, txHex, {
        headers: { 'Content-Type': 'text/plain' },
      });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to broadcast transaction:', error.response?.data || error.message);
      throw new Error('Failed to broadcast transaction');
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txid: string): Promise<any> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/tx/${txid}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get transaction ${txid}:`, error.message);
      throw new Error('Failed to fetch transaction');
    }
  }

  /**
   * Get transaction confirmations
   */
  async getConfirmations(txid: string): Promise<number> {
    try {
      const tx = await this.getTransaction(txid);
      if (!tx.status.confirmed) {
        return 0;
      }

      // Get current block height
      const response = await axios.get(`${this.apiBaseUrl}/blocks/tip/height`);
      const currentHeight = response.data;

      return currentHeight - tx.status.block_height + 1;
    } catch (error) {
      this.logger.error(`Failed to get confirmations for ${txid}:`, error.message);
      return 0;
    }
  }

  /**
   * Validate Bitcoin address
   */
  validateAddress(address: string): boolean {
    try {
      bitcoin.address.toOutputScript(address, this.network);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert BTC to satoshis
   */
  btcToSatoshis(btc: number): number {
    return Math.floor(btc * 100000000);
  }

  /**
   * Convert satoshis to BTC
   */
  satoshisToBtc(satoshis: number): number {
    return satoshis / 100000000;
  }
}
