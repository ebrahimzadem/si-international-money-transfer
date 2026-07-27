/**
 * Public carpet profiles.
 *
 * Anyone holding a profile address or certificate number can check a carpet:
 * its identity document, photo gallery, chain of custody, ledger integrity and
 * on-chain anchor. No session, and no owner identity beyond a display name.
 */

import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrugService } from './prug.service';

@Controller('prug')
export class PrugPublicController {
  constructor(private readonly prugService: PrugService) {}

  @Get('profiles/:slug')
  async getProfile(@Param('slug') slug: string) {
    return this.prugService.getPublicProfile(slug);
  }

  @Get('profiles/:slug/photos/:photoId')
  async getProfilePhoto(
    @Param('slug') slug: string,
    @Param('photoId') photoId: string,
    @Res() res: Response,
  ) {
    const { data, mimeType } = await this.prugService.getPublicPhoto(
      slug,
      photoId,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(data);
  }

  /** ERC-721 tokenURI target. */
  @Get('profiles/:slug/metadata')
  async getTokenMetadata(@Param('slug') slug: string) {
    return this.prugService.getPublicTokenMetadata(slug);
  }

  /** Look a carpet up by the certificate number printed on its document. */
  @Get('verify/:certificateNumber')
  async verifyCertificate(
    @Param('certificateNumber') certificateNumber: string,
  ) {
    return this.prugService.getPublicProfile(certificateNumber);
  }
}
