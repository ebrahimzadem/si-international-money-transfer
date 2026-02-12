import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, radii, gradients } from '../../design-system';

interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'swap';
  token: string;
  amount: string;
  toAddress: string;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
  usdValue: number;
}

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    type: 'send',
    token: 'ETH',
    amount: '0.25',
    toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    status: 'completed',
    createdAt: '2026-02-07T10:30:00Z',
    usdValue: 585.50,
  },
  {
    id: '2',
    type: 'receive',
    token: 'BTC',
    amount: '0.01',
    toAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    status: 'completed',
    createdAt: '2026-02-06T14:20:00Z',
    usdValue: 432.10,
  },
  {
    id: '3',
    type: 'send',
    token: 'USDC',
    amount: '500.00',
    toAddress: '0x8e23Ee67d1332aD560396262C48ffbB273f626',
    status: 'pending',
    createdAt: '2026-02-06T09:15:00Z',
    usdValue: 500.00,
  },
  {
    id: '4',
    type: 'receive',
    token: 'ETH',
    amount: '1.5',
    toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    status: 'completed',
    createdAt: '2026-02-05T16:45:00Z',
    usdValue: 3514.20,
  },
  {
    id: '5',
    type: 'swap',
    token: 'BTC',
    amount: '0.005',
    toAddress: 'ETH',
    status: 'completed',
    createdAt: '2026-02-04T11:00:00Z',
    usdValue: 216.05,
  },
  {
    id: '6',
    type: 'send',
    token: 'USDC',
    amount: '1200.00',
    toAddress: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
    status: 'failed',
    createdAt: '2026-02-03T08:30:00Z',
    usdValue: 1200.00,
  },
];

const TOKEN_GRADIENTS: Record<string, [string, string]> = {
  BTC: gradients.bitcoin,
  ETH: gradients.ethereum,
  USDC: gradients.usdc,
  USDT: gradients.usdt,
};

const TYPE_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  send: 'arrow-up-right',
  receive: 'arrow-down-left',
  swap: 'repeat',
};

const STATUS_CONFIG = {
  completed: { label: 'Completed', color: colors.success, bg: '#ECFDF5' },
  pending: { label: 'Pending', color: colors.warning, bg: '#FFFBEB' },
  failed: { label: 'Failed', color: colors.error, bg: '#FEF2F2' },
};

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'send' | 'receive' | 'swap'>('all');

  const loadTransactions = async () => {
    try {
      const api = require('../../services/api').default;
      const data = await api.getTransactions();
      if (data && data.length > 0) {
        const mapped: Transaction[] = data.map((tx: any) => ({
          id: tx.id,
          type: tx.direction === 'inbound' ? 'receive' : 'send',
          token: tx.token,
          amount: tx.amount,
          toAddress: tx.toAddress || tx.to_address || '',
          status: tx.status === 'confirmed' ? 'completed' : tx.status,
          createdAt: tx.createdAt || tx.created_at,
          usdValue: tx.usdValue || 0,
        }));
        setTransactions(mapped);
      }
    } catch {
      // Keep mock data when API unavailable
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const filteredTx = activeFilter === 'all'
    ? transactions
    : transactions.filter((tx) => tx.type === activeFilter);

  const filters = [
    { key: 'all' as const, label: 'All' },
    { key: 'send' as const, label: 'Sent' },
    { key: 'receive' as const, label: 'Received' },
    { key: 'swap' as const, label: 'Swaps' },
  ];

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
        <Text style={styles.headerSubtitle}>
          {transactions.length} transactions
        </Text>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterChip,
              activeFilter === f.key && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === f.key && styles.filterTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transactions */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
            colors={[colors.primary[500]]}
          />
        }
      >
        {filteredTx.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color={colors.neutral[300]} />
            <Text style={styles.emptyText}>No transactions</Text>
            <Text style={styles.emptySubtext}>
              {activeFilter === 'all'
                ? 'Your transaction history will appear here'
                : `No ${activeFilter} transactions found`}
            </Text>
          </View>
        ) : (
          filteredTx.map((tx) => {
            const statusInfo = STATUS_CONFIG[tx.status];
            const tokenGrad = TOKEN_GRADIENTS[tx.token] || gradients.primary;
            const date = new Date(tx.createdAt);
            const formattedDate = date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });

            return (
              <TouchableOpacity key={tx.id} style={styles.txRow} activeOpacity={0.6}>
                <LinearGradient colors={tokenGrad} style={styles.txIcon}>
                  <Feather
                    name={TYPE_ICON[tx.type]}
                    size={16}
                    color={colors.white}
                  />
                </LinearGradient>

                <View style={styles.txInfo}>
                  <Text style={styles.txTitle}>
                    {tx.type === 'send' ? 'Sent' : tx.type === 'receive' ? 'Received' : 'Swapped'} {tx.token}
                  </Text>
                  <Text style={styles.txMeta}>
                    {tx.type === 'swap'
                      ? `→ ${tx.toAddress}`
                      : `${tx.toAddress.slice(0, 8)}...${tx.toAddress.slice(-4)}`}
                    {' · '}
                    {formattedDate}
                  </Text>
                </View>

                <View style={styles.txRight}>
                  <Text
                    style={[
                      styles.txAmount,
                      { color: tx.type === 'receive' ? colors.success : colors.neutral[800] },
                    ]}
                  >
                    {tx.type === 'receive' ? '+' : '-'}{tx.amount} {tx.token}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>
                      {statusInfo.label}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
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
    paddingTop: 60,
    paddingBottom: spacing[4],
    paddingHorizontal: spacing[5],
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[200],
  },
  headerTitle: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.neutral[900],
  },
  headerSubtitle: {
    fontSize: typography.size.sm,
    color: colors.neutral[500],
    marginTop: 2,
  },

  // Filters
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    gap: spacing[2],
    backgroundColor: colors.white,
  },
  filterChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    backgroundColor: colors.neutral[100],
  },
  filterChipActive: {
    backgroundColor: colors.primary[500],
  },
  filterText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.neutral[500],
  },
  filterTextActive: {
    color: colors.white,
  },

  // List
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: spacing[3],
    paddingBottom: spacing[10],
  },

  // Transaction Row
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3] + 2,
    paddingHorizontal: spacing[5],
    backgroundColor: colors.white,
    marginBottom: 1,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semiBold,
    color: colors.neutral[800],
  },
  txMeta: {
    fontSize: typography.size.xs,
    color: colors.neutral[400],
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semiBold,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: typography.weight.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Empty
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: spacing[3],
  },
  emptyText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semiBold,
    color: colors.neutral[500],
  },
  emptySubtext: {
    fontSize: typography.size.sm,
    color: colors.neutral[400],
    textAlign: 'center',
  },
});
