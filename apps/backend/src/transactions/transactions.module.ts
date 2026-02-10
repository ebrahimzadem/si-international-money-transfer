import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { WalletsModule } from '../wallets/wallets.module';
import { UsersModule } from '../users/users.module';

/**
 * Transactions Module
 * Handles crypto transactions (send, receive, history)
 */
@Module({
  imports: [BlockchainModule, WalletsModule, UsersModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
