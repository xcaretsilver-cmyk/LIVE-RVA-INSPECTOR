// Powered by OnSpace.AI
// Export Panel — session dump builder, preview, and share
import React, { useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
} from 'react-native';
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme';
import { useInspector } from '@/hooks/useInspector';
import { MaterialIcons } from '@expo/vector-icons';
import { ExportOptions, DEFAULT_EXPORT_OPTIONS, getExportStats, buildSessionDump } from '@/services/sessionExport';
import { EngineType } from '@/types/inspector';

const ENGINE_LABELS: Record<EngineType, { label: string; icon: keyof typeof MaterialIcons.glyphMap; color: string }> = {
  unity_il2cpp: { label: 'Unity IL2CPP',  icon: 'videogame-asset', color: Colors.textCyan },
  unity_mono:   { label: 'Unity Mono',    icon: 'videogame-asset', color: Colors.textBlue },
  unreal:       { label: 'Unreal Engine', icon: 'sports-esports',  color: Colors.textYellow },
  godot:        { label: 'Godot Engine',  icon: 'sports-esports',  color: Colors.textPurple },
  native:       { label: 'Native C/C++',  icon: 'memory',          color: Colors.textGreen },
};

interface ToggleRowProps {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ label, sub, value, onChange }: ToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {sub ? <Text style={styles.toggleSub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.primaryDim }}
        thumbColor={value ? Colors.primary : Colors.textMuted}
      />
    </View>
  );
}

export const ExportPanel = memo(function ExportPanel() {
  const {
    engineType, setEngineType,
    events, classes, methods, patches, hookConfigs,
    moduleInfo, wsState, sessionStartTime,
    exportSession, lastDump,
  } = useInspector();

  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [exporting, setExporting] = useState(false);
  const [lastResult, setLastResult] = useState<boolean | null>(null);

  const setOpt = (key: keyof ExportOptions, value: boolean | number) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = async () => {
    setExporting(true);
    setLastResult(null);
    try {
      const ok = await exportSession(options);
      setLastResult(ok);
    } finally {
      setExporting(false);
    }
  };

  // Build preview stats
  const previewDump = buildSessionDump({
    engine: engineType,
    wsState,
    sessionStartTime,
    moduleInfo,
    events,
    classes,
    methods,
    patches,
    hookConfigs,
    options,
  });
  const statsText = getExportStats(previewDump);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Engine Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TARGET ENGINE</Text>
        <View style={styles.engineGrid}>
          {(Object.entries(ENGINE_LABELS) as [EngineType, typeof ENGINE_LABELS[EngineType]][]).map(([key, cfg]) => (
            <Pressable
              key={key}
              style={({ pressed }) => [
                styles.engineChip,
                engineType === key && styles.engineChipActive,
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => setEngineType(key)}
            >
              <MaterialIcons
                name={cfg.icon}
                size={12}
                color={engineType === key ? cfg.color : Colors.textMuted}
              />
              <Text style={[styles.engineChipText, engineType === key && { color: cfg.color }]}>
                {cfg.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Export Options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>EXPORT OPTIONS</Text>
        <ToggleRow
          label="Include Hook Events"
          sub={`${events.length} events (cap: ${options.maxEvents})`}
          value={options.includeEvents}
          onChange={v => setOpt('includeEvents', v)}
        />
        <ToggleRow
          label="Include Class Dumps"
          sub={`${classes.length} classes`}
          value={options.includeClasses}
          onChange={v => setOpt('includeClasses', v)}
        />
        <ToggleRow
          label="Include Methods"
          sub={`${methods.length} methods`}
          value={options.includeMethods}
          onChange={v => setOpt('includeMethods', v)}
        />
        <ToggleRow
          label="Include Memory Patches"
          sub={`${patches.length} patches`}
          value={options.includePatches}
          onChange={v => setOpt('includePatches', v)}
        />
        <ToggleRow
          label="Include Hook Configs"
          sub={`${hookConfigs.length} configs`}
          value={options.includeHookConfigs}
          onChange={v => setOpt('includeHookConfigs', v)}
        />

        {/* Event cap selector */}
        <View style={styles.capRow}>
          <Text style={styles.toggleLabel}>Max Events in Export</Text>
          <View style={styles.capBtns}>
            {[100, 250, 500, 1000].map(n => (
              <Pressable
                key={n}
                style={[styles.capBtn, options.maxEvents === n && styles.capBtnActive]}
                onPress={() => setOpt('maxEvents', n)}
              >
                <Text style={[styles.capBtnText, options.maxEvents === n && styles.capBtnTextActive]}>
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Session Preview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SESSION PREVIEW</Text>
        <View style={styles.previewBox}>
          {statsText.split('\n').map((line, i) => {
            const [k, v] = line.split(': ');
            return (
              <View key={i} style={styles.previewRow}>
                <Text style={styles.previewKey}>{k}</Text>
                <Text style={styles.previewVal}>{v}</Text>
              </View>
            );
          })}
          {previewDump.summary.hotMethods.length > 0 ? (
            <View style={styles.hotMethodsSection}>
              <Text style={styles.hotMethodsTitle}>HOT METHODS</Text>
              {previewDump.summary.hotMethods.slice(0, 5).map((m, i) => (
                <View key={i} style={styles.hotMethodRow}>
                  <MaterialIcons name="bolt" size={10} color={Colors.textYellow} />
                  <Text style={styles.hotMethodName} numberOfLines={1}>{m.key}</Text>
                  <Text style={styles.hotMethodHits}>×{m.hits}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {/* Last dump info */}
      {lastDump ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LAST EXPORT</Text>
          <View style={styles.lastDumpBox}>
            <MaterialIcons name="check-circle" size={14} color={Colors.textGreen} />
            <Text style={styles.lastDumpText}>{lastDump.meta.exportedAt}</Text>
            <Text style={styles.lastDumpEngine}>{lastDump.meta.engine}</Text>
          </View>
        </View>
      ) : null}

      {/* Export button */}
      <View style={styles.exportActions}>
        {lastResult === false ? (
          <View style={styles.resultBanner}>
            <MaterialIcons name="error" size={13} color={Colors.textRed} />
            <Text style={styles.resultText}>Export was dismissed or failed</Text>
          </View>
        ) : lastResult === true ? (
          <View style={[styles.resultBanner, styles.resultBannerOk]}>
            <MaterialIcons name="check" size={13} color={Colors.textGreen} />
            <Text style={[styles.resultText, { color: Colors.textGreen }]}>Exported successfully</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.exportBtn,
            exporting && styles.exportBtnLoading,
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleExport}
          disabled={exporting}
        >
          <MaterialIcons
            name={exporting ? 'sync' : 'share'}
            size={16}
            color={Colors.bg}
          />
          <Text style={styles.exportBtnText}>
            {exporting ? 'PREPARING...' : 'EXPORT & SHARE SESSION'}
          </Text>
        </Pressable>

        <Text style={styles.exportHint}>
          Exports JSON via Android share sheet.{'\n'}
          Open in file manager, email, or reverse engineering tools.
        </Text>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  section: {
    padding: Spacing.sm,
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
  engineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  engineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  engineChipActive: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.borderBright,
  },
  engineChipText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  toggleInfo: {
    flex: 1,
    gap: 1,
  },
  toggleLabel: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },
  toggleSub: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
  },
  capRow: {
    paddingTop: 4,
    gap: 6,
  },
  capBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  capBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  capBtnActive: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accent + '60',
  },
  capBtnText: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  capBtnTextActive: {
    color: Colors.textBlue,
  },
  previewBox: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewKey: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
  },
  previewVal: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  hotMethodsSection: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 3,
  },
  hotMethodsTitle: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textYellow,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  hotMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  hotMethodName: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textSecondary,
    flex: 1,
  },
  hotMethodHits: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textYellow,
    fontWeight: '700',
  },
  lastDumpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryGlow,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  lastDumpText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textGreen,
    flex: 1,
  },
  lastDumpEngine: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
  },
  exportActions: {
    padding: Spacing.md,
    gap: 10,
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.sm,
    backgroundColor: Colors.dangerDim,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.danger + '40',
  },
  resultBannerOk: {
    backgroundColor: Colors.primaryGlow,
    borderColor: Colors.primary + '40',
  },
  resultText: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textRed,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
  },
  exportBtnLoading: {
    backgroundColor: Colors.warning,
  },
  exportBtnText: {
    fontFamily: 'monospace',
    fontSize: FontSize.sm,
    color: Colors.bg,
    fontWeight: '700',
    letterSpacing: 1,
  },
  exportHint: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
