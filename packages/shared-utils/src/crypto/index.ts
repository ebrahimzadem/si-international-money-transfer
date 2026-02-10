import { Token } from '@si/shared-types';

/**
 * Format crypto amount to human-readable string with appropriate decimals
 */
export function formatCryptoAmount(amount: string, token: Token): string {
  const decimals = getTokenDecimals(token);
  const num = parseFloat(amount);

  if (isNaN(num)) return '0';

  // For small amounts, show more decimals
  if (num < 0.01) {
    return num.toFixed(8);
  } else if (num < 1) {
    return num.toFixed(6);
  } else if (num < 100) {
    return num.toFixed(4);
  } else {
    return num.toFixed(2);
  }
}

/**
 * Get decimal precision for a token
 */
export function getTokenDecimals(token: Token): number {
  switch (token) {
    case Token.BTC:
      return 8;
    case Token.ETH:
      return 18;
    case Token.USDC:
      return 6;
    case Token.USDT:
      return 6;
    default:
      return 18;
  }
}

/**
 * Convert crypto amount to smallest unit (satoshis, wei, etc.)
 */
export function toSmallestUnit(amount: string, token: Token): bigint {
  const decimals = getTokenDecimals(token);
  const amountFloat = parseFloat(amount);
  const multiplier = BigInt(10 ** decimals);

  // Convert to integer to avoid floating point issues
  const integerPart = Math.floor(amountFloat);
  const decimalPart = amountFloat - integerPart;

  const integerWei = BigInt(integerPart) * multiplier;
  const decimalWei = BigInt(Math.round(decimalPart * Number(multiplier)));

  return integerWei + decimalWei;
}

/**
 * Convert from smallest unit to human-readable amount
 */
export function fromSmallestUnit(amount: bigint, token: Token): string {
  const decimals = getTokenDecimals(token);
  const divisor = BigInt(10 ** decimals);

  const integerPart = amount / divisor;
  const remainder = amount % divisor;

  const decimalPart = Number(remainder) / Number(divisor);
  const total = Number(integerPart) + decimalPart;

  return total.toString();
}

/**
 * Format USD amount
 */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(
  oldValue: number,
  newValue: number
): number {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Truncate blockchain address for display
 */
export function truncateAddress(address: string, chars: number = 6): string {
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
