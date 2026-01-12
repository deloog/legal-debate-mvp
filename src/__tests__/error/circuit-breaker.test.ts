/**
 * CircuitBreaker 测试
 *
 * 测试熔断器
 */

import {
  CircuitBreaker,
  circuitBreakerManager,
} from '@/lib/error/circuit-breaker';
import { CircuitState, CircuitBreakerConfig } from '@/lib/error/types';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;
  const config: CircuitBreakerConfig = {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 5000,
    halfOpenAttempts: 2,
  };

  beforeEach(() => {
    breaker = new CircuitBreaker(config);
  });

  describe('初始状态', () => {
    it('应该初始为CLOSED状态', () => {
      const status = breaker.getStatus();
      expect(status.state).toBe(CircuitState.CLOSED);
      expect(status.failureCount).toBe(0);
      expect(status.successCount).toBe(0);
    });

    it('应该允许在CLOSED状态下执行操作', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await breaker.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('失败计数', () => {
    it('应该正确记录失败次数', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Error'));

      try {
        await breaker.execute(operation);
      } catch {}

      const status = breaker.getStatus();
      expect(status.failureCount).toBe(1);
    });

    it('应该在失败后增加失败计数', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Error'));

      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(operation);
        } catch {}
      }

      const status = breaker.getStatus();
      expect(status.failureCount).toBe(3);
    });
  });

  describe('状态转换', () => {
    it('应该在达到失败阈值后切换到OPEN状态', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Error'));

      // 失败3次
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(operation);
        } catch {}
      }

      const status = breaker.getStatus();
      expect(status.state).toBe(CircuitState.OPEN);
    });

    it('应该在OPEN状态下拒绝操作', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Error'));

      // 触发熔断
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(operation);
        } catch {}
      }

      // 尝试执行新操作，应该被拒绝
      const newOperation = jest.fn().mockResolvedValue('success');
      await expect(breaker.execute(newOperation)).rejects.toThrow(
        'Circuit breaker is OPEN'
      );

      expect(newOperation).not.toHaveBeenCalled();
    });

    it('应该在超时后切换到HALF_OPEN状态', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Error'));
      const shortTimeoutBreaker = new CircuitBreaker({
        ...config,
        timeout: 100, // 100ms超时
      });

      // 触发熔断
      for (let i = 0; i < 3; i++) {
        try {
          await shortTimeoutBreaker.execute(operation);
        } catch {}
      }

      // 等待超时
      await new Promise(resolve => setTimeout(resolve, 150));

      const status = shortTimeoutBreaker.getStatus();
      expect(status.state).toBe(CircuitState.HALF_OPEN);
    });

    it('应该在成功后切换回CLOSED状态', async () => {
      const failOperation = jest.fn().mockRejectedValue(new Error('Error'));
      const shortTimeoutBreaker = new CircuitBreaker({
        ...config,
        timeout: 100,
      });

      // 触发熔断
      for (let i = 0; i < 3; i++) {
        try {
          await shortTimeoutBreaker.execute(failOperation);
        } catch {}
      }

      // 等待超时
      await new Promise(resolve => setTimeout(resolve, 150));

      // 在HALF_OPEN状态下成功2次
      const successOperation = jest.fn().mockResolvedValue('success');
      await shortTimeoutBreaker.execute(successOperation);
      await shortTimeoutBreaker.execute(successOperation);

      const status = shortTimeoutBreaker.getStatus();
      expect(status.state).toBe(CircuitState.CLOSED);
    });

    it('应该在HALF_OPEN状态下失败后切换回OPEN状态', async () => {
      const failOperation = jest.fn().mockRejectedValue(new Error('Error'));
      const shortTimeoutBreaker = new CircuitBreaker({
        ...config,
        timeout: 100,
      });

      // 触发熔断
      for (let i = 0; i < 3; i++) {
        try {
          await shortTimeoutBreaker.execute(failOperation);
        } catch {}
      }

      // 等待超时
      await new Promise(resolve => setTimeout(resolve, 150));

      // 在HALF_OPEN状态下失败
      const failAgainOperation = jest
        .fn()
        .mockRejectedValue(new Error('Error again'));
      try {
        await shortTimeoutBreaker.execute(failAgainOperation);
      } catch {}

      const status = shortTimeoutBreaker.getStatus();
      expect(status.state).toBe(CircuitState.OPEN);
    });
  });

  describe('重置功能', () => {
    it('应该能够重置熔断器', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Error'));

      // 触发熔断
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(operation);
        } catch {}
      }

      breaker.reset();

      const status = breaker.getStatus();
      expect(status.state).toBe(CircuitState.CLOSED);
      expect(status.failureCount).toBe(0);
      expect(status.successCount).toBe(0);
    });

    it('重置后应该允许执行操作', async () => {
      const failOperation = jest.fn().mockRejectedValue(new Error('Error'));

      // 触发熔断
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failOperation);
        } catch {}
      }

      breaker.reset();

      // 重置后应该允许执行
      const newOperation = jest.fn().mockResolvedValue('success');
      const result = await breaker.execute(newOperation);

      expect(result).toBe('success');
    });
  });

  describe('配置验证', () => {
    it('应该使用默认配置', () => {
      const defaultBreaker = new CircuitBreaker();

      const status = defaultBreaker.getStatus();
      expect(status.state).toBe(CircuitState.CLOSED);
    });
  });

  describe('熔断器管理器', () => {
    it('应该能够获取已存在的熔断器', () => {
      const existingBreaker = circuitBreakerManager.getBreaker('test-breaker');

      expect(existingBreaker).toBeDefined();
      expect(existingBreaker.getStatus().state).toBe(CircuitState.CLOSED);
    });

    it('应该能够创建新的熔断器', () => {
      const newBreaker = circuitBreakerManager.getBreaker('new-breaker');

      expect(newBreaker).toBeDefined();
    });

    it('应该能够重置指定的熔断器', async () => {
      const failOperation = jest.fn().mockRejectedValue(new Error('Error'));
      const managerBreaker = circuitBreakerManager.getBreaker('reset-test');

      // 触发熔断
      for (let i = 0; i < 3; i++) {
        try {
          await managerBreaker.execute(failOperation);
        } catch {}
      }

      circuitBreakerManager.resetBreaker('reset-test');

      const status = managerBreaker.getStatus();
      expect(status.state).toBe(CircuitState.CLOSED);
    });

    it('应该重置不存在的熔断器时不报错', () => {
      expect(() => {
        circuitBreakerManager.resetBreaker('non-existent');
      }).not.toThrow();
    });
  });
});
