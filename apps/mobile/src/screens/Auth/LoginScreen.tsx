import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDispatch } from 'react-redux';
import { setUser } from '../../store/authSlice';
import api from '../../services/api';
import { Colors, Fonts, FontSizes, Spacing, BorderRadius } from '../../theme/colors';

type Step = 'credentials' | 'email-otp';

export default function LoginScreen({ navigation }: any) {
  const dispatch = useDispatch();

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // OTP
  const [step, setStep] = useState<Step>('credentials');
  const [emailOtp, setEmailOtp] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  // Step 1: Validate credentials → send email OTP
  const handleLogin = async () => {
    if (!email.trim()) {
      showError('Please enter your email');
      return;
    }
    if (!password) {
      showError('Please enter your password');
      return;
    }

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

  // Step 2: Verify email OTP → complete login
  const handleVerifyOtp = async () => {
    if (emailOtp.length !== 6) {
      showError('Enter the 6-digit code');
      return;
    }

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
    try {
      await api.sendEmailOtp(email);
    } catch {
      showError('Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    showError('Google Sign-In will be available soon!');
  };

  const handleAppleSignIn = () => {
    showError('Apple Sign-In will be available soon!');
  };

  const renderCredentialsStep = () => (
    <>
      <Text style={styles.welcomeText}>Welcome Back</Text>
      <Text style={styles.welcomeSubtext}>Sign in to your account</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="your@email.com"
          placeholderTextColor={Colors.gray400}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your password"
          placeholderTextColor={Colors.gray400}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />
      </View>

      <TouchableOpacity>
        <Text style={styles.forgotPassword}>Forgot password?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.loginButton, loading && styles.loginButtonDisabled]}
        onPress={handleLogin}
        disabled={loading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientButton}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.loginButtonText}>Sign In</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* Social Sign In */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.socialButtons}>
        <TouchableOpacity
          style={styles.socialButton}
          onPress={handleGoogleSignIn}
          activeOpacity={0.7}
        >
          <Text style={styles.socialIcon}>G</Text>
          <Text style={styles.socialButtonText}>Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.socialButton}
          onPress={handleAppleSignIn}
          activeOpacity={0.7}
        >
          <Text style={styles.socialIcon}>{'\uF8FF'}</Text>
          <Text style={styles.socialButtonText}>Apple</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.registerContainer}
        onPress={() => navigation.navigate('Register')}
      >
        <Text style={styles.registerText}>
          Don't have an account?{' '}
          <Text style={styles.registerLink}>Sign Up</Text>
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderOtpStep = () => (
    <>
      <TouchableOpacity
        onPress={() => animateTransition(() => {
          setStep('credentials');
          setEmailOtp('');
        })}
        style={styles.backRow}
      >
        <Text style={styles.backArrow}>{'\u2039'}</Text>
        <Text style={styles.backLabel}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.welcomeText}>Verify Email</Text>
      <Text style={styles.welcomeSubtext}>
        Enter the 6-digit code sent to{'\n'}
        <Text style={styles.destination}>{email}</Text>
      </Text>

      <View style={styles.otpContainer}>
        <TextInput
          style={styles.otpInput}
          placeholder="000000"
          placeholderTextColor={Colors.gray300}
          value={emailOtp}
          onChangeText={(t) => setEmailOtp(t.replace(/[^0-9]/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          editable={!loading}
          autoFocus
        />
      </View>

      <Text style={styles.otpHint}>
        Demo mode: enter any 6 digits (e.g. 123456)
      </Text>

      <TouchableOpacity
        style={[styles.loginButton, loading && styles.loginButtonDisabled]}
        onPress={handleVerifyOtp}
        disabled={loading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientButton}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.loginButtonText}>Verify & Sign In</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
        <Text style={styles.resendText}>
          Didn't receive the code? <Text style={styles.resendLink}>Resend</Text>
        </Text>
      </TouchableOpacity>

      {/* Step indicator */}
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, styles.stepDone]} />
        <View style={[styles.stepLine, styles.stepLineDone]} />
        <View style={[styles.stepDot, styles.stepActive]} />
      </View>
      <View style={styles.stepLabelRow}>
        <Text style={styles.stepLabel}>Credentials</Text>
        <Text style={styles.stepLabel}>Verify</Text>
      </View>
    </>
  );

  return (
    <LinearGradient
      colors={[Colors.primary, Colors.primaryLight, Colors.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../../assets/si-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.tagline}>
              {step === 'credentials' ? 'International Money Transfer' : 'Secure verification'}
            </Text>
          </View>

          {/* Form Card */}
          <Animated.View style={[styles.formCard, { opacity: fadeAnim }]}>
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {step === 'credentials' && renderCredentialsStep()}
            {step === 'email-otp' && renderOtpStep()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.xl,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: Spacing.huge,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  logo: {
    width: 200,
    height: 80,
  },
  tagline: {
    fontSize: FontSizes.md,
    color: 'rgba(255, 255, 255, 0.95)',
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.5,
  },
  formCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xxxl,
    padding: Spacing.xxl + 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 20,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    fontWeight: '600',
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: FontSizes.xxxl - 4,
    fontFamily: Fonts.extraBold,
    color: Colors.gray900,
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontSize: FontSizes.md - 1,
    color: Colors.gray600,
    fontFamily: Fonts.regular,
    marginBottom: Spacing.xxl + 4,
    lineHeight: 22,
  },
  destination: {
    fontWeight: '700',
    color: Colors.primary,
  },
  inputContainer: {
    marginBottom: Spacing.sm + 6,
  },
  inputLabel: {
    fontSize: FontSizes.sm - 1,
    fontFamily: Fonts.semiBold,
    color: Colors.gray700,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.gray50,
    padding: Spacing.lg - 2,
    borderRadius: BorderRadius.lg - 2,
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.gray900,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
  },
  forgotPassword: {
    textAlign: 'right',
    color: Colors.primary,
    fontSize: FontSizes.sm - 1,
    fontFamily: Fonts.semiBold,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.md,
  },
  loginButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  gradientButton: {
    padding: Spacing.lg + 2,
    alignItems: 'center',
  },
  loginButtonText: {
    color: Colors.white,
    fontSize: FontSizes.lg - 1,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xxl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.gray200,
  },
  dividerText: {
    marginHorizontal: Spacing.lg,
    fontSize: FontSizes.xs + 1,
    color: Colors.gray400,
    fontFamily: Fonts.regular,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  socialButton: {
    flex: 1,
    backgroundColor: Colors.gray50,
    padding: Spacing.lg - 3,
    borderRadius: BorderRadius.lg - 2,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  socialIcon: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.gray700,
  },
  socialButtonText: {
    fontSize: FontSizes.md - 1,
    fontFamily: Fonts.semiBold,
    color: Colors.gray700,
  },
  registerContainer: {
    marginTop: Spacing.lg,
  },
  registerText: {
    textAlign: 'center',
    fontSize: FontSizes.md - 1,
    color: Colors.gray600,
    fontFamily: Fonts.regular,
  },
  registerLink: {
    color: Colors.primary,
    fontFamily: Fonts.bold,
  },

  // OTP styles
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  backArrow: { fontSize: 26, color: Colors.primary, fontWeight: '300' },
  backLabel: { fontSize: 15, color: Colors.primary, fontWeight: '600' },

  otpContainer: { marginVertical: 20, alignItems: 'center' },
  otpInput: {
    backgroundColor: Colors.gray50,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: 18,
    fontSize: 28,
    fontWeight: '800',
    color: Colors.gray900,
    textAlign: 'center',
    letterSpacing: 12,
    width: '100%',
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  otpHint: {
    fontSize: 12,
    color: Colors.gray400,
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },

  resendText: {
    textAlign: 'center',
    fontSize: 14,
    color: Colors.gray500,
    marginTop: 20,
  },
  resendLink: { color: Colors.primary, fontWeight: '700' },

  // Step indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.gray200,
    borderWidth: 2,
    borderColor: Colors.gray200,
  },
  stepActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.primary,
  },
  stepDone: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: Colors.gray200,
  },
  stepLineDone: {
    backgroundColor: Colors.primary,
  },
  stepLabelRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 48,
    marginTop: 6,
  },
  stepLabel: {
    fontSize: 11,
    color: Colors.gray400,
    fontWeight: '600',
  },
});
