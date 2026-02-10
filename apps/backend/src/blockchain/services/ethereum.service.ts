import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HdWalletService } from './hd-wallet.service';
import { ethers } from 'ethers';

/**
 * Ethereum Service
 * Handles Ethereum and ERC-20 tokens (USDC, USDT) interactions
 *
 * Features:
 * - Address generation
 * - ETH balance checking
 * - USDC & USDT (ERC-20) balance checking
 * - ETH transfers
 * - USDC & USDT transfers
 * - Gas estimation
 * - Transaction tracking
 */
@Injectable()
export class EthereumService {
  private readonly logger = new Logger(EthereumService.name);
  private provider: ethers.JsonRpcProvider;
  private usdcContract: ethers.Contract;
  private usdtContract: ethers.Contract;
  private readonly usdcAddress: string;
  private readonly usdtAddress: string;
  private readonly isTestnet: boolean;

  // USDC ERC-20 ABI (minimal - only what we need)
  private readonly ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
  ];

  constructor(
    private hdWalletService: HdWalletService,
    private configService: ConfigService,
  ) {
    this.isTestnet = this.configService.get<boolean>('TESTNET_MODE', true);

    // Initialize provider with fallback
    const primaryRpc = this.configService.get<string>('ETH_RPC_URL');
    const testnetRpc = this.configService.get<string>('ETH_TESTNET_RPC_URL');
    const rpcUrl = this.isTestnet ? testnetRpc : primaryRpc;

    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // USDC contract address (Ethereum Mainnet or Sepolia testnet)
    this.usdcAddress = this.isTestnet
      ? '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' // USDC on Sepolia
      : this.configService.get<string>('USDC_CONTRACT_ADDRESS', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');

    this.usdcContract = new ethers.Contract(this.usdcAddress, this.ERC20_ABI, this.provider);

    // USDT contract address (Ethereum Mainnet or Sepolia testnet)
    this.usdtAddress = this.isTestnet
      ? '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0' // USDT on Sepolia
      : this.configService.get<string>('USDT_CONTRACT_ADDRESS', '0xdAC17F958D2ee523a2206206994597C13D831ec7');

    this.usdtContract = new ethers.Contract(this.usdtAddress, this.ERC20_ABI, this.provider);

    this.logger.log(`Ethereum Service initialized - Network: ${this.isTestnet ? 'SEPOLIA' : 'MAINNET'}`);
  }

  /**
   * Generate Ethereum address for user
   */
  async generateAddress(userId: number): Promise<{ address: string; derivationPath: string }> {
    return await this.hdWalletService.deriveEthereumAddress(userId);
  }

  /**
   * Get ETH balance for an address
   * Returns balance in wei (smallest unit)
   */
  async getEthBalance(address: string): Promise<{ wei: string; eth: string }> {
    try {
      const balanceWei = await this.provider.getBalance(address);
      const balanceEth = ethers.formatEther(balanceWei);

      return {
        wei: balanceWei.toString(),
        eth: balanceEth,
      };
    } catch (error) {
      this.logger.error(`Failed to get ETH balance for ${address}:`, error.message);
      throw new Error('Failed to fetch ETH balance');
    }
  }

  /**
   * Get USDC balance for an address
   * Returns balance in smallest unit (6 decimals for USDC)
   */
  async getUsdcBalance(address: string): Promise<{ raw: string; formatted: string }> {
    try {
      const balance = await this.usdcContract.balanceOf(address);
      const formatted = ethers.formatUnits(balance, 6); // USDC has 6 decimals

      return {
        raw: balance.toString(),
        formatted,
      };
    } catch (error) {
      this.logger.error(`Failed to get USDC balance for ${address}:`, error.message);
      throw new Error('Failed to fetch USDC balance');
    }
  }

  /**
   * Get USDT balance for an address
   * Returns balance in smallest unit (6 decimals for USDT)
   */
  async getUsdtBalance(address: string): Promise<{ raw: string; formatted: string }> {
    try {
      const balance = await this.usdtContract.balanceOf(address);
      const formatted = ethers.formatUnits(balance, 6); // USDT has 6 decimals

      return {
        raw: balance.toString(),
        formatted,
      };
    } catch (error) {
      this.logger.error(`Failed to get USDT balance for ${address}:`, error.message);
      throw new Error('Failed to fetch USDT balance');
    }
  }

  /**
   * Send ETH transaction
   *
   * @param derivationPath - Derivation path for private key
   * @param toAddress - Recipient address
   * @param amountEth - Amount to send in ETH
   * @returns Transaction hash
   */
  async sendEth(
    derivationPath: string,
    toAddress: string,
    amountEth: string,
  ): Promise<{ txHash: string; gasUsed: string }> {
    try {
      // 1. Get private key and create wallet
      const privateKey = await this.hdWalletService.getPrivateKey(derivationPath);
      const wallet = new ethers.Wallet('0x' + privateKey.toString('hex'), this.provider);

      // 2. Get current gas price
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice;

      if (!gasPrice) {
        throw new Error('Failed to get gas price');
      }

      // 3. Prepare transaction
      const tx = {
        to: toAddress,
        value: ethers.parseEther(amountEth),
        gasLimit: 21000n, // Standard ETH transfer
        gasPrice: gasPrice,
      };

      // 4. Send transaction
      const txResponse = await wallet.sendTransaction(tx);
      this.logger.log(`ETH transaction sent: ${txResponse.hash}`);

      // 5. Wait for confirmation
      const receipt = await txResponse.wait();

      if (!receipt) {
        throw new Error('Transaction receipt not available');
      }

      return {
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to send ETH transaction:', error.message);
      throw error;
    }
  }

  /**
   * Send USDC (ERC-20) transaction
   *
   * @param derivationPath - Derivation path for private key
   * @param toAddress - Recipient address
   * @param amountUsdc - Amount to send in USDC (e.g., "10.50")
   * @returns Transaction hash
   */
  async sendUsdc(
    derivationPath: string,
    toAddress: string,
    amountUsdc: string,
  ): Promise<{ txHash: string; gasUsed: string }> {
    try {
      // 1. Get private key and create wallet
      const privateKey = await this.hdWalletService.getPrivateKey(derivationPath);
      const wallet = new ethers.Wallet('0x' + privateKey.toString('hex'), this.provider);

      // 2. Connect contract with signer
      const usdcWithSigner = this.usdcContract.connect(wallet) as ethers.Contract;

      // 3. Convert amount to smallest unit (6 decimals)
      const amount = ethers.parseUnits(amountUsdc, 6);

      // 4. Estimate gas
      const gasEstimate = await usdcWithSigner.transfer.estimateGas(toAddress, amount);
      const feeData = await this.provider.getFeeData();

      if (!feeData.gasPrice) {
        throw new Error('Failed to get gas price');
      }

      // 5. Send transaction with 20% gas buffer
      const gasLimit = (gasEstimate * 120n) / 100n;
      const txResponse = await usdcWithSigner.transfer(toAddress, amount, {
        gasLimit,
        gasPrice: feeData.gasPrice,
      });

      this.logger.log(`USDC transaction sent: ${txResponse.hash}`);

      // 6. Wait for confirmation
      const receipt = await txResponse.wait();

      return {
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to send USDC transaction:', error.message);
      throw error;
    }
  }

  /**
   * Send USDT (ERC-20) transaction
   *
   * @param derivationPath - Derivation path for private key
   * @param toAddress - Recipient address
   * @param amountUsdt - Amount to send in USDT (e.g., "10.50")
   * @returns Transaction hash
   */
  async sendUsdt(
    derivationPath: string,
    toAddress: string,
    amountUsdt: string,
  ): Promise<{ txHash: string; gasUsed: string }> {
    try {
      // 1. Get private key and create wallet
      const privateKey = await this.hdWalletService.getPrivateKey(derivationPath);
      const wallet = new ethers.Wallet('0x' + privateKey.toString('hex'), this.provider);

      // 2. Connect contract with signer
      const usdtWithSigner = this.usdtContract.connect(wallet) as ethers.Contract;

      // 3. Convert amount to smallest unit (6 decimals)
      const amount = ethers.parseUnits(amountUsdt, 6);

      // 4. Estimate gas
      const gasEstimate = await usdtWithSigner.transfer.estimateGas(toAddress, amount);
      const feeData = await this.provider.getFeeData();

      if (!feeData.gasPrice) {
        throw new Error('Failed to get gas price');
      }

      // 5. Send transaction with 20% gas buffer
      const gasLimit = (gasEstimate * 120n) / 100n;
      const txResponse = await usdtWithSigner.transfer(toAddress, amount, {
        gasLimit,
        gasPrice: feeData.gasPrice,
      });

      this.logger.log(`USDT transaction sent: ${txResponse.hash}`);

      // 6. Wait for confirmation
      const receipt = await txResponse.wait();

      return {
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to send USDT transaction:', error.message);
      throw error;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txHash: string): Promise<any> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      return tx;
    } catch (error) {
      this.logger.error(`Failed to get transaction ${txHash}:`, error.message);
      throw new Error('Failed to fetch transaction');
    }
  }

  /**
   * Get transaction receipt (to check if confirmed)
   */
  async getTransactionReceipt(txHash: string): Promise<any> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      return receipt;
    } catch (error) {
      this.logger.error(`Failed to get transaction receipt ${txHash}:`, error.message);
      throw new Error('Failed to fetch transaction receipt');
    }
  }

  /**
   * Get number of confirmations for a transaction
   */
  async getConfirmations(txHash: string): Promise<number> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) {
        return 0;
      }

      const currentBlock = await this.provider.getBlockNumber();
      if (!tx.blockNumber) {
        return 0;
      }

      return currentBlock - tx.blockNumber + 1;
    } catch (error) {
      this.logger.error(`Failed to get confirmations for ${txHash}:`, error.message);
      return 0;
    }
  }

  /**
   * Estimate gas for ETH transfer
   */
  async estimateEthGas(toAddress: string, amountEth: string): Promise<{ gasLimit: string; gasCost: string }> {
    try {
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || 0n;
      const gasLimit = 21000n;
      const gasCost = gasLimit * gasPrice;

      return {
        gasLimit: gasLimit.toString(),
        gasCost: ethers.formatEther(gasCost),
      };
    } catch (error) {
      this.logger.error('Failed to estimate gas:', error.message);
      throw new Error('Failed to estimate gas');
    }
  }

  /**
   * Validate Ethereum address (checksum)
   */
  validateAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<{ wei: string; gwei: string }> {
    try {
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || 0n;

      return {
        wei: gasPrice.toString(),
        gwei: ethers.formatUnits(gasPrice, 'gwei'),
      };
    } catch (error) {
      this.logger.error('Failed to get gas price:', error.message);
      throw new Error('Failed to fetch gas price');
    }
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      this.logger.error('Failed to get block number:', error.message);
      throw new Error('Failed to fetch block number');
    }
  }

  /**
   * Health check - verify RPC connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.provider.getBlockNumber();
      return true;
    } catch (error) {
      this.logger.error('Ethereum health check failed:', error.message);
      return false;
    }
  }
}
