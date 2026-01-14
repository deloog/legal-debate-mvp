import {
  ConcurrencyControl,
  ConcurrencyControlFactory,
} from '../../lib/ai/concurrency-control';

describe('ConcurrencyControl', () => {
  let controller: ConcurrencyControl;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ConcurrencyControl({
      maxConcurrency: 2,
      maxQueueSize: 5,
      queueTimeout: 1000,
    });
  });

  afterEach(() => {
    controller.clear();
  });

  describe('execute', () => {
    it('应该成功执行单个任务', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      const result = await controller.execute(mockFn);

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('应该限制并发数', async () => {
      const activeCount = { value: 0 };
      const maxActive = { value: 0 };

      const mockFn = jest.fn().mockImplementation(async () => {
        activeCount.value++;
        maxActive.value = Math.max(maxActive.value, activeCount.value);
        await new Promise(resolve => setTimeout(resolve, 10));
        activeCount.value--;
        return 'result';
      });

      const promises = Array.from({ length: 3 }, () =>
        controller.execute(mockFn)
      );

      await Promise.all(promises);

      expect(maxActive.value).toBeLessThanOrEqual(2);
    });

    it('应该正确处理任务失败', async () => {
      const errorFn = jest.fn().mockRejectedValue(new Error('Task failed'));

      await expect(controller.execute(errorFn)).rejects.toThrow('Task failed');

      const stats = controller.getStats();
      expect(stats.failedTasks).toBe(1);
    });
  });

  describe('getStats', () => {
    it('应该返回正确的统计信息', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      await controller.execute(mockFn);

      const stats = controller.getStats();

      expect(stats.totalTasks).toBe(1);
      expect(stats.successfulTasks).toBe(1);
      expect(stats.failedTasks).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('应该更新配置', () => {
      controller.updateConfig({ maxConcurrency: 5 });
      const stats = controller.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('resetStats', () => {
    it('应该重置统计信息', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      await controller.execute(mockFn);
      controller.resetStats();

      const stats = controller.getStats();

      expect(stats.totalTasks).toBe(0);
      expect(stats.successfulTasks).toBe(0);
    });
  });

  describe('getQueueSize', () => {
    it('应该返回队列大小', async () => {
      const queueSize = controller.getQueueSize();

      expect(typeof queueSize).toBe('number');
      expect(queueSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getActiveTaskCount', () => {
    it('应该返回活跃任务数', async () => {
      const activeCount = controller.getActiveTaskCount();

      expect(typeof activeCount).toBe('number');
      expect(activeCount).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('ConcurrencyControlFactory', () => {
  afterEach(() => {
    ConcurrencyControlFactory.shutdownAll();
  });

  describe('getInstance', () => {
    it('应该返回单例实例', () => {
      const instance1 = ConcurrencyControlFactory.getInstance('test');
      const instance2 = ConcurrencyControlFactory.getInstance('test');

      expect(instance1).toBe(instance2);
    });

    it('应该为不同名称创建不同实例', () => {
      const instance1 = ConcurrencyControlFactory.getInstance('test1');
      const instance2 = ConcurrencyControlFactory.getInstance('test2');

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('createCustomInstance', () => {
    it('应该创建自定义实例', () => {
      const instance = ConcurrencyControlFactory.createCustomInstance(
        'custom',
        {
          maxConcurrency: 5,
        }
      );

      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(ConcurrencyControl);
    });
  });

  describe('removeInstance', () => {
    it('应该移除指定实例', () => {
      ConcurrencyControlFactory.createCustomInstance('test', {});
      const removed = ConcurrencyControlFactory.removeInstance('test');

      expect(removed).toBe(true);
    });

    it('应该返回false如果实例不存在', () => {
      const removed = ConcurrencyControlFactory.removeInstance('nonexistent');

      expect(removed).toBe(false);
    });
  });

  describe('getAllInstances', () => {
    it('应该返回所有实例', () => {
      ConcurrencyControlFactory.createCustomInstance('test1', {});
      ConcurrencyControlFactory.createCustomInstance('test2', {});

      const instances = ConcurrencyControlFactory.getAllInstances();

      expect(instances.size).toBe(2);
    });
  });

  describe('resetAll', () => {
    it('应该重置所有实例的统计信息', () => {
      ConcurrencyControlFactory.createCustomInstance('test', {});
      ConcurrencyControlFactory.resetAll();

      const instances = ConcurrencyControlFactory.getAllInstances();
      instances.forEach(instance => {
        const stats = instance.getStats();
        expect(stats.totalTasks).toBe(0);
      });
    });
  });

  describe('shutdownAll', () => {
    it('应该关闭所有实例', () => {
      ConcurrencyControlFactory.createCustomInstance('test1', {});
      ConcurrencyControlFactory.createCustomInstance('test2', {});

      ConcurrencyControlFactory.shutdownAll();

      const removed = ConcurrencyControlFactory.removeInstance('test1');
      expect(removed).toBe(false);
    });
  });
});
