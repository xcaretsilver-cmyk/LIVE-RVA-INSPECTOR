// Powered by OnSpace.AI
import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Clipboard } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { RvaInfo } from '@/types/inspector';

interface AddressChipProps {
  rva: RvaInfo;
  compact?: boolean;
}

export const AddressChip = memo(function AddressChip({ rva, compact = false }: AddressChipProps) {
  const copyRva = () => {
    try { Clipboard.setString(rva.rva); } catch {}
  };
  const copyAbs = () => {
    try { Clipboard.setString(rva.absoluteAddr); } catch {}
  };

  if (compact) {
    return (
      <Pressable onPress={copyRva} style={styles.compactChip}>
        <Text style={styles.compactRva}>{rva.rva}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={copyRva} style={styles.chip}>
        <Text style={styles.label}>RVA</Text>
        <Text style={styles.rvaValue}>{rva.rva}</Text>
      </Pressable>
      <Text style={styles.separator}>+</Text>
      <Pressable onPress={copyAbs} style={styles.chip}>
        <Text style={styles.label}>ABS</Text>
        <Text style={styles.absValue}>{rva.absoluteAddr}</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    gap: 4,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  rvaValue: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textYellow,
  },
  absValue: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textBlue,
  },
  separator: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: 'monospace',
  },
  compactChip: {
    backgroundColor: Colors.warningDim,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  compactRva: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textYellow,
  },
});
