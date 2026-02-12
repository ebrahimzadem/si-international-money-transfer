import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { setBalances } from '../../store/walletSlice';
import api from '../../services/api';
import { DSAssetRow, DSCard, colors, typography, spacing, radii, shadows, gradients } from '../../design-system';

const ACTION_BUTTONS = [
  { key: 'send', label: 'Send', icon: 'arrow-up-right' as const, route: 'Send' },
  { key: 'receive', label: 'Receive', icon: 'arrow-down-left' as const, route: 'Receive' },
  { key: 'swap', label: 'Swap', icon: 'repeat' as const, route: 'Swap' },
  { key: 'buy', label: 'Buy', icon: 'plus' as const, route: 'Receive' },
];

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
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  const firstName = (user?.fullName || user?.email?.split('@')[0] || 'there').split(' ')[0];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
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
        {/* ── Header ─────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image
              source={require('../../../assets/brand/si-star.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={styles.greeting}>Hi, {firstName}</Text>
          </View>
          <TouchableOpacity
            style={styles.notifButton}
            onPress={() => {}}
            activeOpacity={0.6}
          >
            <Feather name="bell" size={20} color={colors.neutral[700]} />
          </TouchableOpacity>
        </View>

        {/* ── Balance Card ───────────────────────────────── */}
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>
            ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            {ACTION_BUTTONS.map((btn) => (
              <TouchableOpacity
                key={btn.key}
                style={styles.actionBtn}
                activeOpacity={0.7}
                onPress={() => navigation.navigate(btn.route)}
              >
                <View style={styles.actionIconWrap}>
                  <Feather name={btn.icon} size={20} color={colors.primary[700]} />
                </View>
                <Text style={styles.actionLabel}>{btn.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        {/* ── Asset List ─────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assets</Text>
        </View>

        <DSCard variant="default" padding={0}>
          {balances.map((b, i) => (
            <DSAssetRow
              key={b.token}
              token={b.token}
              balance={b.balance}
              balanceUsd={b.balanceUsd}
              borderBottom={i < balances.length - 1}
              onPress={() => navigation.navigate('TokenDetail', { token: b.token })}
            />
          ))}
        </DSCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing[10],
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: 56,
    paddingBottom: spacing[4],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  headerLogo: {
    width: 28,
    height: 28,
  },
  greeting: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semiBold,
    color: colors.neutral[800],
  },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },

  // Balance Card
  balanceCard: {
    marginHorizontal: spacing[5],
    borderRadius: radii['2xl'],
    padding: spacing[6],
    marginBottom: spacing[6],
  },
  balanceLabel: {
    fontSize: typography.size.sm,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: typography.weight.medium,
    marginBottom: spacing[1],
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: typography.weight.bold,
    color: colors.white,
    letterSpacing: -0.5,
    marginBottom: spacing[6],
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionBtn: {
    alignItems: 'center',
    gap: spacing[2],
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.white,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  sectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semiBold,
    color: colors.neutral[800],
  },
});
