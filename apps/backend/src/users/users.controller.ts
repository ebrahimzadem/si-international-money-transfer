import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Users Controller
 * Handles user profile operations
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  /**
   * Get current user profile
   * GET /users/me
   */
  @Get('me')
  async getProfile(@Request() req) {
    const { passwordHash, ...user } = req.user;
    return user;
  }

  /**
   * Update user profile
   * PATCH /users/me
   */
  @Patch('me')
  async updateProfile(@Request() req, @Body() updates: any) {
    const userId = req.user.id;
    const updatedUser = await this.usersService.update(userId, updates);
    const { passwordHash, ...result } = updatedUser;
    return result;
  }
}
