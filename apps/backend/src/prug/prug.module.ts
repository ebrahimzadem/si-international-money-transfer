import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { PrugController } from './prug.controller';
import { PrugPublicController } from './prug-public.controller';
import { PrugService } from './prug.service';
import { PrugRepository } from './prug.repository';
import { ForensicsService } from './forensics/forensics.service';
import { ClaudeVisionService } from './agent/claude-vision.service';
import { PhotoStorageService } from './storage/photo-storage.service';
import { PrugKycService } from './kyc/prug-kyc.service';
import { OwnershipService } from './ownership/ownership.service';
import { TokenizationService } from './tokenization/tokenization.service';
import { CaptureSessionService } from './capture/capture-session.service';
import { DeviceAttestationService } from './capture/device-attestation.service';

/**
 * Prug — carpet identity, fraud detection, provenance and tokenisation.
 *
 * Anyone in the world who owns a handwoven carpet can register it, have an
 * identity document built from their own photographs, name the owners who came
 * before them, and hand the carpet on to a verified buyer with its history
 * intact.
 */
@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [PrugController, PrugPublicController],
  providers: [
    PrugService,
    PrugRepository,
    ForensicsService,
    ClaudeVisionService,
    PhotoStorageService,
    PrugKycService,
    OwnershipService,
    TokenizationService,
    CaptureSessionService,
    DeviceAttestationService,
  ],
  exports: [PrugService],
})
export class PrugModule {}
