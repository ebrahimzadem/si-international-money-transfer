import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useAlert } from '../../components/WebSafeAlert';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme/colors';

const TOKENS = [
  { key: 'BTC', name: 'Bitcoin', chain: 'bitcoin', colors: ['#F7931A', '#FFA726'] as [string, string] },
  { key: 'ETH', name: 'Ethereum', chain: 'ethereum', colors: ['#627EEA', '#4A90E2'] as [string, string] },
  { key: 'USDC', name: 'USD Coin', chain: 'ethereum', colors: ['#2775CA', '#1E88E5'] as [string, string] },
  { key: 'USDT', name: 'Tether', chain: 'ethereum', colors: ['#26A17B', '#4CAF50'] as [string, string] },
];

export default function ReceiveScreen({ navigation }: any) {
  const { balances } = useSelector((state: RootState) => state.wallet);
  const [selectedToken, setSelectedToken] = useState('BTC');
  const [copied, setCopied] = useState(false);
  const { showAlert, AlertComponent } = useAlert();

  const headerFade = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(contentFade, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const selectedBalance = balances.find((b) => b.token === selectedToken);
  const tokenInfo = TOKENS.find((t) => t.key === selectedToken)!;
  const address = selectedBalance?.address || 'No wallet address available';

  const copyAddress = async () => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(address);
      } else {
        const Clipboard = require('expo-clipboard');
        await Clipboard.setStringAsync(address);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showAlert('Error', 'Could not copy address');
    }
  };

  const shareAddress = () => {
    showAlert('Your Address', address, [{ text: 'OK' }]);
  };

  return (
    <View style={styles.container}>
      {AlertComponent}

      {/* Header */}
      <LinearGradient colors={['#10B981', '#059669']} style={styles.header}>
        <View style={styles.headerDecor} />
        <Animated.View style={{ opacity: headerFade }}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>‹</Text>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Receive Crypto</Text>
          <Text style={styles.headerSubtitle}>Share your address to receive funds</Text>
        </Animated.View>
      </LinearGradient>

      <Animated.View style={[styles.content, { opacity: contentFade }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Token Selection */}
          <Text style={styles.label}>Select Token</Text>
          <View style={styles.tokenSelector}>
            {TOKENS.map((token) => {
              const isActive = selectedToken === token.key;
              return (
                <TouchableOpacity
                  key={token.key}
                  style={[styles.tokenButton, isActive && styles.tokenButtonActive]}
                  onPress={() => setSelectedToken(token.key)}
                >
                  {isActive ? (
                    <LinearGradient colors={token.colors} style={styles.tokenGradient}>
                      <Text style={styles.tokenTextActive}>{token.key}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.tokenInner}>
                      <Text style={styles.tokenText}>{token.key}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Address Display */}
          <View style={styles.addressCard}>
            <LinearGradient
              colors={tokenInfo.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addressGradientTop}
            >
              <Text style={styles.addressLabel}>Your {tokenInfo.name} Address</Text>
              <Text style={styles.chainInfo}>
                {tokenInfo.chain === 'bitcoin' ? 'Bitcoin Network' : 'Ethereum Network (ERC-20)'}
              </Text>
            </LinearGradient>

            <View style={styles.addressBody}>
              {/* QR Code placeholder */}
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrIcon}>⬜</Text>
                <Text style={styles.qrText}>QR Code</Text>
              </View>

              {/* Address text */}
              <View style={styles.addressTextContainer}>
                <Text style={styles.addressText} selectable>{address}</Text>
              </View>

              {/* Actions */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionButton} onPress={copyAddress}>
                  <LinearGradient
                    colors={copied ? ['#10B981', '#059669'] : [Colors.primary, Colors.secondary]}
                    style={styles.actionGradient}
                  >
                    <Text style={styles.actionIcon}>{copied ? '✓' : '⧉'}</Text>
                    <Text style={styles.actionText}>{copied ? 'Copied!' : 'Copy'}</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={shareAddress}>
                  <View style={styles.actionOutline}>
                    <Text style={styles.actionIconOutline}>↗</Text>
                    <Text style={styles.actionTextOutline}>Share</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Warning */}
          <View style={styles.warning}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>
              Only send {selectedToken} ({tokenInfo.chain === 'bitcoin' ? 'Bitcoin' : 'ERC-20'}) to this address.
              Sending other tokens may result in permanent loss.
            </Text>
          </View>
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
  tokenSelector: { flexDirection: 'row', gap: 8, marginBottom: Spacing.xl },
  tokenButton: { flex: 1, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  tokenButtonActive: {},
  tokenGradient: { paddingVertical: 14, alignItems: 'center', borderRadius: BorderRadius.lg },
  tokenInner: { paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.gray200 },
  tokenText: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.gray500 },
  tokenTextActive: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.white },
  addressCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  addressGradientTop: { padding: Spacing.xl },
  addressLabel: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.white },
  chainInfo: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  addressBody: { padding: Spacing.xl, alignItems: 'center' },
  qrPlaceholder: { width: 160, height: 160, backgroundColor: Colors.gray50, borderRadius: BorderRadius.xl, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xl, borderWidth: 2, borderColor: Colors.gray200, borderStyle: 'dashed' },
  qrIcon: { fontSize: 48, marginBottom: 4 },
  qrText: { fontSize: FontSizes.xs, color: Colors.gray400, fontWeight: '600' },
  addressTextContainer: { backgroundColor: Colors.gray50, borderRadius: BorderRadius.lg, padding: Spacing.lg, width: '100%', marginBottom: Spacing.lg },
  addressText: { fontSize: 13, color: Colors.gray700, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
  actionRow: { flexDirection: 'row', gap: 12, width: '100%' },
  actionButton: { flex: 1, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  actionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6, borderRadius: BorderRadius.lg },
  actionIcon: { fontSize: 16, color: Colors.white },
  actionText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.white },
  actionOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.gray200, backgroundColor: Colors.white },
  actionIconOutline: { fontSize: 16, color: Colors.gray600 },
  actionTextOutline: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.gray600 },
  warning: { backgroundColor: '#FFF8E1', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginTop: Spacing.xl, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: '#FFE082' },
  warningIcon: { fontSize: 16, marginTop: 1 },
  warningText: { flex: 1, fontSize: FontSizes.sm, color: '#7B6B2B', lineHeight: 20 },
});
