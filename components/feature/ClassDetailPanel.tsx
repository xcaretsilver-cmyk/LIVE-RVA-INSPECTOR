// Powered by OnSpace.AI
import React, { memo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme';
import { ClassInfo } from '@/types/inspector';
import { Badge } from '@/components/ui/Badge';
import { AddressChip } from '@/components/ui/AddressChip';
import { MaterialIcons } from '@expo/vector-icons';

interface ClassDetailPanelProps {
  classInfo: ClassInfo;
  onClose: () => void;
}

type SubTab = 'fields' | 'methods';

export const ClassDetailPanel = memo(function ClassDetailPanel({
  classInfo,
  onClose,
}: ClassDetailPanelProps) {
  const [subTab, setSubTab] = useState<SubTab>('methods');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="class" size={14} color={Colors.textPurple} />
          <Text style={styles.namespace}>{classInfo.namespace}</Text>
          <Text style={styles.separator}>/</Text>
          <Text style={styles.className}>{classInfo.name}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
          <MaterialIcons name="close" size={14} color={Colors.textMuted} />
        </Pressable>
      </View>

      {/* Meta */}
      <View style={styles.meta}>
        {classInfo.rva ? (
          <AddressChip rva={classInfo.rva} />
        ) : null}
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>base:</Text>
          <Text style={styles.metaValue}>{classInfo.baseClass ?? 'Object'}</Text>
          <Text style={styles.metaLabel}>size:</Text>
          <Text style={styles.metaValue}>{classInfo.size} bytes</Text>
        </View>
      </View>

      {/* Sub tabs */}
      <View style={styles.subTabs}>
        {(['methods', 'fields'] as SubTab[]).map(tab => (
          <Pressable
            key={tab}
            onPress={() => setSubTab(tab)}
            style={[styles.subTab, subTab === tab && styles.subTabActive]}
          >
            <Text style={[styles.subTabText, subTab === tab && styles.subTabTextActive]}>
              {tab.toUpperCase()} ({tab === 'methods' ? classInfo.methods.length : classInfo.fields.length})
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {subTab === 'methods' ? (
          classInfo.methods.map((m, i) => (
            <View key={i} style={styles.item}>
              <View style={styles.itemHeader}>
                <Badge
                  label={m.isVirtual ? 'virtual' : m.isStatic ? 'static' : 'instance'}
                  variant={m.isVirtual ? 'yellow' : m.isStatic ? 'cyan' : 'blue'}
                />
                {m.hitCount > 0 && (
                  <Badge label={`x${m.hitCount}`} variant="green" />
                )}
              </View>
              <Text style={styles.methodSig}>
                <Text style={styles.retType}>{m.returnType} </Text>
                <Text style={styles.methodName}>{m.name}</Text>
                <Text style={styles.sigText}>(</Text>
                {m.params.map((p, pi) => (
                  <Text key={pi} style={styles.sigText}>
                    {pi > 0 ? ', ' : ''}
                    <Text style={styles.paramType}>{p.type} </Text>
                    <Text style={styles.paramName}>{p.name}</Text>
                  </Text>
                ))}
                <Text style={styles.sigText}>)</Text>
              </Text>
              <AddressChip rva={m.rva} />
            </View>
          ))
        ) : (
          classInfo.fields.map((f, i) => (
            <View key={i} style={styles.item}>
              <View style={styles.itemHeader}>
                <Text style={styles.fieldOffset}>{f.offset}</Text>
                <Badge label={f.isStatic ? 'static' : 'instance'} variant={f.isStatic ? 'cyan' : 'muted'} />
              </View>
              <Text style={styles.fieldSig}>
                <Text style={styles.paramType}>{f.type} </Text>
                <Text style={styles.methodName}>{f.name}</Text>
                {f.value ? (
                  <Text style={styles.fieldValue}>{' = '}{f.value}</Text>
                ) : null}
              </Text>
            </View>
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
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  namespace: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  separator: {
    color: Colors.textMuted,
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
  },
  className: {
    fontFamily: 'monospace',
    fontSize: FontSize.sm,
    color: Colors.textPurple,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  meta: {
    padding: Spacing.sm,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaLabel: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  metaValue: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  subTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  subTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  subTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  subTabText: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  subTabTextActive: {
    color: Colors.textGreen,
  },
  scroll: {
    flex: 1,
  },
  item: {
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  methodSig: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    flexWrap: 'wrap',
  },
  retType: {
    color: Colors.textCyan,
  },
  methodName: {
    color: Colors.textGreen,
    fontWeight: '600',
  },
  sigText: {
    color: Colors.textSecondary,
  },
  paramType: {
    color: Colors.textBlue,
  },
  paramName: {
    color: Colors.textPrimary,
  },
  fieldOffset: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textYellow,
    backgroundColor: Colors.warningDim,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: Radius.sm,
  },
  fieldSig: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
  },
  fieldValue: {
    color: Colors.textCyan,
  },
});
