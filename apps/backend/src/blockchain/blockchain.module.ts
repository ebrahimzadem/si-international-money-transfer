import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HdWalletService } from './services/hd-wallet.service';
import { BitcoinService } from './services/bitcoin.service';
import { EthereumService } from './services/ethereum.service';

/**
 * Blockchain Module
 * Provides blockchain integration services for Bitcoin and Ethereum
 *
 * Services:
 * - HdWalletService: HD wallet generation (BIP39/BIP44)
 * - BitcoinService: Bitcoin blockchain interactions
 * - EthereumService: Ethereum and USDC (ERC-20) interactions
 */
@Module({
  imports: [ConfigModule],
  providers: [HdWalletService, BitcoinService, EthereumService],
  exports: [HdWalletService, BitcoinService, EthereumService],
})
export class BlockchainModule {}
