import {
  CircuitBreaker,
  CircuitBreakerFactory,
} from '../../lib/ai/circuit-breaker';
import type { CircuitState } from '../../types/ai-service-batch';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      halfOpenTimeout: 500,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    breaker.shutdown();
  });

  describe('execute', () => {
    it('应该在CLOSED状态下成功执行', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await breaker.execute(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);

      const state = breaker.getState();
      expect(state.state).toBe('CLOSED');
    });

    it('应该在连续失败后打开熔断器', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failed'));

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(mockFn)).rejects.toThrow('Failed');
      }

      const state = breaker.getState();
      expect(state.state).toBe('OPEN');
      expect(state.failureCount).toBe(3);
    });

    it('应该在OPEN状态下拒绝请求', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failed'));

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(mockFn)).rejects.toThrow('Failed');
      }

      await expect(breaker.execute(mockFn)).rejects.toThrow(
        'Circuit breaker is OPEN'
      );
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('应该在超时后进入HALF_OPEN状态', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failed'));

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(mockFn)).rejects.toThrow('Failed');
      }

      // 推进时间超过timeout
      jest.advanceTimersByTime(1001);

      const successFn = jest.fn().mockResolvedValue('success');
      const result = await breaker.execute(successFn);

      expect(result).toBe('success');

      const state = breaker.getState();
      expect(state.state).toBe('HALF_OPEN');
    });

    it('应该在HALF_OPEN状态下成功后恢复', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('Failed'));

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow('Failed');
      }

      jest.advanceTimersByTime(1001);

      const successFn = jest.fn().mockResolvedValue('success');
      await breaker.execute(successFn);
      await breaker.execute(successFn);

      const state = breaker.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
    });

    it('应该在HALF_OPEN状态下失败后重新打开', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('Failed'));

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow('Failed');
      }

      jest.advanceTimersByTime(1001);

      await expect(breaker.execute(failFn)).rejects.toThrow('Failed');

      const state = breaker.getState();
      expect(state.state).toBe('OPEN');
    });
  });

  describe('getState', () => {
    it('应该返回当前状态', async () => {
      const state = breaker.getState();

      expect(state).toBeDefined();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
      expect(state.successCount).toBe(0);
    });
  });

  describe('getStats', () => {
    it('应该返回统计信息', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      await breaker.execute(mockFn);

      const stats = breaker.getStats();

      expect(stats.state).toBe('CLOSED');
      expect(stats.totalRequests).toBe(1);
      expect(stats.totalSuccesses).toBe(1);
      expect(stats.totalFailures).toBe(0);
    });

    it('应该计算成功率', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      await breaker.execute(mockFn);
      await breaker.execute(mockFn);

      const failFn = jest.fn().mockRejectedValue(new Error('Failed'));
      try {
        await breaker.execute(failFn);
      } catch {
        // Ignore
      }

      const stats = breaker.getStats();

      expect(stats.successRate).toBeCloseTo(2 / 3, 1);
    });
  });

  describe('reset', () => {
    it('应该重置熔断器状态', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('Failed'));

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow('Failed');
      }

      breaker.reset();

      const state = breaker.getState();

      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
      expect(state.successCount).toBe(0);
      expect(state.requestCount).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('应该更新配置', () => {
      breaker.updateConfig({ failureThreshold: 5 });
      const stats = breaker.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('事件监听', () => {
    it('应该触发状态变更事件', async () => {
      const listener = jest.fn();
      breaker.addListener(listener);

      const failFn = jest.fn().mockRejectedValue(new Error('Failed'));

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow('Failed');
      }

      expect(listener).toHaveBeenCalledWith(
        'STATE_CHANGE',
        expect.objectContaining({
          state: 'OPEN' as CircuitState,
        })
      );
    });

    it('应该触发成功事件', async () => {
      const listener = jest.fn();
      breaker.addListener(listener);

      const mockFn = jest.fn().mockResolvedValue('success');
      await breaker.execute(mockFn);

      expect(listener).toHaveBeenCalledWith('SUCCESS', expect.any(Object));
    });

    it('应该触发失败事件', async () => {
      const listener = jest.fn();
      breaker.addListener(listener);

      const failFn = jest.fn().mockRejectedValue(new Error('Failed'));
      try {
        await breaker.execute(failFn);
      } catch {
        // Ignore
      }

      expect(listener).toHaveBeenCalledWith('FAILURE', expect.any(Object));
    });

    it('应该移除监听器', async () => {
      const listener = jest.fn();
      breaker.addListener(listener);
      breaker.removeListener(listener);

      const mockFn = jest.fn().mockResolvedValue('success');
      await breaker.execute(mockFn);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('forceOpen/forceClose', () => {
    it('应该强制打开熔断器', () => {
      breaker.forceOpen();

      const state = breaker.getState();
      expect(state.state).toBe('OPEN');
    });

    it('应该强制关闭熔断器', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('Failed'));

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow('Failed');
      }

      breaker.forceClose();

      const state = breaker.getState();
      expect(state.state).toBe('CLOSED');
    });
  });
});

describe('CircuitBreakerFactory', () => {
  afterEach(() => {
    CircuitBreakerFactory.shutdownAll();
  });

  describe('getInstance', () => {
    it('应该返回单例实例', () => {
      const instance1 = CircuitBreakerFactory.getInstance('test');
      const instance2 = CircuitBreakerFactory.getInstance('test');

      expect(instance1).toBe(instance2);
    });

    it('应该为不同名称创建不同实例', () => {
      const instance1 = CircuitBreakerFactory.getInstance('test1');
      const instance2 = CircuitBreakerFactory.getInstance('test2');

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('createCustomInstance', () => {
    it('应该创建自定义实例', () => {
      const instance = CircuitBreakerFactory.createCustomInstance('custom', {
        failureThreshold: 5,
      });

      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(CircuitBreaker);
    });
  });

  describe('removeInstance', () => {
    it('应该移除指定实例', () => {
      CircuitBreakerFactory.createCustomInstance('test', {});
      const removed = CircuitBreakerFactory.removeInstance('test');

      expect(removed).toBe(true);
    });

    it('应该返回false如果实例不存在', () => {
      const removed = CircuitBreakerFactory.removeInstance('nonexistent');

      expect(removed).toBe(false);
    });
  });

  describe('getAllInstances', () => {
    it('应该返回所有实例', () => {
      CircuitBreakerFactory.createCustomInstance('test1', {});
      CircuitBreakerFactory.createCustomInstance('test2', {});

      const instances = CircuitBreakerFactory.getAllInstances();

      expect(instances.size).toBe(2);
    });
  });

  describe('resetAll', () => {
    it('应该重置所有实例', () => {
      CircuitBreakerFactory.createCustomInstance('test', {});
      CircuitBreakerFactory.resetAll();

      const instances = CircuitBreakerFactory.getAllInstances();
      instances.forEach(instance => {
        const state = instance.getState();
        expect(state.state).toBe('CLOSED');
        expect(state.failureCount).toBe(0);
      });
    });
  });

  describe('shutdownAll', () => {
    it('应该关闭所有实例', () => {
      CircuitBreakerFactory.createCustomInstance('test1', {});
      CircuitBreakerFactory.createCustomInstance('test2', {});

      CircuitBreakerFactory.shutdownAll();

      const removed = CircuitBreakerFactory.removeInstance('test1');
      expect(removed).toBe(false);
    });
  });
});
