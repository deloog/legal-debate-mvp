/**
 * SSE客户端
 * 负责处理SSE连接、断线检测和自动重连
 */

import type {
  ArgumentEventData,
  CompletedEventData,
  ConnectedEventData,
  DebateStreamEventType,
  DisconnectedEventData,
  ErrorEventData,
  PingEventData,
  ProgressEventData,
  RoundStartEventData,
  SSEConnectionConfig,
} from './types';
import { SSEConnectionState, LawSearchCompleteEventData } from './types';

/**
 * 事件回调类型
 */
export type SSEEventHandler = (data: unknown) => void;

/**
 * AI流式事件数据
 */
export interface AIStreamEventData {
  chunkId: number;
  content: string;
  accumulatedLength: number;
  progress: number;
  roundNumber: number;
  timestamp: string;
}

/**
 * SSE客户端配置
 */
export interface SSEClientConfig extends SSEConnectionConfig {
  url: string;
  onConnected?: (data: ConnectedEventData) => void;
  onRoundStart?: (data: RoundStartEventData) => void;
  onLawSearchComplete?: (data: LawSearchCompleteEventData) => void;
  onAIStream?: (data: AIStreamEventData) => void;
  onArgument?: (data: ArgumentEventData) => void;
  onProgress?: (data: ProgressEventData) => void;
  onCompleted?: (data: CompletedEventData) => void;
  onError?: (data: ErrorEventData) => void;
  onPing?: (data: PingEventData) => void;
  onDisconnected?: (data: DisconnectedEventData) => void;
  onReconnecting?: (attempt: number, delay: number) => void;
  onReconnectFailed?: () => void;
  enableLogging?: boolean;
}

/**
 * SSE客户端类
 */
export class SSEClient {
  private config: SSEClientConfig;
  private state: SSEConnectionState = SSEConnectionState.CONNECTING;
  private eventSource: EventSource | null = null;
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private lastEventId = '';
  private eventHandlers: Map<DebateStreamEventType, SSEEventHandler[]> =
    new Map();

  constructor(config: SSEClientConfig) {
    this.config = {
      heartbeatInterval: 30000,
      connectionTimeout: 300000,
      maxRetryAttempts: 5,
      enableReconnection: true,
      enableLogging: false,
      ...config,
    };
  }

  /**
   * 连接到SSE端点
   */
  connect(): void {
    if (this.eventSource && this.eventSource.readyState === 1) {
      // 1 = OPEN
      this.log('已经连接，无需重复连接');
      return;
    }

    this.state = SSEConnectionState.CONNECTING;
    this.log('开始连接SSE端点:', this.config.url);

    const url = this.buildUrl();

    try {
      this.eventSource = new EventSource(url);
      this.setupEventListeners();
    } catch (error) {
      this.log('连接失败:', error);
      this.state = SSEConnectionState.ERROR;
      this.handleError(error);
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.state = SSEConnectionState.DISCONNECTED;
    this.clearReconnectTimer();
    this.stopEventSource();
    this.log('断开连接');
  }

  /**
   * 手动触发重连
   */
  reconnect(): void {
    this.log('手动触发重连');
    this.stopEventSource();
    this.connect();
  }

  /**
   * 获取连接状态
   */
  getState(): SSEConnectionState {
    return this.state;
  }

  /**
   * 注册事件处理器
   */
  on(eventType: DebateStreamEventType, handler: SSEEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)?.push(handler);
  }

  /**
   * 移除事件处理器
   */
  off(eventType: DebateStreamEventType, handler: SSEEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.disconnect();
    this.eventHandlers.clear();
  }

  /**
   * 构建SSE URL（兼容相对路径与绝对路径）
   * 注意：EventSource 接受相对路径，但 new URL(relativeUrl) 在浏览器会抛 TypeError，
   * 因此改用 URLSearchParams 直接拼接 query string。
   */
  private buildUrl(): string {
    const params = new URLSearchParams({
      debateId: this.config.debateId,
      roundId: this.config.roundId,
    });
    const sep = this.config.url.includes('?') ? '&' : '?';
    return `${this.config.url}${sep}${params.toString()}`;
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.eventSource) {
      return;
    }

    this.eventSource.onopen = () => {
      this.state = SSEConnectionState.CONNECTED;
      this.reconnectAttempts = 0;
      this.clearReconnectTimer();
      this.log('SSE连接已建立');
    };

    this.eventSource.onerror = (error: Event) => {
      this.log('SSE连接错误:', error);
      this.handleConnectionError();
    };

    this.registerSpecificListeners();
    this.registerDefaultListeners();
  }

  /**
   * 注册特定事件监听器
   */
  private registerSpecificListeners(): void {
    const events: DebateStreamEventType[] = [
      'connected',
      'round-start',
      'law-search-complete',
      'ai_stream',
      'argument',
      'progress',
      'completed',
      'error',
      'ping',
      'disconnected',
    ];

    events.forEach(eventType => {
      this.eventSource?.addEventListener(eventType, (event: MessageEvent) => {
        this.handleEvent(eventType, event);
      });
    });
  }

  /**
   * 注册默认事件监听器
   */
  private registerDefaultListeners(): void {
    if (!this.eventSource) {
      return;
    }

    this.eventSource.addEventListener('connected', (event: MessageEvent) => {
      this.lastEventId = event.lastEventId || '';
      this.log('收到Last-Event-ID:', this.lastEventId);
    });
  }

  /**
   * 处理事件
   */
  private handleEvent(
    eventType: DebateStreamEventType,
    event: MessageEvent
  ): void {
    try {
      const data = JSON.parse(event.data);
      this.log(`收到事件: ${eventType}`, data);

      if (event.lastEventId) {
        this.lastEventId = event.lastEventId;
      }

      this.callConfigCallback(eventType, data);
      this.emit(eventType, data);
    } catch (error) {
      this.log('事件解析失败:', error);
    }
  }

  /**
   * 调用配置的回调函数
   */
  private callConfigCallback(
    eventType: DebateStreamEventType,
    data: unknown
  ): void {
    // Each callback is called with the parsed event data.
    // The data originates from JSON.parse and is typed by the event type at runtime.
    switch (eventType) {
      case 'connected':
        this.config.onConnected?.(data as ConnectedEventData);
        break;
      case 'round-start':
        this.config.onRoundStart?.(data as RoundStartEventData);
        break;
      case 'law-search-complete':
        this.config.onLawSearchComplete?.(data as LawSearchCompleteEventData);
        break;
      case 'ai_stream':
        this.config.onAIStream?.(data as AIStreamEventData);
        break;
      case 'argument':
        this.config.onArgument?.(data as ArgumentEventData);
        break;
      case 'progress':
        this.config.onProgress?.(data as ProgressEventData);
        break;
      case 'completed':
        this.config.onCompleted?.(data as CompletedEventData);
        break;
      case 'error':
        this.config.onError?.(data as ErrorEventData);
        break;
      case 'ping':
        this.config.onPing?.(data as PingEventData);
        break;
      case 'disconnected':
        this.config.onDisconnected?.(data as DisconnectedEventData);
        break;
    }
  }

  /**
   * 发射事件
   */
  private emit(eventType: DebateStreamEventType, data: unknown): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.log(`事件处理器错误 (${eventType}):`, error);
        }
      });
    }
  }

  /**
   * 处理连接错误
   */
  private handleConnectionError(): void {
    this.state = SSEConnectionState.ERROR;

    if (this.config.enableReconnection) {
      this.scheduleReconnect();
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: unknown): void {
    this.log('错误:', error);
    this.state = SSEConnectionState.ERROR;

    if (this.config.onError) {
      this.config.onError({
        debateId: this.config.debateId,
        roundId: this.config.roundId,
        code: 'CONNECTION_ERROR',
        message: '连接失败',
        details: error,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 调度重连
   */
  private scheduleReconnect(): void {
    this.clearReconnectTimer();

    const maxRetryAttempts = this.config.maxRetryAttempts ?? 5;
    const enableReconnection = this.config.enableReconnection ?? true;

    if (!enableReconnection) {
      this.log('自动重连已禁用');
      return;
    }

    if (this.reconnectAttempts >= maxRetryAttempts) {
      this.log('已达到最大重连次数，放弃重连');
      this.state = SSEConnectionState.DISCONNECTED;

      if (this.config.onReconnectFailed) {
        this.config.onReconnectFailed();
      }

      return;
    }

    this.reconnectAttempts++;
    this.state = SSEConnectionState.RECONNECTING;

    const delay = this.calculateReconnectDelay();
    this.log(`准备第 ${this.reconnectAttempts} 次重连，延迟 ${delay}ms`);

    if (this.config.onReconnecting) {
      this.config.onReconnecting(this.reconnectAttempts, delay);
    }

    this.reconnectTimer = setTimeout(() => {
      this.log(`开始第 ${this.reconnectAttempts} 次重连`);
      this.stopEventSource();
      this.connect();
    }, delay);
  }

  /**
   * 计算重连延迟（指数退避）
   */
  private calculateReconnectDelay(): number {
    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(
      baseDelay * Math.pow(2, this.reconnectAttempts - 1),
      maxDelay
    );
    const jitter = Math.random() * 500;
    return Math.floor(delay + jitter);
  }

  /**
   * 清除重连定时器
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * 停止EventSource
   */
  private stopEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * 日志输出
   */
  private log(...args: unknown[]): void {
    if (this.config.enableLogging) {
      console.info('[SSEClient]', ...args);
    }
  }
}
