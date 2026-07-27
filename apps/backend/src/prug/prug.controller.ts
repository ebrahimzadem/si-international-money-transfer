/**
 * Prug HTTP API — owner-facing routes.
 *
 * Everything here requires a session; the public profile lives in
 * PrugPublicController.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrugService } from './prug.service';
import { OwnershipService } from './ownership/ownership.service';
import { PrugKycService } from './kyc/prug-kyc.service';
import { PrugRepository } from './prug.repository';
import {
  CreateCarpetDto,
  CreateTransferDto,
  DeclareOwnerDto,
  TokenizeDto,
  UpdateProfileDto,
  UploadPhotoDto,
} from './dto/prug.dto';
import {
  MAX_PHOTOS,
  MIN_PHOTOS,
  REQUIRED_PHOTO_COUNT,
  SHOT_LIST,
} from './capture/shot-list';

/** Accept both raw base64 and `data:image/jpeg;base64,...`. */
function decodeBase64Image(value: string): Buffer {
  const payload =
    value.includes(',') && value.startsWith('data:')
      ? value.slice(value.indexOf(',') + 1)
      : value;
  const buffer = Buffer.from(payload, 'base64');

  if (buffer.length < 1024) {
    throw new BadRequestException('Photo payload is empty or not valid base64');
  }
  return buffer;
}

@Controller('prug')
@UseGuards(JwtAuthGuard)
export class PrugController {
  constructor(
    private readonly prugService: PrugService,
    private readonly ownershipService: OwnershipService,
    private readonly kycService: PrugKycService,
    private readonly repository: PrugRepository,
  ) {}

  /** The guided capture plan a client renders before the first photo. */
  @Get('capture-plan')
  getCapturePlan() {
    return {
      minPhotos: MIN_PHOTOS,
      maxPhotos: MAX_PHOTOS,
      requiredPhotos: REQUIRED_PHOTO_COUNT,
      shots: SHOT_LIST,
    };
  }

  @Get('kyc-status')
  async getKycStatus(@Request() req) {
    const status = await this.kycService.getStatus(req.user.id);
    return { ...status, enforced: this.kycService.enforced };
  }

  // ==========================================================================
  // CARPETS
  // ==========================================================================

  @Post('carpets')
  async createCarpet(@Request() req, @Body() dto: CreateCarpetDto) {
    return this.prugService.createCarpet(req.user.id, {
      title: dto.title,
      declared: { ...(dto.declared || {}), title: dto.title },
      acquisitionType: dto.acquisitionType,
      acquiredAt: dto.acquiredAt,
    });
  }

  @Get('carpets')
  async listCarpets(@Request() req) {
    return this.prugService.listCarpets(req.user.id);
  }

  @Get('carpets/:carpetId')
  async getCarpet(@Request() req, @Param('carpetId') carpetId: string) {
    const carpet = await this.prugService.getOwnedCarpet(req.user.id, carpetId);
    const [photos, ownership, report, token] = await Promise.all([
      this.repository.listPhotos(carpetId),
      this.ownershipService.listOwnership(carpetId),
      this.repository.latestForensicReport(carpetId),
      this.repository.getLatestToken(carpetId),
    ]);

    return { carpet, photos, ownership, report, token };
  }

  @Patch('carpets/:carpetId/profile')
  async updateProfile(
    @Request() req,
    @Param('carpetId') carpetId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.prugService.updateProfile(req.user.id, carpetId, dto);
  }

  // ==========================================================================
  // PHOTOS
  // ==========================================================================

  @Post('carpets/:carpetId/photos')
  async addPhoto(
    @Request() req,
    @Param('carpetId') carpetId: string,
    @Body() dto: UploadPhotoDto,
  ) {
    return this.prugService.addPhoto(req.user.id, carpetId, {
      shotType: dto.shotType,
      data: decodeBase64Image(dto.data),
      isPublic: dto.isPublic,
    });
  }

  @Get('carpets/:carpetId/photos')
  async listPhotos(@Request() req, @Param('carpetId') carpetId: string) {
    return this.prugService.listPhotos(req.user.id, carpetId);
  }

  @Get('carpets/:carpetId/photos/:photoId/raw')
  async getPhotoBytes(
    @Request() req,
    @Param('carpetId') carpetId: string,
    @Param('photoId') photoId: string,
    @Res() res: Response,
  ) {
    const { data, mimeType } = await this.prugService.getPhotoBytes(
      req.user.id,
      carpetId,
      photoId,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(data);
  }

  @Delete('carpets/:carpetId/photos/:photoId')
  async deletePhoto(
    @Request() req,
    @Param('carpetId') carpetId: string,
    @Param('photoId') photoId: string,
  ) {
    await this.prugService.deletePhoto(req.user.id, carpetId, photoId);
    return { deleted: true };
  }

  // ==========================================================================
  // ANALYSIS AND CERTIFICATE
  // ==========================================================================

  @Post('carpets/:carpetId/analyze')
  async analyze(@Request() req, @Param('carpetId') carpetId: string) {
    return this.prugService.analyze(req.user.id, carpetId);
  }

  @Post('carpets/:carpetId/certificate')
  async issueCertificate(@Request() req, @Param('carpetId') carpetId: string) {
    const certificateNumber = await this.prugService.issueCertificate(
      req.user.id,
      carpetId,
    );
    return { certificateNumber };
  }

  @Get('carpets/:carpetId/ledger')
  async getLedger(@Request() req, @Param('carpetId') carpetId: string) {
    await this.prugService.getOwnedCarpet(req.user.id, carpetId);
    return this.prugService.getLedger(carpetId);
  }

  // ==========================================================================
  // PROVENANCE AND TRANSFERS
  // ==========================================================================

  @Get('carpets/:carpetId/owners')
  async listOwners(@Request() req, @Param('carpetId') carpetId: string) {
    await this.prugService.getOwnedCarpet(req.user.id, carpetId);
    return this.ownershipService.listOwnership(carpetId);
  }

  @Post('carpets/:carpetId/owners')
  async declareOwner(
    @Request() req,
    @Param('carpetId') carpetId: string,
    @Body() dto: DeclareOwnerDto,
  ) {
    return this.prugService.declareHistoricalOwner(req.user.id, carpetId, dto);
  }

  @Post('carpets/:carpetId/transfers')
  async createTransfer(
    @Request() req,
    @Param('carpetId') carpetId: string,
    @Body() dto: CreateTransferDto,
  ) {
    return this.prugService.initiateTransfer(req.user.id, carpetId, dto);
  }

  @Get('carpets/:carpetId/transfers')
  async listCarpetTransfers(
    @Request() req,
    @Param('carpetId') carpetId: string,
  ) {
    await this.prugService.getOwnedCarpet(req.user.id, carpetId);
    return this.ownershipService.listCarpetTransfers(carpetId);
  }

  @Get('transfers/incoming')
  async listIncomingTransfers(@Request() req) {
    return this.ownershipService.listIncomingTransfers(req.user.email);
  }

  @Post('transfers/:transferId/accept')
  async acceptTransfer(
    @Request() req,
    @Param('transferId') transferId: string,
  ) {
    return this.prugService.acceptTransfer(req.user.id, transferId);
  }

  @Post('transfers/:transferId/decline')
  async declineTransfer(
    @Request() req,
    @Param('transferId') transferId: string,
  ) {
    return this.prugService.declineTransfer(req.user.id, transferId);
  }

  @Post('transfers/:transferId/cancel')
  async cancelTransfer(
    @Request() req,
    @Param('transferId') transferId: string,
  ) {
    return this.prugService.cancelTransfer(req.user.id, transferId);
  }

  // ==========================================================================
  // TOKENISATION
  // ==========================================================================

  /** The exact metadata and hashes that would go on chain, without signing. */
  @Get('carpets/:carpetId/token')
  async getTokenPlan(@Request() req, @Param('carpetId') carpetId: string) {
    return this.prugService.prepareTokenization(req.user.id, carpetId);
  }

  @Post('carpets/:carpetId/token')
  async tokenize(
    @Request() req,
    @Param('carpetId') carpetId: string,
    @Body() dto: TokenizeDto,
  ) {
    return this.prugService.tokenize(
      req.user.id,
      carpetId,
      dto.recipientAddress,
    );
  }
}
