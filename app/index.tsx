// Powered by OnSpace.AI
// RVA Inspector — Main launcher screen
// Android-only · On-device loopback · No root · No PC required
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme';
import { FloatingInspector } from '@/components/feature/FloatingInspector';
import { useInspector } from '@/hooks/useInspector';
import { MaterialIcons } from '@expo/vector-icons';
import { EngineType } from '@/types/inspector';

const ENGINE_OPTIONS: { key: EngineType; label: string; module: string; color: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'unity_il2cpp', label: 'Unity IL2CPP',  module: 'libil2cpp.so',        color: Colors.textCyan,   icon: 'videogame-asset' },
  { key: 'unity_mono',   label: 'Unity Mono',    module: 'libmono.so',           color: Colors.textBlue,   icon: 'videogame-asset' },
  { key: 'unreal',       label: 'Unreal Engine', module: 'libUE4.so / libUE5.so',color: Colors.textYellow, icon: 'sports-esports' },
  { key: 'godot',        label: 'Godot Engine',  module: 'libgodot.so',          color: Colors.textPurple, icon: 'sports-esports' },
  { key: 'native',       label: 'Native C/C++',  module: 'libgame.so',           color: Colors.textGreen,  icon: 'memory' },
];

// ─── Connection Banner ────────────────────────────────────────
function ConnectionBanner() {
  const { wsState, connected, moduleInfo, events, classes, methods } = useInspector();

  const bgColor =
    wsState.status === 'connected' ? Colors.primaryGlow :
    wsState.status === 'connecting' ? Colors.warningDim :
    wsState.status === 'error' ? Colors.dangerDim :
    Colors.surfaceElevated;

  const dotColor =
    wsState.status === 'connected' ? Colors.primary :
    wsState.status === 'connecting' ? Colors.warning :
    wsState.status === 'error' ? Colors.danger :
    Colors.textMuted;

  const label =
    wsState.status === 'connected' ? 'AGENT CONNECTED' :
    wsState.status === 'connecting' ? 'CONNECTING TO AGENT...' :
    wsState.status === 'error' ? 'AGENT NOT FOUND' :
    'AGENT DISCONNECTED';

  return (
    <View style={[styles.banner, { backgroundColor: bgColor, borderColor: dotColor + '40' }]}>
      <View style={[styles.bannerDot, { backgroundColor: dotColor }]} />
      <View style={styles.bannerInfo}>
        <Text style={[styles.bannerStatus, { color: dotColor }]}>{label}</Text>
        <Text style={styles.bannerEndpoint} numberOfLines={1}>{wsState.endpoint}</Text>
      </View>
      {connected ? (
        <View style={styles.bannerStats}>
          <BannerStat label="EVT" value={events.length} color={Colors.textGreen} />
          <BannerStat label="CLS" value={classes.length} color={Colors.textPurple} />
          <BannerStat label="MTH" value={methods.length} color={Colors.textBlue} />
          {wsState.latencyMs > 0 ? (
            <BannerStat label="ms" value={wsState.latencyMs} color={Colors.textCyan} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function BannerStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.bannerStat}>
      <Text style={[styles.bannerStatValue, { color }]}>{value}</Text>
      <Text style={styles.bannerStatLabel}>{label}</Text>
    </View>
  );
}

// ─── Engine Selector ──────────────────────────────────────────
function EngineSelector() {
  const { engineType, setEngineType } = useInspector();

  return (
    <View style={styles.engineSection}>
      <Text style={styles.sectionTitle}>TARGET ENGINE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.engineScroll}>
        {ENGINE_OPTIONS.map(eng => (
          <Pressable
            key={eng.key}
            style={({ pressed }) => [
              styles.engineChip,
              engineType === eng.key && styles.engineChipActive,
              pressed && { opacity: 0.75 },
            ]}
            onPress={() => setEngineType(eng.key)}
          >
            <MaterialIcons
              name={eng.icon}
              size={13}
              color={engineType === eng.key ? eng.color : Colors.textMuted}
            />
            <View>
              <Text style={[styles.engineLabel, engineType === eng.key && { color: eng.color }]}>
                {eng.label}
              </Text>
              <Text style={styles.engineModule}>{eng.module}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Quick Connect ────────────────────────────────────────────
function QuickConnect() {
  const { wsEndpoint, setWsEndpoint, connectLive, disconnectLive, wsState } = useInspector();
  const [editEndpoint, setEditEndpoint] = useState(wsEndpoint);

  const isConnected = wsState.status === 'connected';
  const isConnecting = wsState.status === 'connecting';

  const handleConnect = () => {
    setWsEndpoint(editEndpoint.trim());
    connectLive(editEndpoint.trim());
  };

  return (
    <View style={styles.quickConnect}>
      <Text style={styles.sectionTitle}>LOOPBACK ENDPOINT</Text>
      <View style={styles.endpointRow}>
        <TextInput
          style={styles.endpointInput}
          value={editEndpoint}
          onChangeText={setEditEndpoint}
          placeholder="ws://127.0.0.1:9999"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          keyboardType="url"
          editable={!isConnected && !isConnecting}
        />
        <Pressable
          style={({ pressed }) => [
            styles.connectBtn,
            isConnected && styles.connectBtnDanger,
            isConnecting && styles.connectBtnWaiting,
            pressed && { opacity: 0.75 },
          ]}
          onPress={isConnected ? disconnectLive : handleConnect}
          disabled={isConnecting}
        >
          <MaterialIcons
            name={isConnected ? 'wifi-off' : isConnecting ? 'sync' : 'wifi'}
            size={14}
            color={Colors.bg}
          />
          <Text style={styles.connectBtnText}>
            {isConnected ? 'DISCONNECT' : isConnecting ? 'WAIT' : 'CONNECT'}
          </Text>
        </Pressable>
      </View>
      <View style={styles.presets}>
        <Text style={styles.presetsLabel}>QUICK:</Text>
        {[
          { label: ':9999', url: 'ws://127.0.0.1:9999' },
          { label: ':8080', url: 'ws://127.0.0.1:8080' },
          { label: ':7777', url: 'ws://127.0.0.1:7777' },
          { label: ':1234', url: 'ws://127.0.0.1:1234' },
        ].map(p => (
          <Pressable
            key={p.label}
            style={[styles.presetChip, editEndpoint === p.url && styles.presetChipActive]}
            onPress={() => setEditEndpoint(p.url)}
            disabled={isConnected}
          >
            <Text style={[styles.presetChipText, editEndpoint === p.url && styles.presetChipTextActive]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Module Info Card ─────────────────────────────────────────
function ModuleInfoCard() {
  const { moduleInfo, connected } = useInspector();
  if (!connected || !moduleInfo) return null;

  return (
    <View style={styles.moduleCard}>
      <View style={styles.moduleCardHeader}>
        <MaterialIcons name="memory" size={13} color={Colors.textGreen} />
        <Text style={styles.moduleCardTitle}>ACTIVE MODULE</Text>
      </View>
      <View style={styles.moduleCardRows}>
        {[
          { label: 'NAME', value: moduleInfo.name, color: Colors.textGreen },
          { label: 'BASE', value: moduleInfo.base, color: Colors.textYellow },
          { label: 'SIZE', value: moduleInfo.size, color: Colors.textBlue },
          { label: 'PATH', value: moduleInfo.path, color: Colors.textMuted },
        ].map(row => (
          <View key={row.label} style={styles.moduleRow}>
            <Text style={styles.moduleRowLabel}>{row.label}</Text>
            <Text style={[styles.moduleRowValue, { color: row.color }]} numberOfLines={1} selectable>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── How It Works (No-Root Architecture) ──────────────────────
function ArchitectureCard() {
  return (
    <View style={styles.archCard}>
      <View style={styles.archHeader}>
        <MaterialIcons name="phone-android" size={13} color={Colors.textGreen} />
        <Text style={styles.archTitle}>HOW IT WORKS — NO ROOT · NO PC · ANDROID ONLY</Text>
      </View>
      <Text style={styles.archBody}>
        The inspector agent is compiled directly into the target game as a shared library (.so). When the game process starts, the agent hooks methods internally and opens a loopback WebSocket server on this device. No external device, no USB cable, and no root access is needed.
      </Text>
    </View>
  );
}

// ─── Integration Steps ────────────────────────────────────────
function IntegrationSteps() {
  const { engineType } = useInspector();
  const eng = ENGINE_OPTIONS.find(e => e.key === engineType) ?? ENGINE_OPTIONS[0];

  const steps: { icon: keyof typeof MaterialIcons.glyphMap; title: string; detail: string }[] = [
    {
      icon: 'code',
      title: `Add agent to ${eng.label} project`,
      detail: engineType === 'unity_il2cpp' || engineType === 'unity_mono'
        ? 'Copy libinspect_agent.cpp into Assets/Plugins/Android/. Add to Android build. The agent auto-hooks IL2CPP methods and emits hook_event messages.'
        : engineType === 'unreal'
        ? 'Add as a ThirdParty or GameplayModule. Include InspectAgent.h and call InspectAgent::Init() in your GameInstance::Init(). Supports UClass reflection via UE metadata.'
        : engineType === 'godot'
        ? 'Build as a GDExtension .so. Register as extension in .gdextension file. Agent hooks GDScript virtual methods and C++ native calls automatically.'
        : 'Link libinspect_agent.so at build time. Call inspect_agent_init(9999) early in your main() or JNI_OnLoad. Works with any ARM64 native binary.',
    },
    {
      icon: 'sports-esports',
      title: 'Install & launch the game',
      detail: `Install the modified APK on this Android device. When ${eng.module} loads, the agent starts automatically. It hooks all registered methods and opens ws://127.0.0.1:9999 on this device.`,
    },
    {
      icon: 'bug-report',
      title: 'Connect & inspect live',
      detail: 'Tap CONNECT in the WS tab or above. Hook events stream in real time. Use the floating panel (bug FAB) to overlay the inspector on top of the running game. Export session dumps via the EXP tab.',
    },
  ];

  return (
    <View style={styles.stepsCard}>
      <View style={styles.stepsHeader}>
        <MaterialIcons name={eng.icon} size={13} color={eng.color} />
        <Text style={[styles.stepsTitle, { color: eng.color }]}>
          {eng.label.toUpperCase()} INTEGRATION
        </Text>
      </View>
      {steps.map((s, i) => (
        <View key={i} style={styles.step}>
          <View style={styles.stepLeft}>
            <View style={styles.stepIndex}>
              <Text style={styles.stepIndexText}>{i + 1}</Text>
            </View>
            {i < steps.length - 1 ? <View style={styles.stepLine} /> : null}
          </View>
          <View style={styles.stepContent}>
            <View style={styles.stepTitleRow}>
              <MaterialIcons name={s.icon} size={11} color={Colors.textBlue} />
              <Text style={styles.stepTitle}>{s.title}</Text>
            </View>
            <Text style={styles.stepDetail}>{s.detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Root ─────────────────────────────────────────────────────
export default function InspectorScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.logoMark}>
            <MaterialIcons name="bug-report" size={18} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.appTitle}>RVA INSPECTOR</Text>
            <Text style={styles.appSub}>Unity · Unreal · Godot · Native ARM64</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.androidBadge}>
            <MaterialIcons name="phone-android" size={10} color={Colors.textGreen} />
            <Text style={styles.androidBadgeText}>ANDROID</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Connection status */}
        <ConnectionBanner />

        {/* Engine selector */}
        <EngineSelector />

        {/* Quick connect */}
        <QuickConnect />

        {/* Module info (shown after connect) */}
        <ModuleInfoCard />

        {/* Architecture explanation */}
        <ArchitectureCard />

        {/* Engine-specific integration steps */}
        <IntegrationSteps />

        <View style={{ height: insets.bottom + 80 }} />
      </ScrollView>

      {/* === FLOATING INSPECTOR OVERLAY === */}
      <FloatingInspector />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: 12,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontFamily: 'monospace',
    fontSize: FontSize.md,
    color: Colors.textGreen,
    fontWeight: '700',
    letterSpacing: 2,
  },
  appSub: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  headerRight: {},
  androidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  androidBadgeText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textGreen,
    fontWeight: '700',
    letterSpacing: 1,
  },
  scroll: { flex: 1 },
  scrollContent: { gap: 1 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.md,
    borderBottomWidth: 1,
    flexWrap: 'wrap',
  },
  bannerDot: { width: 10, height: 10, borderRadius: 5 },
  bannerInfo: { flex: 1, minWidth: 100, gap: 2 },
  bannerStatus: { fontFamily: 'monospace', fontSize: FontSize.sm, fontWeight: '700', letterSpacing: 1 },
  bannerEndpoint: { fontFamily: 'monospace', fontSize: FontSize.micro, color: Colors.textMuted },
  bannerStats: { flexDirection: 'row', gap: 12 },
  bannerStat: { alignItems: 'center', gap: 1 },
  bannerStatValue: { fontFamily: 'monospace', fontSize: FontSize.sm, fontWeight: '700' },
  bannerStatLabel: { fontFamily: 'monospace', fontSize: FontSize.micro, color: Colors.textMuted, letterSpacing: 0.5 },

  engineSection: {
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 8,
  },
  engineScroll: {
    gap: 8,
    paddingRight: Spacing.sm,
  },
  engineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  engineChipActive: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.borderBright,
  },
  engineLabel: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  engineModule: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
  },

  quickConnect: {
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  endpointRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  endpointInput: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textBlue,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 10 : 7,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 9,
  },
  connectBtnDanger: { backgroundColor: Colors.danger },
  connectBtnWaiting: { backgroundColor: Colors.warning },
  connectBtnText: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.bg,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  presets: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  presetsLabel: { fontFamily: 'monospace', fontSize: FontSize.micro, color: Colors.textMuted },
  presetChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetChipActive: { backgroundColor: Colors.accentDim, borderColor: Colors.accent + '60' },
  presetChipText: { fontFamily: 'monospace', fontSize: FontSize.micro, color: Colors.textSecondary },
  presetChipTextActive: { color: Colors.textBlue },

  moduleCard: {
    margin: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    overflow: 'hidden',
  },
  moduleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.primaryGlow,
  },
  moduleCardTitle: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textGreen,
    fontWeight: '700',
    letterSpacing: 1,
  },
  moduleCardRows: { padding: Spacing.sm, gap: 5 },
  moduleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  moduleRowLabel: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    fontWeight: '700',
    width: 40,
    letterSpacing: 0.5,
  },
  moduleRowValue: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    flex: 1,
  },

  archCard: {
    margin: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.primaryGlow,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary + '25',
    gap: 6,
  },
  archHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  archTitle: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textGreen,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
  },
  archBody: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textSecondary,
    lineHeight: 16,
  },

  stepsCard: {
    margin: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accentDim,
    overflow: 'hidden',
  },
  stepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.accentDim,
  },
  stepsTitle: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  step: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingTop: 10,
    paddingBottom: 4,
  },
  stepLeft: { alignItems: 'center', marginRight: 10, width: 22 },
  stepIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accentDim,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndexText: { fontFamily: 'monospace', fontSize: FontSize.micro, color: Colors.textBlue, fontWeight: '700' },
  stepLine: {
    width: 1,
    flex: 1,
    backgroundColor: Colors.border,
    marginTop: 4,
    minHeight: 20,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 10,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepTitle: { fontFamily: 'monospace', fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: '700', flex: 1 },
  stepDetail: { fontFamily: 'monospace', fontSize: FontSize.micro, color: Colors.textSecondary, lineHeight: 16 },
});
