// Powered by OnSpace.AI
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Radius } from '@/constants/theme';

type BadgeVariant = 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'cyan' | 'muted';

const VARIANT_MAP: Record<BadgeVariant, { bg: string; text: string }> = {
  green: { bg: Colors.primaryGlow, text: Colors.textGreen },
  blue: { bg: Colors.accentDim, text: Colors.textBlue },
  yellow: { bg: Colors.warningDim, text: Colors.textYellow },
  red: { bg: Colors.dangerDim, text: Colors.textRed },
  purple: { bg: 'rgba(188,140,255,0.12)', text: Colors.textPurple },
  cyan: { bg: 'rgba(121,192,255,0.12)', text: Colors.textCyan },
  muted: { bg: 'rgba(72,79,88,0.3)', text: Colors.textMuted },
};

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export const Badge = memo(function Badge({ label, variant = 'muted' }: BadgeProps) {
  const v = VARIANT_MAP[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }]}>
      <Text style={[styles.text, { color: v.text }]}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
