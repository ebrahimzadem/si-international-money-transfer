import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Auth Guard
 * Protects routes that require authentication
 * Add @UseGuards(JwtAuthGuard) to protected routes
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
