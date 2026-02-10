import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDispatch } from 'react-redux';
import { setUser } from '../../store/authSlice';
import api from '../../services/api';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../theme/colors';

type Step = 'form' | 'email-otp' | 'phone-otp';

export default function RegisterScreen({ navigation }: any) {
  const dispatch = useDispatch();

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // OTP
  const [step, setStep] = useState<Step>('form');
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');

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

  // Step 1: Submit form → send email OTP
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

  // Step 2: Verify email OTP → send phone OTP
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

  // Step 3: Verify phone OTP → register
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

  const renderFormStep = () => (
    <>
      <Text style={styles.cardTitle}>Create Account</Text>
      <Text style={styles.cardSubtitle}>Sign up to get started</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="John Doe"
          placeholderTextColor={Colors.gray400}
          value={fullName}
          onChangeText={setFullName}
          editable={!loading}
        />
      </View>

      <View style={styles.inputGroup}>
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

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="+1 (555) 123-4567"
          placeholderTextColor={Colors.gray400}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={!loading}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Minimum 8 characters"
          placeholderTextColor={Colors.gray400}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Re-enter your password"
          placeholderTextColor={Colors.gray400}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!loading}
        />
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleSubmitForm}
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
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Continue</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <Text style={styles.termsText}>
        By signing up, you agree to our{' '}
        <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
        <Text style={styles.termsLink}>Privacy Policy</Text>
      </Text>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or sign up with</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.socialRow}>
        <TouchableOpacity style={styles.socialButton} activeOpacity={0.7}>
          <Text style={styles.socialIcon}>G</Text>
          <Text style={styles.socialLabel}>Google</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.socialButton} activeOpacity={0.7}>
          <Text style={styles.socialIcon}></Text>
          <Text style={styles.socialLabel}>Apple</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => navigation.navigate('Login')}
        style={styles.switchAuth}
      >
        <Text style={styles.switchText}>
          Already have an account? <Text style={styles.switchLink}>Sign In</Text>
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderOtpStep = (type: 'email' | 'phone') => {
    const isEmail = type === 'email';
    const value = isEmail ? emailOtp : phoneOtp;
    const setValue = isEmail ? setEmailOtp : setPhoneOtp;
    const onVerify = isEmail ? handleVerifyEmail : handleVerifyPhone;
    const destination = isEmail ? email : phone;

    return (
      <>
        <TouchableOpacity
          onPress={() => animateTransition(() => setStep(isEmail ? 'form' : 'email-otp'))}
          style={styles.backRow}
        >
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.cardTitle}>
          Verify {isEmail ? 'Email' : 'Phone'}
        </Text>
        <Text style={styles.cardSubtitle}>
          Enter the 6-digit code sent to{'\n'}
          <Text style={styles.destination}>{destination}</Text>
        </Text>

        {/* OTP Input */}
        <View style={styles.otpContainer}>
          <TextInput
            style={styles.otpInput}
            placeholder="000000"
            placeholderTextColor={Colors.gray300}
            value={value}
            onChangeText={(t) => setValue(t.replace(/[^0-9]/g, '').slice(0, 6))}
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
          style={styles.primaryButton}
          onPress={onVerify}
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
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isEmail ? 'Verify & Continue' : 'Verify & Create Account'}
              </Text>
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
          <View style={[styles.stepLine, isEmail ? null : styles.stepLineDone]} />
          <View style={[styles.stepDot, isEmail ? styles.stepActive : styles.stepDone]} />
          <View style={[styles.stepLine, !isEmail ? null : null]} />
          <View style={[styles.stepDot, !isEmail ? styles.stepActive : null]} />
        </View>
        <View style={styles.stepLabelRow}>
          <Text style={styles.stepLabel}>Details</Text>
          <Text style={styles.stepLabel}>Email</Text>
          <Text style={styles.stepLabel}>Phone</Text>
        </View>
      </>
    );
  };

  return (
    <LinearGradient
      colors={[Colors.primary, Colors.primaryLight, Colors.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../../assets/si-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.tagline}>
            {step === 'form' ? 'Join the future of money' : 'Secure verification'}
          </Text>
        </View>

        {/* Card */}
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {step === 'form' && renderFormStep()}
          {step === 'email-otp' && renderOtpStep('email')}
          {step === 'phone-otp' && renderOtpStep('phone')}
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.xl,
    paddingTop: 50,
    paddingBottom: 40,
  },
  logoContainer: { alignItems: 'center', marginBottom: 20 },
  logoWrapper: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  logo: { width: 150, height: 56 },
  tagline: {
    fontSize: FontSizes.sm,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.gray900,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 15,
    color: Colors.gray500,
    marginBottom: 20,
    lineHeight: 22,
  },
  destination: {
    fontWeight: '700',
    color: Colors.primary,
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

  inputGroup: { marginBottom: 14 },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.gray600,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.gray50,
    padding: 14,
    borderRadius: 14,
    fontSize: 15,
    color: Colors.gray900,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
  },

  primaryButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginTop: 8,
  },
  gradientButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  termsText: {
    fontSize: 12,
    color: Colors.gray400,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 18,
  },
  termsLink: { color: Colors.primary, fontWeight: '600' },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.gray200 },
  dividerText: {
    marginHorizontal: 14,
    fontSize: 12,
    color: Colors.gray400,
    fontWeight: '500',
  },

  socialRow: { flexDirection: 'row', gap: 10 },
  socialButton: {
    flex: 1,
    backgroundColor: Colors.gray50,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialIcon: { fontSize: 16, fontWeight: '700', color: Colors.gray700 },
  socialLabel: { fontSize: 14, fontWeight: '600', color: Colors.gray700 },

  switchAuth: { marginTop: 16 },
  switchText: {
    textAlign: 'center',
    fontSize: 14,
    color: Colors.gray500,
  },
  switchLink: { color: Colors.primary, fontWeight: '700' },

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
    borderRadius: 16,
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
    gap: 0,
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
    width: 50,
    height: 2,
    backgroundColor: Colors.gray200,
  },
  stepLineDone: {
    backgroundColor: Colors.primary,
  },
  stepLabelRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 38,
    marginTop: 6,
  },
  stepLabel: {
    fontSize: 11,
    color: Colors.gray400,
    fontWeight: '600',
  },
});
