// Powered by OnSpace.AI
import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme';
import { HookEvent, HookEventType } from '@/types/inspector';
import { Badge } from '@/components/ui/Badge';
import { AddressChip } from '@/components/ui/AddressChip';

const EVENT_TYPE_BADGE: Record<HookEventType, { label: string; variant: 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'cyan' | 'muted' }> = {
  call: { label: 'CALL', variant: 'green' },
  ret: { label: 'RET', variant: 'blue' },
  ctor: { label: 'CTOR', variant: 'cyan' },
  dtor: { label: 'DTOR', variant: 'red' },
  field_read: { label: 'FREAD', variant: 'purple' },
  field_write: { label: 'FWRITE', variant: 'yellow' },
  exception: { label: 'EXC', variant: 'red' },
};

interface HookEventRowProps {
  event: HookEvent;
  onPress?: () => void;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}

function formatSignature(event: HookEvent): string {
  const params = event.params
    .map(p => `${p.type} ${p.name}${p.value ? `=${p.value}` : ''}`)
    .join(', ');
  return `${event.returnType} ${event.methodName}(${params})`;
}

export const HookEventRow = memo(function HookEventRow({ event, onPress }: HookEventRowProps) {
  const badge = EVENT_TYPE_BADGE[event.type] ?? EVENT_TYPE_BADGE.call;
  const depthPad = event.callDepth * 8;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {/* Left depth indicator */}
      <View style={[styles.depthBar, { marginLeft: depthPad, backgroundColor: badge.variant === 'green' ? Colors.primary : Colors.accent }]} />

      <View style={styles.content}>
        {/* Top row */}
        <View style={styles.topRow}>
          <Badge label={badge.label} variant={badge.variant} />
          <Text style={styles.className}>{event.namespace ? `${event.namespace}.` : ''}{event.className}</Text>
          <Text style={styles.separator}>::</Text>
          <Text style={styles.methodName}>{event.methodName}</Text>
        </View>

        {/* Signature */}
        <Text style={styles.signature} numberOfLines={1}>
          {formatSignature(event)}
        </Text>

        {/* Bottom row */}
        <View style={styles.bottomRow}>
          <AddressChip rva={event.rva} compact />
          {event.returnValue ? (
            <Text style={styles.returnValue}>
              {'=> '}{event.returnValue}
            </Text>
          ) : null}
          <Text style={styles.timestamp}>{formatTimestamp(event.timestamp)}</Text>
          {event.threadId ? (
            <Text style={styles.threadId}>tid:{event.threadId}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 8,
    paddingRight: Spacing.md,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceHighlight,
  },
  depthBar: {
    width: 2,
    alignSelf: 'stretch',
    marginRight: 8,
    borderRadius: 1,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  className: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textPurple,
    fontWeight: '600',
  },
  separator: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  methodName: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textGreen,
    fontWeight: '600',
  },
  signature: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textSecondary,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  returnValue: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textCyan,
  },
  timestamp: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
  threadId: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
  },
});
