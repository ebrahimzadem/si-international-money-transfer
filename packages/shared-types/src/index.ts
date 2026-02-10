// Core enums
export enum Chain {
  BITCOIN = 'bitcoin',
  ETHEREUM = 'ethereum',
}

export enum Token {
  BTC = 'BTC',
  ETH = 'ETH',
  USDC = 'USDC',
  USDT = 'USDT',
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

export enum TransactionDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum KYCStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum WithdrawalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  BROADCASTED = 'broadcasted',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

// User types
export interface User {
  id: string;
  email: string;
  kycStatus: KYCStatus;
  kycLevel: number; // 1, 2, 3
  createdAt: Date;
  updatedAt: Date;
}

// Wallet types
export interface Wallet {
  id: string;
  userId: string;
  chain: Chain;
  address: string;
  derivationPath: string;
  createdAt: Date;
}

export interface CryptoBalance {
  id: string;
  walletId: string;
  token: Token;
  balance: string; // Decimal as string to avoid precision issues
  usdValue: number;
  lastUpdated: Date;
}

// Transaction types
export interface BlockchainTransaction {
  id: string;
  userId: string;
  walletId: string;
  chain: Chain;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  token: Token;
  amount: string;
  gasFee: string;
  status: TransactionStatus;
  confirmations: number;
  requiredConfirmations: number;
  direction: TransactionDirection;
  createdAt: Date;
  confirmedAt?: Date;
}

// Withdrawal types
export interface Withdrawal {
  id: string;
  userId: string;
  blockchainTransactionId?: string;
  toAddress: string;
  amount: string;
  token: Token;
  chain: Chain;
  gasFee: string;
  status: WithdrawalStatus;
  approvalRequired: boolean;
  createdAt: Date;
}

// On-ramp types
export interface OnRampTransaction {
  id: string;
  userId: string;
  provider: string; // 'moonpay'
  externalId: string;
  fiatAmount: number;
  fiatCurrency: string; // 'USD', 'EUR'
  cryptoAmount: string;
  cryptoCurrency: Token;
  status: string;
  providerFee: number;
  createdAt: Date;
  completedAt?: Date;
}

// Swap types
export interface Swap {
  id: string;
  userId: string;
  fromToken: Token;
  toToken: Token;
  fromAmount: string;
  toAmount: string;
  exchangeRate: string;
  feeAmount: string;
  status: string;
  createdAt: Date;
  completedAt?: Date;
}

// Price types
export interface Price {
  token: Token;
  priceUsd: number;
  timestamp: Date;
}

export interface PriceHistory {
  token: Token;
  prices: Array<{
    timestamp: Date;
    price: number;
  }>;
}

// API Request/Response types
export interface CreateWalletRequest {
  chain: Chain;
}

export interface CreateWalletResponse {
  wallet: Wallet;
  balance: CryptoBalance;
}

export interface GetBalancesResponse {
  balances: CryptoBalance[];
  totalUsdValue: number;
}

export interface WithdrawRequest {
  toAddress: string;
  amount: string;
  token: Token;
  chain: Chain;
}

export interface WithdrawResponse {
  withdrawal: Withdrawal;
  estimatedGasFee: string;
}

export interface SwapQuoteRequest {
  fromToken: Token;
  toToken: Token;
  fromAmount: string;
}

export interface SwapQuoteResponse {
  fromToken: Token;
  toToken: Token;
  fromAmount: string;
  toAmount: string;
  exchangeRate: string;
  feeAmount: string;
  feePercentage: number;
}

export interface ExecuteSwapRequest {
  fromToken: Token;
  toToken: Token;
  fromAmount: string;
}

export interface ExecuteSwapResponse {
  swap: Swap;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// KYC types
export interface InitiateKYCRequest {
  userId: string;
}

export interface InitiateKYCResponse {
  verificationUrl: string;
  sessionId: string;
}

export interface KYCStatusResponse {
  status: KYCStatus;
  level: number;
  verifiedAt?: Date;
}

// Portfolio types
export interface PortfolioSummary {
  totalUsdValue: number;
  balances: Array<{
    token: Token;
    balance: string;
    usdValue: number;
    priceUsd: number;
    change24h: number;
  }>;
  recentTransactions: BlockchainTransaction[];
}
