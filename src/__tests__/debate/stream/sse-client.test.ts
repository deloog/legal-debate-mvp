/**
 * SSE客户端单元测试
 * 测试SSE连接、重连机制、事件处理等功能
 */

import { SSEClient, SSEClientConfig } from '@/lib/debate/stream/sse-client';
import { SSEConnectionState } from '@/lib/debate/stream/types';

// Mock EventSource
class MockEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readyState = 0;
  url = '';
  onopen: ((this: MockEventSource, ev: Event) => unknown) | null = null;
  onmessage: ((this: MockEventSource, ev: MessageEvent) => unknown) | null =
    null;
  onerror: ((this: MockEventSource, ev: Event) => unknown) | null = null;

  withCredentials = false;
  listeners: Map<string, ((ev: MessageEvent) => unknown)[]> = new Map();

  constructor(url: string) {
    this.url = url;
    // 不自动触发onopen，由测试手动触发
  }

  // 用于测试：手动触发连接打开
  triggerOpen(): void {
    this.readyState = 1; // OPEN
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  close(): void {
    this.readyState = 2; // CLOSED
  }

  addEventListener(
    type: string,
    listener: (ev: MessageEvent) => unknown
  ): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)?.push(listener);
  }

  // 用于测试：发送模拟事件
  emitEvent(type: string, data: unknown, lastEventId?: string): void {
    const event = new MessageEvent(type, {
      data: JSON.stringify(data),
      lastEventId,
    });
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }

  // 用于测试：模拟连接错误
  emitError(error?: unknown): void {
    if (this.onerror) {
      if (error instanceof Event) {
        this.onerror(error);
      } else {
        this.onerror(new Event('error'));
      }
    }
  }
}

// 覆盖全局EventSource
// @ts-expect-error - 测试环境中替换全局EventSource
(global as typeof globalThis & { EventSource?: unknown }).EventSource =
  MockEventSource;

describe('SSEClient', () => {
  let client: SSEClient;
  const config: SSEClientConfig = {
    url: 'http://localhost:3000/api/stream',
    debateId: 'debate-123',
    roundId: 'round-456',
    enableLogging: false,
    maxRetryAttempts: 3,
  };

  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (client) {
      client.destroy();
    }
    jest.useRealTimers();
  });

  describe('连接管理', () => {
    it('应该成功连接到SSE端点', () => {
      client = new SSEClient(config);
      client.connect();

      // 手动触发连接打开
      const eventSource = client['eventSource'] as unknown as MockEventSource;
      eventSource.triggerOpen();

      expect(client.getState()).toBe(SSEConnectionState.CONNECTED);
    });

    it('应该避免重复连接', () => {
      client = new SSEClient(config);
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      eventSource.triggerOpen();

      const stateBefore = client.getState();
      client.connect();
      const stateAfter = client.getState();

      expect(stateBefore).toBe(SSEConnectionState.CONNECTED);
      expect(stateAfter).toBe(SSEConnectionState.CONNECTED);
    });

    it('应该正确断开连接', () => {
      client = new SSEClient(config);
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      eventSource.triggerOpen();

      client.disconnect();

      expect(client.getState()).toBe(SSEConnectionState.DISCONNECTED);
    });
  });

  describe('事件处理', () => {
    it('应该接收连接事件', () => {
      const onConnectedMock = jest.fn();
      client = new SSEClient({
        ...config,
        onConnected: onConnectedMock,
      });
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      eventSource.triggerOpen();
      eventSource.emitEvent('connected', {
        debateId: 'debate-123',
        roundId: 'round-456',
        timestamp: new Date().toISOString(),
        sessionId: 'session-001',
      });

      expect(onConnectedMock).toHaveBeenCalled();
      expect(onConnectedMock.mock.calls[0][0].debateId).toBe('debate-123');
    });

    it('应该接收轮次开始事件', () => {
      const onRoundStartMock = jest.fn();
      client = new SSEClient({
        ...config,
        onRoundStart: onRoundStartMock,
      });
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      eventSource.triggerOpen();

      eventSource.emitEvent('round-start', {
        debateId: 'debate-123',
        roundId: 'round-456',
        roundNumber: 1,
        timestamp: new Date().toISOString(),
      });

      expect(onRoundStartMock).toHaveBeenCalled();
    });

    it('应该接收论点事件', () => {
      const onArgumentMock = jest.fn();
      client = new SSEClient({
        ...config,
        onArgument: onArgumentMock,
      });
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      eventSource.triggerOpen();

      eventSource.emitEvent('argument', {
        argumentId: 'arg-1',
        roundId: 'round-456',
        side: 'PLAINTIFF',
        content: '测试论点',
        type: 'MAIN_POINT',
        timestamp: new Date().toISOString(),
      });

      expect(onArgumentMock).toHaveBeenCalled();
      expect(onArgumentMock.mock.calls[0][0].content).toBe('测试论点');
    });

    it('应该接收进度事件', () => {
      const onProgressMock = jest.fn();
      client = new SSEClient({
        ...config,
        onProgress: onProgressMock,
      });
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      eventSource.triggerOpen();

      eventSource.emitEvent('progress', {
        debateId: 'debate-123',
        roundId: 'round-456',
        progress: 50,
        currentStep: '生成论点',
        totalSteps: 4,
        timestamp: new Date().toISOString(),
      });

      expect(onProgressMock).toHaveBeenCalled();
      expect(onProgressMock.mock.calls[0][0].progress).toBe(50);
    });

    it('应该接收完成事件', () => {
      const onCompletedMock = jest.fn();
      client = new SSEClient({
        ...config,
        onCompleted: onCompletedMock,
      });
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      eventSource.triggerOpen();

      eventSource.emitEvent('completed', {
        debateId: 'debate-123',
        roundId: 'round-456',
        totalArguments: 4,
        plaintiffArguments: 2,
        defendantArguments: 2,
        generationTime: 5000,
        timestamp: new Date().toISOString(),
      });

      expect(onCompletedMock).toHaveBeenCalled();
    });

    it('应该接收错误事件', () => {
      const onErrorMock = jest.fn();
      client = new SSEClient({
        ...config,
        onError: onErrorMock,
      });
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      eventSource.triggerOpen();

      eventSource.emitEvent('error', {
        debateId: 'debate-123',
        roundId: 'round-456',
        code: 'AI_ERROR',
        message: 'AI服务不可用',
        timestamp: new Date().toISOString(),
      });

      expect(onErrorMock).toHaveBeenCalled();
    });

    it('应该接收心跳事件', () => {
      const onPingMock = jest.fn();
      client = new SSEClient({
        ...config,
        onPing: onPingMock,
      });
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      eventSource.triggerOpen();

      eventSource.emitEvent('ping', {
        timestamp: new Date().toISOString(),
        serverTime: new Date().toISOString(),
      });

      expect(onPingMock).toHaveBeenCalled();
    });

    it('应该接收断开连接事件', () => {
      const onDisconnectedMock = jest.fn();
      client = new SSEClient({
        ...config,
        onDisconnected: onDisconnectedMock,
      });
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      eventSource.triggerOpen();

      eventSource.emitEvent('disconnected', {
        reason: '正常关闭',
        code: 1000,
        timestamp: new Date().toISOString(),
      });

      expect(onDisconnectedMock).toHaveBeenCalled();
    });
  });

  describe('事件监听器管理', () => {
    it('应该能够注册事件处理器', () => {
      const handler = jest.fn();
      client = new SSEClient(config);
      client.connect();

      client.on('argument', handler);

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      jest.advanceTimersByTime(100);

      eventSource.emitEvent('argument', {
        argumentId: 'arg-1',
        roundId: 'round-456',
        side: 'PLAINTIFF',
        content: '测试论点',
        type: 'MAIN_POINT',
        timestamp: new Date().toISOString(),
      });

      expect(handler).toHaveBeenCalled();
    });

    it('应该能够移除事件处理器', () => {
      const handler = jest.fn();
      client = new SSEClient(config);
      client.connect();

      client.on('argument', handler);
      client.off('argument', handler);

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      jest.advanceTimersByTime(100);

      eventSource.emitEvent('argument', {
        argumentId: 'arg-1',
        roundId: 'round-456',
        side: 'PLAINTIFF',
        content: '测试论点',
        type: 'MAIN_POINT',
        timestamp: new Date().toISOString(),
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('重连机制', () => {
    it('应该在连接失败后自动重连', () => {
      const onReconnectingMock = jest.fn();
      client = new SSEClient({
        ...config,
        onReconnecting: onReconnectingMock,
      });
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      jest.advanceTimersByTime(100);

      // 模拟连接错误
      eventSource.emitError();
      expect(client.getState()).toBe(SSEConnectionState.RECONNECTING);

      // 执行重连
      jest.advanceTimersByTime(2000);
      expect(onReconnectingMock).toHaveBeenCalledWith(1, expect.anything());
    });

    it('应该使用指数退避算法计算重连延迟', () => {
      const delays: number[] = [];
      const onReconnectingMock = jest.fn((attempt: number, delay: number) => {
        delays.push(delay);
      });

      client = new SSEClient({
        ...config,
        onReconnecting: onReconnectingMock,
        maxRetryAttempts: 4,
      });
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      jest.advanceTimersByTime(100);

      // 模拟多次连接失败
      for (let i = 0; i < 3; i++) {
        eventSource.emitError();
        jest.runAllTimers();
      }

      // 延迟应该是递增的（指数退避）
      expect(delays[1]).toBeGreaterThan(delays[0]);
    });

    it('应该在达到最大重连次数后放弃重连', () => {
      const onReconnectFailedMock = jest.fn();
      client = new SSEClient({
        ...config,
        maxRetryAttempts: 2,
        onReconnectFailed: onReconnectFailedMock,
      });
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      jest.runAllTimers();

      // 模拟达到最大重连次数（需要触发maxRetryAttempts + 1次错误才能放弃）
      // 因为每次错误都会增加计数，当计数 >= maxRetryAttempts时才放弃
      eventSource.emitError();
      jest.runAllTimers();
      eventSource.emitError();
      jest.runAllTimers();
      eventSource.emitError();
      jest.runAllTimers();

      expect(onReconnectFailedMock).toHaveBeenCalled();
      expect(client.getState()).toBe(SSEConnectionState.DISCONNECTED);
    });

    it('应该能够在连接成功后重置重连计数', () => {
      client = new SSEClient(config);
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      eventSource.triggerOpen();

      // 保存初始重连计数
      const initialAttempts = client['reconnectAttempts'];
      expect(initialAttempts).toBe(0);

      // 模拟连接错误
      eventSource.emitError();
      const stateAfterError = client.getState();
      expect(stateAfterError).toBe(SSEConnectionState.RECONNECTING);

      // 运行所有定时器以完成重连
      jest.runAllTimers();
      // 手动触发新连接的打开
      const newEventSource = client['eventSource'] as unknown as MockEventSource;
      newEventSource.triggerOpen();

      // 重连成功后重连计数应该重置
      expect(client['reconnectAttempts']).toBe(0);
      expect(client.getState()).toBe(SSEConnectionState.CONNECTED);
    });

    it('应该支持手动重连', () => {
      client = new SSEClient(config);
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      eventSource.triggerOpen();

      client.disconnect();
      expect(client.getState()).toBe(SSEConnectionState.DISCONNECTED);

      client.reconnect();
      const newEventSource = client['eventSource'] as unknown as MockEventSource;
      newEventSource.triggerOpen();

      expect(client.getState()).toBe(SSEConnectionState.CONNECTED);
    });
  });

  describe('Last-Event-ID支持', () => {
    it('应该记录Last-Event-ID', () => {
      client = new SSEClient(config);
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      eventSource.triggerOpen();

      eventSource.emitEvent(
        'connected',
        {
          debateId: 'debate-123',
          roundId: 'round-456',
          timestamp: new Date().toISOString(),
          sessionId: 'session-001',
        },
        'event-123'
      );

      expect(client['lastEventId']).toBe('event-123');
    });

    it('应该在重连时使用Last-Event-ID', () => {
      client = new SSEClient(config);
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      eventSource.triggerOpen();

      eventSource.emitEvent(
        'connected',
        {
          debateId: 'debate-123',
          roundId: 'round-456',
          timestamp: new Date().toISOString(),
          sessionId: 'session-001',
        },
        'event-123'
      );

      const lastEventIdBefore = client['lastEventId'];
      expect(lastEventIdBefore).toBe('event-123');

      // 模拟断线
      eventSource.emitError();
      jest.advanceTimersByTime(2000);

      // Last-Event-ID应该被保留
      expect(client['lastEventId']).toBe(lastEventIdBefore);
    });
  });

  describe('禁用自动重连', () => {
    it('应该在禁用自动重连时不尝试重连', () => {
      const onReconnectingMock = jest.fn();
      client = new SSEClient({
        ...config,
        enableReconnection: false,
        onReconnecting: onReconnectingMock,
      });
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      eventSource.triggerOpen();

      // 模拟连接错误
      eventSource.emitError();
      jest.advanceTimersByTime(5000);

      expect(onReconnectingMock).not.toHaveBeenCalled();
      expect(client.getState()).toBe(SSEConnectionState.ERROR);
    });
  });

  describe('资源清理', () => {
    it('应该清理所有资源', () => {
      const handler = jest.fn();
      client = new SSEClient(config);
      client.connect();

      const eventSource = client['eventSource'] as unknown as MockEventSource;
      eventSource.triggerOpen();

      client.on('argument', handler);

      client.destroy();

      expect(client.getState()).toBe(SSEConnectionState.DISCONNECTED);
      expect(client['eventHandlers'].size).toBe(0);
    });
  });
});
