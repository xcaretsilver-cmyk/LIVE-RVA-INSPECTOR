// Powered by OnSpace.AI
// Memory Patch Editor — view, create, revert memory patches
import React, { useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme';
import { useInspector } from '@/hooks/useInspector';
import { PatchEntry } from '@/types/inspector';
import { MaterialIcons } from '@expo/vector-icons';
import { Badge } from '@/components/ui/Badge';

const STATUS_BADGE: Record<PatchEntry['status'], { label: string; variant: 'green' | 'blue' | 'yellow' | 'red' | 'muted' }> = {
  pending: { label: 'PENDING', variant: 'yellow' },
  applied: { label: 'APPLIED', variant: 'green' },
  failed: { label: 'FAILED', variant: 'red' },
  reverted: { label: 'REVERTED', variant: 'muted' },
};

function PatchRow({ patch, onRevert, onRemove }: {
  patch: PatchEntry;
  onRevert: () => void;
  onRemove: () => void;
}) {
  const st = STATUS_BADGE[patch.status];
  return (
    <View style={styles.patchRow}>
      <View style={styles.patchHeader}>
        <Badge label={st.label} variant={st.variant} />
        <Text style={styles.patchLabel}>{patch.label || 'Unnamed Patch'}</Text>
        <Text style={styles.patchTime}>
          {new Date(patch.timestamp).toLocaleTimeString()}
        </Text>
      </View>
      <View style={styles.patchAddressRow}>
        <MaterialIcons name="location-on" size={10} color={Colors.textBlue} />
        <Text style={styles.patchAddress}>{patch.address}</Text>
      </View>
      <View style={styles.bytesDiff}>
        <View style={styles.bytesBlock}>
          <Text style={styles.bytesLabel}>ORIG</Text>
          <Text style={styles.bytesOrig}>{patch.originalBytes}</Text>
        </View>
        <MaterialIcons name="arrow-forward" size={12} color={Colors.textMuted} />
        <View style={styles.bytesBlock}>
          <Text style={styles.bytesLabel}>PATCH</Text>
          <Text style={styles.bytesNew}>{patch.patchedBytes}</Text>
        </View>
      </View>
      <View style={styles.patchActions}>
        {patch.status === 'applied' ? (
          <Pressable
            style={[styles.actionBtn, styles.revertBtn]}
            onPress={onRevert}
          >
            <MaterialIcons name="undo" size={12} color={Colors.textYellow} />
            <Text style={styles.revertBtnText}>REVERT</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.actionBtn, styles.removeBtn]}
          onPress={onRemove}
        >
          <MaterialIcons name="delete" size={12} color={Colors.textRed} />
        </Pressable>
      </View>
    </View>
  );
}

function HexInput({ value, onChangeText, placeholder }: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  return (
    <TextInput
      style={styles.hexInput}
      value={value}
      onChangeText={text => onChangeText(text.replace(/[^0-9A-Fa-f\s]/g, ''))}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
      autoCapitalize="characters"
      autoCorrect={false}
      spellCheck={false}
    />
  );
}

export const MemoryPatchEditor = memo(function MemoryPatchEditor() {
  const { patches, addPatch, removePatch, revertPatch } = useInspector();

  const [address, setAddress] = useState('');
  const [origBytes, setOrigBytes] = useState('');
  const [patchBytes, setPatchBytes] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  const validateHex = (s: string) => /^[0-9A-Fa-f\s]+$/.test(s.trim());

  const handleApply = () => {
    if (!address.trim()) { setError('Address required'); return; }
    if (!patchBytes.trim()) { setError('Patched bytes required'); return; }
    if (!validateHex(address.replace('0x', ''))) { setError('Invalid address format'); return; }
    if (!validateHex(patchBytes)) { setError('Patch bytes must be hex only'); return; }
    setError('');
    addPatch({
      address: address.trim().startsWith('0x') ? address.trim() : '0x' + address.trim(),
      originalBytes: origBytes.trim() || '??',
      patchedBytes: patchBytes.trim().toUpperCase(),
      label: label.trim() || `patch @ ${address.trim()}`,
    });
    setAddress('');
    setOrigBytes('');
    setPatchBytes('');
    setLabel('');
  };

  return (
    <View style={styles.container}>
      {/* Editor Form */}
      <View style={styles.form}>
        <Text style={styles.sectionTitle}>NEW PATCH</Text>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>ADDRESS</Text>
          <TextInput
            style={styles.addrInput}
            value={address}
            onChangeText={setAddress}
            placeholder="0x7A4B2800"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
          />
        </View>

        <View style={styles.bytesRow}>
          <View style={styles.bytesField}>
            <Text style={styles.fieldLabel}>ORIG BYTES</Text>
            <HexInput value={origBytes} onChangeText={setOrigBytes} placeholder="1F 20 03 D5" />
          </View>
          <MaterialIcons name="arrow-forward" size={14} color={Colors.textMuted} style={styles.arrowIcon} />
          <View style={styles.bytesField}>
            <Text style={styles.fieldLabel}>PATCH BYTES</Text>
            <HexInput value={patchBytes} onChangeText={setPatchBytes} placeholder="00 00 A0 E3" />
          </View>
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>LABEL</Text>
          <TextInput
            style={styles.addrInput}
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. God Mode Health"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <MaterialIcons name="error" size={12} color={Colors.textRed} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.applyBtn, pressed && styles.applyBtnPressed]}
          onPress={handleApply}
        >
          <MaterialIcons name="flash-on" size={14} color={Colors.bg} />
          <Text style={styles.applyBtnText}>APPLY PATCH</Text>
        </Pressable>

        {/* Quick NOP presets */}
        <View style={styles.presets}>
          <Text style={styles.presetsLabel}>QUICK:</Text>
          {[
            { label: 'NOP ARM64', bytes: '1F 20 03 D5' },
            { label: 'RET ARM64', bytes: 'C0 03 5F D6' },
            { label: 'MOV R0,0', bytes: '00 00 A0 E3' },
          ].map(p => (
            <Pressable
              key={p.label}
              style={styles.presetBtn}
              onPress={() => setPatchBytes(p.bytes)}
            >
              <Text style={styles.presetBtnText}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Patch History */}
      <View style={styles.historyHeader}>
        <MaterialIcons name="history" size={12} color={Colors.textMuted} />
        <Text style={styles.historyTitle}>PATCH HISTORY ({patches.length})</Text>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {patches.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="edit" size={22} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No patches applied yet</Text>
          </View>
        ) : (
          patches.map(p => (
            <PatchRow
              key={p.id}
              patch={p}
              onRevert={() => revertPatch(p.id)}
              onRemove={() => removePatch(p.id)}
            />
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  form: {
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldLabel: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    fontWeight: '700',
    width: 56,
    letterSpacing: 0.5,
  },
  addrInput: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textBlue,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
  },
  bytesRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  bytesField: {
    flex: 1,
    gap: 4,
  },
  hexInput: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textYellow,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
  },
  arrowIcon: {
    marginBottom: 6,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  errorText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textRed,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 10,
  },
  applyBtnPressed: {
    opacity: 0.75,
  },
  applyBtnText: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.bg,
    fontWeight: '700',
    letterSpacing: 1,
  },
  presets: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  presetsLabel: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
  },
  presetBtn: {
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetBtnText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textSecondary,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  historyTitle: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scroll: {
    flex: 1,
  },
  patchRow: {
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 4,
  },
  patchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  patchLabel: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    flex: 1,
  },
  patchTime: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
  },
  patchAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  patchAddress: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textBlue,
  },
  bytesDiff: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bytesBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bytesLabel: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  bytesOrig: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textRed,
    backgroundColor: Colors.dangerDim,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: Radius.sm,
  },
  bytesNew: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textGreen,
    backgroundColor: Colors.primaryGlow,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: Radius.sm,
  },
  patchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  revertBtn: {
    backgroundColor: Colors.warningDim,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
  },
  revertBtnText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textYellow,
    fontWeight: '700',
  },
  removeBtn: {
    backgroundColor: Colors.dangerDim,
  },
  empty: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontFamily: 'monospace',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
});
