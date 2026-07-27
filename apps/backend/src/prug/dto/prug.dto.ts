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

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
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
