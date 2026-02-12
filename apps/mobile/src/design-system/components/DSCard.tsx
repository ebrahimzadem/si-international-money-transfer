import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, radii, shadows } from '../tokens';

interface DSCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: keyof typeof spacing;
  style?: ViewStyle;
}

export default function DSCard({
  children,
  variant = 'default',
  padding = 4,
  style,
}: DSCardProps) {
  return (
    <View
      style={[
        styles.base,
        { padding: spacing[padding] },
        variant === 'elevated' && styles.elevated,
        variant === 'outlined' && styles.outlined,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    ...shadows.sm,
  },
  elevated: {
    ...shadows.lg,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    shadowOpacity: 0,
    elevation: 0,
  },
});
