import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme/colors';

const TOKEN_DATA: Record<string, { name: string; symbol: string; gradient: [string, string]; icon: string }> = {
  BTC: { name: 'Bitcoin', symbol: '₿', gradient: ['#F7931A', '#FFA726'], icon: '🟠' },
  ETH: { name: 'Ethereum', symbol: 'Ξ', gradient: ['#627EEA', '#4A90E2'], icon: '💎' },
  USDC: { name: 'USD Coin', symbol: '$', gradient: ['#2775CA', '#1E88E5'], icon: '🔵' },
  USDT: { name: 'Tether', symbol: '₮', gradient: ['#26A17B', '#4CAF50'], icon: '🟢' },
};

const MOCK_PRICE_DATA: Record<string, { price: number; change24h: number; high24h: number; low24h: number; marketCap: string; volume: string }> = {
  BTC: { price: 43150.00, change24h: 2.34, high24h: 43890.00, low24h: 42100.00, marketCap: '$845B', volume: '$28.5B' },
  ETH: { price: 2342.00, change24h: -0.85, high24h: 2390.00, low24h: 2310.00, marketCap: '$281B', volume: '$15.2B' },
  USDC: { price: 1.00, change24h: 0.01, high24h: 1.001, low24h: 0.999, marketCap: '$25B', volume: '$8.1B' },
  USDT: { price: 1.00, change24h: -0.02, high24h: 1.002, low24h: 0.998, marketCap: '$95B', volume: '$52.3B' },
};

interface Transaction {
  id: string;
  type: 'send' | 'receive';
  amount: string;
  date: string;
  status: 'completed' | 'pending';
}

const MOCK_TOKEN_TXS: Record<string, Transaction[]> = {
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
  const tokenInfo = TOKEN_DATA[token] || TOKEN_DATA.BTC;
  const priceData = MOCK_PRICE_DATA[token] || MOCK_PRICE_DATA.BTC;
  const transactions = MOCK_TOKEN_TXS[token] || [];

  const [refreshing, setRefreshing] = useState(false);
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-20)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.parallel([
        Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(headerSlide, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(contentFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(contentSlide, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 1000));
    setRefreshing(false);
  };

  const isPositive = priceData.change24h >= 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={tokenInfo.gradient} style={styles.header}>
        <View style={styles.headerDecor} />
        <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>‹</Text>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>{tokenInfo.name}</Text>
              <Text style={styles.headerSubtitle}>{token}</Text>
            </View>
            <Text style={styles.tokenIcon}>{tokenInfo.icon}</Text>
          </View>

          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Your Balance</Text>
            <Text style={styles.balanceAmount}>
              {balance ? parseFloat(balance.balance).toFixed(6) : '0.000000'} {token}
            </Text>
            <Text style={styles.balanceUsd}>
              ${balance ? balance.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
            </Text>
          </View>
        </Animated.View>
      </LinearGradient>

      <Animated.View style={[styles.contentWrapper, { opacity: contentFade, transform: [{ translateY: contentSlide }] }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
          }
        >
          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Send')}>
              <LinearGradient colors={[Colors.primary, Colors.secondary]} style={styles.actionGradient}>
                <Text style={styles.actionIcon}>↑</Text>
              </LinearGradient>
              <Text style={styles.actionLabel}>Send</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Receive')}>
              <LinearGradient colors={['#10B981', '#059669']} style={styles.actionGradient}>
                <Text style={styles.actionIcon}>↓</Text>
              </LinearGradient>
              <Text style={styles.actionLabel}>Receive</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Swap')}>
              <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.actionGradient}>
                <Text style={styles.actionIcon}>⇄</Text>
              </LinearGradient>
              <Text style={styles.actionLabel}>Swap</Text>
            </TouchableOpacity>
          </View>

          {/* Price Info */}
          <Text style={styles.sectionTitle}>Market Data</Text>
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Current Price</Text>
              <Text style={styles.priceValue}>
                ${priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>24h Change</Text>
              <Text style={[styles.priceValue, { color: isPositive ? Colors.success : Colors.error }]}>
                {isPositive ? '+' : ''}{priceData.change24h.toFixed(2)}%
              </Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>24h High</Text>
              <Text style={styles.priceValue}>
                ${priceData.high24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>24h Low</Text>
              <Text style={styles.priceValue}>
                ${priceData.low24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Market Cap</Text>
              <Text style={styles.priceValue}>{priceData.marketCap}</Text>
            </View>
            <View style={[styles.priceRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.priceLabel}>24h Volume</Text>
              <Text style={styles.priceValue}>{priceData.volume}</Text>
            </View>
          </View>

          {/* Recent Transactions */}
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {transactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No {token} transactions yet</Text>
            </View>
          ) : (
            <View style={styles.txList}>
              {transactions.map((tx) => (
                <View key={tx.id} style={styles.txItem}>
                  <View style={styles.txLeft}>
                    <View style={[styles.txIconBg, { backgroundColor: tx.type === 'receive' ? '#ECFDF5' : '#FEF2F2' }]}>
                      <Text style={[styles.txIconText, { color: tx.type === 'receive' ? Colors.success : Colors.error }]}>
                        {tx.type === 'receive' ? '↓' : '↑'}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.txType}>{tx.type === 'receive' ? 'Received' : 'Sent'}</Text>
                      <Text style={styles.txDate}>{tx.date}</Text>
                    </View>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={[styles.txAmount, { color: tx.type === 'receive' ? Colors.success : Colors.gray900 }]}>
                      {tx.type === 'receive' ? '+' : '-'}{tx.amount} {token}
                    </Text>
                    <View style={[styles.txStatus, { backgroundColor: tx.status === 'completed' ? '#ECFDF5' : '#FFFBEB' }]}>
                      <Text style={[styles.txStatusText, { color: tx.status === 'completed' ? Colors.success : Colors.warning }]}>
                        {tx.status === 'completed' ? 'Completed' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Wallet Address */}
          {balance && (
            <>
              <Text style={styles.sectionTitle}>Wallet Address</Text>
              <View style={styles.addressCard}>
                <Text style={styles.addressText} numberOfLines={1}>
                  {balance.address}
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: Spacing.xl, overflow: 'hidden' },
  headerDecor: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)', top: -60, right: -40,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: 4 },
  backIcon: { fontSize: 28, color: Colors.white, fontWeight: '300', marginTop: -2 },
  backText: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.white },
  headerSubtitle: { fontSize: FontSizes.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  tokenIcon: { fontSize: 40 },
  balanceCard: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: BorderRadius.xl,
    padding: Spacing.xl, alignItems: 'center',
  },
  balanceLabel: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  balanceAmount: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.white, marginBottom: 4 },
  balanceUsd: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  contentWrapper: { flex: 1 },
  contentContainer: { padding: Spacing.xl, paddingBottom: Spacing.huge },
  actionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: Spacing.xxl },
  actionBtn: { alignItems: 'center', gap: 8 },
  actionGradient: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  actionIcon: { fontSize: 22, color: Colors.white, fontWeight: 'bold' },
  actionLabel: { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.gray500 },
  sectionTitle: {
    fontSize: FontSizes.xs, fontWeight: '700', color: Colors.gray400,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: Spacing.sm,
    marginTop: Spacing.lg, marginLeft: Spacing.xs,
  },
  priceCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  priceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.gray100,
  },
  priceLabel: { fontSize: FontSizes.sm, color: Colors.gray500 },
  priceValue: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.gray900 },
  divider: { height: 1, backgroundColor: Colors.gray200, marginVertical: 4 },
  txList: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  txItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.gray100,
  },
  txLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  txIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  txIconText: { fontSize: 16, fontWeight: 'bold' },
  txType: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.gray900 },
  txDate: { fontSize: FontSizes.xs, color: Colors.gray400, marginTop: 2 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: FontSizes.sm, fontWeight: '700', marginBottom: 4 },
  txStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  txStatusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  emptyCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xxxl,
    alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  emptyIcon: { fontSize: 36, marginBottom: Spacing.md },
  emptyText: { fontSize: FontSizes.sm, color: Colors.gray400, fontWeight: '600' },
  addressCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  addressText: { fontSize: FontSizes.xs, color: Colors.gray500, fontFamily: 'monospace' },
});
