import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { clearUser } from '../../store/authSlice';
import { clearBalances } from '../../store/walletSlice';
import api from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme/colors';

interface MenuItemProps {
  icon: string;
  label: string;
  subtitle?: string;
  onPress: () => void;
  delay: number;
}

function MenuItem({ icon, label, subtitle, onPress, delay }: MenuItemProps) {
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        delay,
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

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateX: slideAnim }, { scale: scaleAnim }],
      }}
    >
      <TouchableOpacity
        style={styles.menuItem}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={styles.menuItemLeft}>
          <View style={styles.menuIconContainer}>
            <Text style={styles.menuIcon}>{icon}</Text>
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuLabel}>{label}</Text>
            {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
          </View>
        </View>
        <Text style={styles.menuArrow}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ProfileScreen() {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { totalUsd } = useSelector((state: RootState) => state.wallet);

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-30)).current;
  const avatarScale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(headerSlide, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(avatarScale, {
        toValue: 1,
        friction: 4,
        tension: 40,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try { await api.logout(); } catch {}
          dispatch(clearUser());
          dispatch(clearBalances());
        },
      },
    ]);
  };

  const userName = user?.email?.split('@')[0] || 'User';
  const initial = userName[0]?.toUpperCase() || 'U';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header with Gradient */}
        <LinearGradient
          colors={[Colors.primary, Colors.primaryLight, Colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          {/* Decorative circles */}
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />

          <Animated.View
            style={[
              styles.headerContent,
              {
                opacity: headerFade,
                transform: [{ translateY: headerSlide }],
              },
            ]}
          >
            {/* Avatar */}
            <Animated.View
              style={[
                styles.avatarContainer,
                { transform: [{ scale: avatarScale }] },
              ]}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{initial}</Text>
              </LinearGradient>
            </Animated.View>

            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>

            {/* KYC Badge */}
            <View style={styles.kycBadge}>
              <Text style={styles.kycIcon}>✓</Text>
              <Text style={styles.kycText}>
                Level {user?.kycLevel} Verified
              </Text>
            </View>

            {/* Portfolio Summary */}
            <View style={styles.portfolioCard}>
              <Text style={styles.portfolioLabel}>Total Portfolio</Text>
              <Text style={styles.portfolioValue}>
                ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* Menu Sections */}
        <View style={styles.menuContainer}>
          {/* Account Section */}
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menuSection}>
            <MenuItem
              icon="👤"
              label="Personal Details"
              subtitle="Name, email, phone"
              onPress={() => {}}
              delay={100}
            />
            <MenuItem
              icon="🛡️"
              label="Security"
              subtitle="Password, 2FA, biometrics"
              onPress={() => {}}
              delay={150}
            />
            <MenuItem
              icon="📋"
              label="KYC Verification"
              subtitle={`Level ${user?.kycLevel} • ${user?.kycStatus}`}
              onPress={() => {}}
              delay={200}
            />
          </View>

          {/* Preferences Section */}
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.menuSection}>
            <MenuItem
              icon="🔔"
              label="Notifications"
              subtitle="Push, email, SMS"
              onPress={() => {}}
              delay={250}
            />
            <MenuItem
              icon="💱"
              label="Currency"
              subtitle="USD"
              onPress={() => {}}
              delay={300}
            />
            <MenuItem
              icon="🌙"
              label="Appearance"
              subtitle="Light mode"
              onPress={() => {}}
              delay={350}
            />
          </View>

          {/* Support Section */}
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.menuSection}>
            <MenuItem
              icon="💬"
              label="Help & Support"
              subtitle="FAQ, chat, tickets"
              onPress={() => {}}
              delay={400}
            />
            <MenuItem
              icon="📜"
              label="Legal"
              subtitle="Terms, privacy policy"
              onPress={() => {}}
              delay={450}
            />
            <MenuItem
              icon="ℹ️"
              label="About Si"
              subtitle="Version 1.0.0"
              onPress={() => {}}
              delay={500}
            />
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LinearGradient
              colors={['#FEE2E2', '#FECACA']}
              style={styles.logoutGradient}
            >
              <Text style={styles.logoutText}>Log Out</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            Si - International Money Transfer{'\n'}Version 1.0.0
          </Text>
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
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: Spacing.xl,
    overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -60,
    right: -40,
  },
  decorCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -30,
    left: -30,
  },
  headerContent: {
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.white,
  },
  userName: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  userEmail: {
    fontSize: FontSizes.sm,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: Spacing.md,
  },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    gap: 6,
    marginBottom: Spacing.xl,
  },
  kycIcon: {
    fontSize: 14,
    color: '#6fccaa',
  },
  kycText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.white,
  },
  portfolioCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    width: '100%',
  },
  portfolioLabel: {
    fontSize: FontSizes.xs,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  portfolioValue: {
    fontSize: FontSizes.xxxl,
    fontWeight: '900',
    color: Colors.white,
  },
  menuContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.huge,
  },
  sectionTitle: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
    marginLeft: Spacing.xs,
  },
  menuSection: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.gray50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  menuIcon: {
    fontSize: 18,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.gray900,
  },
  menuSubtitle: {
    fontSize: FontSizes.xs,
    color: Colors.gray400,
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 22,
    color: Colors.gray300,
    fontWeight: '300',
  },
  logoutButton: {
    marginTop: Spacing.xxl,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  logoutGradient: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
  },
  logoutText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.error,
  },
  footerText: {
    textAlign: 'center',
    fontSize: FontSizes.xs,
    color: Colors.gray400,
    marginTop: Spacing.xxl,
    lineHeight: 18,
  },
});
