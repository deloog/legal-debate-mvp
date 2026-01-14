import {
  BatchProcessor,
  BatchProcessorFactory,
} from '../../lib/ai/batch-processor';
import type {
  BatchRequestItem,
  BatchRequestResult,
} from '../../types/ai-service-batch';
import type { AIRequestConfig, AIResponse } from '../../types/ai-service';

// Mock函数
const mockProcessFn = jest.fn(
  async (requests: BatchRequestItem[]): Promise<BatchRequestResult[]> => {
    return requests.map(item => ({
      requestId: item.requestId,
      success: true,
      response: {
        id: `resp_${item.requestId}`,
        object: 'chat.completion',
        created: Date.now(),
        model: 'test-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: `Response for ${item.requestId}`,
            },
            finishReason: 'stop',
          },
        ],
        provider: 'zhipu',
        duration: 50,
      } as AIResponse,
      duration: 50,
    }));
  }
);

describe('BatchProcessor', () => {
  let processor: BatchProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new BatchProcessor(mockProcessFn, {
      maxBatchSize: 3,
      batchTimeout: 50,
      maxConcurrentBatches: 2,
    });
  });

  afterEach(async () => {
    await processor.shutdown();
  });

  describe('add', () => {
    it('应该成功添加单个请求', async () => {
      const request: AIRequestConfig = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            content: 'Test prompt',
          },
        ],
      };

      const response = await processor.add(request);

      expect(response).toBeDefined();
      expect(response.choices[0].message.content).toContain('Response for');
      expect(mockProcessFn).toHaveBeenCalledTimes(1);
    });

    it('应该批量处理多个请求', async () => {
      const requests: AIRequestConfig[] = Array.from({ length: 5 }, (_, i) => ({
        model: 'test-model',
        messages: [
          {
            role: 'user',
            content: `Test prompt ${i}`,
          },
        ],
      }));

      const responses = await Promise.all(
        requests.map(request => processor.add(request))
      );

      expect(responses).toHaveLength(5);
      expect(mockProcessFn).toHaveBeenCalled();
    });

    it('应该正确处理批量超时', async () => {
      const request: AIRequestConfig = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            content: 'Test prompt',
          },
        ],
      };

      await new Promise(resolve => setTimeout(resolve, 60));

      const response = await processor.add(request);

      expect(response).toBeDefined();
    });
  });

  describe('flush', () => {
    it('应该立即处理队列中的所有请求', async () => {
      const requests: AIRequestConfig[] = Array.from({ length: 2 }, (_, i) => ({
        model: 'test-model',
        messages: [
          {
            role: 'user',
            content: `Test prompt ${i}`,
          },
        ],
      }));

      const promises = requests.map(request => processor.add(request));
      await processor.flush();
      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(2);
      expect(mockProcessFn).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('应该返回正确的统计信息', async () => {
      const request: AIRequestConfig = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            content: 'Test prompt',
          },
        ],
      };

      await processor.add(request);

      const stats = processor.getStats();

      expect(stats.totalRequests).toBe(1);
      expect(stats.successfulRequests).toBe(1);
      expect(stats.failedRequests).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('应该更新配置', () => {
      processor.updateConfig({ maxBatchSize: 5 });

      const stats = processor.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('resetStats', () => {
    it('应该重置统计信息', async () => {
      const request: AIRequestConfig = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            content: 'Test prompt',
          },
        ],
      };

      await processor.add(request);
      processor.resetStats();

      const stats = processor.getStats();

      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
    });
  });

  describe('错误处理', () => {
    it('应该正确处理批量处理错误', async () => {
      const errorProcessFn = jest
        .fn()
        .mockRejectedValue(new Error('Batch processing failed'));

      const errorProcessor = new BatchProcessor(errorProcessFn, {
        maxBatchSize: 3,
        batchTimeout: 10,
      });

      const request: AIRequestConfig = {
        model: 'test-model',
        messages: [
          {
            role: 'user',
            content: 'Test prompt',
          },
        ],
      };

      await expect(errorProcessor.add(request)).rejects.toThrow(
        'Batch processing failed'
      );

      await errorProcessor.shutdown();
    });

    it('应该正确处理部分失败', async () => {
      const partialFailureProcessFn = jest.fn(
        async (requests: BatchRequestItem[]): Promise<BatchRequestResult[]> => {
          return requests.map((item, index) => ({
            requestId: item.requestId,
            success: index % 2 === 0,
            response:
              index % 2 === 0
                ? ({
                    id: `resp_${item.requestId}`,
                    object: 'chat.completion',
                    created: Date.now(),
                    model: 'test-model',
                    choices: [
                      {
                        index: 0,
                        message: {
                          role: 'assistant',
                          content: `Response for ${item.requestId}`,
                        },
                        finishReason: 'stop',
                      },
                    ],
                    provider: 'zhipu',
                    duration: 50,
                  } as AIResponse)
                : undefined,
            error: index % 2 !== 0 ? new Error('Failed request') : undefined,
            duration: 50,
          }));
        }
      );

      const partialProcessor = new BatchProcessor(partialFailureProcessFn, {
        maxBatchSize: 3,
        batchTimeout: 10,
      });

      const requests: AIRequestConfig[] = Array.from({ length: 2 }, (_, i) => ({
        model: 'test-model',
        messages: [
          {
            role: 'user',
            content: `Test prompt ${i}`,
          },
        ],
      }));

      await expect(
        Promise.all(requests.map(request => partialProcessor.add(request)))
      ).rejects.toThrow();

      await partialProcessor.shutdown();
    });
  });

  describe('并发批处理', () => {
    it('应该正确处理并发批处理', async () => {
      const concurrentProcessor = new BatchProcessor(mockProcessFn, {
        maxBatchSize: 2,
        batchTimeout: 100,
        maxConcurrentBatches: 2,
      });

      const requests: AIRequestConfig[] = Array.from({ length: 6 }, (_, i) => ({
        model: 'test-model',
        messages: [
          {
            role: 'user',
            content: `Test prompt ${i}`,
          },
        ],
      }));

      const responses = await Promise.all(
        requests.map(request => concurrentProcessor.add(request))
      );

      expect(responses).toHaveLength(6);

      await concurrentProcessor.shutdown();
    });
  });
});

describe('BatchProcessorFactory', () => {
  afterEach(() => {
    BatchProcessorFactory.shutdownAll();
  });

  describe('getInstance', () => {
    it('应该返回单例实例', () => {
      const instance1 = BatchProcessorFactory.getInstance(
        'test',
        mockProcessFn
      );
      const instance2 = BatchProcessorFactory.getInstance('test');

      expect(instance1).toBe(instance2);
    });

    it('应该为不同名称创建不同实例', () => {
      const instance1 = BatchProcessorFactory.getInstance(
        'test1',
        mockProcessFn
      );
      const instance2 = BatchProcessorFactory.getInstance(
        'test2',
        mockProcessFn
      );

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('createCustomInstance', () => {
    it('应该创建自定义实例', () => {
      const instance = BatchProcessorFactory.createCustomInstance(
        'custom',
        mockProcessFn,
        { maxBatchSize: 5 }
      );

      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(BatchProcessor);
    });
  });

  describe('removeInstance', () => {
    it('应该移除指定实例', () => {
      BatchProcessorFactory.createCustomInstance('test', mockProcessFn);
      const removed = BatchProcessorFactory.removeInstance('test');

      expect(removed).toBe(true);
    });

    it('应该返回false如果实例不存在', () => {
      const removed = BatchProcessorFactory.removeInstance('nonexistent');

      expect(removed).toBe(false);
    });
  });

  describe('shutdownAll', () => {
    it('应该关闭所有实例', async () => {
      BatchProcessorFactory.createCustomInstance('test1', mockProcessFn);
      BatchProcessorFactory.createCustomInstance('test2', mockProcessFn);

      await BatchProcessorFactory.shutdownAll();

      const removed = BatchProcessorFactory.removeInstance('test1');
      expect(removed).toBe(false);
    });
  });
});
