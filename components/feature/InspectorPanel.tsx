// Powered by OnSpace.AI
// Full Inspector Panel — 8 tabs: LOG · CLS · MTH · FLD · MEM · CFG · WS · EXP
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme';
import { InspectorTab } from '@/contexts/InspectorContext';
import { useInspector } from '@/hooks/useInspector';
import { HookEventRow } from '@/components/feature/HookEventRow';
import { ClassDetailPanel } from '@/components/feature/ClassDetailPanel';
import { MemoryPatchEditor } from '@/components/feature/MemoryPatchEditor';
import { HookConfigPanel } from '@/components/feature/HookConfigPanel';
import { WsLiveModePanel } from '@/components/feature/WsLiveModePanel';
import { ExportPanel } from '@/components/feature/ExportPanel';
import { CallStackVisualizer } from '@/components/feature/CallStackVisualizer';
import { AddressChip } from '@/components/ui/AddressChip';
import { Badge } from '@/components/ui/Badge';
import { MaterialIcons } from '@expo/vector-icons';
import { HookEvent, ClassInfo, MethodInfo } from '@/types/inspector';

const TABS: { key: InspectorTab; icon: keyof typeof MaterialIcons.glyphMap; label: string }[] = [
  { key: 'log',     icon: 'stream',       label: 'LOG' },
  { key: 'classes', icon: 'class',        label: 'CLS' },
  { key: 'methods', icon: 'functions',    label: 'MTH' },
  { key: 'fields',  icon: 'data-object',  label: 'FLD' },
  { key: 'patch',   icon: 'edit',         label: 'MEM' },
  { key: 'config',  icon: 'settings',     label: 'CFG' },
  { key: 'ws',      icon: 'wifi',         label: 'WS' },
  { key: 'export',  icon: 'share',        label: 'EXP' },
];

function TabBar() {
  const { activeTab, setActiveTab, events, patches, hookConfigs } = useInspector();

  const getBadge = (key: InspectorTab): number | null => {
    if (key === 'log') return events.length > 0 ? Math.min(events.length, 999) : null;
    if (key === 'patch') return patches.filter(p => p.status === 'applied').length || null;
    if (key === 'config') return hookConfigs.filter(c => c.action === 'breakpoint').length || null;
    return null;
  };

  return (
    <View style={styles.tabBar}>
      {TABS.map(tab => {
        const active = activeTab === tab.key;
        const badge = getBadge(tab.key);
        return (
          <Pressable
            key={tab.key}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <View style={styles.tabIconWrap}>
              <MaterialIcons
                name={tab.icon}
                size={11}
                color={active ? Colors.textGreen : Colors.textMuted}
              />
              {badge ? (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{badge > 99 ? '99+' : badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function InspectorPanel() {
  const {
    connected,
    wsState,
    moduleInfo,
    events,
    isPaused,
    togglePause,
    clearEvents,
    classes,
    methods,
    filterText,
    setFilterText,
    activeTab,
    setActiveTab,
    selectedClass,
    setSelectedClass,
    selectedEvent,
    setSelectedEvent,
  } = useInspector();

  const [classFilter, setClassFilter] = useState('');
  const [showHitOnly, setShowHitOnly] = useState(false);

  const filteredEvents = filterText
    ? events.filter(e =>
        e.methodName.toLowerCase().includes(filterText.toLowerCase()) ||
        e.className.toLowerCase().includes(filterText.toLowerCase()) ||
        e.rva.rva.toLowerCase().includes(filterText.toLowerCase())
      )
    : events;

  const filteredClasses = (() => {
    let list = classes;
    const q = (classFilter || filterText).toLowerCase();
    if (q) list = list.filter(c =>
      c.name.toLowerCase().includes(q) || c.namespace.toLowerCase().includes(q)
    );
    if (showHitOnly) list = list.filter(c =>
      c.methods.some(m => {
        const found = methods.find(mm => mm.name === m.name && mm.className === c.name);
        return found && found.hitCount > 0;
      })
    );
    return list;
  })();

  const filteredMethods = filterText
    ? methods.filter(m =>
        m.name.toLowerCase().includes(filterText.toLowerCase()) ||
        m.className.toLowerCase().includes(filterText.toLowerCase())
      )
    : methods;

  const filteredFields = (() => {
    const all = classes.flatMap(c => c.fields.map(f => ({ ...f, className: c.name })));
    const q = filterText.toLowerCase();
    return q ? all.filter(f =>
      f.name.toLowerCase().includes(q) || f.type.toLowerCase().includes(q)
    ) : all;
  })();

  const renderEvent = useCallback(({ item }: { item: HookEvent }) => (
    <HookEventRow event={item} onPress={() => setSelectedEvent(item)} />
  ), [setSelectedEvent]);

  const renderClass = useCallback(({ item }: { item: ClassInfo }) => {
    const hitMethods = item.methods.filter(m => {
      const live = methods.find(mm => mm.name === m.name && mm.className === item.name);
      return live && live.hitCount > 0;
    });
    return (
      <Pressable
        style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]}
        onPress={() => setSelectedClass(item)}
      >
        <View style={styles.listItemRow}>
          <MaterialIcons name="class" size={12} color={Colors.textPurple} />
          <Text style={styles.listItemTitle}>{item.name}</Text>
          <Text style={styles.listItemSub}>{item.size}b</Text>
          {hitMethods.length > 0 ? <Badge label={`${hitMethods.length} active`} variant="green" /> : null}
        </View>
        <Text style={styles.listItemNs}>{item.namespace}</Text>
        <View style={styles.listItemRow}>
          <Text style={styles.listItemSub}>{item.methods.length} methods · {item.fields.length} fields</Text>
          {item.rva ? <AddressChip rva={item.rva} compact /> : null}
        </View>
      </Pressable>
    );
  }, [setSelectedClass, methods]);

  const renderMethod = useCallback(({ item }: { item: MethodInfo }) => (
    <View style={styles.listItem}>
      <View style={styles.listItemRow}>
        <MaterialIcons name="functions" size={12} color={Colors.textGreen} />
        <Text style={styles.listItemGreen}>{item.name}</Text>
        {item.hitCount > 0 ? <Badge label={`x${item.hitCount}`} variant="green" /> : null}
        {item.isVirtual ? <Badge label="virt" variant="yellow" /> : null}
        {item.isStatic ? <Badge label="static" variant="cyan" /> : null}
      </View>
      <Text style={styles.listItemNs}>{item.namespace}.{item.className}</Text>
      <AddressChip rva={item.rva} compact />
    </View>
  ), []);

  const renderField = useCallback(({ item }: any) => (
    <View style={styles.listItem}>
      <View style={styles.listItemRow}>
        <MaterialIcons name="data-object" size={12} color={Colors.textCyan} />
        <Text style={styles.listItemCyan}>{item.name}</Text>
        <Text style={styles.listItemSub}>{item.type}</Text>
        {item.value ? <Text style={styles.listItemValue}>= {item.value}</Text> : null}
      </View>
      <Text style={styles.listItemNs}>{item.offset} · {item.className}</Text>
    </View>
  ), []);

  const renderClassTabHeader = () => (
    <View style={styles.classSearchHeader}>
      <View style={styles.searchRow}>
        <MaterialIcons name="search" size={12} color={Colors.textMuted} />
        <TextInput
          style={styles.classSearchInput}
          value={classFilter}
          onChangeText={setClassFilter}
          placeholder="class or namespace..."
          placeholderTextColor={Colors.textMuted}
        />
        {classFilter ? (
          <Pressable onPress={() => setClassFilter('')} hitSlop={8}>
            <MaterialIcons name="close" size={12} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.filterChips}>
        <Pressable
          style={[styles.filterChip, showHitOnly && styles.filterChipActive]}
          onPress={() => setShowHitOnly(v => !v)}
        >
          <MaterialIcons name="bolt" size={10} color={showHitOnly ? Colors.textGreen : Colors.textMuted} />
          <Text style={[styles.filterChipText, showHitOnly && styles.filterChipTextActive]}>Hit only</Text>
        </Pressable>
        <Text style={styles.filterCount}>{filteredClasses.length} of {classes.length}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Module Info Bar */}
      {moduleInfo ? (
        <View style={styles.moduleBar}>
          <MaterialIcons name="memory" size={11} color={Colors.textBlue} />
          <Text style={styles.moduleName} numberOfLines={1}>{moduleInfo.name}</Text>
          <Text style={styles.moduleBase} numberOfLines={1}>@{moduleInfo.base}</Text>
          <View style={[styles.statusDot, {
            backgroundColor:
              wsState.status === 'connected' ? Colors.primary :
              wsState.status === 'connecting' ? Colors.warning : Colors.danger
          }]} />
          <Text style={[styles.statusText, {
            color: wsState.status === 'connected' ? Colors.textGreen :
              wsState.status === 'connecting' ? Colors.textYellow : Colors.textRed
          }]}>
            {wsState.status.toUpperCase()}
          </Text>
          {wsState.latencyMs > 0 ? (
            <Text style={styles.latencyText}>{wsState.latencyMs}ms</Text>
          ) : null}
        </View>
      ) : null}

      {/* Toolbar — log/methods/fields tabs */}
      {['log', 'methods', 'fields'].includes(activeTab) ? (
        <View style={styles.toolbar}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={12} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={filterText}
              onChangeText={setFilterText}
              placeholder="filter..."
              placeholderTextColor={Colors.textMuted}
            />
            {filterText ? (
              <Pressable onPress={() => setFilterText('')} hitSlop={8}>
                <MaterialIcons name="close" size={12} color={Colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={togglePause} style={styles.toolBtn} hitSlop={8}>
            <MaterialIcons
              name={isPaused ? 'play-arrow' : 'pause'}
              size={15}
              color={isPaused ? Colors.textGreen : Colors.textYellow}
            />
          </Pressable>
          <Pressable onPress={clearEvents} style={styles.toolBtn} hitSlop={8}>
            <MaterialIcons name="delete-sweep" size={15} color={Colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('ws')}
            style={[styles.toolBtn, styles.connPill]}
          >
            <View style={[styles.connDot, {
              backgroundColor: connected ? Colors.primary : Colors.danger
            }]} />
            <Text style={[styles.connPillText, { color: connected ? Colors.textGreen : Colors.textRed }]}>
              {connected ? 'LIVE' : 'OFF'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Tab Bar */}
      <TabBar />

      {/* Content */}
      {selectedClass && activeTab === 'classes' ? (
        <ClassDetailPanel
          classInfo={selectedClass}
          onClose={() => setSelectedClass(null)}
        />
      ) : (
        <View style={styles.listContainer}>
          {activeTab === 'log' && (
            <FlatList
              data={filteredEvents}
              renderItem={renderEvent}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              initialNumToRender={20}
              maxToRenderPerBatch={10}
              windowSize={10}
              ListEmptyComponent={
                <View style={styles.empty}>
                  {connected ? (
                    <>
                      <MaterialIcons name="stream" size={28} color={Colors.textMuted} />
                      <Text style={styles.emptyText}>Waiting for hook events...</Text>
                      <Text style={styles.emptyHint}>Trigger actions in the target game</Text>
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="wifi-off" size={28} color={Colors.danger} />
                      <Text style={[styles.emptyText, { color: Colors.textRed }]}>Not connected</Text>
                      <Pressable style={styles.goWsBtn} onPress={() => setActiveTab('ws')}>
                        <MaterialIcons name="wifi" size={12} color={Colors.textBlue} />
                        <Text style={styles.goWsBtnText}>Open WS settings</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              }
            />
          )}
          {activeTab === 'classes' && (
            <FlatList
              data={filteredClasses}
              renderItem={renderClass}
              keyExtractor={item => `${item.namespace}.${item.name}`}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={renderClassTabHeader}
              stickyHeaderIndices={[0]}
              ListEmptyComponent={
                <View style={styles.empty}>
                  {connected ? (
                    <Text style={styles.emptyText}>No classes received yet</Text>
                  ) : (
                    <Text style={styles.emptyText}>Connect to receive class dumps</Text>
                  )}
                </View>
              }
            />
          )}
          {activeTab === 'methods' && (
            <FlatList
              data={filteredMethods}
              renderItem={renderMethod}
              keyExtractor={(item, i) => `${item.className}.${item.name}.${i}`}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No methods received yet</Text>
                </View>
              }
            />
          )}
          {activeTab === 'fields' && (
            <FlatList
              data={filteredFields}
              renderItem={renderField}
              keyExtractor={(item, i) => `${item.className}.${item.name}.${i}`}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No fields received yet</Text>
                </View>
              }
            />
          )}
          {activeTab === 'patch' && <MemoryPatchEditor />}
          {activeTab === 'config' && (
            <View style={{ flex: 1 }}>
              <HookConfigPanel />
            </View>
          )}
          {activeTab === 'ws' && (
            <View style={{ flex: 1 }}>
              <WsLiveModePanel />
            </View>
          )}
          {activeTab === 'export' && (
            <View style={{ flex: 1 }}>
              <ExportPanel />
            </View>
          )}
        </View>
      )}

      {/* Call Stack Visualizer modal */}
      <CallStackVisualizer
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  moduleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  moduleName: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textBlue,
    fontWeight: '600',
    maxWidth: 90,
  },
  moduleBase: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    flex: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  latencyText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textCyan,
    marginLeft: 2,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    gap: 5,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: Platform.OS === 'ios' ? 5 : 3,
    gap: 4,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    padding: 0,
  },
  toolBtn: {
    padding: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceHighlight,
    minWidth: 26,
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
  },
  connPill: {
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 6,
    minWidth: 40,
  },
  connDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  connPillText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: 5,
    alignItems: 'center',
    gap: 2,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabIconWrap: {
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: Colors.danger,
    borderRadius: Radius.full,
    minWidth: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  tabBadgeText: {
    fontFamily: 'monospace',
    fontSize: 7,
    color: '#fff',
    fontWeight: '700',
  },
  tabText: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  tabTextActive: {
    color: Colors.textGreen,
  },
  listContainer: {
    flex: 1,
  },
  listItem: {
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 3,
    backgroundColor: Colors.surface,
  },
  listItemPressed: {
    backgroundColor: Colors.surfaceHighlight,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  listItemTitle: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  listItemGreen: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textGreen,
    fontWeight: '600',
  },
  listItemCyan: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textCyan,
    fontWeight: '600',
  },
  listItemSub: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
  },
  listItemNs: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
  },
  listItemValue: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textCyan,
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
  },
  goWsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.accentDim,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
  },
  goWsBtnText: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textBlue,
  },
  classSearchHeader: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    padding: Spacing.sm,
    gap: 6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 5 : 3,
  },
  classSearchInput: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    padding: 0,
  },
  filterChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryGlow,
    borderColor: Colors.primary + '50',
  },
  filterChipText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
  },
  filterChipTextActive: {
    color: Colors.textGreen,
  },
  filterCount: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
});
