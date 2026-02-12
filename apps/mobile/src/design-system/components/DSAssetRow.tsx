import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, radii, gradients } from '../tokens';

const TOKEN_META: Record<string, { name: string; icon: keyof typeof Feather.glyphMap; gradient: [string, string] }> = {
  BTC: { name: 'Bitcoin', icon: 'circle', gradient: gradients.bitcoin },
  ETH: { name: 'Ethereum', icon: 'hexagon', gradient: gradients.ethereum },
  USDC: { name: 'USD Coin', icon: 'dollar-sign', gradient: gradients.usdc },
  USDT: { name: 'Tether', icon: 'dollar-sign', gradient: gradients.usdt },
};

interface DSAssetRowProps {
  token: string;
  balance: string;
  balanceUsd: number;
  price?: number;
  priceChange?: number;
  onPress?: () => void;
  borderBottom?: boolean;
}

export default function DSAssetRow({
  token,
  balance,
  balanceUsd,
  price,
  priceChange,
  onPress,
  borderBottom = true,
}: DSAssetRowProps) {
  const meta = TOKEN_META[token] || TOKEN_META.BTC;
  const isPositive = (priceChange || 0) >= 0;

  return (
    <TouchableOpacity
      style={[styles.container, borderBottom && styles.border]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      {/* Token Icon */}
      <LinearGradient colors={meta.gradient} style={styles.iconContainer}>
        <Feather name={meta.icon} size={18} color={colors.white} />
      </LinearGradient>

      {/* Token Name + Price */}
      <View style={styles.nameCol}>
        <Text style={styles.tokenName}>{meta.name}</Text>
        <Text style={styles.tokenSymbol}>
          {token}
          {price ? ` \u00B7 $${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
        </Text>
      </View>

      {/* Balance */}
      <View style={styles.balanceCol}>
        <Text style={styles.balanceUsd}>
          ${balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceToken}>
            {parseFloat(balance).toFixed(token === 'USDC' || token === 'USDT' ? 2 : 6)}
          </Text>
          {priceChange !== undefined && (
            <Text style={[styles.change, { color: isPositive ? colors.success : colors.error }]}>
              {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[200],
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameCol: {
    flex: 1,
  },
  tokenName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semiBold,
    color: colors.neutral[800],
  },
  tokenSymbol: {
    fontSize: typography.size.sm,
    color: colors.neutral[500],
    marginTop: 1,
  },
  balanceCol: {
    alignItems: 'flex-end',
  },
  balanceUsd: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semiBold,
    color: colors.neutral[800],
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: 1,
  },
  balanceToken: {
    fontSize: typography.size.sm,
    color: colors.neutral[500],
  },
  change: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semiBold,
  },
});
