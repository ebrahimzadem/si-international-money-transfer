import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { DSCard, colors, typography, spacing, radii, shadows, gradients } from '../../design-system';

const TOKEN_META: Record<string, { name: string; icon: keyof typeof Feather.glyphMap; gradient: [string, string] }> = {
  BTC: { name: 'Bitcoin', icon: 'circle', gradient: gradients.bitcoin },
  ETH: { name: 'Ethereum', icon: 'hexagon', gradient: gradients.ethereum },
  USDC: { name: 'USD Coin', icon: 'dollar-sign', gradient: gradients.usdc },
  USDT: { name: 'Tether', icon: 'dollar-sign', gradient: gradients.usdt },
};

const MOCK_PRICES: Record<string, { price: number; change24h: number; high24h: number; low24h: number; marketCap: string; volume: string }> = {
  BTC: { price: 43150.00, change24h: 2.34, high24h: 43890.00, low24h: 42100.00, marketCap: '$845B', volume: '$28.5B' },
  ETH: { price: 2342.00, change24h: -0.85, high24h: 2390.00, low24h: 2310.00, marketCap: '$281B', volume: '$15.2B' },
  USDC: { price: 1.00, change24h: 0.01, high24h: 1.001, low24h: 0.999, marketCap: '$25B', volume: '$8.1B' },
  USDT: { price: 1.00, change24h: -0.02, high24h: 1.002, low24h: 0.998, marketCap: '$95B', volume: '$52.3B' },
};

const MOCK_TXS: Record<string, Array<{ id: string; type: 'send' | 'receive'; amount: string; date: string; status: 'completed' | 'pending' }>> = {
  BTC: [
    { id: '1', type: 'receive', amount: '0.01', date: 'Feb 7', status: 'completed' },
    { id: '2', type: 'send', amount: '0.005', date: 'Feb 4', status: 'completed' },
  ],
  ETH: [
    { id: '3', type: 'send', amount: '0.25', date: 'Feb 7', status: 'completed' },
    { id: '4', type: 'receive', amount: '1.5', date: 'Feb 5', status: 'completed' },
  ],
  USDC: [
    { id: '5', type: 'send', amount: '500.00', date: 'Feb 6', status: 'pending' },
    { id: '6', type: 'send', amount: '1200.00', date: 'Feb 3', status: 'completed' },
  ],
  USDT: [],
};

export default function TokenDetailScreen({ route, navigation }: any) {
  const token = route?.params?.token || 'BTC';
  const { balances } = useSelector((state: RootState) => state.wallet);
  const balance = balances.find((b) => b.token === token);
  const meta = TOKEN_META[token] || TOKEN_META.BTC;
  const priceData = MOCK_PRICES[token] || MOCK_PRICES.BTC;
  const transactions = MOCK_TXS[token] || [];
  const [refreshing, setRefreshing] = useState(false);

  const isPositive = priceData.change24h >= 0;

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 1000));
    setRefreshing(false);
  };

  const actions = [
    { key: 'send', label: 'Send', icon: 'arrow-up-right' as const, route: 'Send' },
    { key: 'receive', label: 'Receive', icon: 'arrow-down-left' as const, route: 'Receive' },
    { key: 'swap', label: 'Swap', icon: 'repeat' as const, route: 'Swap' },
  ];

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={colors.neutral[800]} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <LinearGradient colors={meta.gradient} style={styles.headerIcon}>
            <Feather name={meta.icon} size={14} color={colors.white} />
          </LinearGradient>
          <Text style={styles.headerTitle}>{meta.name}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
            colors={[colors.primary[500]]}
          />
        }
      >
        {/* Balance */}
        <View style={styles.balanceSection}>
          <Text style={styles.balanceUsd}>
            ${balance ? balance.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
          </Text>
          <Text style={styles.balanceCrypto}>
            {balance ? parseFloat(balance.balance).toFixed(token === 'USDC' || token === 'USDT' ? 2 : 6) : '0.000000'} {token}
          </Text>
          <View style={styles.changeBadge}>
            <Feather
              name={isPositive ? 'trending-up' : 'trending-down'}
              size={14}
              color={isPositive ? colors.success : colors.error}
            />
            <Text style={[styles.changeText, { color: isPositive ? colors.success : colors.error }]}>
              {isPositive ? '+' : ''}{priceData.change24h.toFixed(2)}% today
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          {actions.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={styles.actionBtn}
              activeOpacity={0.7}
              onPress={() => navigation.navigate(a.route)}
            >
              <View style={styles.actionCircle}>
                <Feather name={a.icon} size={20} color={colors.primary[600]} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Market Data */}
        <Text style={styles.sectionLabel}>Market Data</Text>
        <DSCard variant="default" padding={0}>
          {[
            { label: 'Price', value: `$${priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
            { label: '24h High', value: `$${priceData.high24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
            { label: '24h Low', value: `$${priceData.low24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
            { label: 'Market Cap', value: priceData.marketCap },
            { label: '24h Volume', value: priceData.volume },
          ].map((row, i, arr) => (
            <View
              key={row.label}
              style={[styles.dataRow, i < arr.length - 1 && styles.dataRowBorder]}
            >
              <Text style={styles.dataLabel}>{row.label}</Text>
              <Text style={styles.dataValue}>{row.value}</Text>
            </View>
          ))}
        </DSCard>

        {/* Recent Activity */}
        <Text style={styles.sectionLabel}>Recent Activity</Text>
        {transactions.length === 0 ? (
          <DSCard variant="default">
            <View style={styles.emptyState}>
              <Feather name="inbox" size={36} color={colors.neutral[300]} />
              <Text style={styles.emptyText}>No {token} transactions yet</Text>
            </View>
          </DSCard>
        ) : (
          <DSCard variant="default" padding={0}>
            {transactions.map((tx, i) => (
              <View
                key={tx.id}
                style={[styles.txRow, i < transactions.length - 1 && styles.dataRowBorder]}
              >
                <View style={[styles.txIconBg, { backgroundColor: tx.type === 'receive' ? '#ECFDF5' : '#FEF2F2' }]}>
                  <Feather
                    name={tx.type === 'receive' ? 'arrow-down-left' : 'arrow-up-right'}
                    size={14}
                    color={tx.type === 'receive' ? colors.success : colors.error}
                  />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txType}>{tx.type === 'receive' ? 'Received' : 'Sent'}</Text>
                  <Text style={styles.txDate}>{tx.date}</Text>
                </View>
                <Text
                  style={[
                    styles.txAmount,
                    { color: tx.type === 'receive' ? colors.success : colors.neutral[800] },
                  ]}
                >
                  {tx.type === 'receive' ? '+' : '-'}{tx.amount} {token}
                </Text>
              </View>
            ))}
          </DSCard>
        )}

        {/* Wallet Address */}
        {balance && (
          <>
            <Text style={styles.sectionLabel}>Wallet Address</Text>
            <DSCard variant="default">
              <Text style={styles.addressText} numberOfLines={1}>
                {balance.address}
              </Text>
            </DSCard>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: spacing[3],
    paddingHorizontal: spacing[5],
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[200],
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semiBold,
    color: colors.neutral[800],
  },
  headerRight: {
    width: 40,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[10],
  },

  // Balance
  balanceSection: {
    alignItems: 'center',
    paddingVertical: spacing[6],
  },
  balanceUsd: {
    fontSize: 36,
    fontWeight: typography.weight.bold,
    color: colors.neutral[900],
    letterSpacing: -0.5,
  },
  balanceCrypto: {
    fontSize: typography.size.base,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[3],
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radii.full,
  },
  changeText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[8],
    marginBottom: spacing[6],
  },
  actionBtn: {
    alignItems: 'center',
    gap: spacing[2],
  },
  actionCircle: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.neutral[600],
  },

  // Section
  sectionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semiBold,
    color: colors.neutral[400],
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: spacing[5],
    marginBottom: spacing[2],
    marginLeft: spacing[1],
  },

  // Data rows
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  dataRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[200],
  },
  dataLabel: {
    fontSize: typography.size.sm,
    color: colors.neutral[500],
  },
  dataValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semiBold,
    color: colors.neutral[800],
  },

  // Transactions
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  txIconBg: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  txInfo: {
    flex: 1,
  },
  txType: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.neutral[800],
  },
  txDate: {
    fontSize: typography.size.xs,
    color: colors.neutral[400],
    marginTop: 1,
  },
  txAmount: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semiBold,
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[8],
    gap: spacing[3],
  },
  emptyText: {
    fontSize: typography.size.sm,
    color: colors.neutral[400],
  },

  // Address
  addressText: {
    fontSize: typography.size.xs,
    color: colors.neutral[500],
    fontFamily: 'monospace',
  },
});
