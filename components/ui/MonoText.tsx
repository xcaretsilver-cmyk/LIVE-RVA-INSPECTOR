// Powered by OnSpace.AI
import React, { memo } from 'react';
import { Text, TextStyle, StyleSheet } from 'react-native';
import { Colors, FontSize } from '@/constants/theme';

interface MonoTextProps {
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: TextStyle;
  numberOfLines?: number;
  selectable?: boolean;
}

export const MonoText = memo(function MonoText({
  children,
  size = FontSize.sm,
  color = Colors.textPrimary,
  style,
  numberOfLines,
  selectable = false,
}: MonoTextProps) {
  return (
    <Text
      style={[styles.base, { fontSize: size, color }, style]}
      numberOfLines={numberOfLines}
      selectable={selectable}
    >
      {children}
    </Text>
  );
});

const styles = StyleSheet.create({
  base: {
    fontFamily: 'monospace',
    letterSpacing: 0.3,
  },
});
