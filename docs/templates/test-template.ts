/**
 * 单元测试模板
 * 位置: src/__tests__/module/feature.test.ts
 *
 * 使用说明:
 * 1. 复制此模板到目标位置
 * 2. 修改模块名称和测试用例
 * 3. 测试文件必须放在 src/__tests__/ 目录下
 */

import { describe, it, beforeEach, jest } from '@jest/globals';

// ============ 被测试的模块 ============

// import { functionToTest } from '@/lib/module';

// ============ Mock数据 ============

const mockData = {
  input: 'test input',
  expected: 'expected output',
};

// ============ 测试套件 ============

describe('ModuleName', () => {
  // 每个测试前重置状态
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============ 功能测试 ============

  describe('functionName', () => {
    it('should return expected output for valid input', () => {
      // Arrange
      void mockData.input;

      // Act
      // const result = functionToTest(input);

      // Assert
      // expect(result).toBe(mockData.expected);
    });

    it('should throw error for invalid input', () => {
      // Arrange
      void '';

      // Act & Assert
      // expect(() => functionToTest(invalidInput)).toThrow();
    });

    it('should handle edge cases', () => {
      // 测试边界情况
      // const result = functionToTest(null);
      // expect(result).toBeNull();
    });
  });

  // ============ 异步测试 ============

  describe('asyncFunction', () => {
    it('should resolve with expected data', async () => {
      // Arrange
      void mockData.input;

      // Act
      // const result = await asyncFunction(input);

      // Assert
      // expect(result).toEqual(mockData.expected);
    });

    it('should reject with error for invalid input', async () => {
      // Arrange
      void '';

      // Act & Assert
      // await expect(asyncFunction(invalidInput)).rejects.toThrow();
    });
  });

  // ============ 错误处理测试 ============

  describe('error handling', () => {
    it('should log error when operation fails', async () => {
      // Arrange
      // const mockLogger = jest.fn();
      // const operation = new Operation({ logger: mockLogger });

      // Act
      // await operation.execute();

      // Assert
      // expect(mockLogger).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});

// ============ 集成测试示例 ============

/**
 * 如果需要测试与数据库或外部服务的交互，
 * 使用集成测试配置
 */
describe('Integration: Database Operations', () => {
  it('should save and retrieve data', async () => {
    // 使用 testDatabase 或 mock prisma
    // const testData = { name: 'test' };
    // await prisma.entity.create({ data: testData });
    // const result = await prisma.entity.findFirst();
    // expect(result?.name).toBe('test');
  });
});
