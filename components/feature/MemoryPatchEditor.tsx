// Powered by OnSpace.AI
// Memory Patch Editor — view, create, revert and restore memory patches
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
  pending:  { label: 'PENDING',  variant: 'yellow' },
  applied:  { label: 'APPLIED',  variant: 'green'  },
  failed:   { label: 'FAILED',   variant: 'red'    },
  reverted: { label: 'REVERTED', variant: 'muted'  },
};

// ─── Patch Row ─────────────────────────────────────────────────
function PatchRow({ patch, onRevert, onRestore, onRemove }: {
  patch: PatchEntry;
  onRevert: () => void;
  onRestore: () => void;
  onRemove: () => void;
}) {
  const st = STATUS_BADGE[patch.status];
  const hasOrigBytes = patch.originalBytes && patch.originalBytes !== '??' && patch.originalBytes.trim() !== '';

  return (
    <View style={styles.patchRow}>
      {/* Header */}
      <View style={styles.patchHeader}>
        <Badge label={st.label} variant={st.variant} />
        <Text style={styles.patchLabel}>{patch.label || 'Unnamed Patch'}</Text>
        <Text style={styles.patchTime}>
          {new Date(patch.timestamp).toLocaleTimeString()}
        </Text>
      </View>

      {/* Address */}
      <View style={styles.patchAddressRow}>
        <MaterialIcons name="location-on" size={10} color={Colors.textBlue} />
        <Text style={styles.patchAddress} selectable>{patch.address}</Text>
      </View>

      {/* Byte diff */}
      <View style={styles.bytesDiff}>
        {hasOrigBytes ? (
          <>
            <View style={styles.bytesBlock}>
              <Text style={styles.bytesLabel}>ORIG</Text>
              <Text style={styles.bytesOrig}>{patch.originalBytes}</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={12} color={Colors.textMuted} />
          </>
        ) : null}
        <View style={styles.bytesBlock}>
          <Text style={styles.bytesLabel}>PATCH</Text>
          <Text style={styles.bytesNew}>{patch.patchedBytes}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.patchActions}>
        {/* RESTORE — re-apply the patch bytes (any status) */}
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.restoreBtn, pressed && { opacity: 0.75 }]}
          onPress={onRestore}
        >
          <MaterialIcons name="refresh" size={12} color={Colors.textGreen} />
          <Text style={styles.restoreBtnText}>RESTORE</Text>
        </Pressable>

        {/* REVERT — only when applied and orig bytes known */}
        {patch.status === 'applied' && hasOrigBytes ? (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.revertBtn, pressed && { opacity: 0.75 }]}
            onPress={onRevert}
          >
            <MaterialIcons name="undo" size={12} color={Colors.textYellow} />
            <Text style={styles.revertBtnText}>REVERT</Text>
          </Pressable>
        ) : null}

        {/* REMOVE */}
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.removeBtn, pressed && { opacity: 0.75 }]}
          onPress={onRemove}
        >
          <MaterialIcons name="delete" size={12} color={Colors.textRed} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Hex Input ─────────────────────────────────────────────────
function HexInput({ value, onChangeText, placeholder, style }: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  style?: object;
}) {
  return (
    <TextInput
      style={[styles.hexInput, style]}
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

// ─── Main Component ────────────────────────────────────────────
export const MemoryPatchEditor = memo(function MemoryPatchEditor() {
  const { patches, addPatch, removePatch, revertPatch } = useInspector();

  const [address, setAddress]     = useState('');
  const [origBytes, setOrigBytes] = useState('');    // optional
  const [patchBytes, setPatchBytes] = useState('');
  const [label, setLabel]         = useState('');
  const [error, setError]         = useState('');

  const validateHex = (s: string) => /^[0-9A-Fa-f\s]+$/.test(s.trim());

  const handleApply = () => {
    if (!address.trim()) { setError('Address required'); return; }
    if (!patchBytes.trim()) { setError('Patched bytes required'); return; }
    if (!validateHex(address.replace('0x', '').replace(/\s/g, ''))) {
      setError('Invalid address format');
      return;
    }
    if (!validateHex(patchBytes)) { setError('Patch bytes must be hex only'); return; }
    if (origBytes.trim() && !validateHex(origBytes)) {
      setError('Original bytes must be hex only');
      return;
    }
    setError('');
    addPatch({
      address: address.trim().startsWith('0x') ? address.trim() : '0x' + address.trim(),
      originalBytes: origBytes.trim().toUpperCase() || '',   // empty = unknown
      patchedBytes: patchBytes.trim().toUpperCase(),
      label: label.trim() || `patch @ ${address.trim()}`,
    });
    setAddress('');
    setOrigBytes('');
    setPatchBytes('');
    setLabel('');
  };

  // Restore = re-apply patchedBytes (re-sends to device)
  const handleRestore = (id: string) => {
    const patch = patches.find(p => p.id === id);
    if (!patch) return;
    addPatch({
      address: patch.address,
      originalBytes: patch.originalBytes,
      patchedBytes: patch.patchedBytes,
      label: `restore:${patch.label}`,
    });
  };

  const appliedCount  = patches.filter(p => p.status === 'applied').length;
  const revertedCount = patches.filter(p => p.status === 'reverted').length;
  const failedCount   = patches.filter(p => p.status === 'failed').length;

  return (
    <View style={styles.container}>

      {/* ── Editor Form ── */}
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>NEW PATCH</Text>

        {/* Address */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>ADDR *</Text>
          <TextInput
            style={styles.addrInput}
            value={address}
            onChangeText={setAddress}
            placeholder="0x7A4B2800 or 7A4B2800"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
          />
        </View>

        {/* Label */}
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

        {/* Bytes row */}
        <View style={styles.bytesOuterRow}>
          {/* ORIG — optional */}
          <View style={styles.bytesField}>
            <View style={styles.bytesFieldHeader}>
              <Text style={styles.fieldLabel}>ORIG BYTES</Text>
              <Text style={styles.optionalTag}>optional</Text>
            </View>
            <HexInput
              value={origBytes}
              onChangeText={setOrigBytes}
              placeholder="1F 20 03 D5"
              style={styles.hexInputOrig}
            />
            <Text style={styles.bytesHint}>
              Leave blank if unknown.{'\n'}Required for REVERT.
            </Text>
          </View>

          <View style={styles.arrowCol}>
            <MaterialIcons name="arrow-forward" size={14} color={Colors.textMuted} />
          </View>

          {/* PATCH — required */}
          <View style={styles.bytesField}>
            <View style={styles.bytesFieldHeader}>
              <Text style={styles.fieldLabel}>PATCH BYTES *</Text>
            </View>
            <HexInput
              value={patchBytes}
              onChangeText={setPatchBytes}
              placeholder="00 00 A0 E3"
              style={styles.hexInputPatch}
            />
            <Text style={styles.bytesHint}>
              Space-separated hex bytes.{'\n'}e.g. NOP = 1F 20 03 D5
            </Text>
          </View>
        </View>

        {/* Quick NOP presets */}
        <View style={styles.presets}>
          <Text style={styles.presetsLabel}>QUICK:</Text>
          {[
            { label: 'NOP ARM64',  bytes: '1F 20 03 D5' },
            { label: 'RET ARM64',  bytes: 'C0 03 5F D6' },
            { label: 'MOV R0,0',   bytes: '00 00 A0 E3' },
            { label: 'NOP ARM32',  bytes: '00 00 A0 E1' },
          ].map(p => (
            <Pressable
              key={p.label}
              style={({ pressed }) => [styles.presetBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setPatchBytes(p.bytes)}
            >
              <Text style={styles.presetBtnText}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <MaterialIcons name="error" size={12} color={Colors.textRed} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.applyBtn, pressed && { opacity: 0.8 }]}
          onPress={handleApply}
        >
          <MaterialIcons name="flash-on" size={14} color={Colors.bg} />
          <Text style={styles.applyBtnText}>APPLY PATCH</Text>
        </Pressable>
      </ScrollView>

      {/* ── Patch History ── */}
      <View style={styles.historyHeader}>
        <MaterialIcons name="history" size={12} color={Colors.textMuted} />
        <Text style={styles.historyTitle}>HISTORY ({patches.length})</Text>
        <View style={styles.historyStats}>
          {appliedCount > 0 ? (
            <View style={[styles.histStat, { backgroundColor: Colors.primaryGlow }]}>
              <Text style={[styles.histStatText, { color: Colors.textGreen }]}>{appliedCount} LIVE</Text>
            </View>
          ) : null}
          {revertedCount > 0 ? (
            <View style={[styles.histStat, { backgroundColor: Colors.warningDim }]}>
              <Text style={[styles.histStatText, { color: Colors.textYellow }]}>{revertedCount} REVERTED</Text>
            </View>
          ) : null}
          {failedCount > 0 ? (
            <View style={[styles.histStat, { backgroundColor: Colors.dangerDim }]}>
              <Text style={[styles.histStatText, { color: Colors.textRed }]}>{failedCount} FAILED</Text>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {patches.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="edit" size={22} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No patches applied yet</Text>
            <Text style={styles.emptyHint}>RESTORE re-applies any patch · REVERT writes back orig bytes</Text>
          </View>
        ) : (
          patches.map(p => (
            <PatchRow
              key={p.id}
              patch={p}
              onRevert={() => revertPatch(p.id)}
              onRestore={() => handleRestore(p.id)}
              onRemove={() => removePatch(p.id)}
            />
          ))
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },

  // Form
  formScroll: {
    maxHeight: 340,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  formContent: {
    padding: Spacing.sm,
    gap: 8,
    paddingBottom: Spacing.md,
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
    width: 60,
    letterSpacing: 0.5,
    flexShrink: 0,
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
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Bytes row
  bytesOuterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  bytesField: {
    flex: 1,
    gap: 3,
  },
  bytesFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  optionalTag: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: Colors.textMuted,
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    letterSpacing: 0.3,
  },
  hexInput: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    borderWidth: 1,
  },
  hexInputOrig: {
    color: Colors.textYellow,
    backgroundColor: Colors.surfaceHighlight,
    borderColor: Colors.border,
  },
  hexInputPatch: {
    color: Colors.textGreen,
    backgroundColor: Colors.primaryGlow,
    borderColor: Colors.primary + '30',
  },
  bytesHint: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: Colors.textMuted,
    lineHeight: 12,
  },
  arrowCol: {
    paddingTop: 22,
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
  },

  // Presets
  presets: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetBtnText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textSecondary,
  },

  // Error & Apply
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
  applyBtnText: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.bg,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // History
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
  historyStats: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 'auto',
  },
  histStat: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  histStatText: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  scroll: { flex: 1 },

  // Patch rows
  patchRow: {
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 5,
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
    flexWrap: 'wrap',
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
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  restoreBtn: {
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  restoreBtnText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textGreen,
    fontWeight: '700',
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
    borderWidth: 1,
    borderColor: Colors.danger + '30',
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
    textAlign: 'center',
  },
  emptyHint: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    opacity: 0.6,
    textAlign: 'center',
    lineHeight: 16,
  },
});
