// Powered by OnSpace.AI
// Shared types for the Runtime Inspector

export type HookEventType = 'call' | 'ret' | 'ctor' | 'dtor' | 'field_read' | 'field_write' | 'exception';

// Supported game engines
export type EngineType = 'unity_il2cpp' | 'unity_mono' | 'unreal' | 'godot';

export interface RvaInfo {
  rva: string;          // e.g. "0x1A2B3C"
  absoluteAddr: string; // e.g. "0x7F1A2B3C"
  moduleName: string;   // e.g. "libil2cpp.so"
  moduleBase: string;   // base address of module
}

export interface MethodParam {
  name: string;
  type: string;
  value?: string; // runtime value if captured
}

export interface HookEvent {
  id: string;
  timestamp: number;       // unix ms
  type: HookEventType;
  methodName: string;
  className: string;
  namespace?: string;
  returnType: string;
  params: MethodParam[];
  rva: RvaInfo;
  callDepth: number;       // stack depth
  threadId?: string;
  returnValue?: string;
  callStack?: CallFrame[]; // optional call stack frames
}

export interface CallFrame {
  index: number;
  methodName: string;
  className: string;
  namespace?: string;
  rva: RvaInfo;
  returnType?: string;
  depth: number;
}

export interface FieldInfo {
  name: string;
  type: string;
  offset: string;          // hex offset in class
  rva?: RvaInfo;
  value?: string;          // captured value
  isStatic: boolean;
}

export interface MethodInfo {
  name: string;
  className: string;
  namespace?: string;
  returnType: string;
  params: MethodParam[];
  rva: RvaInfo;
  isVirtual: boolean;
  isStatic: boolean;
  isConstructor: boolean;
  isDestructor: boolean;
  hitCount: number;
  lastSeen?: number;
}

export interface ClassInfo {
  name: string;
  namespace: string;
  baseClass?: string;
  size: number;            // sizeof in bytes
  rva?: RvaInfo;
  fields: FieldInfo[];
  methods: MethodInfo[];
}

export interface ModuleInfo {
  name: string;
  base: string;
  size: string;
  path: string;
}

export interface InspectorState {
  connected: boolean;
  moduleInfo: ModuleInfo | null;
  events: HookEvent[];
  classes: Map<string, ClassInfo>;
  methods: Map<string, MethodInfo>;
  activeFilter: string;
  isPaused: boolean;
}

// WebSocket message protocol
export type WsMessageType =
  | 'hook_event'
  | 'class_dump'
  | 'module_info'
  | 'heartbeat'
  | 'clear'
  | 'error'
  | 'patch_memory'
  | 'patch_result'
  | 'hook_config'
  | 'hook_config_ack';

export interface WsMessage {
  type: WsMessageType;
  payload: unknown;
}

// ─── Memory Patch ───────────────────────────────────────────
export interface PatchEntry {
  id: string;
  address: string;
  originalBytes: string;
  patchedBytes: string;
  label: string;
  timestamp: number;
  status: 'pending' | 'applied' | 'failed' | 'reverted';
}

// ─── Hook Config ─────────────────────────────────────────────
export type HookAction = 'log' | 'breakpoint' | 'skip' | 'off';

export interface HookConfig {
  methodKey: string;       // "ClassName::MethodName"
  className: string;
  methodName: string;
  rva: string;
  action: HookAction;
  watchCondition?: string; // e.g. "damage > 100"
  captureDepth: number;    // 0-5
  enabled: boolean;
}

// ─── WS Connection State ─────────────────────────────────────
export interface WsConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  latencyMs: number;
  packetCount: number;
  lastPingTime: number;
  endpoint: string;
}

// ─── Session Dump ─────────────────────────────────────────────
export interface SessionDump {
  meta: {
    version: string;
    engine: EngineType;
    exportedAt: string;        // ISO timestamp
    sessionDuration: number;   // ms
    agentEndpoint: string;
    device?: string;
  };
  module: ModuleInfo | null;
  summary: {
    totalEvents: number;
    uniqueClasses: number;
    uniqueMethods: number;
    totalFields: number;
    appliedPatches: number;
    hookConfigs: number;
    hotMethods: Array<{ key: string; hits: number }>;
  };
  events: HookEvent[];
  classes: ClassInfo[];
  methods: MethodInfo[];
  patches: PatchEntry[];
  hookConfigs: HookConfig[];
}
