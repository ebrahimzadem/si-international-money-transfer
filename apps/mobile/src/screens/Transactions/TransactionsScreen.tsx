import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme/colors';

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

const TOKEN_COLORS: Record<string, [string, string]> = {
  BTC: ['#F7931A', '#FFA726'],
  ETH: ['#627EEA', '#4A90E2'],
  USDC: ['#2775CA', '#1E88E5'],
  USDT: ['#26A17B', '#4CAF50'],
};

const TYPE_CONFIG = {
  send: { icon: '↑', label: 'Sent', color: Colors.error },
  receive: { icon: '↓', label: 'Received', color: Colors.success },
  swap: { icon: '⇄', label: 'Swapped', color: '#8B5CF6' },
};

const STATUS_CONFIG = {
  completed: { label: 'Completed', color: Colors.success, bg: '#ECFDF5' },
  pending: { label: 'Pending', color: Colors.warning, bg: '#FFFBEB' },
  failed: { label: 'Failed', color: Colors.error, bg: '#FEF2F2' },
};

interface TxCardProps {
  tx: Transaction;
  index: number;
}

function TransactionCard({ tx, index }: TxCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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

  const typeInfo = TYPE_CONFIG[tx.type];
  const statusInfo = STATUS_CONFIG[tx.status];
  const tokenColors: [string, string] = TOKEN_COLORS[tx.token] || [Colors.primary, Colors.secondary];
  const date = new Date(tx.createdAt);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
      }}
    >
      <TouchableOpacity
        style={styles.txCard}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {/* Left: Icon + Info */}
        <View style={styles.txLeft}>
          <LinearGradient
            colors={tokenColors}
            style={styles.txIconContainer}
          >
            <Text style={styles.txIcon}>{typeInfo.icon}</Text>
          </LinearGradient>
          <View style={styles.txInfo}>
            <Text style={styles.txTitle}>
              {typeInfo.label} {tx.token}
            </Text>
            <Text style={styles.txAddress}>
              {tx.type === 'swap'
                ? `→ ${tx.toAddress}`
                : `${tx.toAddress.slice(0, 8)}...${tx.toAddress.slice(-4)}`}
            </Text>
            <Text style={styles.txDate}>{formattedDate} at {formattedTime}</Text>
          </View>
        </View>

        {/* Right: Amount + Status */}
        <View style={styles.txRight}>
          <Text
            style={[
              styles.txAmount,
              { color: tx.type === 'receive' ? Colors.success : Colors.gray900 },
            ]}
          >
            {tx.type === 'receive' ? '+' : '-'}{tx.amount} {tx.token}
          </Text>
          <Text style={styles.txUsd}>${tx.usdValue.toLocaleString()}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'send' | 'receive' | 'swap'>('all');

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-20)).current;

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
    Animated.parallel([
      Animated.timing(headerFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(headerSlide, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
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
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.primary, Colors.primaryLight]}
        style={styles.header}
      >
        <View style={styles.headerDecor} />
        <Animated.View
          style={{
            opacity: headerFade,
            transform: [{ translateY: headerSlide }],
          }}
        >
          <Text style={styles.headerTitle}>Activity</Text>
          <Text style={styles.headerSubtitle}>
            {transactions.length} transactions
          </Text>
        </Animated.View>
      </LinearGradient>

      {/* Filters */}
      <View style={styles.filterContainer}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterButton,
              activeFilter === f.key && styles.filterButtonActive,
            ]}
            onPress={() => setActiveFilter(f.key)}
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

      {/* Transaction List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {filteredTx.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No transactions</Text>
            <Text style={styles.emptySubtext}>
              {activeFilter === 'all'
                ? 'Your transaction history will appear here'
                : `No ${activeFilter} transactions found`}
            </Text>
          </View>
        ) : (
          filteredTx.map((tx, index) => (
            <TransactionCard key={tx.id} tx={tx} index={index} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: Spacing.xl,
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -60,
    right: -40,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: FontSizes.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.gray500,
  },
  filterTextActive: {
    color: Colors.white,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  txCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  txIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  txIcon: {
    fontSize: 20,
    color: Colors.white,
    fontWeight: 'bold',
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.gray900,
    marginBottom: 2,
  },
  txAddress: {
    fontSize: FontSizes.xs,
    color: Colors.gray400,
    marginBottom: 2,
  },
  txDate: {
    fontSize: 11,
    color: Colors.gray300,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  txUsd: {
    fontSize: FontSizes.xs,
    color: Colors.gray400,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  emptyText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.gray500,
    marginBottom: Spacing.sm,
  },
  emptySubtext: {
    fontSize: FontSizes.sm,
    color: Colors.gray400,
    textAlign: 'center',
  },
});
