// Powered by OnSpace.AI
// Session Export Service — serializes inspector session to JSON and shares via Android Share API
import { Share, Platform } from 'react-native';
import {
  SessionDump, EngineType,
  HookEvent, ClassInfo, MethodInfo, ModuleInfo,
  PatchEntry, HookConfig, WsConnectionState,
} from '@/types/inspector';

const INSPECTOR_VERSION = '2.1.0';

export interface ExportOptions {
  includeEvents: boolean;
  includeClasses: boolean;
  includeMethods: boolean;
  includePatches: boolean;
  includeHookConfigs: boolean;
  maxEvents: number; // cap to avoid huge files
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeEvents: true,
  includeClasses: true,
  includeMethods: true,
  includePatches: true,
  includeHookConfigs: true,
  maxEvents: 500,
};

export function buildSessionDump(params: {
  engine: EngineType;
  wsState: WsConnectionState;
  sessionStartTime: number;
  moduleInfo: ModuleInfo | null;
  events: HookEvent[];
  classes: ClassInfo[];
  methods: MethodInfo[];
  patches: PatchEntry[];
  hookConfigs: HookConfig[];
  options?: Partial<ExportOptions>;
}): SessionDump {
  const opts = { ...DEFAULT_EXPORT_OPTIONS, ...params.options };
  const now = Date.now();

  const eventsToExport = opts.includeEvents
    ? params.events.slice(0, opts.maxEvents)
    : [];

  const hotMethods = [...params.methods]
    .filter(m => m.hitCount > 0)
    .sort((a, b) => b.hitCount - a.hitCount)
    .slice(0, 20)
    .map(m => ({ key: `${m.className}::${m.name}`, hits: m.hitCount }));

  const dump: SessionDump = {
    meta: {
      version: INSPECTOR_VERSION,
      engine: params.engine,
      exportedAt: new Date(now).toISOString(),
      sessionDuration: now - params.sessionStartTime,
      agentEndpoint: params.wsState.endpoint,
    },
    module: params.moduleInfo,
    summary: {
      totalEvents: params.events.length,
      uniqueClasses: params.classes.length,
      uniqueMethods: params.methods.length,
      totalFields: params.classes.reduce((s, c) => s + c.fields.length, 0),
      appliedPatches: params.patches.filter(p => p.status === 'applied').length,
      hookConfigs: params.hookConfigs.length,
      hotMethods,
    },
    events: eventsToExport,
    classes: opts.includeClasses ? params.classes : [],
    methods: opts.includeMethods ? params.methods : [],
    patches: opts.includePatches ? params.patches : [],
    hookConfigs: opts.includeHookConfigs ? params.hookConfigs : [],
  };

  return dump;
}

export async function shareSessionDump(dump: SessionDump): Promise<boolean> {
  try {
    const json = JSON.stringify(dump, null, 2);
    const filename = `rva_session_${dump.meta.engine}_${Date.now()}.json`;

    const result = await Share.share({
      title: `RVA Inspector Session — ${dump.meta.engine}`,
      message: json,
    });

    return result.action !== Share.dismissedAction;
  } catch (err) {
    console.warn('[Export] Share failed:', err);
    return false;
  }
}

export function getExportStats(dump: SessionDump): string {
  const lines = [
    `Engine: ${dump.meta.engine}`,
    `Module: ${dump.module?.name ?? 'unknown'}`,
    `Events: ${dump.summary.totalEvents} (exported: ${dump.events.length})`,
    `Classes: ${dump.summary.uniqueClasses}`,
    `Methods: ${dump.summary.uniqueMethods}`,
    `Fields: ${dump.summary.totalFields}`,
    `Patches applied: ${dump.summary.appliedPatches}`,
    `Session duration: ${Math.round(dump.meta.sessionDuration / 1000)}s`,
  ];
  return lines.join('\n');
}
