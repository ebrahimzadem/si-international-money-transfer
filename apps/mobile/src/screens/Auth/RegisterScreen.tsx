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

type Step = 'form' | 'email-otp' | 'phone-otp';

export default function RegisterScreen({ navigation }: any) {
  const dispatch = useDispatch();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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

  const handleSubmitForm = async () => {
    if (!fullName.trim()) { showError('Please enter your full name'); return; }
    if (!email.trim()) { showError('Please enter your email'); return; }
    if (!phone.trim()) { showError('Please enter your phone number'); return; }
    if (password.length < 8) { showError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { showError('Passwords do not match'); return; }

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

  const handleVerifyEmail = async () => {
    if (emailOtp.length !== 6) { showError('Enter the 6-digit code'); return; }

    setLoading(true);
    setError('');
    try {
      await api.verifyEmailOtp(email, emailOtp);
      await api.sendPhoneOtp(phone);
      animateTransition(() => setStep('phone-otp'));
    } catch {
      showError('Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhone = async () => {
    if (phoneOtp.length !== 6) { showError('Enter the 6-digit code'); return; }

    setLoading(true);
    setError('');
    try {
      await api.verifyPhoneOtp(phone, phoneOtp);
      const response = await api.register(email, password, fullName, phone);
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
      if (step === 'email-otp') {
        await api.sendEmailOtp(email);
      } else {
        await api.sendPhoneOtp(phone);
      }
    } catch {
      showError('Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    showError('Google Sign-Up coming soon');
  };

  // ─── FORM STEP ───────────────────────────────────────────────────────

  const renderForm = () => (
    <>
      <Text style={styles.heading}>Create account</Text>
      <Text style={styles.subheading}>Sign up to start using Si</Text>

      <DSInput
        label="Full Name"
        placeholder="John Doe"
        value={fullName}
        onChangeText={setFullName}
        leftIcon="user"
        editable={!loading}
      />

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
        label="Phone Number"
        placeholder="+1 (555) 123-4567"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        leftIcon="phone"
        editable={!loading}
      />

      <DSInput
        label="Password"
        placeholder="Minimum 8 characters"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        leftIcon="lock"
        rightIcon={showPassword ? 'eye-off' : 'eye'}
        onRightIconPress={() => setShowPassword(!showPassword)}
        editable={!loading}
      />

      <DSInput
        label="Confirm Password"
        placeholder="Re-enter your password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry={!showConfirm}
        leftIcon="lock"
        rightIcon={showConfirm ? 'eye-off' : 'eye'}
        onRightIconPress={() => setShowConfirm(!showConfirm)}
        editable={!loading}
      />

      <DSButton
        title="Continue"
        onPress={handleSubmitForm}
        loading={loading}
        disabled={loading}
        size="lg"
      />

      <Text style={styles.termsText}>
        By signing up, you agree to our{' '}
        <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
        <Text style={styles.termsLink}>Privacy Policy</Text>
      </Text>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Google Sign Up */}
      <TouchableOpacity
        style={styles.googleButton}
        onPress={handleGoogleSignUp}
        activeOpacity={0.7}
      >
        <Text style={styles.googleIcon}>G</Text>
        <Text style={styles.googleText}>Continue with Google</Text>
      </TouchableOpacity>

      {/* Login link */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.footerLink}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // ─── OTP STEP ────────────────────────────────────────────────────────

  const renderOtp = (type: 'email' | 'phone') => {
    const isEmail = type === 'email';
    const value = isEmail ? emailOtp : phoneOtp;
    const setValue = isEmail ? setEmailOtp : setPhoneOtp;
    const onVerify = isEmail ? handleVerifyEmail : handleVerifyPhone;
    const destination = isEmail ? email : phone;

    return (
      <>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => animateTransition(() => {
            if (isEmail) {
              setStep('form');
              setEmailOtp('');
            } else {
              setStep('email-otp');
              setPhoneOtp('');
            }
          })}
        >
          <Feather name="arrow-left" size={20} color={colors.primary[600]} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.heading}>
          Verify {isEmail ? 'email' : 'phone'}
        </Text>
        <Text style={styles.subheading}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.emailHighlight}>{destination}</Text>
        </Text>

        {/* OTP Input */}
        <View style={styles.otpWrapper}>
          <TextInput
            style={styles.otpInput}
            placeholder="000000"
            placeholderTextColor={colors.neutral[300]}
            value={value}
            onChangeText={(t) => setValue(t.replace(/[^0-9]/g, '').slice(0, 6))}
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
          title={isEmail ? 'Verify & Continue' : 'Verify & Create Account'}
          onPress={onVerify}
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
          <View style={[styles.stepDot, isEmail ? styles.stepActive : styles.stepDone]} />
          <View style={[styles.stepLine, !isEmail ? styles.stepLineDone : null]} />
          <View style={[styles.stepDot, !isEmail ? styles.stepActive : null]} />
        </View>
        <View style={styles.stepsLabelRow}>
          <Text style={styles.stepLabel}>Details</Text>
          <Text style={styles.stepLabel}>Email</Text>
          <Text style={styles.stepLabel}>Phone</Text>
        </View>
      </>
    );
  };

  // ─── RENDER ──────────────────────────────────────────────────────────

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

            {step === 'form' && renderForm()}
            {step === 'email-otp' && renderOtp('email')}
            {step === 'phone-otp' && renderOtp('phone')}
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
    paddingTop: 56,
    paddingBottom: spacing[10],
  },

  // Logo
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing[6],
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

  // Terms
  termsText: {
    fontSize: typography.size.xs,
    color: colors.neutral[400],
    textAlign: 'center',
    marginTop: spacing[4],
    lineHeight: 18,
  },
  termsLink: {
    color: colors.primary[600],
    fontWeight: typography.weight.medium,
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
  stepsLabelRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 38,
    marginTop: spacing[2],
  },
  stepLabel: {
    fontSize: typography.size.xs,
    color: colors.neutral[400],
    fontWeight: typography.weight.medium,
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
