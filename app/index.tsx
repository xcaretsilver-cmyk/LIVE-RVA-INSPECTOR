// Powered by OnSpace.AI
// RVA Inspector — Main launcher screen
// Run this app alongside (or injected into) the target game.
// The floating inspector overlay appears on top of whatever is running.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme';
import { FloatingInspector } from '@/components/feature/FloatingInspector';
import { useInspector } from '@/hooks/useInspector';
import { MaterialIcons } from '@expo/vector-icons';

// ─── Connection Banner ───────────────────────────────────────
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
    wsState.status === 'connected' ? 'CONNECTED' :
    wsState.status === 'connecting' ? 'CONNECTING...' :
    wsState.status === 'error' ? 'CONNECTION ERROR' :
    'DISCONNECTED';

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
      {moduleInfo && connected ? (
        <View style={styles.moduleTag}>
          <MaterialIcons name="memory" size={10} color={Colors.textBlue} />
          <Text style={styles.moduleTagText} numberOfLines={1}>{moduleInfo.name}</Text>
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
      <Text style={styles.sectionTitle}>RELAY ENDPOINT</Text>
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
            {isConnected ? 'DISCONNECT' : isConnecting ? 'CONNECTING' : 'CONNECT'}
          </Text>
        </Pressable>
      </View>

      {/* Presets */}
      <View style={styles.presets}>
        <Text style={styles.presetsLabel}>PRESETS:</Text>
        {[
          { label: 'localhost', url: 'ws://127.0.0.1:9999' },
          { label: 'USB ADB', url: 'ws://10.0.2.2:9999' },
          { label: 'LAN', url: 'ws://192.168.1.100:9999' },
          { label: 'port 8080', url: 'ws://127.0.0.1:8080' },
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

// ─── Setup Guide ──────────────────────────────────────────────
function SetupGuide() {
  const steps = [
    {
      icon: 'build' as const,
      title: 'Build the C++ agent',
      detail: 'Compile libinspect_agent.so from BRIDGE_INTEGRATION.md and inject it into the target game process via Zygisk/Frida/KernelSU.',
    },
    {
      icon: 'cable' as const,
      title: 'Forward the relay port',
      detail: 'Over USB: adb forward tcp:9999 tcp:9999\nOver Wi-Fi: use the device LAN IP directly.',
    },
    {
      icon: 'wifi' as const,
      title: 'Connect the inspector',
      detail: 'Enter the endpoint above and tap CONNECT. The inspector will auto-reconnect on disconnect.',
    },
    {
      icon: 'bug-report' as const,
      title: 'Open the floating panel',
      detail: 'Tap the green bug FAB (bottom-right). Hook events, class dumps, and memory data will stream live.',
    },
  ];

  return (
    <View style={styles.guide}>
      <View style={styles.guideHeader}>
        <MaterialIcons name="integration-instructions" size={13} color={Colors.textBlue} />
        <Text style={styles.guideTitleText}>INJECTION GUIDE</Text>
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
              <MaterialIcons name={s.icon} size={12} color={Colors.textBlue} />
              <Text style={styles.stepTitle}>{s.title}</Text>
            </View>
            <Text style={styles.stepDetail}>{s.detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Protocol Reference ───────────────────────────────────────
function ProtocolReference() {
  const messages = [
    { dir: '←', type: 'hook_event', desc: 'Fired method with params, RVA, call stack' },
    { dir: '←', type: 'class_dump', desc: 'Class metadata with fields and methods' },
    { dir: '←', type: 'module_info', desc: 'Module base address and size' },
    { dir: '←', type: 'patch_result', desc: 'Ack after memory patch applied/failed' },
    { dir: '→', type: 'patch_memory', desc: 'Write bytes to absolute address' },
    { dir: '→', type: 'hook_config', desc: 'Set per-method action/depth/condition' },
    { dir: '→', type: 'ping', desc: 'Latency measurement (expects pong)' },
  ];

  return (
    <View style={styles.protocol}>
      <Text style={styles.sectionTitle}>WS PROTOCOL MESSAGES</Text>
      {messages.map((m, i) => (
        <View key={i} style={styles.protoRow}>
          <Text style={[styles.protoDir, { color: m.dir === '←' ? Colors.textGreen : Colors.textBlue }]}>
            {m.dir}
          </Text>
          <Text style={styles.protoType}>{m.type}</Text>
          <Text style={styles.protoDesc}>{m.desc}</Text>
        </View>
      ))}
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
        <Text style={styles.moduleCardTitle}>TARGET MODULE</Text>
      </View>
      <View style={styles.moduleCardRows}>
        <ModuleRow label="NAME" value={moduleInfo.name} color={Colors.textGreen} />
        <ModuleRow label="BASE" value={moduleInfo.base} color={Colors.textYellow} />
        <ModuleRow label="SIZE" value={moduleInfo.size} color={Colors.textBlue} />
        <ModuleRow label="PATH" value={moduleInfo.path} color={Colors.textMuted} />
      </View>
    </View>
  );
}

function ModuleRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.moduleRow}>
      <Text style={styles.moduleRowLabel}>{label}</Text>
      <Text style={[styles.moduleRowValue, { color }]} numberOfLines={1} selectable>{value}</Text>
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
            <Text style={styles.appSub}>ARM64 · il2cpp · Unity · Godot</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.versionTag}>v2.0 LIVE</Text>
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

        {/* Quick connect */}
        <QuickConnect />

        {/* Module info (shown after connect) */}
        <ModuleInfoCard />

        {/* Setup guide */}
        <SetupGuide />

        {/* Protocol reference */}
        <ProtocolReference />

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
  headerRight: {
    alignItems: 'flex-end',
  },
  versionTag: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textGreen,
    backgroundColor: Colors.primaryGlow,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    letterSpacing: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 1,
  },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.md,
    borderBottomWidth: 1,
    flexWrap: 'wrap',
  },
  bannerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bannerInfo: {
    flex: 1,
    minWidth: 100,
    gap: 2,
  },
  bannerStatus: {
    fontFamily: 'monospace',
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bannerEndpoint: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
  },
  bannerStats: {
    flexDirection: 'row',
    gap: 12,
  },
  bannerStat: {
    alignItems: 'center',
    gap: 1,
  },
  bannerStatValue: {
    fontFamily: 'monospace',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  bannerStatLabel: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  moduleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  moduleTagText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textBlue,
    maxWidth: 120,
  },

  // Quick Connect
  quickConnect: {
    padding: Spacing.md,
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
  endpointRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
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
  connectBtnDanger: {
    backgroundColor: Colors.danger,
  },
  connectBtnWaiting: {
    backgroundColor: Colors.warning,
  },
  connectBtnText: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.bg,
    fontWeight: '700',
    letterSpacing: 0.5,
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
  presetChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetChipActive: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accent + '60',
  },
  presetChipText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textSecondary,
  },
  presetChipTextActive: {
    color: Colors.textBlue,
  },

  // Module Card
  moduleCard: {
    margin: Spacing.md,
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
  moduleCardRows: {
    padding: Spacing.sm,
    gap: 5,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
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

  // Guide
  guide: {
    margin: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accentDim,
    overflow: 'hidden',
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.accentDim,
  },
  guideTitleText: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textBlue,
    fontWeight: '700',
    letterSpacing: 1,
  },
  step: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingTop: 10,
    paddingBottom: 4,
  },
  stepLeft: {
    alignItems: 'center',
    marginRight: 10,
    width: 22,
  },
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
  stepIndexText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textBlue,
    fontWeight: '700',
  },
  stepLine: {
    width: 1,
    flex: 1,
    backgroundColor: Colors.border,
    marginTop: 4,
    marginBottom: 0,
    minHeight: 20,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 10,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepTitle: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  stepDetail: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textSecondary,
    lineHeight: 16,
  },

  // Protocol
  protocol: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    gap: 6,
  },
  protoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  protoDir: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    fontWeight: '700',
    width: 14,
  },
  protoType: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textYellow,
    width: 120,
  },
  protoDesc: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 15,
  },
});
