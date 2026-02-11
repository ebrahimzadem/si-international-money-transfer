import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useAlert } from '../../components/WebSafeAlert';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme/colors';

const TOKENS = [
  { key: 'BTC', name: 'Bitcoin', colors: ['#F7931A', '#FFA726'] as [string, string] },
  { key: 'ETH', name: 'Ethereum', colors: ['#627EEA', '#4A90E2'] as [string, string] },
  { key: 'USDC', name: 'USD Coin', colors: ['#2775CA', '#1E88E5'] as [string, string] },
  { key: 'USDT', name: 'Tether', colors: ['#26A17B', '#4CAF50'] as [string, string] },
];

// Mock exchange rates (relative to USD)
const MOCK_RATES: Record<string, number> = {
  BTC: 43200,
  ETH: 2341,
  USDC: 1,
  USDT: 1,
};

export default function SwapScreen({ navigation }: any) {
  const { balances } = useSelector((state: RootState) => state.wallet);
  const [fromToken, setFromToken] = useState('BTC');
  const [toToken, setToToken] = useState('USDC');
  const [fromAmount, setFromAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const { showAlert, AlertComponent } = useAlert();

  const headerFade = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(contentFade, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const fromBalance = balances.find((b) => b.token === fromToken);
  const fromInfo = TOKENS.find((t) => t.key === fromToken)!;
  const toInfo = TOKENS.find((t) => t.key === toToken)!;

  const estimatedOutput = fromAmount
    ? ((parseFloat(fromAmount) * MOCK_RATES[fromToken]) / MOCK_RATES[toToken] * 0.99).toFixed(
        toToken === 'BTC' ? 8 : toToken === 'ETH' ? 6 : 2
      )
    : '0.00';

  const fee = fromAmount
    ? (parseFloat(fromAmount) * MOCK_RATES[fromToken] * 0.01).toFixed(2)
    : '0.00';

  const swapTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount('');
  };

  const handleSwap = () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      showAlert('Error', 'Please enter an amount');
      return;
    }

    if (fromBalance && parseFloat(fromAmount) > parseFloat(fromBalance.balance)) {
      showAlert('Error', 'Insufficient balance');
      return;
    }

    showAlert(
      'Confirm Swap',
      `Swap ${fromAmount} ${fromToken} for ~${estimatedOutput} ${toToken}?\n\nFee: $${fee} (1%)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Swap',
          onPress: async () => {
            setLoading(true);
            await new Promise((r) => setTimeout(r, 1500));
            setLoading(false);
            showAlert('Success', `Swapped ${fromAmount} ${fromToken} for ${estimatedOutput} ${toToken}`, [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {AlertComponent}

      {/* Header */}
      <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.header}>
        <View style={styles.headerDecor} />
        <Animated.View style={{ opacity: headerFade }}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>‹</Text>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Swap Crypto</Text>
          <Text style={styles.headerSubtitle}>Exchange between tokens instantly</Text>
        </Animated.View>
      </LinearGradient>

      <Animated.View style={[styles.content, { opacity: contentFade }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* From Token */}
          <Text style={styles.label}>From</Text>
          <View style={styles.swapCard}>
            <View style={styles.tokenRow}>
              {TOKENS.filter((t) => t.key !== toToken).map((token) => (
                <TouchableOpacity
                  key={token.key}
                  style={[styles.miniToken, fromToken === token.key && styles.miniTokenActive]}
                  onPress={() => setFromToken(token.key)}
                >
                  {fromToken === token.key ? (
                    <LinearGradient colors={token.colors} style={styles.miniTokenGrad}>
                      <Text style={styles.miniTokenTextActive}>{token.key}</Text>
                    </LinearGradient>
                  ) : (
                    <Text style={styles.miniTokenText}>{token.key}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.amountRow}>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={Colors.gray400}
                value={fromAmount}
                onChangeText={setFromAmount}
                keyboardType="decimal-pad"
              />
              {fromBalance && (
                <TouchableOpacity onPress={() => setFromAmount(fromBalance.balance)}>
                  <Text style={styles.balanceText}>
                    Balance: {parseFloat(fromBalance.balance).toFixed(4)} {fromToken}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Swap Button */}
          <TouchableOpacity style={styles.swapButtonContainer} onPress={swapTokens}>
            <View style={styles.swapCircle}>
              <Text style={styles.swapArrow}>↕</Text>
            </View>
          </TouchableOpacity>

          {/* To Token */}
          <Text style={styles.label}>To (estimated)</Text>
          <View style={styles.swapCard}>
            <View style={styles.tokenRow}>
              {TOKENS.filter((t) => t.key !== fromToken).map((token) => (
                <TouchableOpacity
                  key={token.key}
                  style={[styles.miniToken, toToken === token.key && styles.miniTokenActive]}
                  onPress={() => setToToken(token.key)}
                >
                  {toToken === token.key ? (
                    <LinearGradient colors={token.colors} style={styles.miniTokenGrad}>
                      <Text style={styles.miniTokenTextActive}>{token.key}</Text>
                    </LinearGradient>
                  ) : (
                    <Text style={styles.miniTokenText}>{token.key}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.estimatedAmount}>{estimatedOutput}</Text>
              <Text style={styles.feeText}>Fee: ${fee} (1%)</Text>
            </View>
          </View>

          {/* Rate Info */}
          <View style={styles.rateCard}>
            <Text style={styles.rateLabel}>Exchange Rate</Text>
            <Text style={styles.rateValue}>
              1 {fromToken} = {(MOCK_RATES[fromToken] / MOCK_RATES[toToken]).toFixed(
                toToken === 'BTC' ? 8 : toToken === 'ETH' ? 4 : 2
              )} {toToken}
            </Text>
          </View>

          {/* Swap Button */}
          <TouchableOpacity onPress={handleSwap} disabled={loading} activeOpacity={0.8}>
            <LinearGradient
              colors={loading ? [Colors.gray300, Colors.gray400] : ['#8B5CF6', '#7C3AED']}
              style={styles.confirmButton}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.confirmText}>Swap {fromToken} → {toToken}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: Spacing.xl, overflow: 'hidden' },
  headerDecor: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -40 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: 4 },
  backIcon: { fontSize: 28, color: Colors.white, fontWeight: '300', marginTop: -2 },
  backText: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.white },
  headerSubtitle: { fontSize: FontSizes.sm, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  content: { flex: 1 },
  scrollContent: { padding: Spacing.xl, paddingBottom: 100 },
  label: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: Spacing.sm, marginLeft: Spacing.xs },
  swapCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  tokenRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg },
  miniToken: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.gray100 },
  miniTokenActive: { backgroundColor: 'transparent' },
  miniTokenGrad: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full },
  miniTokenText: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.gray500 },
  miniTokenTextActive: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.white },
  amountRow: { gap: 8 },
  amountInput: { fontSize: 28, fontWeight: '800', color: Colors.gray900, padding: 0 },
  balanceText: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: '600' },
  estimatedAmount: { fontSize: 28, fontWeight: '800', color: Colors.gray900 },
  feeText: { fontSize: FontSizes.xs, color: Colors.gray400 },
  swapButtonContainer: { alignItems: 'center', marginVertical: -8, zIndex: 1 },
  swapCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4, borderWidth: 2, borderColor: Colors.gray100 },
  swapArrow: { fontSize: 20, color: '#8B5CF6', fontWeight: '700' },
  rateCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginTop: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rateLabel: { fontSize: FontSizes.sm, color: Colors.gray400, fontWeight: '600' },
  rateValue: { fontSize: FontSizes.sm, color: Colors.gray900, fontWeight: '700' },
  confirmButton: { borderRadius: BorderRadius.lg, paddingVertical: 18, alignItems: 'center', marginTop: Spacing.xxl },
  confirmText: { color: Colors.white, fontSize: FontSizes.lg, fontWeight: '800' },
});
