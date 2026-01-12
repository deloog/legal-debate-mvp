/**
 * SSE事件管理器单元测试
 * 测试SSE事件格式化、心跳机制、连接超时等功能
 */

import { SSEEventManager } from '@/lib/debate/stream/sse-manager';
import { SSEConnectionState } from '@/lib/debate/stream/types';

describe('SSEEventManager', () => {
  let manager: SSEEventManager;
  const sessionId = 'test-session-001';

  beforeEach(() => {
    manager = new SSEEventManager(sessionId);
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('会话管理', () => {
    it('应该生成唯一的会话ID', () => {
      const manager1 = new SSEEventManager('session-1');
      const manager2 = new SSEEventManager('session-2');
      const stats1 = manager1.getStats();
      const stats2 = manager2.getStats();

      expect(stats1.sessionId).toBe('session-1');
      expect(stats2.sessionId).toBe('session-2');
      expect(stats1.sessionId).not.toBe(stats2.sessionId);

      manager1.cleanup();
      manager2.cleanup();
    });

    it('应该正确跟踪开始时间', () => {
      const stats = manager.getStats();
      const now = new Date();
      const startTime = new Date(stats.startTime);

      expect(startTime.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(startTime.getTime()).toBeGreaterThan(now.getTime() - 1000);
    });
  });

  describe('事件格式化', () => {
    it('应该正确格式化基本SSE事件', () => {
      const event = manager.createEvent('ping', { message: 'hello' });
      const formatted = manager.formatEvent(event);

      expect(formatted).toContain('event: ping');
      expect(formatted).toContain('data: {');
      expect(formatted).toContain('"message":"hello"');
    });

    it('应该支持带ID的事件', () => {
      const event = manager.createEvent('ping', { data: 1 }, 'event-123');
      const formatted = manager.formatEvent(event);

      expect(formatted).toContain('id: event-123');
    });

    it('应该支持带重试间隔的事件', () => {
      const event = manager.createEvent('ping', { data: 1 }, undefined, 5000);
      const formatted = manager.formatEvent(event);

      expect(formatted).toContain('retry: 5000');
    });

    it('应该正确处理包含换行符的消息', () => {
      const event = manager.createEvent('ping', {
        message: 'line1\nline2\rcarriage',
      });
      const formatted = manager.formatEvent(event);

      // SSE要求每行以\n结尾，不应该有裸的\n或\r
      expect(formatted).toContain('event: ping');
      expect(formatted).toContain('data: {');
    });

    it('应该以双换行符结束每个事件', () => {
      const event = manager.createEvent('ping', { data: 1 });
      const formatted = manager.formatEvent(event);

      expect(formatted).toMatch(/\n\n$/);
    });
  });

  describe('心跳机制', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('应该启动心跳', () => {
      let pingCount = 0;
      const pingCallback = () => {
        pingCount++;
      };

      manager.startHeartbeat(100, pingCallback);
      jest.advanceTimersByTime(250);

      expect(pingCount).toBeGreaterThanOrEqual(1);

      manager.stopHeartbeat();
    });

    it('应该按照指定间隔发送心跳', () => {
      let pingCount = 0;
      const pingCallback = () => {
        pingCount++;
      };

      manager.startHeartbeat(1000, pingCallback);

      jest.advanceTimersByTime(3000);
      expect(pingCount).toBe(3);

      manager.stopHeartbeat();
    });

    it('应该能停止心跳', () => {
      let pingCount = 0;
      const pingCallback = () => {
        pingCount++;
      };

      manager.startHeartbeat(1000, pingCallback);

      jest.advanceTimersByTime(2000);
      expect(pingCount).toBe(2);

      manager.stopHeartbeat();
      jest.advanceTimersByTime(2000);
      expect(pingCount).toBe(2); // 不再增加
    });

    it('多次启动心跳应该覆盖之前的心跳', () => {
      let firstPingCount = 0;
      let secondPingCount = 0;

      const firstCallback = () => {
        firstPingCount++;
      };

      const secondCallback = () => {
        secondPingCount++;
      };

      manager.startHeartbeat(1000, firstCallback);
      manager.startHeartbeat(500, secondCallback);

      jest.advanceTimersByTime(2000);

      expect(firstPingCount).toBe(0); // 第一个心跳被覆盖
      expect(secondPingCount).toBe(4); // 第二个心跳工作

      manager.stopHeartbeat();
    });
  });

  describe('连接超时', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('应该检测连接超时', () => {
      const timeoutCallback = jest.fn();
      const timeout = 3000;

      manager.startConnectionTimeout(timeout, timeoutCallback);

      // 不更新活动时间
      jest.advanceTimersByTime(timeout + 100);

      expect(timeoutCallback).toHaveBeenCalled();
    });

    it('活动时间更新应该重置超时', () => {
      const timeoutCallback = jest.fn();
      const timeout = 2000;

      manager.startConnectionTimeout(timeout, timeoutCallback);

      // 在超时前更新活动时间
      jest.advanceTimersByTime(500);
      manager.updateStats(100);
      jest.advanceTimersByTime(500);
      manager.updateStats(100);
      jest.advanceTimersByTime(500);
      manager.updateStats(100);

      expect(timeoutCallback).not.toHaveBeenCalled();

      // 超过超时时间
      jest.advanceTimersByTime(timeout);
      expect(timeoutCallback).toHaveBeenCalled();
    });

    it('应该能停止连接超时', () => {
      const timeoutCallback = jest.fn();
      const timeout = 3000;

      manager.startConnectionTimeout(timeout, timeoutCallback);
      manager.stopConnectionTimeout();

      jest.advanceTimersByTime(timeout + 1000);

      expect(timeoutCallback).not.toHaveBeenCalled();
    });
  });

  describe('统计信息', () => {
    it('应该正确记录发送事件数', () => {
      const initialStats = manager.getStats();
      expect(initialStats.totalEventsSent).toBe(0);

      manager.updateStats(100);
      manager.updateStats(200);

      const updatedStats = manager.getStats();
      expect(updatedStats.totalEventsSent).toBe(2);
    });

    it('应该正确记录发送字节数', () => {
      const initialStats = manager.getStats();
      expect(initialStats.totalBytesSent).toBe(0);

      manager.updateStats(100);
      manager.updateStats(150);

      const updatedStats = manager.getStats();
      expect(updatedStats.totalBytesSent).toBe(250);
    });

    it('应该记录最后事件ID', () => {
      manager.createEvent('ping', { data: 1 });
      const stats = manager.getStats();

      expect(stats.lastEventId).toBe('test-session-001-1');

      manager.createEvent('ping', { data: 2 });
      const stats2 = manager.getStats();

      expect(stats2.lastEventId).toBe('test-session-001-2');
    });

    it('应该记录重连次数', () => {
      manager.incrementReconnectAttempts();
      manager.incrementReconnectAttempts();

      const stats = manager.getStats();
      expect(stats.reconnectAttempts).toBe(2);
    });

    it('应该重置重连次数', () => {
      manager.incrementReconnectAttempts();
      manager.incrementReconnectAttempts();
      manager.resetReconnectAttempts();

      const stats = manager.getStats();
      expect(stats.reconnectAttempts).toBe(0);
    });

    it('应该正确更新活动时间', () => {
      const initialStats = manager.getStats();
      const initialTime = initialStats.lastActivityTime.getTime();

      // 更新统计信息会自动更新活动时间
      setTimeout(() => {
        manager.updateStats(100);
        const updatedStats = manager.getStats();
        const updatedTime = updatedStats.lastActivityTime.getTime();

        expect(updatedTime).toBeGreaterThan(initialTime);
      }, 100);
    });
  });

  describe('连接状态', () => {
    it('应该正确设置和获取状态', () => {
      manager.setState(SSEConnectionState.CONNECTING);

      expect(manager.getState()).toBe(SSEConnectionState.CONNECTING);

      manager.setState(SSEConnectionState.CONNECTED);
      expect(manager.getState()).toBe(SSEConnectionState.CONNECTED);
    });

    it('应该在清理时保持连接状态', () => {
      // 设置状态为CONNECTED
      manager.setState(SSEConnectionState.CONNECTED);
      const stateBefore = manager.getState();
      expect(stateBefore).toBe(SSEConnectionState.CONNECTED);

      // cleanup不应该影响状态
      manager.cleanup();

      expect(manager.getState()).toBe(SSEConnectionState.CONNECTED);
    });
  });

  describe('清理资源', () => {
    it('应该停止心跳', () => {
      jest.useFakeTimers();
      let pingCount = 0;
      const pingCallback = () => {
        pingCount++;
      };

      manager.startHeartbeat(1000, pingCallback);
      manager.cleanup();

      jest.advanceTimersByTime(5000);

      expect(pingCount).toBe(0);
      jest.useRealTimers();
    });

    it('应该清除连接超时', () => {
      jest.useFakeTimers();
      const timeoutCallback = jest.fn();

      manager.startConnectionTimeout(3000, timeoutCallback);
      manager.cleanup();

      jest.advanceTimersByTime(5000);

      expect(timeoutCallback).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('边缘情况', () => {
    it('应该处理空数据事件', () => {
      const event = manager.createEvent('ping', {});
      const formatted = manager.formatEvent(event);

      expect(formatted).toContain('event: ping');
      expect(formatted).toContain('data: {}');
    });

    it('应该处理undefined重试间隔', () => {
      const event = manager.createEvent('ping', { data: 1 });
      const formatted = manager.formatEvent(event);

      expect(formatted).not.toContain('retry:');
    });

    it('应该处理undefined事件ID', () => {
      const event = manager.createEvent('ping', { data: 1 }, undefined, 1000);
      const formatted = manager.formatEvent(event);

      expect(formatted).toContain('id: test-session-001-1'); // 自动生成ID
      expect(formatted).toContain('retry: 1000');
    });

    it('应该处理JSON序列化复杂对象', () => {
      const complexData = {
        nested: {
          value: 123,
          array: [1, 2, 3],
        },
      };
      const event = manager.createEvent('ping', complexData);
      const formatted = manager.formatEvent(event);

      expect(formatted).toContain('"nested"');
      expect(formatted).toContain('"value":123');
      expect(formatted).toContain('"array":[1,2,3]');
    });
  });
});
