import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { setBalances } from '../../store/walletSlice';
import api from '../../services/api';
import BalanceHeader from '../../components/BalanceHeader';
import CryptoCard from '../../components/CryptoCard';
import ActionButton from '../../components/ActionButton';
import { Colors, Spacing } from '../../theme/colors';

export default function HomeScreen({ navigation }: any) {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { balances, totalUsd, isLoading } = useSelector((state: RootState) => state.wallet);
  const [refreshing, setRefreshing] = useState(false);

  const loadBalances = async () => {
    try {
      const data = await api.getBalances();
      if (data && data.length > 0) {
        dispatch(setBalances(data));
      }
    } catch {
      // Keep existing data when API is unavailable
    }
  };

  useEffect(() => {
    if (balances.length === 0) {
      loadBalances();
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBalances();
    setRefreshing(false);
  };

  if (isLoading && balances.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const userName = user?.fullName || user?.email?.split('@')[0] || 'User';

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
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
        {/* Balance Header with Gradient */}
        <BalanceHeader
          totalBalance={totalUsd}
          changePercent={0}
          changeAmount={0}
          userName={userName}
        />

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <ActionButton
            icon="↑"
            label="Send"
            gradient={[Colors.primary, Colors.secondary]}
            onPress={() => navigation.navigate('Send')}
          />
          <ActionButton
            icon="↓"
            label="Receive"
            gradient={['#10B981', '#059669']}
            onPress={() => navigation.navigate('Receive')}
          />
          <ActionButton
            icon="⇄"
            label="Swap"
            gradient={['#8B5CF6', '#7C3AED']}
            onPress={() => navigation.navigate('Swap')}
          />
          <ActionButton
            icon="$"
            label="Buy"
            gradient={['#F59E0B', '#D97706']}
            onPress={() => navigation.navigate('Receive')}
          />
        </View>

        {/* Crypto Cards */}
        <View style={styles.cardsContainer}>
          {balances.map((balance) => (
            <CryptoCard
              key={balance.token}
              token={balance.token as 'BTC' | 'ETH' | 'USDC' | 'USDT'}
              balance={balance.balance}
              balanceUsd={balance.balanceUsd}
              address={balance.address}
              onPress={() => {
                // Navigate to token details
              }}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
  },
  scrollView: {
    flex: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  cardsContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
});
