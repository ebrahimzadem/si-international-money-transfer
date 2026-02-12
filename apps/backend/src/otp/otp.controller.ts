import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { IsString, IsNotEmpty, IsEmail, Length } from 'class-validator';
import { OtpService } from './otp.service';

class SendEmailOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

class VerifyEmailOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @Length(6, 6)
  code: string;
}

class SendPhoneOtpDto {
  @IsString()
  @IsNotEmpty()
  phone: string;
}

class VerifyPhoneOtpDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @Length(6, 6)
  code: string;
}

@Controller('auth/otp')
export class OtpController {
  constructor(private otpService: OtpService) {}

  @HttpCode(HttpStatus.OK)
  @Post('email/send')
  async sendEmailOtp(@Body() dto: SendEmailOtpDto) {
    return this.otpService.sendOtp(dto.email, 'email');
  }

  @HttpCode(HttpStatus.OK)
  @Post('email/verify')
  async verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
    try {
      return await this.otpService.verifyOtp(dto.email, dto.code, 'email');
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('phone/send')
  async sendPhoneOtp(@Body() dto: SendPhoneOtpDto) {
    return this.otpService.sendOtp(dto.phone, 'phone');
  }

  @HttpCode(HttpStatus.OK)
  @Post('phone/verify')
  async verifyPhoneOtp(@Body() dto: VerifyPhoneOtpDto) {
    try {
      return await this.otpService.verifyOtp(dto.phone, dto.code, 'phone');
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
