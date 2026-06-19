// Powered by OnSpace.AI
// Hook Config Panel — toggle hooks, set actions, watch conditions
import React, { useState, memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Platform,
  Switch,
} from 'react-native';
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme';
import { useInspector } from '@/hooks/useInspector';
import { HookConfig, HookAction } from '@/types/inspector';
import { MaterialIcons } from '@expo/vector-icons';
import { Badge } from '@/components/ui/Badge';

const ACTION_OPTIONS: { value: HookAction; label: string; color: string }[] = [
  { value: 'log', label: 'LOG', color: Colors.textGreen },
  { value: 'breakpoint', label: 'BRK', color: Colors.textYellow },
  { value: 'skip', label: 'SKIP', color: Colors.textRed },
  { value: 'off', label: 'OFF', color: Colors.textMuted },
];

const ACTION_BADGE_VARIANT: Record<HookAction, 'green' | 'yellow' | 'red' | 'muted'> = {
  log: 'green',
  breakpoint: 'yellow',
  skip: 'red',
  off: 'muted',
};

function ActionPicker({ current, onChange }: {
  current: HookAction;
  onChange: (a: HookAction) => void;
}) {
  return (
    <View style={styles.actionPicker}>
      {ACTION_OPTIONS.map(opt => (
        <Pressable
          key={opt.value}
          style={[
            styles.actionBtn,
            current === opt.value && { backgroundColor: opt.color + '20', borderColor: opt.color + '60' },
          ]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.actionBtnText, { color: current === opt.value ? opt.color : Colors.textMuted }]}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function HookConfigRow({ config, onToggle, onActionChange, onDepthChange, onWatchChange, onSendToDevice }: {
  config: HookConfig;
  onToggle: () => void;
  onActionChange: (a: HookAction) => void;
  onDepthChange: (d: number) => void;
  onWatchChange: (w: string) => void;
  onSendToDevice: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.hookRow, !config.enabled && styles.hookRowDisabled]}>
      {/* Header */}
      <Pressable
        style={styles.hookHeader}
        onPress={() => setExpanded(v => !v)}
      >
        <Switch
          value={config.enabled}
          onValueChange={onToggle}
          trackColor={{ false: Colors.border, true: Colors.primaryDim }}
          thumbColor={config.enabled ? Colors.primary : Colors.textMuted}
          style={styles.toggle}
        />
        <View style={styles.hookInfo}>
          <Text style={[styles.hookClass, !config.enabled && styles.textDisabled]}>
            {config.className}
          </Text>
          <Text style={styles.hookSep}>::</Text>
          <Text style={[styles.hookMethod, !config.enabled && styles.textDisabled]}>
            {config.methodName}
          </Text>
          <Badge label={config.action.toUpperCase()} variant={ACTION_BADGE_VARIANT[config.action]} />
        </View>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={14}
          color={Colors.textMuted}
        />
      </Pressable>

      {/* RVA */}
      <View style={styles.hookRva}>
        <MaterialIcons name="pin" size={10} color={Colors.textMuted} />
        <Text style={styles.hookRvaText}>{config.rva}</Text>
      </View>

      {/* Expanded config */}
      {expanded ? (
        <View style={styles.hookExpanded}>
          {/* Action picker */}
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>ACTION</Text>
            <ActionPicker current={config.action} onChange={onActionChange} />
          </View>

          {/* Capture depth */}
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>DEPTH</Text>
            <View style={styles.depthPicker}>
              {[0, 1, 2, 3, 4, 5].map(d => (
                <Pressable
                  key={d}
                  style={[
                    styles.depthBtn,
                    config.captureDepth === d && styles.depthBtnActive,
                  ]}
                  onPress={() => onDepthChange(d)}
                >
                  <Text style={[
                    styles.depthBtnText,
                    config.captureDepth === d && styles.depthBtnTextActive,
                  ]}>{d}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Watch condition */}
          <View style={styles.configColRow}>
            <Text style={styles.configLabel}>WATCH IF</Text>
            <TextInput
              style={styles.watchInput}
              value={config.watchCondition ?? ''}
              onChangeText={onWatchChange}
              placeholder="e.g. damage > 100"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Send to device */}
          <Pressable
            style={({ pressed }) => [styles.sendBtn, pressed && styles.sendBtnPressed]}
            onPress={onSendToDevice}
          >
            <MaterialIcons name="send" size={12} color={Colors.textBlue} />
            <Text style={styles.sendBtnText}>PUSH TO DEVICE</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export const HookConfigPanel = memo(function HookConfigPanel() {
  const { hookConfigs, setHookConfig, toggleHook, sendHookConfigToDevice, methods, connected } = useInspector();
  const [filter, setFilter] = useState('');

  const filtered = filter
    ? hookConfigs.filter(c =>
        c.className.toLowerCase().includes(filter.toLowerCase()) ||
        c.methodName.toLowerCase().includes(filter.toLowerCase())
      )
    : hookConfigs;

  const enabledCount = hookConfigs.filter(c => c.enabled).length;
  const brkCount = hookConfigs.filter(c => c.action === 'breakpoint').length;

  const renderItem = useCallback(({ item }: { item: HookConfig }) => {
    const methodHits = methods.find(m => m.name === item.methodName && m.className === item.className)?.hitCount ?? 0;
    return (
      <View>
        {methodHits > 0 ? (
          <View style={styles.hitBar}>
            <MaterialIcons name="bolt" size={10} color={Colors.textYellow} />
            <Text style={styles.hitBarText}>{methodHits} hits</Text>
          </View>
        ) : null}
        <HookConfigRow
          config={item}
          onToggle={() => toggleHook(item.methodKey)}
          onActionChange={(a) => setHookConfig(item.methodKey, a, item.captureDepth, item.watchCondition)}
          onDepthChange={(d) => setHookConfig(item.methodKey, item.action, d, item.watchCondition)}
          onWatchChange={(w) => setHookConfig(item.methodKey, item.action, item.captureDepth, w)}
          onSendToDevice={() => sendHookConfigToDevice(item.methodKey)}
        />
      </View>
    );
  }, [hookConfigs, methods, toggleHook, setHookConfig, sendHookConfigToDevice]);

  return (
    <View style={styles.container}>
      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{enabledCount}</Text>
          <Text style={styles.statLabel}>ACTIVE</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.textYellow }]}>{brkCount}</Text>
          <Text style={styles.statLabel}>BREAKPOINTS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.textMuted }]}>{hookConfigs.length - enabledCount}</Text>
          <Text style={styles.statLabel}>DISABLED</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={12} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={filter}
          onChangeText={setFilter}
          placeholder="filter hooks..."
          placeholderTextColor={Colors.textMuted}
        />
        {filter ? (
          <Pressable onPress={() => setFilter('')} hitSlop={8}>
            <MaterialIcons name="close" size={12} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={item => item.methodKey}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            {hookConfigs.length === 0 ? (
              <Text style={styles.emptyText}>
                {connected ? 'Waiting for class dump from device...' : 'Connect to receive hook metadata'}
              </Text>
            ) : (
              <Text style={styles.emptyText}>No hooks match filter</Text>
            )}
          </View>
        }
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: 'monospace',
    fontSize: FontSize.md,
    color: Colors.textGreen,
    fontWeight: '700',
  },
  statLabel: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    padding: 0,
  },
  hookRow: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  hookRowDisabled: {
    opacity: 0.5,
  },
  hookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    gap: 8,
  },
  toggle: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  hookInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  hookClass: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textPurple,
    fontWeight: '600',
  },
  hookSep: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  hookMethod: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textGreen,
    fontWeight: '600',
  },
  textDisabled: {
    color: Colors.textMuted,
  },
  hookRva: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingBottom: 6,
  },
  hookRvaText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textYellow,
  },
  hookExpanded: {
    padding: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  configColRow: {
    gap: 4,
  },
  configLabel: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    fontWeight: '700',
    width: 56,
    letterSpacing: 0.5,
  },
  actionPicker: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHighlight,
  },
  actionBtnText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  depthPicker: {
    flexDirection: 'row',
    gap: 5,
  },
  depthBtn: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depthBtnActive: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accent + '60',
  },
  depthBtnText: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  depthBtnTextActive: {
    color: Colors.textBlue,
    fontWeight: '700',
  },
  watchInput: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textCyan,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 5 : 3,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentDim,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  sendBtnPressed: {
    opacity: 0.7,
  },
  sendBtnText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textBlue,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  hitBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    backgroundColor: Colors.warningDim,
  },
  hitBarText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textYellow,
  },
  empty: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'monospace',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
});
