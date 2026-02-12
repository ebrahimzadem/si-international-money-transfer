import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, radii } from '../tokens';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface DSButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export default function DSButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = true,
  icon,
  style,
}: DSButtonProps) {
  const isDisabled = disabled || loading;
  const sizeStyles = SIZE_MAP[size];

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.85}
        style={[fullWidth && { width: '100%' }, style]}
      >
        <LinearGradient
          colors={isDisabled ? [colors.neutral[300], colors.neutral[400]] : ['#1E5535', '#2D7A4E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.base, sizeStyles.container, isDisabled && styles.disabled]}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              {icon}
              <Text style={[styles.primaryText, sizeStyles.text]}>{title}</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const variantStyles = VARIANT_MAP[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        sizeStyles.container,
        variantStyles.container,
        isDisabled && styles.disabled,
        fullWidth && { width: '100%' },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.loaderColor} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[variantStyles.text, sizeStyles.text]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const SIZE_MAP: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: { paddingVertical: spacing[2], paddingHorizontal: spacing[4] },
    text: { fontSize: typography.size.sm },
  },
  md: {
    container: { paddingVertical: spacing[3] + 2, paddingHorizontal: spacing[5] },
    text: { fontSize: typography.size.base },
  },
  lg: {
    container: { paddingVertical: spacing[4], paddingHorizontal: spacing[6] },
    text: { fontSize: typography.size.md },
  },
};

const VARIANT_MAP: Record<Exclude<ButtonVariant, 'primary'>, { container: ViewStyle; text: TextStyle; loaderColor: string }> = {
  secondary: {
    container: { backgroundColor: colors.sage[100] },
    text: { color: colors.primary[700], fontWeight: typography.weight.semiBold },
    loaderColor: colors.primary[700],
  },
  outline: {
    container: { backgroundColor: colors.transparent, borderWidth: 1.5, borderColor: colors.neutral[300] },
    text: { color: colors.neutral[700], fontWeight: typography.weight.semiBold },
    loaderColor: colors.neutral[700],
  },
  ghost: {
    container: { backgroundColor: colors.transparent },
    text: { color: colors.primary[600], fontWeight: typography.weight.semiBold },
    loaderColor: colors.primary[600],
  },
  danger: {
    container: { backgroundColor: colors.errorLight },
    text: { color: colors.error, fontWeight: typography.weight.bold },
    loaderColor: colors.error,
  },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    gap: spacing[2],
  },
  disabled: {
    opacity: 0.5,
  },
  primaryText: {
    color: colors.white,
    fontWeight: typography.weight.semiBold,
  },
});
