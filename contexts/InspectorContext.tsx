// Powered by OnSpace.AI
// InspectorContext — LIVE mode only. Android on-device loopback only.
import React, { createContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import {
  HookEvent, ClassInfo, MethodInfo, ModuleInfo,
  PatchEntry, HookConfig, HookAction, WsConnectionState, EngineType, SessionDump,
} from '@/types/inspector';
import { wsBridge } from '@/services/websocketBridge';
import {
  buildSessionDump, shareSessionDump,
  ExportOptions, DEFAULT_EXPORT_OPTIONS,
} from '@/services/sessionExport';
import { MAX_LOG_ENTRIES } from '@/constants/config';

export type InspectorTab = 'log' | 'classes' | 'methods' | 'fields' | 'patch' | 'config' | 'ws' | 'export';

export interface InspectorContextType {
  // Connection
  connected: boolean;
  wsState: WsConnectionState;
  wsEndpoint: string;
  setWsEndpoint: (url: string) => void;
  connectLive: (endpoint?: string) => void;
  disconnectLive: () => void;

  // Engine
  engineType: EngineType;
  setEngineType: (e: EngineType) => void;

  // Module
  moduleInfo: ModuleInfo | null;

  // Live events
  events: HookEvent[];
  isPaused: boolean;
  togglePause: () => void;
  clearEvents: () => void;

  // Parsed data
  classes: ClassInfo[];
  methods: MethodInfo[];

  // Filters
  filterText: string;
  setFilterText: (v: string) => void;
  activeTab: InspectorTab;
  setActiveTab: (t: InspectorTab) => void;

  // Selected detail
  selectedClass: ClassInfo | null;
  setSelectedClass: (c: ClassInfo | null) => void;
  selectedMethod: MethodInfo | null;
  setSelectedMethod: (m: MethodInfo | null) => void;
  selectedEvent: HookEvent | null;
  setSelectedEvent: (e: HookEvent | null) => void;

  // Memory patches
  patches: PatchEntry[];
  addPatch: (patch: Omit<PatchEntry, 'id' | 'timestamp' | 'status'>) => void;
  removePatch: (id: string) => void;
  revertPatch: (id: string) => void;

  // Hook config
  hookConfigs: HookConfig[];
  setHookConfig: (key: string, action: HookAction, captureDepth?: number, watchCondition?: string) => void;
  toggleHook: (key: string) => void;
  sendHookConfigToDevice: (key: string) => void;

  // Export
  exportSession: (options?: Partial<ExportOptions>) => Promise<boolean>;
  lastDump: SessionDump | null;
  sessionStartTime: number;
}

export const InspectorContext = createContext<InspectorContextType | undefined>(undefined);

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [wsEndpoint, setWsEndpoint] = useState('ws://127.0.0.1:9999');
  const [wsState, setWsState] = useState<WsConnectionState>({
    status: 'disconnected',
    latencyMs: 0,
    packetCount: 0,
    lastPingTime: 0,
    endpoint: 'ws://127.0.0.1:9999',
  });

  const [engineType, setEngineType] = useState<EngineType>('unity_il2cpp');
  const [moduleInfo, setModuleInfo] = useState<ModuleInfo | null>(null);
  const [events, setEvents] = useState<HookEvent[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [methods, setMethods] = useState<MethodInfo[]>([]);
  const [filterText, setFilterText] = useState('');
  const [activeTab, setActiveTab] = useState<InspectorTab>('ws');
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<MethodInfo | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<HookEvent | null>(null);
  const [patches, setPatches] = useState<PatchEntry[]>([]);
  const [hookConfigs, setHookConfigs] = useState<HookConfig[]>([]);
  const [lastDump, setLastDump] = useState<SessionDump | null>(null);
  const [sessionStartTime] = useState<number>(Date.now());

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  // Keep refs for export (avoid stale closures)
  const eventsRef = useRef(events);
  const classesRef = useRef(classes);
  const methodsRef = useRef(methods);
  const patchesRef = useRef(patches);
  const hookConfigsRef = useRef(hookConfigs);
  const moduleInfoRef = useRef(moduleInfo);
  const wsStateRef = useRef(wsState);
  const engineTypeRef = useRef(engineType);

  eventsRef.current = events;
  classesRef.current = classes;
  methodsRef.current = methods;
  patchesRef.current = patches;
  hookConfigsRef.current = hookConfigs;
  moduleInfoRef.current = moduleInfo;
  wsStateRef.current = wsState;
  engineTypeRef.current = engineType;

  const pushEvent = useCallback((event: HookEvent) => {
    if (isPausedRef.current) return;
    setEvents(prev => {
      const next = [event, ...prev];
      return next.length > MAX_LOG_ENTRIES ? next.slice(0, MAX_LOG_ENTRIES) : next;
    });
    setMethods(prev =>
      prev.map(m =>
        m.name === event.methodName && m.className === event.className
          ? { ...m, hitCount: m.hitCount + 1, lastSeen: event.timestamp }
          : m
      )
    );
  }, []);

  // WebSocket bridge listeners
  useEffect(() => {
    const unsubState = wsBridge.onConnectionStateChange(state => {
      setWsState(state);
      setConnected(state.status === 'connected');
    });

    const unsubMsg = wsBridge.onMessage(msg => {
      switch (msg.type) {
        case 'hook_event': {
          pushEvent(msg.payload as HookEvent);
          break;
        }
        case 'module_info': {
          const info = msg.payload as ModuleInfo;
          setModuleInfo(info);
          break;
        }
        case 'class_dump': {
          const cls = msg.payload as ClassInfo;
          setClasses(prev => {
            const idx = prev.findIndex(c => c.name === cls.name && c.namespace === cls.namespace);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = cls;
              return next;
            }
            return [...prev, cls];
          });
          setMethods(prev => {
            const filtered = prev.filter(m => m.className !== cls.name);
            return [...filtered, ...cls.methods];
          });
          setHookConfigs(prev => {
            const existingKeys = new Set(prev.map(c => c.methodKey));
            const newCfgs: HookConfig[] = cls.methods
              .filter(m => !existingKeys.has(`${m.className}::${m.name}`))
              .map(m => ({
                methodKey: `${m.className}::${m.name}`,
                className: m.className,
                methodName: m.name,
                rva: m.rva.rva,
                action: 'log' as HookAction,
                captureDepth: 2,
                enabled: true,
              }));
            return [...prev, ...newCfgs];
          });
          break;
        }
        case 'patch_result': {
          const { id, status } = msg.payload as { id: string; status: PatchEntry['status'] };
          setPatches(prev => prev.map(p => p.id === id ? { ...p, status } : p));
          break;
        }
        case 'hook_config_ack': {
          break;
        }
      }
    });

    return () => {
      unsubState();
      unsubMsg();
    };
  }, [pushEvent]);

  useEffect(() => () => wsBridge.disconnect(), []);

  const connectLive = useCallback((endpoint?: string) => {
    const ep = endpoint ?? wsEndpoint;
    setWsEndpoint(ep);
    wsBridge.connect(ep);
  }, [wsEndpoint]);

  const disconnectLive = useCallback(() => {
    wsBridge.disconnect();
    setConnected(false);
  }, []);

  const togglePause = useCallback(() => setIsPaused(v => !v), []);
  const clearEvents = useCallback(() => setEvents([]), []);

  // ─── Memory Patches ──────────────────────────────────────────
  const addPatch = useCallback((patch: Omit<PatchEntry, 'id' | 'timestamp' | 'status'>) => {
    const entry: PatchEntry = {
      ...patch,
      id: `patch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      status: 'pending',
    };
    setPatches(prev => [entry, ...prev]);
    if (wsBridge.isConnected()) {
      wsBridge.send('patch_memory', {
        id: entry.id,
        address: entry.address,
        bytes: entry.patchedBytes,
        label: entry.label,
      });
    } else {
      setTimeout(() => {
        setPatches(prev => prev.map(p =>
          p.id === entry.id ? { ...p, status: 'failed' } : p
        ));
      }, 300);
    }
  }, []);

  const removePatch = useCallback((id: string) => {
    setPatches(prev => prev.filter(p => p.id !== id));
  }, []);

  const revertPatch = useCallback((id: string) => {
    const patch = patchesRef.current.find(p => p.id === id);
    if (!patch) return;
    setPatches(prev => prev.map(p => p.id === id ? { ...p, status: 'reverted' } : p));
    if (wsBridge.isConnected()) {
      wsBridge.send('patch_memory', {
        id: `revert_${id}`,
        address: patch.address,
        bytes: patch.originalBytes,
        label: `revert:${patch.label}`,
      });
    }
  }, []);

  // ─── Hook Config ─────────────────────────────────────────────
  const setHookConfig = useCallback((
    key: string,
    action: HookAction,
    captureDepth: number = 2,
    watchCondition?: string,
  ) => {
    setHookConfigs(prev => prev.map(c =>
      c.methodKey === key ? { ...c, action, captureDepth, watchCondition } : c
    ));
  }, []);

  const toggleHook = useCallback((key: string) => {
    setHookConfigs(prev => prev.map(c =>
      c.methodKey === key ? { ...c, enabled: !c.enabled } : c
    ));
  }, []);

  const sendHookConfigToDevice = useCallback((key: string) => {
    const cfg = hookConfigsRef.current.find(c => c.methodKey === key);
    if (!cfg) return;
    if (wsBridge.isConnected()) {
      wsBridge.send('hook_config', cfg);
    }
  }, []);

  // ─── Export ──────────────────────────────────────────────────
  const exportSession = useCallback(async (options?: Partial<ExportOptions>): Promise<boolean> => {
    const dump = buildSessionDump({
      engine: engineTypeRef.current,
      wsState: wsStateRef.current,
      sessionStartTime,
      moduleInfo: moduleInfoRef.current,
      events: eventsRef.current,
      classes: classesRef.current,
      methods: methodsRef.current,
      patches: patchesRef.current,
      hookConfigs: hookConfigsRef.current,
      options: { ...DEFAULT_EXPORT_OPTIONS, ...options },
    });
    setLastDump(dump);
    return shareSessionDump(dump);
  }, [sessionStartTime]);

  return (
    <InspectorContext.Provider
      value={{
        connected,
        wsState,
        wsEndpoint,
        setWsEndpoint,
        connectLive,
        disconnectLive,
        engineType,
        setEngineType,
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
        selectedMethod,
        setSelectedMethod,
        selectedEvent,
        setSelectedEvent,
        patches,
        addPatch,
        removePatch,
        revertPatch,
        hookConfigs,
        setHookConfig,
        toggleHook,
        sendHookConfigToDevice,
        exportSession,
        lastDump,
        sessionStartTime,
      }}
    >
      {children}
    </InspectorContext.Provider>
  );
}
