import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { setBalances, setLoading } from '../../store/walletSlice';
import api from '../../services/api';

const { width } = Dimensions.get('window');

const TOKEN_INFO = {
  BTC: { name: 'Bitcoin', color: '#F7931A', gradient: ['#F7931A', '#FFA726'] as [string, string] },
  ETH: { name: 'Ethereum', color: '#627EEA', gradient: ['#627EEA', '#4A90E2'] as [string, string] },
  USDC: { name: 'USD Coin', color: '#2775CA', gradient: ['#2775CA', '#1E88E5'] as [string, string] },
  USDT: { name: 'Tether', color: '#26A17B', gradient: ['#26A17B', '#4CAF50'] as [string, string] },
};

export default function HomeScreen({ navigation }: any) {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { balances, totalUsd, isLoading } = useSelector((state: RootState) => state.wallet);
  const [refreshing, setRefreshing] = useState(false);

  const loadBalances = async () => {
    try {
      dispatch(setLoading(true));
      const data = await api.getBalances();
      dispatch(setBalances(data));
    } catch (error) {
      console.error('Failed to load balances:', error);
    }
  };

  useEffect(() => {
    loadBalances();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBalances();
    setRefreshing(false);
  };

  if (isLoading && balances.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Gradient */}
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{user?.email?.split('@')[0] || 'User'}</Text>
            </View>
            <TouchableOpacity style={styles.notificationButton}>
              <Text style={styles.notificationIcon}>🔔</Text>
            </TouchableOpacity>
          </View>

          {/* Total Balance Card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Total Portfolio Value</Text>
            <Text style={styles.balanceAmount}>${totalUsd.toFixed(2)}</Text>
            <View style={styles.balanceChange}>
              <Text style={styles.balanceChangeText}>+$0.00 (0.00%) today</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Send')}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionIconGradient}
            >
              <Text style={styles.actionIcon}>↑</Text>
            </LinearGradient>
            <Text style={styles.actionText}>Send</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionIconGradient}
            >
              <Text style={styles.actionIcon}>↓</Text>
            </LinearGradient>
            <Text style={styles.actionText}>Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionIconGradient}
            >
              <Text style={styles.actionIcon}>⇄</Text>
            </LinearGradient>
            <Text style={styles.actionText}>Swap</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionIconGradient}
            >
              <Text style={styles.actionIcon}>$</Text>
            </LinearGradient>
            <Text style={styles.actionText}>Buy</Text>
          </TouchableOpacity>
        </View>

        {/* Assets Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Assets</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See All →</Text>
            </TouchableOpacity>
          </View>

          {balances.map((balance) => {
            const info = TOKEN_INFO[balance.token as keyof typeof TOKEN_INFO];
            return (
              <TouchableOpacity key={balance.token} style={styles.assetCard}>
                <LinearGradient
                  colors={[info.gradient[0], info.gradient[1], info.gradient[0] + '80'] as [string, string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.assetCardGradient}
                >
                  <View style={styles.assetLeft}>
                    <View style={styles.assetIconContainer}>
                      <Text style={styles.assetIconText}>{balance.token}</Text>
                    </View>
                    <View style={styles.assetInfo}>
                      <Text style={styles.assetName}>{info.name}</Text>
                      <Text style={styles.assetAddress}>
                        {balance.address.slice(0, 8)}...{balance.address.slice(-6)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.assetRight}>
                    <Text style={styles.assetBalance}>
                      {parseFloat(balance.balance).toFixed(6)} {balance.token}
                    </Text>
                    <Text style={styles.assetUsd}>${balance.balanceUsd.toFixed(2)} USD</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}

          {balances.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💰</Text>
              <Text style={styles.emptyText}>No Assets Yet</Text>
              <Text style={styles.emptySubtext}>
                Start by buying crypto or receiving from friends
              </Text>
              <TouchableOpacity style={styles.emptyButton}>
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyButtonGradient}
                >
                  <Text style={styles.emptyButtonText}>Buy Crypto</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Market Overview */}
        {balances.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Market Overview</Text>
            <View style={styles.marketCard}>
              <Text style={styles.marketCardTitle}>📈 Crypto Market</Text>
              <Text style={styles.marketCardSubtext}>
                Stay updated with the latest market trends
              </Text>
              <TouchableOpacity style={styles.marketButton}>
                <Text style={styles.marketButtonText}>View Market</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    textTransform: 'capitalize',
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationIcon: {
    fontSize: 20,
  },
  balanceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 24,
    padding: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 44,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 8,
  },
  balanceChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceChangeText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 32,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIconGradient: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  actionIcon: {
    fontSize: 28,
    color: '#FFF',
    fontWeight: 'bold',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  assetCard: {
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  assetCardGradient: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  assetIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  assetIconText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF',
  },
  assetInfo: {
    flex: 1,
  },
  assetName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  assetAddress: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  assetRight: {
    alignItems: 'flex-end',
  },
  assetBalance: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  assetUsd: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  emptyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  marketCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  marketCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  marketCardSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  marketButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  marketButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
});
