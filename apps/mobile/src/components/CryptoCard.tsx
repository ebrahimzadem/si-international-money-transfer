import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, FontSizes, Spacing, BorderRadius } from '../theme/colors';

interface CryptoCardProps {
  token: 'BTC' | 'ETH' | 'USDC' | 'USDT';
  balance: string;
  balanceUsd: number;
  address: string;
  onPress?: () => void;
}

const TOKEN_DATA = {
  BTC: {
    name: 'Bitcoin',
    symbol: '₿',
    gradient: ['#F7931A', '#FFA726'] as [string, string],
    icon: '🟠',
  },
  ETH: {
    name: 'Ethereum',
    symbol: 'Ξ',
    gradient: ['#627EEA', '#4A90E2'] as [string, string],
    icon: '💎',
  },
  USDC: {
    name: 'USD Coin',
    symbol: '$',
    gradient: ['#2775CA', '#1E88E5'] as [string, string],
    icon: '🔵',
  },
  USDT: {
    name: 'Tether',
    symbol: '₮',
    gradient: ['#26A17B', '#4CAF50'] as [string, string],
    icon: '🟢',
  },
};

export default function CryptoCard({ token, balance, balanceUsd, address, onPress }: CryptoCardProps) {
  const data = TOKEN_DATA[token];
  const scaleAnim = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
    >
      <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient
          colors={data.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.tokenInfo}>
              <Text style={styles.icon}>{data.icon}</Text>
              <View>
                <Text style={styles.tokenName}>{data.name}</Text>
                <Text style={styles.tokenSymbol}>{token}</Text>
              </View>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Active</Text>
            </View>
          </View>

          {/* Balance */}
          <View style={styles.balanceSection}>
            <Text style={styles.balanceLabel}>Balance</Text>
            <Text style={styles.balance}>
              {data.symbol} {parseFloat(balance).toFixed(6)}
            </Text>
            <Text style={styles.balanceUsd}>${balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>

          {/* Address */}
          <View style={styles.addressSection}>
            <Text style={styles.addressLabel}>Wallet Address</Text>
            <Text style={styles.address} numberOfLines={1}>
              {address.slice(0, 12)}...{address.slice(-12)}
            </Text>
          </View>

          {/* Decorative Elements */}
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xxl,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  gradient: {
    padding: Spacing.xxl,
    borderRadius: BorderRadius.xxl,
    minHeight: 180,
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  icon: {
    fontSize: 40,
  },
  tokenName: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  tokenSymbol: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.regular,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.semiBold,
    color: Colors.white,
  },
  balanceSection: {
    marginBottom: Spacing.lg,
  },
  balanceLabel: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.regular,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: Spacing.xs,
  },
  balance: {
    fontSize: FontSizes.xxxl,
    fontFamily: Fonts.extraBold,
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  balanceUsd: {
    fontSize: FontSizes.lg,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  addressSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  addressLabel: {
    fontSize: FontSizes.xs,
    fontFamily: Fonts.regular,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: Spacing.xs,
  },
  address: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.white,
  },
  // Decorative elements
  decorCircle1: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: -50,
    right: -50,
  },
  decorCircle2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    bottom: -30,
    left: -30,
  },
});
