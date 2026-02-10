import { Chain } from '@si/shared-types';

/**
 * Validate Bitcoin address format
 */
export function isValidBitcoinAddress(address: string): boolean {
  // Basic validation - proper regex would be more complex
  const bech32Regex = /^(bc1|tb1)[a-z0-9]{39,87}$/i;
  const legacyRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const p2shRegex = /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/;

  return (
    bech32Regex.test(address) ||
    legacyRegex.test(address) ||
    p2shRegex.test(address)
  );
}

/**
 * Validate Ethereum address format
 */
export function isValidEthereumAddress(address: string): boolean {
  // Basic validation - checks 0x prefix and 40 hex characters
  const ethereumRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethereumRegex.test(address);
}

/**
 * Validate address based on chain
 */
export function isValidAddress(address: string, chain: Chain): boolean {
  switch (chain) {
    case Chain.BITCOIN:
      return isValidBitcoinAddress(address);
    case Chain.ETHEREUM:
      return isValidEthereumAddress(address);
    default:
      return false;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate amount is positive and has valid format
 */
export function isValidAmount(amount: string): boolean {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && isFinite(num);
}

/**
 * Validate transaction hash format
 */
export function isValidTxHash(hash: string, chain: Chain): boolean {
  switch (chain) {
    case Chain.BITCOIN:
      // Bitcoin tx hash: 64 hex characters
      return /^[a-fA-F0-9]{64}$/.test(hash);
    case Chain.ETHEREUM:
      // Ethereum tx hash: 0x + 64 hex characters
      return /^0x[a-fA-F0-9]{64}$/.test(hash);
    default:
      return false;
  }
}
