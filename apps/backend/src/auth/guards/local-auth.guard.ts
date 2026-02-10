import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Local Auth Guard
 * Uses local strategy for email/password authentication
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
