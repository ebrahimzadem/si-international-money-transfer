import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing } from '../tokens';

interface DSListItemProps {
  icon: keyof typeof Feather.glyphMap;
  iconColor?: string;
  iconBg?: string;
  label: string;
  subtitle?: string;
  rightText?: string;
  showChevron?: boolean;
  onPress?: () => void;
  borderBottom?: boolean;
}

export default function DSListItem({
  icon,
  iconColor = colors.primary[600],
  iconBg = colors.sage[100],
  label,
  subtitle,
  rightText,
  showChevron = true,
  onPress,
  borderBottom = true,
}: DSListItemProps) {
  return (
    <TouchableOpacity
      style={[styles.container, borderBottom && styles.border]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={18} color={iconColor} />
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {rightText && <Text style={styles.rightText}>{rightText}</Text>}
      {showChevron && (
        <Feather name="chevron-right" size={18} color={colors.neutral[400]} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3] + 2,
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[200],
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.neutral[800],
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.neutral[500],
    marginTop: 1,
  },
  rightText: {
    fontSize: typography.size.sm,
    color: colors.neutral[500],
    marginRight: spacing[1],
  },
});
