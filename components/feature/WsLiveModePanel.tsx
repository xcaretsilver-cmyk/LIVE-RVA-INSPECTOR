// Powered by OnSpace.AI
// WS Live Mode Panel — on-device loopback only (no PC/ADB required)
// The C++ agent runs inside the same Android device and listens on loopback.
import React, { useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  ScrollView,
} from 'react-native';
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme';
import { useInspector } from '@/hooks/useInspector';
import { MaterialIcons } from '@expo/vector-icons';

const STATUS_CONFIG = {
  disconnected: { color: Colors.textMuted,   icon: 'signal-wifi-off' as const,  label: 'DISCONNECTED' },
  connecting:   { color: Colors.textYellow,  icon: 'sync' as const,             label: 'CONNECTING...' },
  connected:    { color: Colors.textGreen,   icon: 'signal-wifi-4-bar' as const, label: 'CONNECTED' },
  error:        { color: Colors.textRed,     icon: 'error' as const,            label: 'CONNECTION ERROR' },
};

// On-device presets — no external PC needed
const PRESETS = [
  { label: 'loopback :9999', url: 'ws://127.0.0.1:9999', desc: 'Default — agent on same device' },
  { label: 'loopback :8080', url: 'ws://127.0.0.1:8080', desc: 'Alternate port' },
  { label: 'loopback :7777', url: 'ws://127.0.0.1:7777', desc: 'Alternate port' },
  { label: 'loopback :1234', url: 'ws://127.0.0.1:1234', desc: 'Frida default' },
];

export const WsLiveModePanel = memo(function WsLiveModePanel() {
  const {
    wsState,
    wsEndpoint,
    setWsEndpoint,
    connectLive,
    disconnectLive,
    connected,
  } = useInspector();

  const [editEndpoint, setEditEndpoint] = useState(wsEndpoint);

  const statusCfg = STATUS_CONFIG[wsState.status];
  const isConnecting = wsState.status === 'connecting';

  const handleConnect = () => {
    const ep = editEndpoint.trim();
    setWsEndpoint(ep);
    connectLive(ep);
  };

  const formatLatency = (ms: number) =>
    ms === 0 ? '---' : ms < 1 ? '<1ms' : `${ms}ms`;

  const formatTime = (ts: number) =>
    ts === 0 ? 'never' : new Date(ts).toLocaleTimeString();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Connection status card */}
      <View style={[styles.statusCard, { borderColor: statusCfg.color + '30' }]}>
        <View style={[styles.statusIndicator, { backgroundColor: statusCfg.color + '15', borderColor: statusCfg.color + '40' }]}>
          <MaterialIcons name={statusCfg.icon} size={22} color={statusCfg.color} />
        </View>
        <View style={styles.statusInfo}>
          <Text style={[styles.statusLabel, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          <Text style={styles.statusEndpoint} numberOfLines={1}>{wsState.endpoint}</Text>
        </View>
        {connected ? (
          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        ) : null}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <MaterialIcons name="speed" size={12} color={Colors.textBlue} />
          <Text style={styles.statValue}>{formatLatency(wsState.latencyMs)}</Text>
          <Text style={styles.statLabel}>LATENCY</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <MaterialIcons name="swap-horiz" size={12} color={Colors.textGreen} />
          <Text style={styles.statValue}>{wsState.packetCount}</Text>
          <Text style={styles.statLabel}>PACKETS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <MaterialIcons name="schedule" size={12} color={Colors.textMuted} />
          <Text style={styles.statValue}>{formatTime(wsState.lastPingTime)}</Text>
          <Text style={styles.statLabel}>LAST PING</Text>
        </View>
      </View>

      {/* Endpoint editor */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AGENT ENDPOINT (ON-DEVICE LOOPBACK)</Text>
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
          editable={!connected && !isConnecting}
        />
        {/* On-device presets */}
        <View style={styles.presets}>
          {PRESETS.map(p => (
            <Pressable
              key={p.url}
              style={[styles.presetBtn, editEndpoint === p.url && styles.presetBtnActive]}
              onPress={() => setEditEndpoint(p.url)}
              disabled={connected}
            >
              <Text style={[styles.presetBtnText, editEndpoint === p.url && styles.presetBtnTextActive]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Connect button */}
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [
            styles.connectBtn,
            connected && styles.connectBtnDisconnect,
            isConnecting && styles.connectBtnConnecting,
            pressed && { opacity: 0.75 },
          ]}
          onPress={connected ? disconnectLive : handleConnect}
          disabled={isConnecting}
        >
          <MaterialIcons
            name={connected ? 'wifi-off' : isConnecting ? 'sync' : 'wifi'}
            size={14}
            color={Colors.bg}
          />
          <Text style={styles.connectBtnText}>
            {connected ? 'DISCONNECT' : isConnecting ? 'CONNECTING...' : 'CONNECT'}
          </Text>
        </Pressable>
      </View>

      {/* On-device architecture explanation */}
      <View style={styles.archCard}>
        <View style={styles.archHeader}>
          <MaterialIcons name="phone-android" size={13} color={Colors.textGreen} />
          <Text style={styles.archTitle}>ON-DEVICE ARCHITECTURE (NO ROOT · NO PC)</Text>
        </View>
        <Text style={styles.archDesc}>
          The C++ agent module is compiled into the target game as a shared library. Once the game starts, the agent opens a loopback WebSocket server. This inspector connects to it on the same device — no PC, no USB, no root required.
        </Text>
        <View style={styles.archFlow}>
          {[
            { icon: 'sports-esports' as const, label: 'Game Process', sub: 'libgame.so' },
            { icon: 'arrow-forward' as const,  label: '', sub: '' },
            { icon: 'code' as const,           label: 'Agent Module', sub: 'libinspect.so' },
            { icon: 'arrow-forward' as const,  label: '', sub: '' },
            { icon: 'wifi' as const,           label: '127.0.0.1:9999', sub: 'WS loopback' },
            { icon: 'arrow-forward' as const,  label: '', sub: '' },
            { icon: 'bug-report' as const,     label: 'This App', sub: 'Inspector UI' },
          ].map((node, i) => (
            node.icon === 'arrow-forward' ? (
              <MaterialIcons key={i} name="arrow-forward" size={10} color={Colors.textMuted} />
            ) : (
              <View key={i} style={styles.archNode}>
                <MaterialIcons name={node.icon} size={12} color={Colors.textBlue} />
                <Text style={styles.archNodeLabel}>{node.label}</Text>
                <Text style={styles.archNodeSub}>{node.sub}</Text>
              </View>
            )
          ))}
        </View>
      </View>

      {/* Integration steps */}
      <View style={styles.stepsCard}>
        <Text style={styles.sectionTitle}>HOW TO INTEGRATE — 3 STEPS</Text>
        {[
          {
            n: '1',
            icon: 'build' as const,
            title: 'Compile the agent into your game',
            detail: 'Add libinspect_agent.cpp to your game build.\n• Unity: place in Assets/Plugins/Android/\n• Unreal: add as GameplayModule or ThirdParty\n• Godot: add as GDExtension .so\nThe agent auto-starts a WS server on port 9999 at app launch.',
          },
          {
            n: '2',
            icon: 'sports-esports' as const,
            title: 'Launch the game',
            detail: 'Install and open the target game on this Android device. The agent initialises in the background, opens loopback WS, starts hooking methods, and emits hook_event / class_dump messages.',
          },
          {
            n: '3',
            icon: 'bug-report' as const,
            title: 'Connect this inspector',
            detail: 'Tap CONNECT above. Hook events, class dumps, and memory data stream live into all tabs. Tap the FAB to open the floating panel while the game runs in the background.',
          },
        ].map(step => (
          <View key={step.n} style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{step.n}</Text>
            </View>
            <View style={styles.stepContent}>
              <View style={styles.stepTitleRow}>
                <MaterialIcons name={step.icon} size={11} color={Colors.textBlue} />
                <Text style={styles.stepTitle}>{step.title}</Text>
              </View>
              <Text style={styles.stepDetail}>{step.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Message protocol */}
      <View style={styles.protoSection}>
        <Text style={styles.sectionTitle}>WS MESSAGE PROTOCOL</Text>
        {[
          { dir: '←', type: 'hook_event',   color: Colors.textGreen,  desc: 'Method call with params, RVA, call stack' },
          { dir: '←', type: 'class_dump',   color: Colors.textPurple, desc: 'Class metadata, fields, method signatures' },
          { dir: '←', type: 'module_info',  color: Colors.textBlue,   desc: 'Module base address and size' },
          { dir: '←', type: 'patch_result', color: Colors.textYellow, desc: 'Patch applied/reverted/failed ack' },
          { dir: '→', type: 'patch_memory', color: Colors.textYellow, desc: 'Write bytes to absolute address' },
          { dir: '→', type: 'hook_config',  color: Colors.textCyan,   desc: 'Set per-method action and capture depth' },
          { dir: '→', type: 'ping',         color: Colors.textMuted,  desc: 'Latency measurement — expects pong reply' },
        ].map((m, i) => (
          <View key={i} style={styles.protoRow}>
            <Text style={[styles.protoDir, { color: m.dir === '←' ? Colors.textGreen : Colors.textBlue }]}>
              {m.dir}
            </Text>
            <Text style={[styles.protoType, { color: m.color }]}>{m.type}</Text>
            <Text style={styles.protoDesc}>{m.desc}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    borderTopWidth: 1,
  },
  statusIndicator: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusInfo: {
    flex: 1,
    gap: 2,
  },
  statusLabel: {
    fontFamily: 'monospace',
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statusEndpoint: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryGlow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  liveText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textGreen,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 10,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  statValue: {
    fontFamily: 'monospace',
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  statLabel: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    letterSpacing: 0.5,
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
  endpointInput: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textBlue,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presets: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  presetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetBtnActive: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accent + '60',
  },
  presetBtnText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textSecondary,
  },
  presetBtnTextActive: {
    color: Colors.textBlue,
  },
  actionRow: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
  },
  connectBtnDisconnect: {
    backgroundColor: Colors.danger,
  },
  connectBtnConnecting: {
    backgroundColor: Colors.warning,
  },
  connectBtnText: {
    fontFamily: 'monospace',
    fontSize: FontSize.sm,
    color: Colors.bg,
    fontWeight: '700',
    letterSpacing: 1,
  },
  archCard: {
    margin: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.primaryGlow,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    gap: 8,
  },
  archHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  archTitle: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textGreen,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
  },
  archDesc: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  archFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    paddingTop: 4,
  },
  archNode: {
    alignItems: 'center',
    gap: 2,
    minWidth: 56,
  },
  archNodeLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: Colors.textBlue,
    fontWeight: '600',
    textAlign: 'center',
  },
  archNodeSub: {
    fontFamily: 'monospace',
    fontSize: 7,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  stepsCard: {
    margin: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accentDim,
    padding: Spacing.sm,
    gap: 10,
  },
  step: {
    flexDirection: 'row',
    gap: 10,
  },
  stepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accentDim,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  stepNumText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textBlue,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
    gap: 3,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stepTitle: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
  stepDetail: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  protoSection: {
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 5,
  },
  protoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    fontWeight: '700',
    width: 100,
  },
  protoDesc: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 14,
  },
});
