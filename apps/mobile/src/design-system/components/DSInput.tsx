import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../tokens';

interface DSInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helper?: string;
  leftIcon?: keyof typeof Feather.glyphMap;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightIconPress?: () => void;
}

export default function DSInput({
  label,
  error,
  helper,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  ...props
}: DSInputProps) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = (e: any) => {
    setFocused(true);
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
    props.onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setFocused(false);
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    props.onBlur?.(e);
  };

  const borderColor = error
    ? colors.error
    : borderAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.neutral[200], colors.primary[500]],
      });

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <Animated.View
        style={[
          styles.inputWrapper,
          { borderColor },
          error && styles.inputError,
        ]}
      >
        {leftIcon && (
          <Feather
            name={leftIcon}
            size={18}
            color={focused ? colors.primary[500] : colors.neutral[400]}
            style={styles.leftIcon}
          />
        )}

        <TextInput
          {...props}
          style={[styles.input, leftIcon && { paddingLeft: 0 }, style]}
          placeholderTextColor={colors.neutral[400]}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />

        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} disabled={!onRightIconPress}>
            <Feather
              name={rightIcon}
              size={18}
              color={colors.neutral[400]}
              style={styles.rightIcon}
            />
          </TouchableOpacity>
        )}
      </Animated.View>

      {(error || helper) && (
        <Text style={[styles.helper, error && styles.helperError]}>
          {error || helper}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.neutral[700],
    marginBottom: spacing[2],
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    borderRadius: radii.lg,
    paddingHorizontal: spacing[4],
  },
  inputError: {
    borderColor: colors.error,
    backgroundColor: '#FFF8F8',
  },
  input: {
    flex: 1,
    fontSize: typography.size.base,
    color: colors.neutral[800],
    paddingVertical: spacing[3] + 2,
  },
  leftIcon: {
    marginRight: spacing[3],
  },
  rightIcon: {
    marginLeft: spacing[3],
  },
  helper: {
    fontSize: typography.size.xs,
    color: colors.neutral[500],
    marginTop: spacing[1],
    marginLeft: spacing[1],
  },
  helperError: {
    color: colors.error,
  },
});
