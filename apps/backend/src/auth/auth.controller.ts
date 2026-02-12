import { Controller, Post, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';

class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;

  @IsString()
  fullName?: string;
}

class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

/**
 * Authentication Controller
 * Handles user registration, login, and token refresh
 */
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Register new user
   * POST /auth/register
   */
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto.email, registerDto.password, registerDto.fullName);
  }

  /**
   * Login user
   * POST /auth/login
   */
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  /**
   * Google OAuth login
   * POST /auth/google
   */
  @HttpCode(HttpStatus.OK)
  @Post('google')
  async googleLogin(@Body() googleLoginDto: GoogleLoginDto) {
    return this.authService.googleLogin(googleLoginDto.idToken);
  }

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  /**
   * Get current user profile
   * GET /auth/me
   */
  @UseGuards(LocalAuthGuard)
  @Post('me')
  async getProfile(@Request() req) {
    return req.user;
  }
}
