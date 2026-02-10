# Si Crypto Platform

Full cryptocurrency platform with custodial wallets supporting BTC, ETH, and USDC. Built with React Native mobile app and NestJS backend.

## 🚀 Project Status - Week 1

**Setup Progress: 60% Complete**

✅ Turborepo monorepo structure initialized
✅ NestJS backend created in `apps/backend/`
✅ React Native Expo app created in `apps/mobile/`
✅ Shared packages created (`@si/shared-types`, `@si/shared-utils`)
🔄 PostgreSQL database schema (in progress)
⏳ ESLint/Prettier configuration
⏳ CI/CD pipeline setup
⏳ Third-party service signups

## 📁 Project Structure

```
si-hello-world/
├── apps/
│   ├── backend/              # NestJS API server (Port 3000)
│   │   └── src/
│   │       ├── app.module.ts
│   │       ├── main.ts
│   │       └── (modules to be added)
│   │
│   └── mobile/               # React Native Expo app
│       ├── App.tsx
│       └── package.json
│
├── packages/
│   ├── shared-types/         # Shared TypeScript types ✅
│   │   └── src/
│   │       └── index.ts      # User, Wallet, Transaction types
│   │
│   └── shared-utils/         # Shared utility functions ✅
│       └── src/
│           ├── crypto/       # formatCryptoAmount, toSmallestUnit
│           ├── validation/   # isValidAddress, isValidEmail
│           └── formatting/   # formatDate, formatUsd
│
├── package.json              # Root package.json with Turbo scripts
├── turbo.json                # Turborepo pipeline config
├── pnpm-workspace.yaml       # pnpm workspaces
└── README.md                 # This file
```

## 🛠️ Tech Stack

### Installed ✅
- **Monorepo**: Turborepo 2.8.3 + pnpm 9.15.4
- **Mobile**: React Native 0.81.5 + Expo 54.0.33
- **Backend**: NestJS 10.x + TypeScript 5.9.3
- **Node.js**: v24.13.0 (npm 11.6.2)

### To Install (Week 2)
- **Database**: PostgreSQL 15+ (via Docker)
- **Cache**: Redis 7+ (via Docker)
- **Blockchain**: ethers.js, bitcoinjs-lib, bip39, bip32
- **ORM**: Prisma or TypeORM
- **Validation**: class-validator, zod
- **API**: @nestjs/swagger, @nestjs/websockets

### External Services (Sign-up Required)
| Service | Purpose | Cost | Status |
|---------|---------|------|--------|
| Alchemy | Ethereum node | $200/mo | ⏳ Signup needed |
| Blockchair | Bitcoin API | $500/mo | ⏳ Signup needed |
| MoonPay | Buy crypto | 4.5% fee | ⏳ Signup needed |
| Sumsub | KYC | $0.50-2/check | ⏳ Signup needed |
| AWS KMS | Key management | $50/mo | ⏳ Setup needed |
| CoinGecko | Price feeds | $130/mo | ⏳ Signup needed |

## 🚀 Quick Start

### Installation

```bash
# Install all workspace dependencies
pnpm install

# Build shared packages first
pnpm --filter @si/shared-types build
pnpm --filter @si/shared-utils build
```

### Run Development

```bash
# Run all apps in dev mode
pnpm dev

# Or run individually:

# Backend only
cd apps/backend
pnpm run start:dev

# Mobile only
cd apps/mobile
pnpm start
```

### Build for Production

```bash
# Build all packages and apps
pnpm build

# Build specific app
pnpm --filter backend build
pnpm --filter mobile build
```

## 📦 Shared Packages

### @si/shared-types

All TypeScript interfaces and enums:

```typescript
import {
  Token,
  Chain,
  User,
  Wallet,
  BlockchainTransaction,
  WithdrawRequest,
  SwapQuoteResponse
} from '@si/shared-types';

// Available enums
enum Chain { BITCOIN = 'bitcoin', ETHEREUM = 'ethereum' }
enum Token { BTC = 'BTC', ETH = 'ETH', USDC = 'USDC' }
enum TransactionStatus { PENDING, CONFIRMED, FAILED }
enum KYCStatus { PENDING, VERIFIED, REJECTED }
```

### @si/shared-utils

Crypto utility functions:

```typescript
import {
  formatCryptoAmount,
  toSmallestUnit,
  fromSmallestUnit,
  isValidAddress,
  formatUsd,
  truncateAddress
} from '@si/shared-utils';

// Format crypto amounts
formatCryptoAmount('0.12345678', Token.BTC); // "0.12345678"
formatCryptoAmount('1234.56', Token.ETH);    // "1234.5600"

// Convert to wei/satoshis
const wei = toSmallestUnit('1.5', Token.ETH);      // 1500000000000000000n
const satoshis = toSmallestUnit('0.001', Token.BTC); // 100000n

// Validate addresses
isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', Chain.ETHEREUM); // true
isValidAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', Chain.BITCOIN);  // true

// Format display
truncateAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'); // "0x742d...f0bEb"
formatUsd(1234.56); // "$1,234.56"
```

## 🗄️ Database Schema (To Be Created)

**Next Step**: Create PostgreSQL schema with these tables:

- **users** - User accounts, email, KYC status
- **wallets** - Multi-chain addresses (BTC, ETH)
- **crypto_balances** - Per-token balances with USD value
- **blockchain_transactions** - All deposits/withdrawals
- **withdrawals** - Withdrawal requests with approval workflow
- **on_ramp_transactions** - MoonPay purchases
- **swaps** - Internal crypto-to-crypto swaps
- **price_history** - Historical price snapshots

SQL schema file will be created at: `apps/backend/sql/schema.sql`

## 🔐 Security Architecture

### Custodial Wallet Model
- **Master Seed**: Encrypted in AWS KMS
- **Derivation Path**: `m/44'/coin'/0'/0/{userId}` (BIP44)
- **Hot Wallet**: 5-10% of funds (AWS KMS signing)
- **Cold Wallet**: 90-95% in hardware wallets (2-of-3 multi-sig)

### Key Features
- All transaction signatures via AWS KMS
- Withdrawal limits based on KYC tier
- Velocity checks and rate limiting
- Circuit breaker for unusual activity
- Crypto custody insurance

## 📋 MVP Scope (18 Weeks)

### ✅ Week 1 - Project Setup (Current)
- Turborepo monorepo ✅
- NestJS backend ✅
- React Native app ✅
- Shared packages ✅
- Database schema 🔄
- CI/CD pipeline ⏳

### 📅 Week 2-4 - Blockchain Integration
- Bitcoin wallet generation (BIP39/BIP44)
- Ethereum wallet generation
- AWS KMS integration
- Transaction signing service

### 📅 Week 5-10 - Core Features
- User auth & KYC (Sumsub)
- Wallet service (create, balances)
- Withdrawal service
- MoonPay integration
- Transaction monitoring
- Price feeds (CoinGecko)

### 📅 Week 11-14 - Advanced Features
- Internal swaps
- Transaction history
- Mobile app UI
- Portfolio dashboard

### 📅 Week 15-18 - Security & Launch
- Security hardening
- Compliance setup
- Testing & QA
- Soft launch (WY, MT, SC)

## ❌ Out of Scope for MVP

Deferred to post-MVP (Months 5-12):
- Polygon and Solana support
- Multiple on-ramp providers
- Off-ramp to bank account
- DEX integration (1inch)
- MPC/hybrid custody
- Staking and DeFi features
- Full US state licensing

## 🔧 Development Commands

```bash
# Install dependencies
pnpm install

# Development mode (all apps)
pnpm dev

# Build all
pnpm build

# Lint all
pnpm lint

# Format code
pnpm format

# Clean build artifacts
pnpm clean

# Run backend tests
pnpm --filter backend test

# Run mobile app
cd apps/mobile && pnpm start
```

## 📖 Documentation

- **[Implementation Plan](.claude/plans/glimmering-orbiting-shore.md)** - Full 18-week plan
- API Documentation - Coming in Week 2
- Mobile App Guide - Coming in Week 3
- Deployment Guide - Coming in Week 4

## 🤝 Team

**Current Phase**: Week 1 Setup

Planned team structure:
- Backend Developers: 2 (to be hired)
- Mobile Developer: 1 (to be hired)
- Compliance Officer: 1 (to be hired)
- DevOps: Part-time (to be hired)

## 💰 Budget & Timeline

- **MVP Budget**: $1.5M
- **Timeline**: 18 weeks (4.5 months)
- **Monthly Operating**: $55-60k
- **Target Launch**: Wyoming, Montana, South Carolina

## 📄 License

Proprietary - All Rights Reserved

---

**Current Version**: 1.0.0
**Last Updated**: February 2026
**Status**: Week 1 - Initial Setup Phase
