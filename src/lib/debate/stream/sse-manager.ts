/**
 * SSE事件管理器
 * 负责SSE事件格式化、发送和管理
 */

import {
  SSEEvent,
  DebateStreamEventType,
  SSEConnectionState,
  SSEConnectionStats,
} from './types';

/**
 * SSE事件管理器类
 */
export class SSEEventManager {
  private sessionId: string;
  private state: SSEConnectionState;
  private stats: SSEConnectionStats;
  private eventCounter: number = 0;
  private heartbeatTimer?: NodeJS.Timeout;
  private connectionTimer?: NodeJS.Timeout;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.state = SSEConnectionState.CONNECTING;
    this.stats = {
      sessionId,
      startTime: new Date(),
      lastActivityTime: new Date(),
      totalEventsSent: 0,
      totalBytesSent: 0,
      lastEventId: '',
      reconnectAttempts: 0,
    };
  }

  /**
   * 格式化SSE事件为标准格式
   */
  formatEvent(event: SSEEvent): string {
    const lines: string[] = [];

    if (event.event) {
      lines.push(`event: ${event.event}`);
    }

    if (event.id) {
      lines.push(`id: ${event.id}`);
    }

    if (event.retry) {
      lines.push(`retry: ${event.retry}`);
    }

    // 处理多行数据
    const dataLines = event.data.split('\n');
    dataLines.forEach(line => {
      lines.push(`data: ${line}`);
    });

    // SSE事件以两个换行符结束
    lines.push('', '');

    const formatted = lines.join('\n');
    return formatted;
  }

  /**
   * 生成事件ID
   */
  generateEventId(): string {
    this.eventCounter++;
    const eventId = `${this.sessionId}-${this.eventCounter}`;
    this.stats.lastEventId = eventId;
    return eventId;
  }

  /**
   * 创建标准SSE事件
   */
  createEvent(
    type: DebateStreamEventType,
    data: unknown,
    id?: string,
    retry?: number
  ): SSEEvent {
    return {
      event: type,
      data: typeof data === 'string' ? data : JSON.stringify(data),
      id: id || this.generateEventId(),
      retry,
    };
  }

  /**
   * 更新统计信息并重置连接超时
   */
  updateStats(eventSize: number): void {
    this.stats.totalEventsSent++;
    this.stats.totalBytesSent += eventSize;
    this.stats.lastActivityTime = new Date();
    // 重置连接超时定时器
    if (this.connectionTimer) {
      // 注意：这里不重置定时器，由调用者决定何时重置
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): SSEConnectionStats {
    return { ...this.stats };
  }

  /**
   * 获取连接状态
   */
  getState(): SSEConnectionState {
    return this.state;
  }

  /**
   * 设置连接状态
   */
  setState(state: SSEConnectionState): void {
    this.state = state;
  }

  /**
   * 启动心跳定时器
   */
  startHeartbeat(interval: number, sendPing: () => void): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      sendPing();
    }, interval);
  }

  /**
   * 停止心跳定时器
   */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * 启动连接超时定时器
   */
  startConnectionTimeout(timeout: number, onTimeout: () => void): void {
    this.stopConnectionTimeout();
    this.connectionTimer = setTimeout(() => {
      onTimeout();
    }, timeout);
  }

  /**
   * 停止连接超时定时器
   */
  stopConnectionTimeout(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = undefined;
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.stopHeartbeat();
    this.stopConnectionTimeout();
    // 不改变状态，让调用者决定
  }

  /**
   * 增加重连尝试次数
   */
  incrementReconnectAttempts(): void {
    this.stats.reconnectAttempts++;
  }

  /**
   * 重置重连尝试次数
   */
  resetReconnectAttempts(): void {
    this.stats.reconnectAttempts = 0;
  }
}
