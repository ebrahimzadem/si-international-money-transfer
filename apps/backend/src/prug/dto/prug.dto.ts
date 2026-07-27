/**
 * Request payloads for the Prug API.
 *
 * The global ValidationPipe runs with `whitelist` and `forbidNonWhitelisted`,
 * so anything not declared here is rejected outright.
 */

import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEthereumAddress,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { AcquisitionType, ShotType } from '../prug.types';
import { SHOT_LIST } from '../capture/shot-list';

const SHOT_TYPES = SHOT_LIST.map((spec) => spec.type);

const ACQUISITION_TYPES: AcquisitionType[] = [
  'original_weaver',
  'purchase',
  'inheritance',
  'gift',
  'auction',
  'trade',
  'unknown',
];

/** Roughly 9 MB of binary once decoded. */
const MAX_BASE64_LENGTH = 12_000_000;

export class DeclaredAttributesDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  originCountry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  originRegion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  weaverName?: string;

  @IsOptional()
  @IsIn(['persian_asymmetric', 'turkish_symmetric', 'jufti', 'unknown'])
  knotType?: 'persian_asymmetric' | 'turkish_symmetric' | 'jufti' | 'unknown';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  materials?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(2000)
  lengthCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(2000)
  widthCm?: number;

  @IsOptional()
  @IsInt()
  @Min(1500)
  @Max(2100)
  estimatedYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CreateCarpetDto {
  @IsString()
  @Length(3, 120)
  title: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DeclaredAttributesDto)
  declared?: DeclaredAttributesDto;

  @IsOptional()
  @IsIn(ACQUISITION_TYPES)
  acquisitionType?: AcquisitionType;

  @IsOptional()
  @IsISO8601()
  acquiredAt?: string;
}

export class UploadPhotoDto {
  @IsIn(SHOT_TYPES)
  shotType: ShotType;

  /** Base64-encoded JPEG or PNG. A `data:` prefix is accepted and stripped. */
  @IsString()
  @MaxLength(MAX_BASE64_LENGTH)
  data: string;

  /**
   * Single-use token issued for this frame moments before the shutter.
   * Required unless the deployment runs with PRUG_CAPTURE_MODE=off.
   */
  @IsOptional()
  @IsString()
  @Length(64, 64)
  frameToken?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class OpenCaptureSessionDto {
  @IsIn(['ios', 'android', 'web'])
  platform: 'ios' | 'android' | 'web';

  /** Stable per-install identifier, used to spot a set built on several devices. */
  @IsString()
  @Length(8, 128)
  deviceId: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;

  /**
   * The device's UTC offset in minutes. EXIF timestamps are local wall-clock
   * with no zone, so without this a capture time cannot be checked.
   */
  @IsInt()
  @Min(-840)
  @Max(840)
  utcOffsetMinutes: number;

  /** Apple App Attest or Play Integrity token, bound to the session nonce. */
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  attestationToken?: string;
}

export class IssueFrameTokenDto {
  @IsIn(SHOT_TYPES)
  shotType: ShotType;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsIn(['public', 'unlisted', 'private'])
  visibility?: 'public' | 'unlisted' | 'private';

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  story?: string;

  @IsOptional()
  @IsString()
  coverPhotoId?: string;
}

export class DeclareOwnerDto {
  @IsString()
  @Length(2, 160)
  ownerName: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ownerCountry?: string;

  @IsIn(ACQUISITION_TYPES)
  acquisitionType: AcquisitionType;

  @IsOptional()
  @IsISO8601()
  acquiredAt?: string;

  @IsOptional()
  @IsISO8601()
  releasedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateTransferDto {
  @IsEmail()
  toEmail: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  priceAmount?: string;

  @IsOptional()
  @IsString()
  @Length(3, 5)
  priceCurrency?: string;
}

export class TokenizeDto {
  /** Required when an ERC-721 contract is configured; ignored when anchoring. */
  @IsOptional()
  @IsEthereumAddress()
  recipientAddress?: string;
}
