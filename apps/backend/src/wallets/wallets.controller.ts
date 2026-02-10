import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Wallets Controller
 * Handles wallet operations (create, balances, addresses)
 */
@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private walletsService: WalletsService) {}

  /**
   * Create wallets for current user
   * POST /wallets
   */
  @Post()
  async createWallets(@Request() req) {
    const userId = req.user.id;
    return this.walletsService.createWalletsForUser(userId);
  }

  /**
   * Get all wallets for current user
   * GET /wallets
   */
  @Get()
  async getWallets(@Request() req) {
    const userId = req.user.id;
    return this.walletsService.findByUserId(userId);
  }

  /**
   * Get all balances for current user
   * GET /wallets/balances
   */
  @Get('balances')
  async getBalances(@Request() req) {
    const userId = req.user.id;
    return this.walletsService.getBalances(userId);
  }

  /**
   * Get balance for specific token
   * GET /wallets/balances/:token
   */
  @Get('balances/:token')
  async getBalanceByToken(@Request() req, @Param('token') token: 'BTC' | 'ETH' | 'USDC' | 'USDT') {
    const userId = req.user.id;
    return this.walletsService.getBalanceByToken(userId, token);
  }

  /**
   * Get wallet address for specific chain
   * GET /wallets/:chain/address
   */
  @Get(':chain/address')
  async getAddress(@Request() req, @Param('chain') chain: 'bitcoin' | 'ethereum') {
    const userId = req.user.id;
    const wallet = await this.walletsService.findByUserIdAndChain(userId, chain);

    if (!wallet) {
      // Auto-create if doesn't exist
      await this.walletsService.createWalletsForUser(userId);
      return this.getAddress(req, chain); // Recursive call
    }

    return {
      chain,
      address: wallet.address,
    };
  }
}
