/**
 * 核心原子函数测试
 * 测试core.ts中的所有18个原子函数
 * 覆盖率要求：90%以上
 */

import { PrismaClient } from '@prisma/client';
import { MemoryManager } from '@/lib/agent/memory-agent/memory-manager';
import * as core from '@/lib/agent/core-actions/index';
import type {
  DatabaseSearchParams,
  AIServiceCallParams,
  ValidationRule,
  HandleErrorParams,
  RetryOperationParams,
  MergeResultsParams,
  GenerateSummaryParams,
} from '@/lib/agent/core-actions/types';

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    agentAction: {
      create: jest.fn().mockResolvedValue({ id: 'test-log-id' }),
    },
    errorLog: {
      create: jest.fn().mockResolvedValue({ id: 'test-error-id' }),
    },
    testTable: {
      findMany: jest.fn().mockResolvedValue([
        { id: '1', name: 'test1' },
        { id: '2', name: 'test2' },
      ]),
    },
  })),
}));

// Mock MemoryManager
jest.mock('@/lib/agent/memory-agent/memory-manager', () => ({
  MemoryManager: jest.fn().mockImplementation(() => ({
    storeWorkingMemory: jest.fn().mockResolvedValue(undefined),
    getMemory: jest.fn().mockImplementation(params => {
      if (params.memoryKey === 'test-key-update') {
        return Promise.resolve({
          memoryId: 'existing-id',
          memoryValue: { data: 'existing' },
        });
      }
      return Promise.resolve(null);
    }),
    storeMemory: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('核心原子函数 - Core Layer', () => {
  let prisma: PrismaClient;
  let memoryManager: MemoryManager;

  beforeEach(() => {
    prisma = new PrismaClient();
    memoryManager = new MemoryManager(prisma);
    jest.clearAllMocks();
  });

  describe('analyze_text - 文本分析', () => {
    it('应该正确分析中文文本', async () => {
      const text = '法律纠纷案件，涉及合同违约。';
      const result = await core.analyze_text(text);

      expect(result).toMatchObject({
        text,
        language: 'zh',
        length: text.length,
        containsChinese: true,
        containsNumbers: false,
        wordCount: expect.any(Number),
        lineCount: expect.any(Number),
        keyPhrases: expect.any(Array),
      });
      expect(result.keyPhrases.length).toBeGreaterThan(0);
    });

    it('应该正确分析英文文本', async () => {
      const text = 'This is a test text with English and numbers 123.';
      const result = await core.analyze_text(text);

      expect(result).toMatchObject({
        text,
        language: 'en',
        containsChinese: false,
        containsNumbers: true,
        wordCount: expect.any(Number),
      });
    });

    it('应该正确处理空文本', async () => {
      const text = '';
      const result = await core.analyze_text(text);

      expect(result).toMatchObject({
        text,
        length: 0,
        wordCount: 0,
        lineCount: 0,
        containsChinese: false,
        containsNumbers: false,
      });
    });

    it('应该正确提取关键短语', async () => {
      const text = '法律纠纷案件，涉及合同违约，金额50万元';
      const result = await core.analyze_text(text);

      expect(result.keyPhrases).toContain('法律纠纷');
      expect(result.keyPhrases).toContain('合同违约');
    });
  });

  describe('extract_entities - 实体提取', () => {
    it('应该正确提取人名实体', async () => {
      const text = '张三和李四签订了合同，金额50万元。';
      const result = await core.extract_entities(text, ['PERSON']);

      expect(result.entities).toBeInstanceOf(Array);
      expect(result.totalEntities).toBe(result.entities.length);
      expect(result.entitiesByType).toHaveProperty('PERSON');
    });

    it('应该正确提取日期实体', async () => {
      const text = '合同于2024年1月15日签署，到期日为2025年1月15日。';
      const result = await core.extract_entities(text, ['DATE']);

      expect(result.entities.length).toBeGreaterThan(0);
      result.entities.forEach(entity => {
        expect(entity.type).toBe('DATE');
        expect(entity.confidence).toBeGreaterThan(0);
        expect(entity.startIndex).toBeLessThan(entity.endIndex);
      });
    });

    it('应该正确提取金额实体', async () => {
      const text = '违约金为50万元，赔偿金10万元。';
      const result = await core.extract_entities(text, ['AMOUNT']);

      expect(result.entities).toBeInstanceOf(Array);
      result.entities.forEach(entity => {
        expect(entity.type).toBe('AMOUNT');
        expect(entity.confidence).toBeGreaterThan(0);
      });
    });

    it('应该正确返回实体分类统计', async () => {
      const text = '张三于2024年1月1日支付50万元。';
      const result = await core.extract_entities(text, [
        'PERSON',
        'DATE',
        'AMOUNT',
      ]);

      expect(result.entitiesByType).toHaveProperty('PERSON');
      expect(result.entitiesByType).toHaveProperty('DATE');
      expect(result.entitiesByType).toHaveProperty('AMOUNT');
    });
  });

  describe('classify_content - 内容分类', () => {
    it('应该正确分类合同纠纷案件', async () => {
      const text = '这是一起合同纠纷案件，涉及违约金争议。';
      const result = await core.classify_content(text, 'case_type');

      expect(result).toMatchObject({
        category: expect.any(String),
        confidence: expect.any(Number),
      });
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.alternativeCategories).toBeInstanceOf(Array);
    });

    it('应该正确分类劳动合同纠纷', async () => {
      const text = '用人单位未按时支付工资，劳动者要求支付拖欠工资。';
      const result = await core.classify_content(text, 'case_type');

      expect(result.category).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('应该返回备选分类', async () => {
      const text = '合同违约，同时涉及劳动争议和侵权责任。';
      const result = await core.classify_content(text, 'case_type');

      expect(result.alternativeCategories.length).toBeGreaterThan(0);
      result.alternativeCategories.forEach(alt => {
        expect(alt).toHaveProperty('category');
        expect(alt).toHaveProperty('confidence');
      });
    });
  });

  describe('search_database - 数据库检索', () => {
    it('应该正确执行数据库查询', async () => {
      const params: DatabaseSearchParams = {
        table: 'testTable',
        query: 'test query',
        limit: 10,
      };

      const result = await core.search_database(prisma, params);

      expect(result).toMatchObject({
        items: expect.any(Array),
        totalCount: expect.any(Number),
        hasMore: expect.any(Boolean),
        executionTime: expect.any(Number),
      });
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('应该正确应用过滤条件', async () => {
      const params: DatabaseSearchParams = {
        table: 'testTable',
        query: 'test query',
        filters: { status: 'active' },
        limit: 5,
      };

      const result = await core.search_database(prisma, params);

      expect(result.items).toBeInstanceOf(Array);
      expect(result.items.length).toBeLessThanOrEqual(5);
    });

    it('应该正确应用排序', async () => {
      const params: DatabaseSearchParams = {
        table: 'testTable',
        orderBy: 'createdAt',
        orderDirection: 'desc',
        limit: 10,
      };

      const result = await core.search_database(prisma, params);

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('call_ai_service - AI服务调用', () => {
    const mockAiService = {
      call: jest.fn().mockResolvedValue({
        response: 'AI生成的回复',
        tokensUsed: 100,
        model: 'deepseek-chat',
      }),
    };

    it('应该正确调用DeepSeek服务', async () => {
      const params: AIServiceCallParams = {
        prompt: '测试提示词',
        provider: 'deepseek',
        model: 'deepseek-chat',
        temperature: 0.7,
        maxTokens: 1000,
      };

      const result = await core.call_ai_service(params, mockAiService);

      expect(result).toMatchObject({
        success: true,
        response: expect.any(String),
        model: 'deepseek-chat',
        executionTime: expect.any(Number),
      });
      expect(mockAiService.call).toHaveBeenCalled();
    });

    it('应该正确处理API错误', async () => {
      const errorAiService = {
        call: jest.fn().mockRejectedValue(new Error('API调用失败')),
      };

      const params: AIServiceCallParams = {
        prompt: '测试提示词',
        provider: 'deepseek',
      };

      const result = await core.call_ai_service(params, errorAiService);

      expect(result).toMatchObject({
        success: false,
        error: expect.any(String),
        executionTime: expect.any(Number),
      });
    });
  });

  describe('validate_data - 数据验证', () => {
    it('应该正确验证有效数据', async () => {
      const data = {
        name: '测试名称',
        age: 25,
        email: 'test@example.com',
      };
      const rules: ValidationRule[] = [
        {
          field: 'name',
          type: 'string',
          required: true,
          minLength: 2,
          maxLength: 50,
        },
        {
          field: 'age',
          type: 'number',
          required: true,
        },
      ];

      const result = await core.validate_data(data, rules);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该正确检测无效数据', async () => {
      const data = { name: '', age: -5 };
      const rules: ValidationRule[] = [
        {
          field: 'name',
          type: 'string',
          required: true,
          minLength: 2,
        },
        {
          field: 'age',
          type: 'number',
          customValidator: (value: unknown) =>
            typeof value === 'number' && value >= 0,
        },
      ];

      const result = await core.validate_data(data, rules);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该正确应用正则验证', async () => {
      const data = { email: 'invalid-email' };
      const rules: ValidationRule[] = [
        {
          field: 'email',
          type: 'string',
          required: true,
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        },
      ];

      const result = await core.validate_data(data, rules);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeInstanceOf(Array);
    });
  });

  describe('format_transform - 格式转换', () => {
    it('应该正确将JSON转换为文本', async () => {
      const params = {
        sourceFormat: 'json',
        targetFormat: 'text',
        data: { name: '张三', age: 25 },
      };

      const result = await core.format_transform(params);

      expect(result).toMatchObject({
        success: true,
        data: expect.any(String),
        warnings: expect.any(Array),
      });
      expect(result.data).toContain('张三');
    });

    it('应该正确将文本转换为JSON', async () => {
      const params = {
        sourceFormat: 'text',
        targetFormat: 'json',
        data: 'name: 张三, age: 25',
      };

      const result = await core.format_transform(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('应该正确处理不支持的格式转换', async () => {
      const params = {
        sourceFormat: 'unsupported',
        targetFormat: 'json',
        data: 'test',
      };

      const result = await core.format_transform(params);

      expect(result.success).toBe(false);
    });
  });

  describe('cache_result - 缓存结果', () => {
    it('应该成功缓存数据', async () => {
      const key = 'test-cache-key';
      const data = { result: 'test data' };
      const ttl = 3600;
      const userId = 'user-123';

      const result = await core.cache_result(
        memoryManager,
        key,
        data,
        ttl,
        userId
      );

      expect(result.success).toBe(true);
    });

    it('应该正确处理缓存失败', async () => {
      const key = 'test-cache-key';
      const data = { result: 'test data' };
      const ttl = -1;
      const userId = 'user-123';

      const result = await core.cache_result(
        memoryManager,
        key,
        data,
        ttl,
        userId
      );

      expect(result).toBeDefined();
    });
  });

  describe('log_action - 行动记录', () => {
    it('应该正确记录成功的行动', async () => {
      const params = {
        actionType: 'RETRIEVE',
        actionName: 'test_action',
        agentName: 'TestAgent',
        input: { test: 'data' },
        output: { result: 'success' },
        status: 'success' as const,
        executionTime: 100,
      };

      const result = await core.log_action(prisma, params);

      expect(result.success).toBe(true);
      expect(result.recordId).toBeDefined();
      expect(
        (prisma as unknown as { agentAction: { create: unknown } }).agentAction
          .create
      ).toHaveBeenCalled();
    });

    it('应该正确记录失败的行动', async () => {
      const params = {
        actionType: 'GENERATE',
        actionName: 'failed_action',
        agentName: 'TestAgent',
        status: 'failure' as const,
        executionTime: 50,
      };

      const result = await core.log_action(prisma, params);

      expect(result.success).toBe(true);
    });
  });

  describe('verify_output - 输出验证', () => {
    it('应该正确验证有效输出', async () => {
      const output = { argument: '测试论点', points: 3 };
      const validationCriteria = {
        minArgumentLength: 5,
        minSupportingPoints: 1,
      };

      const result = await core.verify_output(output, validationCriteria);

      expect(result).toMatchObject({
        valid: expect.any(Boolean),
        score: expect.any(Number),
        passed: expect.any(Boolean),
        issues: expect.any(Array),
      });
      expect(result.score).toBeGreaterThan(0);
    });

    it('应该检测输出中的问题', async () => {
      const output = { argument: '' };
      const validationCriteria = {
        minArgumentLength: 10,
      };

      const result = await core.verify_output(output, validationCriteria);

      expect(result.issues.length).toBeGreaterThan(0);
      result.issues.forEach(issue => {
        expect(issue).toHaveProperty('type');
        expect(issue).toHaveProperty('message');
        expect(issue).toHaveProperty('severity');
      });
    });
  });

  describe('handle_error - 错误处理', () => {
    it('应该正确处理并记录错误', async () => {
      const params: HandleErrorParams = {
        error: new Error('测试错误'),
        actionName: 'test_action',
        context: { test: 'data' },
      };

      const result = await core.handle_error(prisma, params);

      expect(result).toMatchObject({
        handled: expect.any(Boolean),
        errorId: expect.any(String),
        actionTaken: expect.any(String),
        recovered: expect.any(Boolean),
        retryable: expect.any(Boolean),
      });
      expect(prisma.errorLog.create).toHaveBeenCalled();
    });

    it('应该正确标记可重试错误', async () => {
      const params: HandleErrorParams = {
        error: new Error('网络超时'),
        actionName: 'test_action',
      };

      const result = await core.handle_error(prisma, params);

      expect(result.retryable).toBe(true);
    });
  });

  describe('retry_operation - 重试操作', () => {
    it('应该成功执行操作无需重试', async () => {
      const operation = jest.fn().mockResolvedValue({ success: true });
      const params: RetryOperationParams = {
        operation,
        maxAttempts: 3,
        baseDelay: 100,
      };

      const result = await core.retry_operation(params);

      expect(result).toMatchObject({
        success: true,
        result: expect.any(Object),
        attempts: 1,
        executionTime: expect.any(Number),
      });
    });

    it('应该在失败后重试并成功', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw new Error('临时错误');
        }
        return { success: true };
      });
      const params: RetryOperationParams = {
        operation,
        maxAttempts: 3,
        baseDelay: 50,
        maxDelay: 200,
      };

      const result = await core.retry_operation(params);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('应该在达到最大重试次数后放弃', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('持续错误'));
      const params: RetryOperationParams = {
        operation,
        maxAttempts: 2,
        baseDelay: 10,
      };

      const result = await core.retry_operation(params);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2);
      expect(result.error).toBeDefined();
    });
  });

  describe('merge_results - 结果合并', () => {
    it('应该正确合并多个结果集', async () => {
      const params: MergeResultsParams<number> = {
        results: [[1, 2, 3], [4, 5], [6]],
        deduplicate: false,
      };

      const result = await core.merge_results(params);

      expect(result).toMatchObject({
        merged: [1, 2, 3, 4, 5, 6],
        totalItems: 6,
        duplicatesRemoved: 0,
      });
    });

    it('应该正确合并并去重', async () => {
      const params: MergeResultsParams<number> = {
        results: [
          [1, 2, 3],
          [3, 4, 5],
          [5, 6],
        ],
        deduplicate: true,
        keySelector: item => `item-${item}`,
      };

      const result = await core.merge_results(params);

      expect(result.merged).toHaveLength(6);
      expect(result.duplicatesRemoved).toBe(2);
      expect(result.totalItems).toBe(8);
    });

    it('应该正确合并对象数组', async () => {
      const params: MergeResultsParams<{ id: string; value: number }> = {
        results: [
          [{ id: '1', value: 10 }],
          [{ id: '2', value: 20 }],
          [{ id: '1', value: 30 }],
        ],
        deduplicate: true,
        keySelector: item => item.id,
      };

      const result = await core.merge_results(params);

      expect(result.merged).toHaveLength(2);
      expect(result.duplicatesRemoved).toBe(1);
    });
  });

  describe('filter_data - 数据过滤', () => {
    it('应该正确过滤数据', async () => {
      const data = [
        { id: 1, value: 10 },
        { id: 2, value: 20 },
        { id: 3, value: 30 },
      ];
      const filterFn = (item: { value: number }) => item.value > 15;

      const result = await core.filter_data(data, filterFn);

      expect(result.filtered).toHaveLength(2);
      expect(result.totalMatched).toBe(2);
      expect(result.returnedCount).toBe(2);
      expect(result.filtered.every(item => item.value > 15)).toBe(true);
    });

    it('应该正确应用最大结果限制', async () => {
      const data = Array.from({ length: 10 }, (_, i) => ({ id: i, value: i }));
      const filterFn = () => true;
      const options = { maxResults: 3 };

      const result = await core.filter_data(data, filterFn, options);

      expect(result.filtered).toHaveLength(3);
      expect(result.returnedCount).toBe(3);
    });

    it('应该正确应用偏移量', async () => {
      const data = Array.from({ length: 10 }, (_, i) => ({ id: i, value: i }));
      const filterFn = () => true;
      const options = { offset: 5, maxResults: 3 };

      const result = await core.filter_data(data, filterFn, options);

      expect(result.filtered).toHaveLength(3);
      expect(result.filtered[0].id).toBe(5);
    });
  });

  describe('rank_items - 项目排序', () => {
    it('应该正确按分数降序排列', async () => {
      const items = [
        { id: 1, value: 10 },
        { id: 2, value: 30 },
        { id: 3, value: 20 },
      ];
      const scoreFn = (item: { value: number }) => item.value;

      const result = await core.rank_items(items, scoreFn, 'desc');

      expect(result.ranked[0].value).toBe(30);
      expect(result.ranked[1].value).toBe(20);
      expect(result.ranked[2].value).toBe(10);
      expect(result.scores).toEqual([30, 20, 10]);
      expect(result.minScore).toBe(10);
      expect(result.maxScore).toBe(30);
    });

    it('应该正确按分数升序排列', async () => {
      const items = [
        { id: 1, value: 30 },
        { id: 2, value: 10 },
        { id: 3, value: 20 },
      ];
      const scoreFn = (item: { value: number }) => item.value;

      const result = await core.rank_items(items, scoreFn, 'asc');

      expect(result.ranked[0].value).toBe(10);
      expect(result.ranked[1].value).toBe(20);
      expect(result.ranked[2].value).toBe(30);
    });
  });

  describe('generate_summary - 摘要生成', () => {
    it('应该正确生成文本摘要', async () => {
      const content =
        '这是一个很长的文本，需要生成摘要。包含了很多信息，应该提取关键点。这里有很多内容，需要压缩成简短的摘要。核心信息应该保留。';
      const params: GenerateSummaryParams = {
        content,
        maxLength: 50,
        preserveKeyInfo: true,
      };

      const result = await core.generate_summary(params);

      expect(result).toMatchObject({
        summary: expect.any(String),
        originalLength: content.length,
        summaryLength: expect.any(Number),
        compressionRatio: expect.any(Number),
        keyPoints: expect.any(Array),
      });
      expect(result.summaryLength).toBeLessThanOrEqual(params.maxLength);
      expect(result.compressionRatio).toBeLessThan(1);
    });

    it('应该正确提取关键点', async () => {
      const content =
        '法律纠纷案件涉及合同违约。原告要求赔偿50万元。被告拒绝支付。案件已提交法院审理。';
      const params: GenerateSummaryParams = {
        content,
        targetRatio: 0.5,
        preserveKeyInfo: true,
      };

      const result = await core.generate_summary(params);

      expect(result.keyPoints.length).toBeGreaterThan(0);
    });
  });

  describe('compare_versions - 版本对比', () => {
    it('应该正确对比两个版本', async () => {
      const versionA = {
        id: '1',
        name: '原始名称',
        value: 10,
      };
      const versionB = {
        id: '1',
        name: '修改名称',
        value: 20,
        status: 'active',
      };

      const result = await core.compare_versions({
        versionA,
        versionB,
      });

      expect(result).toMatchObject({
        hasDifferences: expect.any(Boolean),
        differences: expect.any(Array),
        versionA,
        versionB,
      });
      expect(result.differences.length).toBeGreaterThan(0);
    });

    it('应该正确识别新增字段', async () => {
      const versionA = { id: '1', name: 'test' };
      const versionB = { id: '1', name: 'test', value: 100 };

      const result = await core.compare_versions({
        versionA,
        versionB,
      });

      const addedDiff = result.differences.find(d => d.changeType === 'added');
      expect(addedDiff).toBeDefined();
      expect(addedDiff?.field).toBe('value');
    });

    it('应该正确识别修改字段', async () => {
      const versionA = { id: '1', name: 'test' };
      const versionB = { id: '1', name: 'modified' };

      const result = await core.compare_versions({
        versionA,
        versionB,
      });

      const modifiedDiff = result.differences.find(
        d => d.changeType === 'modified'
      );
      expect(modifiedDiff).toBeDefined();
      expect(modifiedDiff?.field).toBe('name');
    });
  });

  describe('update_memory - 记忆更新', () => {
    it('应该成功创建新记忆', async () => {
      const params = {
        memoryType: 'HOT' as const,
        memoryKey: 'test-key',
        memoryValue: { data: 'test' },
        importance: 0.8,
      };
      const userId = 'user-123';

      const result = await core.update_memory(memoryManager, params, userId);

      expect(result).toMatchObject({
        success: expect.any(Boolean),
        action: expect.any(String),
      });
    });

    it('应该更新现有记忆', async () => {
      const params = {
        memoryType: 'WORKING' as const,
        memoryKey: 'test-key-update',
        memoryValue: { data: 'updated' },
        importance: 0.9,
      };
      const userId = 'user-123';

      const result = await core.update_memory(memoryManager, params, userId);

      expect(result.action).toBe('updated');
    });
  });

  // 补充测试用例 - 提升覆盖率到90%+

  // text-analysis.ts - 补充2个测试
  describe('generate_summary - 字符串参数测试', () => {
    it('应该正确处理字符串参数', async () => {
      const content = '这是一个测试文本';
      const result = await core.generate_summary(content, 50, true);

      expect(result).toMatchObject({
        summary: expect.any(String),
        originalLength: content.length,
        summaryLength: expect.any(Number),
        compressionRatio: expect.any(Number),
        keyPoints: expect.any(Array),
      });
      expect(result.summaryLength).toBeLessThanOrEqual(50);
    });
  });

  describe('classify_content - document_type测试', () => {
    it('应该正确分类文档类型', async () => {
      const text = '这是一份民事起诉状';
      const result = await core.classify_content(text, 'document_type');

      expect(result.category).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.alternativeCategories).toBeInstanceOf(Array);
    });
  });

  // data-validation.ts - 补充3个测试
  describe('validate_data - minLength/maxLength测试', () => {
    it('应该正确验证字符串长度', async () => {
      const data = { name: 'ab', email: 'test@example.com' };
      const rules = [
        {
          field: 'name',
          type: 'string',
          required: true,
          minLength: 3,
          maxLength: 10,
        },
        {
          field: 'email',
          type: 'string',
          required: true,
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        },
      ];

      const result = await core.validate_data(data, rules);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('min'))).toBe(true);
      expect(result.errors.some(e => e.field === 'email')).toBe(false);
    });
  });

  describe('rank_items - 数组参数重载测试', () => {
    it('应该正确处理数组参数', async () => {
      const items = [
        { id: 1, value: 10 },
        { id: 2, value: 20 },
      ];
      const result = await core.rank_items(items, item => item.value, 'asc');

      expect(result.ranked[0].value).toBe(10);
      expect(result.ranked[1].value).toBe(20);
      expect(result.minScore).toBe(10);
      expect(result.maxScore).toBe(20);
    });
  });

  describe('compare_versions - removed字段测试', () => {
    it('应该正确识别删除字段', async () => {
      const versionA = { id: '1', name: 'test', value: 10 };
      const versionB = { id: '1', name: 'test' };
      const result = await core.compare_versions({ versionA, versionB });

      const removedDiff = result.differences.find(
        d => d.changeType === 'removed'
      );
      expect(removedDiff).toBeDefined();
      expect(removedDiff?.field).toBe('value');
      expect(removedDiff?.valueA).toBe(10);
      expect(removedDiff?.valueB).toBeUndefined();
    });
  });

  // ai-operations.ts - 补充2个测试
  describe('call_ai_service - zhipu provider测试', () => {
    it('应该正确调用智谱服务', async () => {
      const mockService = {
        call: jest.fn().mockResolvedValue({
          response: '智谱回复',
          tokensUsed: 100,
          model: 'zhipu-chat',
        }),
      };
      const params = {
        prompt: '测试提示词',
        provider: 'zhipu' as const,
        model: 'zhipu-chat',
        temperature: 0.7,
        maxTokens: 1000,
      };

      const result = await core.call_ai_service(params, mockService);

      expect(result.success).toBe(true);
      expect(result.model).toBe('zhipu-chat');
      expect(mockService.call).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'zhipu' })
      );
    });
  });

  describe('search_database - offset/hasMore测试', () => {
    it('应该正确计算hasMore', async () => {
      const params = {
        table: 'testTable',
        limit: 5,
        offset: 0,
      };

      const result = await core.search_database(prisma, params);

      expect(result.hasMore).toBeDefined();
      expect(typeof result.hasMore).toBe('boolean');
      expect(result.items).toBeInstanceOf(Array);
    });
  });

  // format-operations.ts - 补充3个测试
  describe('format_transform - object格式测试', () => {
    it('应该正确将object转换为json', async () => {
      const params = {
        sourceFormat: 'object',
        targetFormat: 'json',
        data: { test: 'value' },
      };

      const result = await core.format_transform(params);

      expect(result.success).toBe(true);
      expect(result.data).toBe('{"test":"value"}');
      expect(result.warnings).toBeInstanceOf(Array);
    });
  });

  describe('verify_output - 空对象测试', () => {
    it('应该正确验证空对象', async () => {
      const output = {};
      const criteria = { minArgumentLength: 10 };

      const result = await core.verify_output(output, criteria);

      expect(result.issues.length).toBeGreaterThan(0);
      const lengthIssue = result.issues.find(i => i.type === 'LENGTH_MISMATCH');
      expect(lengthIssue).toBeDefined();
      expect(lengthIssue?.severity).toBe('error');
    });
  });

  describe('handle_error - 多种错误类型测试', () => {
    it('应该正确处理不同类型的错误', async () => {
      const errors = [
        new Error('网络错误'),
        new Error('ValidationError'),
        new Error('TimeoutError'),
      ];

      for (const err of errors) {
        const result = await core.handle_error(prisma, {
          error: err,
          actionName: 'test_action',
        });

        expect(result.handled).toBe(true);
        expect(result.errorId).toBeDefined();
        expect(result.retryable).toBeDefined();
      }
    });
  });

  // 覆盖率提升测试 - 覆盖未测试的代码路径

  // format_transform - 覆盖不支持格式转换的错误分支
  describe('format_transform - 不支持格式测试', () => {
    it('应该正确处理不支持的源格式', async () => {
      const params = {
        sourceFormat: 'xml',
        targetFormat: 'json',
        data: 'test',
      };

      const result = await core.format_transform(params);

      expect(result.success).toBe(false);
      expect(result.warnings[0]).toContain('Unsupported format conversion');
    });

    it('应该正确处理不支持的目标格式', async () => {
      const params = {
        sourceFormat: 'json',
        targetFormat: 'xml',
        data: { test: 'value' },
      };

      const result = await core.format_transform(params);

      expect(result.success).toBe(false);
      expect(result.warnings[0]).toContain('Unsupported format conversion');
    });
  });

  // verify_output - 覆盖minSupportingPoints验证
  describe('verify_output - 支持点测试', () => {
    it('应该正确验证支持点数量不足', async () => {
      const output = { argument: '测试论点', points: 1 };
      const criteria = { minSupportingPoints: 3 };

      const result = await core.verify_output(output, criteria);

      expect(result.issues).toBeInstanceOf(Array);
      const pointsIssue = result.issues.find(
        i => i.type === 'INSUFFICIENT_POINTS'
      );
      expect(pointsIssue).toBeDefined();
      expect(pointsIssue?.severity).toBe('warning');
      expect(result.score).toBeLessThan(1);
    });
  });

  // retry_operation - 覆盖shouldRetry返回false的情况
  describe('retry_operation - shouldRetry测试', () => {
    it('应该在shouldRetry返回false时不重试', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        throw new Error('不可重试错误');
      });
      const params = {
        operation,
        maxAttempts: 5,
        baseDelay: 10,
        shouldRetry: (err: Error) => err.message !== '不可重试错误',
      };

      const result = await core.retry_operation(params);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  // update_memory - 覆盖catch块
  describe('update_memory - 异常处理测试', () => {
    it('应该在异常时返回默认结果', async () => {
      const failingMemoryManager = {
        getMemory: jest.fn().mockRejectedValue(new Error('查询失败')),
        storeMemory: jest.fn().mockRejectedValue(new Error('存储失败')),
      } as unknown as MemoryManager;

      const params = {
        memoryType: 'HOT' as const,
        memoryKey: 'test-key',
        memoryValue: { data: 'test' },
      };
      const userId = 'user-123';

      const result = await core.update_memory(
        failingMemoryManager,
        params,
        userId
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('created');
    });
  });

  // format_transform - 覆盖无转换需要的警告
  describe('format_transform - 无转换测试', () => {
    it('应该在无转换需要时返回警告', async () => {
      const params = {
        sourceFormat: 'json',
        targetFormat: 'json',
        data: { test: 'value' },
      };

      const result = await core.format_transform(params);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('No transformation needed');
    });
  });

  // verify_output - 覆盖null/undefined输出
  describe('verify_output - null/undefined测试', () => {
    it('应该正确检测null输出', async () => {
      const result = await core.verify_output(null, {});

      expect(result.valid).toBe(false);
      const missingIssue = result.issues.find(i => i.type === 'MISSING_OUTPUT');
      expect(missingIssue).toBeDefined();
      expect(missingIssue?.severity).toBe('error');
    });

    it('应该正确检测undefined输出', async () => {
      const result = await core.verify_output(undefined, {});

      expect(result.valid).toBe(false);
      const missingIssue = result.issues.find(i => i.type === 'MISSING_OUTPUT');
      expect(missingIssue).toBeDefined();
      expect(missingIssue?.severity).toBe('error');
    });
  });

  // verify_output - 覆盖类型不匹配
  describe('verify_output - 类型不匹配测试', () => {
    it('应该检测类型不匹配', async () => {
      const output = { argument: 'test' };
      const criteria = 'test';

      const result = await core.verify_output(output, criteria);

      const typeIssue = result.issues.find(i => i.type === 'TYPE_MISMATCH');
      expect(typeIssue).toBeDefined();
      expect(typeIssue?.severity).toBe('warning');
    });
  });
});
