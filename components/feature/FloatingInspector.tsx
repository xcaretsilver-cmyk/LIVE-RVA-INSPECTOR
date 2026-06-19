// Powered by OnSpace.AI
// Floating overlay inspector — draggable FAB + resizable panel
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
} from 'react-native';
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme';
import { useInspector } from '@/hooks/useInspector';
import { InspectorPanel } from '@/components/feature/InspectorPanel';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PANEL_WIDTH = 350;
const PANEL_HEIGHT = 540;
const FAB_SIZE = 52;

export function FloatingInspector() {
  const { connected, events, isPaused, wsState } = useInspector();
  const insets = useSafeAreaInsets();
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMinimized, setPanelMinimized] = useState(false);

  const { width: screenW, height: screenH } = Dimensions.get('window');

  // FAB drag position
  const fabPos = useRef(new Animated.ValueXY({
    x: screenW - FAB_SIZE - 16,
    y: screenH * 0.55,
  })).current;
  const fabPosCache = useRef({ x: screenW - FAB_SIZE - 16, y: screenH * 0.55 });

  const fabPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        fabPos.setOffset({ x: fabPosCache.current.x, y: fabPosCache.current.y });
        fabPos.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: fabPos.x, dy: fabPos.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, g) => {
        fabPos.flattenOffset();
        const newX = Math.max(0, Math.min(screenW - FAB_SIZE, fabPosCache.current.x + g.dx));
        const newY = Math.max(insets.top, Math.min(screenH - FAB_SIZE - insets.bottom, fabPosCache.current.y + g.dy));
        fabPosCache.current = { x: newX, y: newY };
        fabPos.setValue({ x: newX, y: newY });
      },
    })
  ).current;

  // Panel drag position
  const panelPos = useRef(new Animated.ValueXY({
    x: Math.max(0, screenW - PANEL_WIDTH - 8),
    y: 80,
  })).current;
  const panelPosCache = useRef({
    x: Math.max(0, screenW - PANEL_WIDTH - 8),
    y: 80,
  });

  const panelPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        panelPos.setOffset({ x: panelPosCache.current.x, y: panelPosCache.current.y });
        panelPos.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: panelPos.x, dy: panelPos.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, g) => {
        panelPos.flattenOffset();
        const newX = Math.max(0, Math.min(screenW - PANEL_WIDTH, panelPosCache.current.x + g.dx));
        const newY = Math.max(insets.top, Math.min(screenH - 120, panelPosCache.current.y + g.dy));
        panelPosCache.current = { x: newX, y: newY };
        panelPos.setValue({ x: newX, y: newY });
      },
    })
  ).current;

  const togglePanel = useCallback(() => {
    setPanelOpen(v => !v);
    setPanelMinimized(false);
  }, []);

  const liveCount = events.length;

  const statusColor =
    wsState.status === 'connected' ? Colors.primary :
    wsState.status === 'connecting' ? Colors.warning :
    wsState.status === 'error' ? Colors.danger :
    Colors.textMuted;

  return (
    <>
      {/* Floating Inspector Panel */}
      {panelOpen ? (
        <Animated.View
          style={[
            styles.panel,
            {
              left: panelPos.x,
              top: panelPos.y,
              height: panelMinimized ? 38 : PANEL_HEIGHT,
            },
          ]}
        >
          {/* Panel drag handle */}
          <View style={styles.panelHeader} {...panelPanResponder.panHandlers}>
            <View style={styles.panelHeaderLeft}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={styles.panelTitle}>RVA INSPECTOR</Text>
              {liveCount > 0 ? (
                <Text style={styles.panelCount}>{liveCount} events</Text>
              ) : null}
              {wsState.latencyMs > 0 && wsState.status === 'connected' ? (
                <Text style={styles.panelLatency}>{wsState.latencyMs}ms</Text>
              ) : null}
              {wsState.status === 'connecting' ? (
                <Text style={styles.connectingText}>connecting...</Text>
              ) : null}
            </View>
            <View style={styles.panelHeaderActions}>
              <Pressable
                onPress={() => setPanelMinimized(v => !v)}
                hitSlop={8}
                style={styles.headerBtn}
              >
                <MaterialIcons
                  name={panelMinimized ? 'expand-more' : 'expand-less'}
                  size={14}
                  color={Colors.textMuted}
                />
              </Pressable>
              <Pressable onPress={togglePanel} hitSlop={8} style={styles.headerBtn}>
                <MaterialIcons name="close" size={14} color={Colors.textMuted} />
              </Pressable>
            </View>
          </View>

          {/* Panel body */}
          {!panelMinimized ? (
            <View style={styles.panelBody}>
              <InspectorPanel />
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      {/* Floating Action Button */}
      <Animated.View
        style={[
          styles.fabContainer,
          { transform: [{ translateX: fabPos.x }, { translateY: fabPos.y }] },
        ]}
        {...fabPanResponder.panHandlers}
      >
        <Pressable
          onPress={togglePanel}
          style={({ pressed }) => [
            styles.fab,
            panelOpen && styles.fabActive,
            pressed && styles.fabPressed,
            { borderColor: statusColor },
          ]}
        >
          <MaterialIcons
            name="bug-report"
            size={22}
            color={panelOpen ? Colors.bg : statusColor}
          />
          {/* Paused indicator */}
          {!panelOpen && isPaused ? (
            <View style={styles.pausedIndicator}>
              <MaterialIcons name="pause" size={8} color={Colors.textYellow} />
            </View>
          ) : null}
          {/* Event count badge */}
          {!panelOpen && liveCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {liveCount > 99 ? '99+' : liveCount}
              </Text>
            </View>
          ) : null}
          {/* Connection status ring */}
          {wsState.status === 'connecting' ? (
            <View style={[styles.statusRing, { borderColor: Colors.warning }]} />
          ) : null}
        </Pressable>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    zIndex: 9999,
    elevation: 20,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  fabActive: {
    backgroundColor: Colors.primary,
  },
  fabPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.94 }],
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.danger,
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.bg,
  },
  badgeText: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#fff',
    fontWeight: '700',
  },
  pausedIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.warningDim,
    borderRadius: 6,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  statusRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: FAB_SIZE,
    borderWidth: 2,
    opacity: 0.5,
  },
  // Panel
  panel: {
    position: 'absolute',
    width: PANEL_WIDTH,
    zIndex: 9998,
    elevation: 18,
    backgroundColor: Colors.bg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    height: 36,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  panelTitle: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
    color: Colors.textGreen,
    fontWeight: '700',
    letterSpacing: 1,
  },
  panelCount: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textMuted,
  },
  panelLatency: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textCyan,
  },
  connectingText: {
    fontFamily: 'monospace',
    fontSize: FontSize.micro,
    color: Colors.textYellow,
  },
  panelHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBtn: {
    padding: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  panelBody: {
    flex: 1,
  },
});
