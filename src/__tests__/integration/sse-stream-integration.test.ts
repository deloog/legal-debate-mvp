/**
 * SSE流式输出集成测试
 * 测试完整的流式辩论生成流程
 */

import { DebateStreamGenerator } from '@/lib/debate/stream/debate-stream-generator';
import {
  SSEClient,
  type SSEClientConfig,
} from '@/lib/debate/stream/sse-client';
import type { ArgumentEventData } from '@/lib/debate/stream/types';

type StreamGeneratorConfig = {
  debateId: string;
  roundId: string;
  roundNumber: number;
  totalArguments: number;
  progressInterval: number;
};

// Mock EventSource for integration tests
class MockEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readyState = 0;
  url = '';
  onopen: ((this: MockEventSource, ev: Event) => unknown) | null = null;
  onerror: ((this: MockEventSource, ev: Event) => unknown) | null = null;
  withCredentials = false;
  listeners: Map<string, ((ev: MessageEvent) => unknown)[]> = new Map();

  constructor(url: string) {
    this.url = url;
  }

  triggerOpen(): void {
    this.readyState = 1;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  close(): void {
    this.readyState = 2;
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

  emitError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// @ts-expect-error - 测试环境中替换全局EventSource
(global as typeof globalThis & { EventSource?: unknown }).EventSource =
  MockEventSource;

describe('SSE流式输出集成测试', () => {
  describe('端到端流式生成', () => {
    it('应该完整流式生成一场辩论', async () => {
      const outputChunks: string[] = [];
      const sessionId = 'integration-test-001';
      const config = {
        debateId: 'debate-integration-001',
        roundId: 'round-integration-001',
        roundNumber: 1,
        totalArguments: 4,
        progressInterval: 500,
      };

      const generator = new DebateStreamGenerator(
        sessionId,
        config as StreamGeneratorConfig,
        (data: string) => {
          outputChunks.push(data);
        }
      );

      // 执行完整的流式生成流程
      generator.sendConnected();
      generator.sendRoundStart();
      generator.startHeartbeat(1000);

      // 生成论点
      const argumentList: ArgumentEventData[] = [
        {
          argumentId: 'arg-1',
          roundId: config.roundId,
          side: 'PLAINTIFF',
          content: '原告论点1',
          type: 'MAIN_POINT',
          timestamp: new Date().toISOString(),
        },
        {
          argumentId: 'arg-2',
          roundId: config.roundId,
          side: 'DEFENDANT',
          content: '被告论点1',
          type: 'MAIN_POINT',
          timestamp: new Date().toISOString(),
        },
        {
          argumentId: 'arg-3',
          roundId: config.roundId,
          side: 'PLAINTIFF',
          content: '原告论点2',
          type: 'SUPPORTING',
          timestamp: new Date().toISOString(),
        },
        {
          argumentId: 'arg-4',
          roundId: config.roundId,
          side: 'DEFENDANT',
          content: '被告论点2',
          type: 'REBUTTAL',
          timestamp: new Date().toISOString(),
        },
      ];

      for (const arg of argumentList) {
        generator.sendArgument(arg);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      generator.sendCompleted();
      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证输出
      expect(outputChunks.length).toBeGreaterThan(0);

      // 验证事件类型
      const events = outputChunks.map(chunk => {
        const match = chunk.match(/event: ([\w-]+)/);
        return match ? match[1] : null;
      });

      expect(events).toContain('connected');
      expect(events).toContain('round-start');
      expect(events.filter(e => e === 'argument').length).toBe(4);
      expect(events).toContain('completed');

      // 验证统计信息
      const stats = generator.getStats();
      expect(stats.totalEventsSent).toBeGreaterThan(5);
      expect(stats.totalBytesSent).toBeGreaterThan(0);

      generator.cleanup();
    }, 5000);

    it('应该正确处理生成过程中的错误', async () => {
      const outputChunks: string[] = [];
      const sessionId = 'integration-test-002';
      const config = {
        debateId: 'debate-integration-002',
        roundId: 'round-integration-002',
        roundNumber: 1,
        totalArguments: 4,
        progressInterval: 500,
      };

      const generator = new DebateStreamGenerator(
        sessionId,
        config as StreamGeneratorConfig,
        (data: string) => {
          outputChunks.push(data);
        }
      );

      generator.sendConnected();
      generator.sendRoundStart();

      // 生成一个论点后发送错误
      const argument: ArgumentEventData = {
        argumentId: 'arg-1',
        roundId: config.roundId,
        side: 'PLAINTIFF',
        content: '论点1',
        type: 'MAIN_POINT',
        timestamp: new Date().toISOString(),
      };

      generator.sendArgument(argument);

      await new Promise(resolve => setTimeout(resolve, 100));

      generator.sendError('AI_ERROR', 'AI服务不可用', { code: 'API_TIMEOUT' });

      // 验证错误事件
      const errorEvent = outputChunks.find(chunk =>
        chunk.includes('event: error')
      );
      expect(errorEvent).toBeDefined();
      expect(errorEvent).toContain('AI_ERROR');
      expect(errorEvent).toContain('AI服务不可用');

      generator.cleanup();
    }, 5000);
  });

  describe('客户端-服务器集成', () => {
    it('应该能够建立并处理完整的SSE会话', async () => {
      const receivedEvents: string[] = [];
      const clientConfig: SSEClientConfig = {
        url: 'http://localhost:3000/api/stream',
        debateId: 'debate-integration-003',
        roundId: 'round-integration-003',
        enableLogging: false,
        maxRetryAttempts: 3,
        onConnected: data => {
          receivedEvents.push('connected');
          expect(data.debateId).toBe('debate-integration-003');
        },
        onRoundStart: () => {
          receivedEvents.push('round-start');
        },
        onArgument: () => {
          receivedEvents.push('argument');
        },
        onCompleted: data => {
          receivedEvents.push('completed');
          expect(data.totalArguments).toBe(2);
        },
        onPing: () => {
          receivedEvents.push('ping');
        },
      };

      const client = new SSEClient(clientConfig);
      client.connect();

      const eventSource = client['eventSource'] as MockEventSource;
      eventSource.triggerOpen();

      // 模拟服务器发送事件
      await new Promise(resolve => setTimeout(resolve, 50));

      eventSource.emitEvent('connected', {
        debateId: 'debate-integration-003',
        roundId: 'round-integration-003',
        timestamp: new Date().toISOString(),
        sessionId: 'session-003',
      });

      eventSource.emitEvent('round-start', {
        debateId: 'debate-integration-003',
        roundId: 'round-integration-003',
        roundNumber: 1,
        timestamp: new Date().toISOString(),
      });

      eventSource.emitEvent('argument', {
        argumentId: 'arg-1',
        roundId: 'round-integration-003',
        side: 'PLAINTIFF',
        content: '论点1',
        type: 'MAIN_POINT',
        timestamp: new Date().toISOString(),
      });

      eventSource.emitEvent('argument', {
        argumentId: 'arg-2',
        roundId: 'round-integration-003',
        side: 'DEFENDANT',
        content: '论点2',
        type: 'MAIN_POINT',
        timestamp: new Date().toISOString(),
      });

      eventSource.emitEvent('completed', {
        debateId: 'debate-integration-003',
        roundId: 'round-integration-003',
        totalArguments: 2,
        plaintiffArguments: 1,
        defendantArguments: 1,
        generationTime: 1000,
        timestamp: new Date().toISOString(),
      });

      eventSource.emitEvent('ping', {
        timestamp: new Date().toISOString(),
        serverTime: new Date().toISOString(),
      });

      // 验证收到的事件
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedEvents).toContain('connected');
      expect(receivedEvents).toContain('round-start');
      expect(receivedEvents.filter(e => e === 'argument').length).toBe(2);
      expect(receivedEvents).toContain('completed');
      expect(receivedEvents).toContain('ping');

      client.destroy();
    }, 5000);

    it('应该正确处理断线重连', async () => {
      let reconnectCount = 0;
      const clientConfig: SSEClientConfig = {
        url: 'http://localhost:3000/api/stream',
        debateId: 'debate-integration-004',
        roundId: 'round-integration-004',
        enableLogging: false,
        maxRetryAttempts: 3,
        onReconnecting: () => {
          reconnectCount++;
        },
      };

      const client = new SSEClient(clientConfig);
      client.connect();

      const eventSource = client['eventSource'] as MockEventSource;
      eventSource.triggerOpen();

      // 模拟断线
      eventSource.emitError();

      // 验证进入重连状态
      expect(client.getState()).toBe('RECONNECTING');

      // 手动触发新连接打开来模拟重连成功
      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证触发了重连
      expect(reconnectCount).toBe(1);

      client.destroy();
    }, 5000);
  });

  describe('进度追踪集成', () => {
    it('应该正确追踪和报告进度', async () => {
      const progressUpdates: Record<string, unknown>[] = [];
      const sessionId = 'integration-test-005';
      const config = {
        debateId: 'debate-integration-005',
        roundId: 'round-integration-005',
        roundNumber: 1,
        totalArguments: 4,
        progressInterval: 100,
      };

      const generator = new DebateStreamGenerator(
        sessionId,
        config as StreamGeneratorConfig,
        (data: string) => {
          if (data.includes('event: progress')) {
            const dataMatch = data.match(/data: ({[\s\S]*?})/);
            if (dataMatch) {
              progressUpdates.push(JSON.parse(dataMatch[1]));
            }
          }
        }
      );

      generator.sendConnected();
      generator.sendRoundStart();
      generator.startProgressUpdates([
        '生成原告论点',
        '生成被告论点',
        '完成论证',
      ]);

      // 逐步生成论点并检查进度
      for (let i = 0; i < 4; i++) {
        const argument: ArgumentEventData = {
          argumentId: `arg-${i}`,
          roundId: config.roundId,
          side: i % 2 === 0 ? 'PLAINTIFF' : 'DEFENDANT',
          content: `论点${i}`,
          type: 'MAIN_POINT',
          timestamp: new Date().toISOString(),
        };

        generator.sendArgument(argument);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      generator.sendCompleted();
      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证进度更新
      expect(progressUpdates.length).toBeGreaterThan(0);

      generator.cleanup();
    }, 5000);
  });

  describe('错误恢复集成', () => {
    it('应该在错误后能够恢复并继续生成', async () => {
      let errorReceived = false;
      let argumentsReceived = 0;

      const clientConfig: SSEClientConfig = {
        url: 'http://localhost:3000/api/stream',
        debateId: 'debate-integration-006',
        roundId: 'round-integration-006',
        enableLogging: false,
        onError: () => {
          errorReceived = true;
        },
        onArgument: () => {
          argumentsReceived++;
        },
      };

      const client = new SSEClient(clientConfig);
      client.connect();

      const eventSource = client['eventSource'] as MockEventSource;
      eventSource.triggerOpen();

      // 发送一些论点
      eventSource.emitEvent('argument', {
        argumentId: 'arg-1',
        roundId: 'round-integration-006',
        side: 'PLAINTIFF',
        content: '论点1',
        type: 'MAIN_POINT',
        timestamp: new Date().toISOString(),
      });

      eventSource.emitEvent('error', {
        debateId: 'debate-integration-006',
        roundId: 'round-integration-006',
        code: 'TEMPORARY_ERROR',
        message: '临时错误',
        timestamp: new Date().toISOString(),
      });

      // 错误后继续发送论点
      eventSource.emitEvent('argument', {
        argumentId: 'arg-2',
        roundId: 'round-integration-006',
        side: 'DEFENDANT',
        content: '论点2',
        type: 'MAIN_POINT',
        timestamp: new Date().toISOString(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证错误被接收，但论点继续
      expect(errorReceived).toBe(true);
      expect(argumentsReceived).toBe(2);

      client.destroy();
    }, 5000);
  });
});
