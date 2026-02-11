import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import api from '../../services/api';
import { useAlert } from '../../components/WebSafeAlert';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme/colors';

const TOKENS = [
  { key: 'BTC', name: 'Bitcoin', colors: ['#F7931A', '#FFA726'] as [string, string] },
  { key: 'ETH', name: 'Ethereum', colors: ['#627EEA', '#4A90E2'] as [string, string] },
  { key: 'USDC', name: 'USD Coin', colors: ['#2775CA', '#1E88E5'] as [string, string] },
  { key: 'USDT', name: 'Tether', colors: ['#26A17B', '#4CAF50'] as [string, string] },
];

export default function SendScreen({ navigation }: any) {
  const { balances } = useSelector((state: RootState) => state.wallet);
  const [selectedToken, setSelectedToken] = useState('BTC');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const { showAlert, AlertComponent } = useAlert();

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-20)).current;
  const formFade = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.stagger(150, [
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
      ]),
      Animated.parallel([
        Animated.timing(formFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(formSlide, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const selectedBalance = balances.find((b) => b.token === selectedToken);
  const tokenInfo = TOKENS.find((t) => t.key === selectedToken)!;

  const executeSend = async () => {
    setLoading(true);
    try {
      await api.sendTransaction(selectedToken, toAddress, amount);
      showAlert('Success', 'Transaction sent successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      showAlert(
        'Transaction Failed',
        error.response?.data?.message || 'Could not send transaction'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!toAddress || !amount) {
      showAlert('Error', 'Please fill in all fields');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showAlert('Error', 'Invalid amount');
      return;
    }

    if (selectedBalance && amountNum > parseFloat(selectedBalance.balance)) {
      showAlert('Error', 'Insufficient balance');
      return;
    }

    showAlert(
      'Confirm Transaction',
      `Send ${amount} ${selectedToken} to ${toAddress.slice(0, 10)}...?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: executeSend },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {AlertComponent}
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backIcon}>‹</Text>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Send Crypto</Text>
          <Text style={styles.headerSubtitle}>Transfer to any wallet address</Text>
        </Animated.View>
      </LinearGradient>

      <Animated.View
        style={[
          styles.formWrapper,
          {
            opacity: formFade,
            transform: [{ translateY: formSlide }],
          },
        ]}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Token Selection */}
          <Text style={styles.label}>Select Token</Text>
          <View style={styles.tokenSelector}>
            {TOKENS.map((token) => {
              const isActive = selectedToken === token.key;
              return (
                <TouchableOpacity
                  key={token.key}
                  style={[
                    styles.tokenButton,
                    isActive && styles.tokenButtonActive,
                  ]}
                  onPress={() => setSelectedToken(token.key)}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={token.colors}
                      style={styles.tokenGradient}
                    >
                      <Text style={styles.tokenButtonTextActive}>{token.key}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.tokenInner}>
                      <Text style={styles.tokenButtonText}>{token.key}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Balance Card */}
          {selectedBalance && (
            <LinearGradient
              colors={tokenInfo.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.balanceCard}
            >
              <View style={styles.balanceDecor} />
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={styles.balanceAmount}>
                {parseFloat(selectedBalance.balance).toFixed(6)} {selectedToken}
              </Text>
              <Text style={styles.balanceUsd}>
                ${selectedBalance.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </LinearGradient>
          )}

          {/* To Address */}
          <Text style={styles.label}>Recipient Address</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter wallet address"
              placeholderTextColor={Colors.gray400}
              value={toAddress}
              onChangeText={setToAddress}
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          {/* Amount */}
          <Text style={styles.label}>Amount</Text>
          <View style={styles.amountContainer}>
            <View style={[styles.inputContainer, { flex: 1 }]}>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={Colors.gray400}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                editable={!loading}
              />
            </View>
            <TouchableOpacity
              onPress={() =>
                selectedBalance && setAmount(selectedBalance.balance)
              }
            >
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                style={styles.maxButton}
              >
                <Text style={styles.maxButtonText}>MAX</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Send Button */}
          <TouchableOpacity
            onPress={handleSend}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={
                loading
                  ? [Colors.gray300, Colors.gray400]
                  : [Colors.primary, Colors.secondary]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sendButton}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.sendButtonText}>
                  Send {selectedToken}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Warning */}
          <View style={styles.warning}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>
              Double-check the recipient address. Crypto transactions cannot be reversed.
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: 4,
  },
  backIcon: {
    fontSize: 28,
    color: Colors.white,
    fontWeight: '300',
    marginTop: -2,
  },
  backText: {
    fontSize: FontSizes.md,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
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
  formWrapper: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.xl,
    paddingBottom: Spacing.huge,
  },
  label: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xl,
    marginLeft: Spacing.xs,
  },
  tokenSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  tokenButton: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  tokenButtonActive: {},
  tokenGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
  },
  tokenInner: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
  },
  tokenButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.gray500,
  },
  tokenButtonTextActive: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.white,
  },
  balanceCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginTop: Spacing.lg,
    overflow: 'hidden',
  },
  balanceDecor: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    top: -30,
    right: -20,
  },
  balanceLabel: {
    fontSize: FontSizes.xs,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 4,
  },
  balanceUsd: {
    fontSize: FontSizes.sm,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  inputContainer: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  input: {
    padding: Spacing.lg,
    fontSize: FontSizes.md,
    color: Colors.gray900,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  maxButton: {
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maxButtonText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: FontSizes.sm,
    letterSpacing: 1,
  },
  sendButton: {
    borderRadius: BorderRadius.lg,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: Spacing.xxxl,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  sendButtonText: {
    color: Colors.white,
    fontSize: FontSizes.lg,
    fontWeight: '800',
  },
  warning: {
    backgroundColor: '#FFF8E1',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  warningIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  warningText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: '#7B6B2B',
    lineHeight: 20,
  },
});
