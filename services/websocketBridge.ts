// Powered by OnSpace.AI
// Enhanced WebSocket bridge with connection state, latency tracking, and live mode

import { WsMessage, WsMessageType, WsConnectionState } from '@/types/inspector';
import { WS_URL, PING_INTERVAL_MS, RECONNECT_BASE_DELAY_MS, RECONNECT_MAX_DELAY_MS } from '@/constants/config';

type MessageHandler = (msg: WsMessage) => void;
type ConnectionStateHandler = (state: WsConnectionState) => void;

class WebSocketBridge {
  private ws: WebSocket | null = null;
  private messageHandlers: MessageHandler[] = [];
  private stateHandlers: ConnectionStateHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private shouldReconnect = false;
  private reconnectDelay = RECONNECT_BASE_DELAY_MS;
  private _endpoint: string = WS_URL;
  private _packetCount = 0;
  private _latencyMs = 0;
  private _lastPingTime = 0;
  private _pingsSent = 0;
  private _connectionStatus: WsConnectionState['status'] = 'disconnected';

  private emitState() {
    const state: WsConnectionState = {
      status: this._connectionStatus,
      latencyMs: this._latencyMs,
      packetCount: this._packetCount,
      lastPingTime: this._lastPingTime,
      endpoint: this._endpoint,
    };
    this.stateHandlers.forEach(h => h(state));
  }

  connect(endpoint?: string) {
    if (endpoint) this._endpoint = endpoint;
    this.shouldReconnect = true;
    this._connectionStatus = 'connecting';
    this.emitState();
    this._connect();
  }

  private _connect() {
    try {
      this.ws = new WebSocket(this._endpoint);
      this._connectionStatus = 'connecting';

      this.ws.onopen = () => {
        console.log('[Bridge] Connected:', this._endpoint);
        this._connectionStatus = 'connected';
        this.reconnectDelay = 2000;
        this._packetCount = 0;
        this.emitState();
        this._startPing();
      };

      this.ws.onmessage = (evt) => {
        this._packetCount++;
        try {
          const msg: WsMessage = JSON.parse(evt.data);
          // Handle pong to measure latency
          if ((msg as any).type === 'pong') {
            this._latencyMs = Date.now() - this._lastPingTime;
          } else {
            this.messageHandlers.forEach(h => h(msg));
          }
          this.emitState();
        } catch (e) {
          console.warn('[Bridge] Parse error:', evt.data);
        }
      };

      this.ws.onerror = () => {
        this._connectionStatus = 'error';
        this.emitState();
      };

      this.ws.onclose = () => {
        this._stopPing();
        if (this._connectionStatus !== 'error') {
          this._connectionStatus = 'disconnected';
        }
        this.emitState();
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => {
            this._connectionStatus = 'connecting';
            this.emitState();
            this._connect();
          }, this.reconnectDelay);
          this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, RECONNECT_MAX_DELAY_MS);
        }
      };
    } catch (e) {
      console.warn('[Bridge] Could not create WebSocket:', e);
      this._connectionStatus = 'error';
      this.emitState();
    }
  }

  private _startPing() {
    this._pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this._lastPingTime = Date.now();
        this._pingsSent++;
        this.ws.send(JSON.stringify({ type: 'ping', payload: { ts: this._lastPingTime } }));
      }
    }, PING_INTERVAL_MS);
  }

  private _stopPing() {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    this._stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connectionStatus = 'disconnected';
    this.emitState();
  }

  send(type: WsMessageType, payload: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  onConnectionStateChange(handler: ConnectionStateHandler) {
    this.stateHandlers.push(handler);
    return () => {
      this.stateHandlers = this.stateHandlers.filter(h => h !== handler);
    };
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getState(): WsConnectionState {
    return {
      status: this._connectionStatus,
      latencyMs: this._latencyMs,
      packetCount: this._packetCount,
      lastPingTime: this._lastPingTime,
      endpoint: this._endpoint,
    };
  }
}

export const wsBridge = new WebSocketBridge();
