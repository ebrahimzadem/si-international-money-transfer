import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Animated,
  TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { setUser } from '../../store/authSlice';
import api from '../../services/api';
import { DSButton, DSInput, colors, typography, spacing, radii, shadows } from '../../design-system';

type Step = 'credentials' | 'email-otp';

export default function LoginScreen({ navigation }: any) {
  const dispatch = useDispatch();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<Step>('credentials');
  const [emailOtp, setEmailOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 4000);
  };

  const animateTransition = (callback: () => void) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      callback();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleLogin = async () => {
    if (!email.trim()) { showError('Please enter your email'); return; }
    if (!password) { showError('Please enter your password'); return; }

    setLoading(true);
    setError('');
    try {
      await api.sendEmailOtp(email);
      animateTransition(() => setStep('email-otp'));
    } catch {
      showError('Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (emailOtp.length !== 6) { showError('Enter the 6-digit code'); return; }

    setLoading(true);
    setError('');
    try {
      await api.verifyEmailOtp(email, emailOtp);
      const response = await api.login(email, password);
      dispatch(setUser(response.user));
    } catch {
      showError('Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try { await api.sendEmailOtp(email); } catch { showError('Failed to resend code'); }
    finally { setLoading(false); }
  };

  const handleGoogleSignIn = () => {
    showError('Google Sign-In coming soon');
  };

  // ─── CREDENTIALS STEP ─────────────────────────────────────────────────

  const renderCredentials = () => (
    <>
      <Text style={styles.heading}>Welcome back</Text>
      <Text style={styles.subheading}>Sign in to your Si account</Text>

      <DSInput
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        leftIcon="mail"
        editable={!loading}
      />

      <DSInput
        label="Password"
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        leftIcon="lock"
        rightIcon={showPassword ? 'eye-off' : 'eye'}
        onRightIconPress={() => setShowPassword(!showPassword)}
        editable={!loading}
      />

      <TouchableOpacity style={styles.forgotRow}>
        <Text style={styles.forgotText}>Forgot password?</Text>
      </TouchableOpacity>

      <DSButton
        title="Sign In"
        onPress={handleLogin}
        loading={loading}
        disabled={loading}
        size="lg"
      />

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Google Sign In */}
      <TouchableOpacity
        style={styles.googleButton}
        onPress={handleGoogleSignIn}
        activeOpacity={0.7}
      >
        <Text style={styles.googleIcon}>G</Text>
        <Text style={styles.googleText}>Continue with Google</Text>
      </TouchableOpacity>

      {/* Register link */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.footerLink}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // ─── OTP STEP ─────────────────────────────────────────────────────────

  const renderOtp = () => (
    <>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => animateTransition(() => { setStep('credentials'); setEmailOtp(''); })}
      >
        <Feather name="arrow-left" size={20} color={colors.primary[600]} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>Check your email</Text>
      <Text style={styles.subheading}>
        We sent a 6-digit code to{'\n'}
        <Text style={styles.emailHighlight}>{email}</Text>
      </Text>

      {/* OTP Input */}
      <View style={styles.otpWrapper}>
        <TextInput
          style={styles.otpInput}
          placeholder="000000"
          placeholderTextColor={colors.neutral[300]}
          value={emailOtp}
          onChangeText={(t) => setEmailOtp(t.replace(/[^0-9]/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          editable={!loading}
          autoFocus
        />
      </View>

      <Text style={styles.otpHint}>
        Demo: enter any 6 digits (e.g. 123456)
      </Text>

      <DSButton
        title="Verify & Sign In"
        onPress={handleVerifyOtp}
        loading={loading}
        disabled={loading}
        size="lg"
      />

      <TouchableOpacity onPress={handleResendOtp} disabled={loading} style={styles.resendRow}>
        <Text style={styles.resendText}>
          Didn't get the code? <Text style={styles.resendLink}>Resend</Text>
        </Text>
      </TouchableOpacity>

      {/* Step indicator */}
      <View style={styles.stepsRow}>
        <View style={[styles.stepDot, styles.stepDone]} />
        <View style={[styles.stepLine, styles.stepLineDone]} />
        <View style={[styles.stepDot, styles.stepActive]} />
      </View>
    </>
  );

  // ─── RENDER ───────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoSection}>
            <Image
              source={require('../../../assets/brand/si-logo-green.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Form */}
          <Animated.View style={[styles.formCard, { opacity: fadeAnim }]}>
            {error ? (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={16} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {step === 'credentials' && renderCredentials()}
            {step === 'email-otp' && renderOtp()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing[5],
    paddingTop: 72,
    paddingBottom: spacing[10],
  },

  // Logo
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  logo: {
    width: 180,
    height: 60,
  },

  // Form Card
  formCard: {
    backgroundColor: colors.white,
    borderRadius: radii['2xl'],
    padding: spacing[6],
    ...shadows.lg,
  },

  // Error
  errorBanner: {
    backgroundColor: colors.errorLight,
    borderRadius: radii.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    marginBottom: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  errorText: {
    fontSize: typography.size.sm,
    color: colors.error,
    fontWeight: typography.weight.medium,
    flex: 1,
  },

  // Typography
  heading: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.neutral[900],
    marginBottom: spacing[1],
  },
  subheading: {
    fontSize: typography.size.base,
    color: colors.neutral[500],
    lineHeight: 22,
    marginBottom: spacing[6],
  },
  emailHighlight: {
    fontWeight: typography.weight.semiBold,
    color: colors.primary[600],
  },

  // Forgot password
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: spacing[5],
    marginTop: -spacing[2],
  },
  forgotText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.primary[600],
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[5],
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.neutral[300],
  },
  dividerText: {
    marginHorizontal: spacing[4],
    fontSize: typography.size.sm,
    color: colors.neutral[400],
  },

  // Google button
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3] + 2,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    backgroundColor: colors.white,
    gap: spacing[3],
  },
  googleIcon: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: '#4285F4',
  },
  googleText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.neutral[700],
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing[6],
  },
  footerText: {
    fontSize: typography.size.base,
    color: colors.neutral[500],
  },
  footerLink: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semiBold,
    color: colors.primary[600],
  },

  // OTP
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  backText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.primary[600],
  },
  otpWrapper: {
    marginBottom: spacing[3],
  },
  otpInput: {
    backgroundColor: colors.neutral[50],
    borderWidth: 2,
    borderColor: colors.primary[500],
    borderRadius: radii.lg,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    fontSize: 28,
    fontWeight: '800',
    color: colors.neutral[900],
    textAlign: 'center',
    letterSpacing: 10,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  otpHint: {
    fontSize: typography.size.xs,
    color: colors.neutral[400],
    textAlign: 'center',
    marginBottom: spacing[5],
    fontStyle: 'italic',
  },
  resendRow: {
    marginTop: spacing[5],
  },
  resendText: {
    textAlign: 'center',
    fontSize: typography.size.sm,
    color: colors.neutral[500],
  },
  resendLink: {
    color: colors.primary[600],
    fontWeight: typography.weight.semiBold,
  },

  // Steps
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[8],
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.neutral[200],
    borderWidth: 2,
    borderColor: colors.neutral[200],
  },
  stepActive: {
    backgroundColor: colors.white,
    borderColor: colors.primary[500],
  },
  stepDone: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  stepLine: {
    width: 48,
    height: 2,
    backgroundColor: colors.neutral[200],
  },
  stepLineDone: {
    backgroundColor: colors.primary[500],
  },
});
