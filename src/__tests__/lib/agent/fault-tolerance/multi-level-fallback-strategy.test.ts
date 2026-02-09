/**
 * MultiLevelFallbackStrategy 测试
 * 测试多级降级策略的各项功能
 */

import { describe, it, expect, jest } from '@jest/globals';
import type { ExtractedData } from '@/lib/agent/doc-analyzer/core/types';

// 导入待测试的类（稍后实现）
import { MultiLevelFallbackStrategy } from '@/lib/agent/fault-tolerance/multi-level-fallback-strategy';
import type { FallbackContext } from '@/lib/agent/fault-tolerance/multi-level-fallback-strategy';

describe('MultiLevelFallbackStrategy', () => {
  let strategy: MultiLevelFallbackStrategy;

  beforeEach(() => {
    strategy = new MultiLevelFallbackStrategy();
  });

  describe('execute - 多级降级执行', () => {
    it('应该在主要方法成功时返回主要结果', async () => {
      const primaryResult: ExtractedData = {
        parties: [
          { type: 'plaintiff', name: '张三', role: '原告' },
          { type: 'defendant', name: '李四', role: '被告' },
        ],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '支付货款10万元',
            amount: 100000,
            currency: 'CNY',
          },
        ],
      };

      const primaryFn = jest.fn(async () => primaryResult);
      const context: FallbackContext = {};

      const result = await strategy.execute(primaryFn, context);

      expect(result.level).toBe('primary');
      expect(result.result).toEqual(primaryResult);
      expect(result.quality.quality).toBe('high');
      expect(result.quality.score).toBeGreaterThan(0.7);
      expect(primaryFn).toHaveBeenCalledTimes(1);
    });

    it('应该在主要方法质量不佳时尝试规则降级', async () => {
      const lowQualityResult: ExtractedData = {
        parties: [],
        claims: [],
      };

      const ruleResult: ExtractedData = {
        parties: [{ type: 'plaintiff', name: '张三', role: '原告' }],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '支付货款',
            amount: 50000,
            currency: 'CNY',
          },
        ],
      };

      const primaryFn = jest.fn(async () => lowQualityResult);
      const ruleFallback = jest.fn(async () => ruleResult);

      const context: FallbackContext = {
        ruleFallback,
      };

      const result = await strategy.execute(primaryFn, context);

      expect(result.level).toBe('rule');
      expect(result.result).toEqual(ruleResult);
      expect(result.quality.quality).toBe('medium');
      expect(primaryFn).toHaveBeenCalledTimes(1);
      expect(ruleFallback).toHaveBeenCalledTimes(1);
    });

    it('应该在主要方法失败时尝试规则降级', async () => {
      const ruleResult: ExtractedData = {
        parties: [{ type: 'plaintiff', name: '张三', role: '原告' }],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '支付货款',
            amount: 50000,
            currency: 'CNY',
          },
        ],
      };

      const primaryFn = jest.fn(async () => {
        throw new Error('AI服务不可用');
      });
      const ruleFallback = jest.fn(async () => ruleResult);

      const context: FallbackContext = {
        ruleFallback,
      };

      const result = await strategy.execute(primaryFn, context);

      expect(result.level).toBe('rule');
      expect(result.result).toEqual(ruleResult);
      expect(primaryFn).toHaveBeenCalledTimes(1);
      expect(ruleFallback).toHaveBeenCalledTimes(1);
    });

    it('应该在规则降级失败时尝试缓存降级', async () => {
      const cacheResult: ExtractedData = {
        parties: [
          { type: 'plaintiff', name: '张三', role: '原告' },
          { type: 'defendant', name: '李四', role: '被告' },
        ],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '支付货款',
            amount: 80000,
            currency: 'CNY',
          },
        ],
      };

      const primaryFn = jest.fn(async () => {
        throw new Error('AI服务不可用');
      });
      const ruleFallback = jest.fn(async () => {
        throw new Error('规则提取失败');
      });
      const cacheFallback = jest.fn(async () => cacheResult);

      const context: FallbackContext = {
        ruleFallback,
        cacheFallback,
      };

      const result = await strategy.execute(primaryFn, context);

      expect(result.level).toBe('cache');
      expect(result.result).toEqual(cacheResult);
      expect(result.quality.quality).toBe('high');
      expect(primaryFn).toHaveBeenCalledTimes(1);
      expect(ruleFallback).toHaveBeenCalledTimes(1);
      expect(cacheFallback).toHaveBeenCalledTimes(1);
    });

    it('应该在缓存降级失败时尝试模板降级', async () => {
      const templateResult: ExtractedData = {
        parties: [],
        claims: [],
      };

      const primaryFn = jest.fn(async () => {
        throw new Error('AI服务不可用');
      });
      const ruleFallback = jest.fn(async () => {
        throw new Error('规则提取失败');
      });
      const cacheFallback = jest.fn(async () => {
        throw new Error('缓存未命中');
      });
      const templateFallback = jest.fn(async () => templateResult);

      const context: FallbackContext = {
        ruleFallback,
        cacheFallback,
        templateFallback,
      };

      const result = await strategy.execute(primaryFn, context);

      expect(result.level).toBe('template');
      expect(result.result).toEqual(templateResult);
      expect(result.quality.quality).toBe('medium');
      expect(primaryFn).toHaveBeenCalledTimes(1);
      expect(ruleFallback).toHaveBeenCalledTimes(1);
      expect(cacheFallback).toHaveBeenCalledTimes(1);
      expect(templateFallback).toHaveBeenCalledTimes(1);
    });

    it('应该在所有降级都失败时返回失败结果', async () => {
      const primaryFn = jest.fn(async () => {
        throw new Error('AI服务不可用');
      });
      const ruleFallback = jest.fn(async () => {
        throw new Error('规则提取失败');
      });
      const cacheFallback = jest.fn(async () => {
        throw new Error('缓存未命中');
      });
      const templateFallback = jest.fn(async () => {
        throw new Error('模板加载失败');
      });

      const context: FallbackContext = {
        ruleFallback,
        cacheFallback,
        templateFallback,
      };

      const result = await strategy.execute(primaryFn, context);

      expect(result.level).toBe('failed');
      expect(result.result).toBeNull();
      expect(result.quality.quality).toBe('low');
      expect(result.quality.score).toBe(0);
      expect(result.quality.shouldRetry).toBe(true);
      expect(result.quality.warnings).toContain('所有降级策略都失败');
    });

    it('应该在规则降级质量不佳时继续尝试缓存降级', async () => {
      const lowQualityRuleResult: ExtractedData = {
        parties: [],
        claims: [],
      };

      const cacheResult: ExtractedData = {
        parties: [{ type: 'plaintiff', name: '张三', role: '原告' }],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '支付货款',
            amount: 50000,
            currency: 'CNY',
          },
        ],
      };

      const primaryFn = jest.fn(async () => {
        throw new Error('AI服务不可用');
      });
      const ruleFallback = jest.fn(async () => lowQualityRuleResult);
      const cacheFallback = jest.fn(async () => cacheResult);

      const context: FallbackContext = {
        ruleFallback,
        cacheFallback,
      };

      const result = await strategy.execute(primaryFn, context);

      expect(result.level).toBe('cache');
      expect(result.result).toEqual(cacheResult);
      expect(ruleFallback).toHaveBeenCalledTimes(1);
      expect(cacheFallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('降级策略跳过', () => {
    it('应该在没有规则降级时直接尝试缓存降级', async () => {
      const cacheResult: ExtractedData = {
        parties: [{ type: 'plaintiff', name: '张三', role: '原告' }],
        claims: [],
      };

      const primaryFn = jest.fn(async () => {
        throw new Error('AI服务不可用');
      });
      const cacheFallback = jest.fn(async () => cacheResult);

      const context: FallbackContext = {
        cacheFallback,
      };

      const result = await strategy.execute(primaryFn, context);

      expect(result.level).toBe('cache');
      expect(result.result).toEqual(cacheResult);
      expect(cacheFallback).toHaveBeenCalledTimes(1);
    });

    it('应该在没有缓存降级时直接尝试模板降级', async () => {
      const templateResult: ExtractedData = {
        parties: [],
        claims: [],
      };

      const primaryFn = jest.fn(async () => {
        throw new Error('AI服务不可用');
      });
      const templateFallback = jest.fn(async () => templateResult);

      const context: FallbackContext = {
        templateFallback,
      };

      const result = await strategy.execute(primaryFn, context);

      expect(result.level).toBe('template');
      expect(result.result).toEqual(templateResult);
      expect(templateFallback).toHaveBeenCalledTimes(1);
    });

    it('应该在没有任何降级策略时返回失败', async () => {
      const primaryFn = jest.fn(async () => {
        throw new Error('AI服务不可用');
      });

      const context: FallbackContext = {};

      const result = await strategy.execute(primaryFn, context);

      expect(result.level).toBe('failed');
      expect(result.result).toBeNull();
      expect(result.quality.quality).toBe('low');
    });
  });

  describe('质量评估集成', () => {
    it('应该正确评估主要结果的质量', async () => {
      const highQualityResult: ExtractedData = {
        parties: [
          { type: 'plaintiff', name: '张三', role: '原告' },
          { type: 'defendant', name: '李四', role: '被告' },
        ],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '支付货款',
            amount: 100000,
            currency: 'CNY',
          },
        ],
      };

      const primaryFn = jest.fn(async () => highQualityResult);
      const context: FallbackContext = {};

      const result = await strategy.execute(primaryFn, context);

      expect(result.quality.quality).toBe('high');
      expect(result.quality.score).toBeGreaterThan(0.7);
      expect(result.quality.shouldRetry).toBe(false);
    });

    it('应该正确评估规则降级结果的质量', async () => {
      const ruleResult: ExtractedData = {
        parties: [{ type: 'plaintiff', name: '张三', role: '原告' }],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '支付货款',
            amount: 50000,
            currency: 'CNY',
          },
        ],
      };

      const primaryFn = jest.fn(async () => {
        throw new Error('AI服务不可用');
      });
      const ruleFallback = jest.fn(async () => ruleResult);

      const context: FallbackContext = {
        ruleFallback,
      };

      const result = await strategy.execute(primaryFn, context);

      expect(result.quality.quality).toBe('medium');
      expect(result.quality.score).toBeGreaterThan(0.5);
    });

    it('应该正确评估缓存降级结果的质量', async () => {
      const cacheResult: ExtractedData = {
        parties: [{ type: 'plaintiff', name: '张三', role: '原告' }],
        claims: [],
      };

      const primaryFn = jest.fn(async () => {
        throw new Error('AI服务不可用');
      });
      const cacheFallback = jest.fn(async () => cacheResult);

      const context: FallbackContext = {
        cacheFallback,
      };

      const result = await strategy.execute(primaryFn, context);

      expect(result.quality.quality).toBe('high');
      expect(result.quality.score).toBeGreaterThanOrEqual(0.9);
    });

    it('应该正确评估模板降级结果的质量', async () => {
      const templateResult: ExtractedData = {
        parties: [],
        claims: [],
      };

      const primaryFn = jest.fn(async () => {
        throw new Error('AI服务不可用');
      });
      const templateFallback = jest.fn(async () => templateResult);

      const context: FallbackContext = {
        templateFallback,
      };

      const result = await strategy.execute(primaryFn, context);

      expect(result.quality.quality).toBe('medium');
      expect(result.quality.score).toBe(0.5);
      expect(result.quality.warnings).toContain('使用模板降级，结果可能不准确');
    });
  });

  describe('边界情况', () => {
    it('应该处理主要方法返回null', async () => {
      const primaryFn = jest.fn(async () => null);
      const ruleFallback = jest.fn(async () => ({
        parties: [{ type: 'plaintiff', name: '张三', role: '原告' }],
        claims: [],
      }));

      const context: FallbackContext = {
        ruleFallback,
      };

      const result = await strategy.execute(primaryFn, context);

      expect(result.level).toBe('rule');
      expect(ruleFallback).toHaveBeenCalledTimes(1);
    });

    it('应该处理主要方法返回undefined', async () => {
      const primaryFn = jest.fn(async () => undefined);
      const ruleFallback = jest.fn(async () => ({
        parties: [{ type: 'plaintiff', name: '张三', role: '原告' }],
        claims: [],
      }));

      const context: FallbackContext = {
        ruleFallback,
      };

      const result = await strategy.execute(primaryFn, context);

      expect(result.level).toBe('rule');
      expect(ruleFallback).toHaveBeenCalledTimes(1);
    });

    it('应该处理所有降级方法都返回null', async () => {
      const primaryFn = jest.fn(async () => null);
      const ruleFallback = jest.fn(async () => null);
      const cacheFallback = jest.fn(async () => null);
      const templateFallback = jest.fn(async () => null);

      const context: FallbackContext = {
        ruleFallback,
        cacheFallback,
        templateFallback,
      };

      const result = await strategy.execute(primaryFn, context);

      expect(result.level).toBe('failed');
      expect(result.result).toBeNull();
    });

    it('应该处理降级方法抛出异常', async () => {
      const primaryFn = jest.fn(async () => {
        throw new Error('主要方法失败');
      });
      const ruleFallback = jest.fn(async () => {
        throw new Error('规则降级失败');
      });
      const cacheFallback = jest.fn(async () => ({
        parties: [{ type: 'plaintiff', name: '张三', role: '原告' }],
        claims: [],
      }));

      const context: FallbackContext = {
        ruleFallback,
        cacheFallback,
      };

      const result = await strategy.execute(primaryFn, context);

      expect(result.level).toBe('cache');
      expect(result.result).toBeDefined();
    });
  });

  describe('降级链完整性', () => {
    it('应该按照正确的顺序尝试降级：AI → 规则 → 缓存 → 模板', async () => {
      const callOrder: string[] = [];

      const primaryFn = jest.fn(async () => {
        callOrder.push('primary');
        throw new Error('失败');
      });

      const ruleFallback = jest.fn(async () => {
        callOrder.push('rule');
        throw new Error('失败');
      });

      const cacheFallback = jest.fn(async () => {
        callOrder.push('cache');
        throw new Error('失败');
      });

      const templateFallback = jest.fn(async () => {
        callOrder.push('template');
        return { parties: [], claims: [] };
      });

      const context: FallbackContext = {
        ruleFallback,
        cacheFallback,
        templateFallback,
      };

      await strategy.execute(primaryFn, context);

      expect(callOrder).toEqual(['primary', 'rule', 'cache', 'template']);
    });

    it('应该在某一级成功后停止降级链', async () => {
      const primaryFn = jest.fn(async () => {
        throw new Error('失败');
      });

      const ruleFallback = jest.fn(async () => ({
        parties: [{ type: 'plaintiff', name: '张三', role: '原告' }],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '支付货款',
            amount: 50000,
            currency: 'CNY',
          },
        ],
      }));

      const cacheFallback = jest.fn(async () => ({
        parties: [],
        claims: [],
      }));

      const templateFallback = jest.fn(async () => ({
        parties: [],
        claims: [],
      }));

      const context: FallbackContext = {
        ruleFallback,
        cacheFallback,
        templateFallback,
      };

      const result = await strategy.execute(primaryFn, context);

      expect(result.level).toBe('rule');
      expect(ruleFallback).toHaveBeenCalledTimes(1);
      expect(cacheFallback).not.toHaveBeenCalled();
      expect(templateFallback).not.toHaveBeenCalled();
    });
  });
});
