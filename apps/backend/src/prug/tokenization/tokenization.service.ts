/**
 * Tokenisation.
 *
 * Two levels, both driven by the same document hash:
 *
 *   anchor — write the certificate's document hash to Ethereum in a zero-value
 *            transaction. Cheap, contract-free, and enough to prove the
 *            certificate existed in this exact form at that block.
 *   erc721 — mint a transferable deed against a configured ERC-721 contract,
 *            with the Prug profile as its token URI.
 *
 * Neither is required for a certificate to be valid. When no signer is
 * configured the service still produces the metadata and hashes, so an owner
 * can see exactly what would go on chain before any key is involved.
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import {
  CarpetIdentity,
  CarpetRecord,
  CarpetToken,
  OwnershipRecord,
} from '../prug.types';
import { canonicalize } from '../identity/ledger';

/** Minimal mint surface; any ERC-721 with this signature works. */
const ERC721_MINT_ABI = [
  'function safeMint(address to, string uri) returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

export interface Erc721Metadata {
  name: string;
  description: string;
  external_url: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
  properties: {
    certificateNumber: string;
    documentHash: string;
    photoSetHash: string;
    identityHash: string;
    ledgerHeadHash: string | null;
    provenance: Array<{
      owner: string;
      from: string | null;
      to: string | null;
      verified: boolean;
    }>;
  };
}

export interface TokenizationPlan {
  metadata: Erc721Metadata;
  metadataHash: string;
  documentHash: string;
  chain: string;
  network: string;
  /** False when no signer is configured; the plan is still returned. */
  executable: boolean;
  mode: 'erc721' | 'anchor';
}

@Injectable()
export class TokenizationService {
  private readonly logger = new Logger(TokenizationService.name);
  private readonly provider: ethers.JsonRpcProvider | null;
  private readonly signer: ethers.Wallet | null;
  private readonly contractAddress: string | null;
  private readonly anchorAddress: string;
  private readonly network: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const testnet =
      this.configService.get<string>('TESTNET_MODE', 'true') !== 'false';
    this.network = testnet ? 'sepolia' : 'mainnet';

    const rpcUrl = testnet
      ? this.configService.get<string>('ETH_TESTNET_RPC_URL')
      : this.configService.get<string>('ETH_RPC_URL');

    this.provider = rpcUrl ? new ethers.JsonRpcProvider(rpcUrl) : null;

    const privateKey = this.configService.get<string>(
      'PRUG_ANCHOR_PRIVATE_KEY',
    );
    this.signer =
      privateKey && this.provider
        ? new ethers.Wallet(privateKey, this.provider)
        : null;

    this.contractAddress =
      this.configService.get<string>('PRUG_NFT_CONTRACT') || null;
    // Anchoring sends to a burn-style sink; only the calldata matters.
    this.anchorAddress = this.configService.get<string>(
      'PRUG_ANCHOR_ADDRESS',
      '0x000000000000000000000000000000000000dEaD',
    );
    this.publicBaseUrl = this.configService.get<string>(
      'PRUG_PUBLIC_URL',
      'https://prug.app',
    );

    if (!this.signer) {
      this.logger.warn(
        'PRUG_ANCHOR_PRIVATE_KEY not set — tokenisation returns unsigned plans only',
      );
    }
  }

  get executable(): boolean {
    return this.signer !== null;
  }

  /** Build the ERC-721 metadata document for a certified carpet. */
  buildMetadata(input: {
    carpet: CarpetRecord & { profile: { slug: string } };
    identity: CarpetIdentity;
    documentHash: string;
    photoSetHash: string;
    identityHash: string;
    ledgerHeadHash: string | null;
    coverPhotoId: string | null;
    ownership: OwnershipRecord[];
  }): Erc721Metadata {
    const profileUrl = `${this.publicBaseUrl}/p/${input.carpet.profile.slug}`;

    return {
      name: input.carpet.title,
      description: input.identity.summaryEn,
      external_url: profileUrl,
      image: input.coverPhotoId
        ? `${this.publicBaseUrl}/api/prug/profiles/${input.carpet.profile.slug}/photos/${input.coverPhotoId}`
        : profileUrl,
      attributes: [
        { trait_type: 'Origin country', value: input.identity.originCountry },
        { trait_type: 'Origin region', value: input.identity.originRegion },
        { trait_type: 'Design family', value: input.identity.designFamily },
        { trait_type: 'Knot type', value: input.identity.knotType },
        {
          trait_type: 'Knot density',
          value: input.identity.estimatedKnotDensity,
        },
        { trait_type: 'Pile material', value: input.identity.pileMaterial },
        { trait_type: 'Warp material', value: input.identity.warpMaterial },
        { trait_type: 'Dyes', value: input.identity.dyeAssessment },
        { trait_type: 'Age', value: input.identity.estimatedAgeRange },
        { trait_type: 'Dimensions', value: input.identity.estimatedDimensions },
        { trait_type: 'Condition', value: input.identity.condition },
        {
          trait_type: 'Certificate',
          value: input.carpet.certificateNumber || 'unissued',
        },
      ],
      properties: {
        certificateNumber: input.carpet.certificateNumber || '',
        documentHash: input.documentHash,
        photoSetHash: input.photoSetHash,
        identityHash: input.identityHash,
        ledgerHeadHash: input.ledgerHeadHash,
        provenance: input.ownership.map((record) => ({
          owner: record.ownerName,
          from: record.acquiredAt
            ? new Date(record.acquiredAt).toISOString()
            : null,
          to: record.releasedAt
            ? new Date(record.releasedAt).toISOString()
            : null,
          verified: record.verified,
        })),
      },
    };
  }

  buildPlan(metadata: Erc721Metadata, documentHash: string): TokenizationPlan {
    return {
      metadata,
      metadataHash: ethers.keccak256(
        ethers.toUtf8Bytes(
          canonicalize(metadata as unknown as Record<string, unknown>),
        ),
      ),
      documentHash,
      chain: 'ethereum',
      network: this.network,
      executable: this.executable,
      mode: this.contractAddress ? 'erc721' : 'anchor',
    };
  }

  /**
   * Write the document hash on chain.
   *
   * With a contract configured this mints an ERC-721 to the owner's address;
   * otherwise it anchors the hash as transaction calldata.
   */
  async execute(input: {
    carpetId: string;
    plan: TokenizationPlan;
    tokenUri: string;
    recipientAddress?: string;
  }): Promise<Omit<CarpetToken, 'id' | 'createdAt'>> {
    if (!this.signer || !this.provider) {
      throw new BadRequestException(
        'On-chain tokenisation is not configured on this deployment (PRUG_ANCHOR_PRIVATE_KEY is unset)',
      );
    }

    const base = {
      carpetId: input.carpetId,
      chain: 'ethereum',
      network: this.network,
      metadataHash: input.plan.metadataHash,
      documentHash: input.plan.documentHash,
      tokenUri: input.tokenUri,
    };

    if (this.contractAddress) {
      if (
        !input.recipientAddress ||
        !ethers.isAddress(input.recipientAddress)
      ) {
        throw new BadRequestException(
          'A valid recipient Ethereum address is required to mint',
        );
      }

      const contract = new ethers.Contract(
        this.contractAddress,
        ERC721_MINT_ABI,
        this.signer,
      );
      const tx = await contract.safeMint(
        input.recipientAddress,
        input.tokenUri,
      );
      const receipt = await tx.wait();

      const tokenId = this.extractTokenId(receipt);
      this.logger.log(
        `Minted carpet ${input.carpetId} as token ${tokenId ?? 'unknown'} in ${tx.hash}`,
      );

      return {
        ...base,
        standard: 'erc721',
        contractAddress: this.contractAddress,
        tokenId,
        anchorTxHash: tx.hash,
        status: receipt?.status === 1 ? 'confirmed' : 'failed',
      };
    }

    const tx = await this.signer.sendTransaction({
      to: this.anchorAddress,
      value: 0n,
      // Tagged so an indexer can find Prug anchors without a contract.
      data: ethers.concat([
        ethers.toUtf8Bytes('PRUG1'),
        input.plan.documentHash as `0x${string}`,
      ]),
    });
    const receipt = await tx.wait();

    this.logger.log(
      `Anchored carpet ${input.carpetId} document hash in ${tx.hash}`,
    );

    return {
      ...base,
      standard: 'anchor',
      contractAddress: null,
      tokenId: null,
      anchorTxHash: tx.hash,
      status: receipt?.status === 1 ? 'confirmed' : 'failed',
    };
  }

  /** Read an anchor transaction back and confirm it carries this hash. */
  async verifyAnchor(
    txHash: string,
    documentHash: string,
  ): Promise<{ found: boolean; matches: boolean; blockNumber?: number }> {
    if (!this.provider) return { found: false, matches: false };

    const tx = await this.provider.getTransaction(txHash);
    if (!tx) return { found: false, matches: false };

    return {
      found: true,
      matches:
        typeof tx.data === 'string' &&
        tx.data
          .toLowerCase()
          .includes(documentHash.replace(/^0x/, '').toLowerCase()),
      blockNumber: tx.blockNumber ?? undefined,
    };
  }

  /** Pull the minted id out of the ERC-721 Transfer event. */
  private extractTokenId(
    receipt: ethers.TransactionReceipt | null,
  ): string | null {
    if (!receipt) return null;

    const contractInterface = new ethers.Interface(ERC721_MINT_ABI);
    for (const log of receipt.logs) {
      try {
        const parsed = contractInterface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (parsed?.name === 'Transfer') {
          return parsed.args.tokenId.toString();
        }
      } catch {
        // Logs from other contracts in the same transaction are expected.
      }
    }
    return null;
  }
}
