// Powered by OnSpace.AI
// Call Stack Visualizer — full-screen modal for a selected hook event
import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme';
import { HookEvent, CallFrame } from '@/types/inspector';
import { AddressChip } from '@/components/ui/AddressChip';
import { Badge } from '@/components/ui/Badge';
import { MaterialIcons } from '@expo/vector-icons';

interface CallStackVisualizerProps {
  event: HookEvent | null;
  onClose: () => void;
}

const DEPTH_COLORS = [
  Colors.textGreen,
  Colors.textBlue,
  Colors.textYellow,
  Colors.textPurple,
  Colors.textCyan,
  Colors.textRed,
];

function FrameRow({ frame, isRoot }: { frame: CallFrame; isRoot: boolean }) {
  const depthColor = DEPTH_COLORS[Math.min(frame.depth, DEPTH_COLORS.length - 1)];
  const indent = frame.depth * 14;

  return (
    <View style={[styles.frameRow, isRoot && styles.frameRowRoot]}>
      {/* Depth connector lines */}
      {Array.from({ length: frame.depth }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.depthLine,
            {
              left: 12 + i * 14,
              backgroundColor: DEPTH_COLORS[Math.min(i, DEPTH_COLORS.length - 1)] + '40',
            },
          ]}
        />
      ))}

      <View style={[styles.frameContent, { marginLeft: indent }]}>
        {/* Frame index */}
        <View style={[styles.frameIndex, { borderColor: depthColor + '60', backgroundColor: depthColor + '12' }]}>
          <Text style={[styles.frameIndexText, { color: depthColor }]}>#{frame.index}</Text>
        </View>

        <View style={styles.frameInfo}>
          <View style={styles.frameTopRow}>
            {isRoot ? <Badge label="HOOKED" variant="green" /> : null}
            <Text style={styles.frameNamespace}>{frame.namespace}</Text>
            <Text style={styles.frameSep}>::</Text>
            <Text style={[styles.frameClass, { color: depthColor }]}>{frame.className}</Text>
            <Text style={styles.frameSep}>::</Text>
            <Text style={styles.frameMethod}>{frame.methodName}</Text>
          </View>
          <AddressChip rva={frame.rva} compact />
        </View>
      </View>
    </View>
  );
}

export const CallStackVisualizer = memo(function CallStackVisualizer({
  event,
  onClose,
}: CallStackVisualizerProps) {
  if (!event) return null;

  const frames = event.callStack ?? [
    {
      index: 0,
      methodName: event.methodName,
      className: event.className,
      namespace: event.namespace ?? '',
      rva: event.rva,
      depth: 0,
    },
  ];

  return (
    <Modal
      visible={true}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialIcons name="account-tree" size={14} color={Colors.textGreen} />
              <Text style={styles.headerTitle}>CALL STACK</Text>
              <Text style={styles.headerSub}>{frames.length} frames</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <MaterialIcons name="close" size={16} color={Colors.textMuted} />
            </Pressable>
          </View>

          {/* Trigger event summary */}
          <View style={styles.eventSummary}>
            <MaterialIcons name="bolt" size={12} color={Colors.textYellow} />
            <Text style={styles.eventSummaryText}>
              <Text style={styles.eventClass}>{event.className}</Text>
              <Text style={styles.eventSep}>::</Text>
              <Text style={styles.eventMethod}>{event.methodName}</Text>
              <Text style={styles.eventMeta}>  {event.returnType}  tid:{event.threadId}</Text>
            </Text>
          </View>

          {/* Thread & time meta */}
          <View style={styles.metaBar}>
            <View style={styles.metaItem}>
              <MaterialIcons name="schedule" size={10} color={Colors.textMuted} />
              <Text style={styles.metaText}>{new Date(event.timestamp).toISOString().slice(11, 23)}</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialIcons name="memory" size={10} color={Colors.textMuted} />
              <Text style={styles.metaText}>{event.rva.moduleName}</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialIcons name="layers" size={10} color={Colors.textMuted} />
              <Text style={styles.metaText}>depth:{event.callDepth}</Text>
            </View>
          </View>

          {/* Stack frames */}
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {frames.map((frame, i) => (
              <FrameRow key={i} frame={frame} isRoot={i === 0} />
            ))}

            {/* Bottom frame — main thread entry */}
            <View style={styles.mainFrame}>
              <MaterialIcons name="call-received" size={10} color={Colors.textMuted} />
              <Text style={styles.mainFrameText}>[ main thread / game loop ]</Text>
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Params captured */}
          {event.params.length > 0 ? (
            <View style={styles.paramsPanel}>
              <Text style={styles.paramsTitle}>CAPTURED PARAMS</Text>
              {event.params.map((p, i) => (
                <View key={i} style={styles.paramRow}>
                  <Text style={styles.paramType}>{p.type}</Text>
                  <Text style={styles.paramName}>{p.name}</Text>
                  {p.value ? <Text style={styles.paramValue}>= {p.value}</Text> : null}
                </View>
              ))}
              {event.returnValue ? (
                <View style={styles.paramRow}>
                  <Text style={styles.paramType}>return</Text>
                  <Text style={[styles.paramValue, { color: Colors.textCyan }]}>{event.returnValue}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    paddingVertical: 12,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontFamily: 'monospace',
    fontSize: FontSize.sm,
    color: Colors.textGreen,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerSub: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
  },
  eventSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.warningDim,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  eventSummaryText: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    flex: 1,
    flexWrap: 'wrap',
  },
  eventClass: {
    color: Colors.textPurple,
    fontWeight: '600',
  },
  eventSep: {
    color: Colors.textMuted,
  },
  eventMethod: {
    color: Colors.textGreen,
    fontWeight: '700',
  },
  eventMeta: {
    color: Colors.textMuted,
  },
  metaBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    gap: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  frameRow: {
    position: 'relative',
    paddingVertical: 8,
    paddingRight: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    minHeight: 52,
  },
  frameRowRoot: {
    backgroundColor: Colors.primaryGlow,
  },
  depthLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },
  frameContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 12,
  },
  frameIndex: {
    width: 28,
    height: 20,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  frameIndexText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    fontWeight: '700',
  },
  frameInfo: {
    flex: 1,
    gap: 4,
  },
  frameTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexWrap: 'wrap',
  },
  frameNamespace: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
  },
  frameSep: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
  },
  frameClass: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  frameMethod: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textGreen,
    fontWeight: '700',
  },
  mainFrame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.sm,
    paddingLeft: 20,
  },
  mainFrameText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  paramsPanel: {
    padding: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 4,
  },
  paramsTitle: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paramType: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textBlue,
  },
  paramName: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textPrimary,
  },
  paramValue: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textYellow,
  },
});
