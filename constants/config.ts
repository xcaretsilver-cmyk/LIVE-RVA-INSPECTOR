// Inspector Tool Configuration

// Default WebSocket endpoint for the C++ relay agent
export const WS_HOST = '127.0.0.1';
export const WS_PORT = 9999;
export const WS_URL = `ws://${WS_HOST}:${WS_PORT}`;

// Max hook events kept in the live log before oldest are dropped
export const MAX_LOG_ENTRIES = 2000;

// Ping interval in ms (latency measurement)
export const PING_INTERVAL_MS = 3000;

// Reconnect delay settings (ms)
export const RECONNECT_BASE_DELAY_MS = 2000;
export const RECONNECT_MAX_DELAY_MS = 15000;

// Default module name
export const DEFAULT_MODULE = 'libil2cpp.so';
