import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { clearUser } from '../../store/authSlice';
import { clearBalances } from '../../store/walletSlice';
import api from '../../services/api';
import { useAlert } from '../../components/WebSafeAlert';
import { DSListItem, DSCard, colors, typography, spacing, radii, shadows } from '../../design-system';

export default function ProfileScreen() {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { totalUsd } = useSelector((state: RootState) => state.wallet);
  const { showAlert, AlertComponent } = useAlert();

  const handleLogout = () => {
    showAlert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try { await api.logout(); } catch {}
          dispatch(clearUser());
          dispatch(clearBalances());
        },
      },
    ]);
  };

  const userName = user?.fullName || user?.email?.split('@')[0] || 'User';
  const initial = userName[0]?.toUpperCase() || 'U';

  return (
    <View style={styles.screen}>
      {AlertComponent}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* User Card */}
        <DSCard variant="default">
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{userName}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
            <View style={styles.kycBadge}>
              <Feather name="check-circle" size={12} color={colors.primary[600]} />
              <Text style={styles.kycText}>L{user?.kycLevel}</Text>
            </View>
          </View>

          <View style={styles.portfolioRow}>
            <Text style={styles.portfolioLabel}>Total Portfolio</Text>
            <Text style={styles.portfolioValue}>
              ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </DSCard>

        {/* Account */}
        <Text style={styles.sectionLabel}>Account</Text>
        <DSCard variant="default" padding={0}>
          <DSListItem
            icon="user"
            label="Personal Details"
            subtitle="Name, email, phone"
            onPress={() => {}}
          />
          <DSListItem
            icon="shield"
            label="Security"
            subtitle="Password, 2FA, biometrics"
            onPress={() => {}}
          />
          <DSListItem
            icon="file-text"
            label="KYC Verification"
            subtitle={`Level ${user?.kycLevel} \u00B7 ${user?.kycStatus}`}
            onPress={() => {}}
            borderBottom={false}
          />
        </DSCard>

        {/* Preferences */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <DSCard variant="default" padding={0}>
          <DSListItem
            icon="bell"
            label="Notifications"
            subtitle="Push, email, SMS"
            onPress={() => {}}
          />
          <DSListItem
            icon="dollar-sign"
            label="Currency"
            rightText="USD"
            onPress={() => {}}
          />
          <DSListItem
            icon="moon"
            label="Appearance"
            rightText="Light"
            onPress={() => {}}
            borderBottom={false}
          />
        </DSCard>

        {/* Support */}
        <Text style={styles.sectionLabel}>Support</Text>
        <DSCard variant="default" padding={0}>
          <DSListItem
            icon="message-circle"
            label="Help & Support"
            subtitle="FAQ, chat, tickets"
            onPress={() => {}}
          />
          <DSListItem
            icon="book-open"
            label="Legal"
            subtitle="Terms, privacy policy"
            onPress={() => {}}
          />
          <DSListItem
            icon="info"
            label="About Si"
            rightText="v1.0.0"
            onPress={() => {}}
            borderBottom={false}
          />
        </DSCard>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <Feather name="log-out" size={18} color={colors.error} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Si - International Money Transfer{'\n'}Version 1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  scrollContent: {
    paddingBottom: spacing[10],
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

  // User card
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  avatarText: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semiBold,
    color: colors.neutral[800],
    textTransform: 'capitalize',
  },
  userEmail: {
    fontSize: typography.size.sm,
    color: colors.neutral[500],
    marginTop: 2,
  },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radii.full,
  },
  kycText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semiBold,
    color: colors.primary[600],
  },

  // Portfolio
  portfolioRow: {
    backgroundColor: colors.neutral[50],
    borderRadius: radii.lg,
    padding: spacing[4],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  portfolioLabel: {
    fontSize: typography.size.sm,
    color: colors.neutral[500],
  },
  portfolioValue: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.neutral[900],
  },

  // Sections
  sectionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semiBold,
    color: colors.neutral[400],
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: spacing[5],
    marginBottom: spacing[2],
    marginLeft: spacing[5] + spacing[1],
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginHorizontal: spacing[5],
    marginTop: spacing[6],
    paddingVertical: spacing[4],
    borderRadius: radii.lg,
    backgroundColor: '#FEF2F2',
  },
  logoutText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semiBold,
    color: colors.error,
  },

  // Footer
  footerText: {
    textAlign: 'center',
    fontSize: typography.size.xs,
    color: colors.neutral[400],
    marginTop: spacing[6],
    lineHeight: 18,
  },
});
