import {
  RetryStrategy,
  RetryStrategyFactory,
} from '../../lib/ai/retry-strategy';

describe('RetryStrategy', () => {
  let strategy: RetryStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    strategy = new RetryStrategy({
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 500,
      backoffMultiplier: 2,
      enableJitter: false,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('execute', () => {
    it('应该在第一次尝试成功时返回结果', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await strategy.execute(mockFn);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('应该对超时错误进行重试', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValueOnce('success');

      const executePromise = strategy.execute(mockFn);

      await jest.advanceTimersByTimeAsync(100);

      const result = await executePromise;

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('应该对网络错误进行重试', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');

      const executePromise = strategy.execute(mockFn);

      await jest.advanceTimersByTimeAsync(100);

      const result = await executePromise;

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('应该对速率限制错误进行重试', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce('success');

      const executePromise = strategy.execute(mockFn);

      await jest.advanceTimersByTimeAsync(100);

      const result = await executePromise;

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('应该对不可重试的错误不重试', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValue(new Error('Authentication failed'));

      await expect(strategy.execute(mockFn)).rejects.toThrow(
        'Authentication failed'
      );
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStats', () => {
    it('应该返回正确的统计信息', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      await strategy.execute(mockFn);

      const stats = strategy.getStats();

      expect(stats.successfulRetries).toBe(0);
      expect(stats.failedRetries).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('应该更新配置', () => {
      strategy.updateConfig({ maxAttempts: 5 });
      const stats = strategy.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('resetStats', () => {
    it('应该重置统计信息', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      await strategy.execute(mockFn);
      strategy.resetStats();

      const stats = strategy.getStats();

      expect(stats.totalRetries).toBe(0);
      expect(stats.successfulRetries).toBe(0);
    });
  });
});

describe('RetryStrategyFactory', () => {
  afterEach(() => {
    RetryStrategyFactory.shutdownAll();
  });

  describe('getInstance', () => {
    it('应该返回单例实例', () => {
      const instance1 = RetryStrategyFactory.getInstance('test', {
        maxAttempts: 3,
      });
      const instance2 = RetryStrategyFactory.getInstance('test');

      expect(instance1).toBe(instance2);
    });

    it('应该为不同名称创建不同实例', () => {
      const instance1 = RetryStrategyFactory.getInstance('test1', {
        maxAttempts: 3,
      });
      const instance2 = RetryStrategyFactory.getInstance('test2', {
        maxAttempts: 3,
      });

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('createCustomInstance', () => {
    it('应该创建自定义实例', () => {
      const instance = RetryStrategyFactory.createCustomInstance('custom', {
        maxAttempts: 5,
      });

      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(RetryStrategy);
    });
  });

  describe('removeInstance', () => {
    it('应该移除指定实例', () => {
      RetryStrategyFactory.createCustomInstance('test', {
        maxAttempts: 3,
      });
      const removed = RetryStrategyFactory.removeInstance('test');

      expect(removed).toBe(true);
    });

    it('应该返回false如果实例不存在', () => {
      const removed = RetryStrategyFactory.removeInstance('nonexistent');

      expect(removed).toBe(false);
    });
  });

  describe('getAllInstances', () => {
    it('应该返回所有实例', () => {
      RetryStrategyFactory.createCustomInstance('test1', {
        maxAttempts: 3,
      });
      RetryStrategyFactory.createCustomInstance('test2', {
        maxAttempts: 3,
      });

      const instances = RetryStrategyFactory.getAllInstances();

      expect(instances.size).toBe(2);
    });
  });

  describe('resetAll', () => {
    it('应该重置所有实例的统计信息', () => {
      RetryStrategyFactory.createCustomInstance('test', {
        maxAttempts: 3,
      });
      RetryStrategyFactory.resetAll();

      const instances = RetryStrategyFactory.getAllInstances();
      instances.forEach(instance => {
        const stats = instance.getStats();
        expect(stats.totalRetries).toBe(0);
      });
    });
  });

  describe('shutdownAll', () => {
    it('应该关闭所有实例', () => {
      RetryStrategyFactory.createCustomInstance('test1', {
        maxAttempts: 3,
      });
      RetryStrategyFactory.createCustomInstance('test2', {
        maxAttempts: 3,
      });

      RetryStrategyFactory.shutdownAll();

      const removed = RetryStrategyFactory.removeInstance('test1');
      expect(removed).toBe(false);
    });
  });
});
