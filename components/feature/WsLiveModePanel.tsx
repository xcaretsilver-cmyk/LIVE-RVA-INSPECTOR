// Powered by OnSpace.AI
// WebSocket Live Mode Panel — real connection settings, latency, protocol info
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
            editable={!connected && !isConnecting}
          />
        </View>

        {/* Preset endpoints */}
        <View style={styles.presets}>
          <Text style={styles.presetsLabel}>PRESETS:</Text>
          {[
            { label: 'localhost', url: 'ws://127.0.0.1:9999' },
            { label: 'USB ADB',   url: 'ws://10.0.2.2:9999' },
            { label: 'LAN',       url: 'ws://192.168.1.100:9999' },
            { label: ':8080',     url: 'ws://127.0.0.1:8080' },
          ].map(p => (
            <Pressable
              key={p.label}
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

      {/* Connect / Disconnect button */}
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

      {/* Bridge setup guide */}
      <View style={styles.helpSection}>
        <View style={styles.helpHeader}>
          <MaterialIcons name="integration-instructions" size={12} color={Colors.textBlue} />
          <Text style={styles.helpTitle}>BRIDGE SETUP</Text>
        </View>
        {[
          { cmd: null,                      desc: '1. Compile libinspect_agent.so (BRIDGE_INTEGRATION.md)' },
          { cmd: null,                      desc: '2. Inject into game process via Zygisk/Frida/KernelSU' },
          { cmd: 'adb forward tcp:9999 tcp:9999', desc: '3. Forward port over USB (or use LAN IP directly)' },
          { cmd: null,                      desc: '4. Enter endpoint above and tap CONNECT' },
        ].map((item, i) => (
          <View key={i} style={styles.helpLine}>
            {item.cmd ? (
              <View style={styles.cmdBlock}>
                <Text style={styles.cmdText}>{item.cmd}</Text>
              </View>
            ) : (
              <Text style={styles.helpText}>{item.desc}</Text>
            )}
            {item.cmd ? (
              <Text style={styles.helpText}>{item.desc}</Text>
            ) : null}
          </View>
        ))}
      </View>

      {/* Message protocol quick reference */}
      <View style={styles.protoSection}>
        <Text style={styles.sectionTitle}>MESSAGE PROTOCOL</Text>
        {[
          { dir: '←', type: 'hook_event',   color: Colors.textGreen,  desc: 'Method call w/ params + RVA' },
          { dir: '←', type: 'class_dump',   color: Colors.textPurple, desc: 'Class metadata' },
          { dir: '←', type: 'module_info',  color: Colors.textBlue,   desc: 'Module base + size' },
          { dir: '←', type: 'patch_result', color: Colors.textYellow, desc: 'Patch applied/failed ack' },
          { dir: '→', type: 'patch_memory', color: Colors.textYellow, desc: 'Write bytes to address' },
          { dir: '→', type: 'hook_config',  color: Colors.textCyan,   desc: 'Set hook action/depth' },
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
  endpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  endpointInput: {
    flex: 1,
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
  presetsLabel: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
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
  helpSection: {
    margin: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.accentDim,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
    gap: 8,
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  helpTitle: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textBlue,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  helpLine: {
    gap: 3,
  },
  helpText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  cmdBlock: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderLeftWidth: 2,
    borderLeftColor: Colors.primary,
  },
  cmdText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textGreen,
    letterSpacing: 0.3,
  },
  protoSection: {
    marginHorizontal: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
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
  },
});
