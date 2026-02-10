import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { SendTransactionDto } from './dto/send-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Transactions Controller
 * Handles sending crypto and viewing transaction history
 */
@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  /**
   * Send cryptocurrency
   * POST /transactions/send
   */
  @Post('send')
  async sendTransaction(@Request() req, @Body() dto: SendTransactionDto) {
    const userId = req.user.id;
    return this.transactionsService.sendTransaction(userId, dto);
  }

  /**
   * Get transaction history
   * GET /transactions
   */
  @Get()
  async getTransactionHistory(@Request() req, @Query('limit') limit?: string) {
    const userId = req.user.id;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.transactionsService.getTransactionHistory(userId, limitNum);
  }

  /**
   * Get specific transaction
   * GET /transactions/:id
   */
  @Get(':id')
  async getTransaction(@Request() req, @Param('id') transactionId: string) {
    const userId = req.user.id;
    return this.transactionsService.getTransactionById(userId, transactionId);
  }
}
