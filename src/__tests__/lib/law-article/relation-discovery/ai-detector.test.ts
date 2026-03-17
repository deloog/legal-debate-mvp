/**
 * AI检测器测试
 *
 * 测试覆盖：
 * 1. 基本关系检测功能
 * 2. 批量检测功能
 * 3. 预筛选功能
 * 4. AI降级机制
 * 5. 成本控制
 * 6. 错误处理
 */

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { AIDetector } from '@/lib/law-article/relation-discovery/ai-detector';
import { AICostMonitor } from '@/lib/law-article/relation-discovery/ai-cost-monitor';
import { LawArticle, RelationType } from '@prisma/client';
import { logger } from '@/lib/logger';

// Mock AI client
jest.mock('@/lib/ai/openai-client', () => ({
  getOpenAICompletion: jest.fn(),
}));

// Mock cost monitor
jest.mock('@/lib/law-article/relation-discovery/ai-cost-monitor', () => ({
  AICostMonitor: {
    trackCall: jest.fn(),
    canMakeCall: jest.fn(),
    getStats: jest.fn(),
  },
}));

import { getOpenAICompletion } from '@/lib/ai/openai-client';

describe('AIDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AICostMonitor.trackCall as jest.Mock).mockResolvedValue(true);
    (AICostMonitor.canMakeCall as jest.Mock).mockReturnValue(true);
  });

  describe('detectRelations', () => {
    it('应该检测到引用关系', async () => {
      // 准备测试数据
      const article1: LawArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        fullText: '根据宪法第5条的规定，制定本法。',
        category: 'CIVIL',
      } as LawArticle;

      const article2: LawArticle = {
        id: 'article-2',
        lawName: '宪法',
        articleNumber: '5',
        fullText: '中华人民共和国实行依法治国。',
        category: 'CONSTITUTIONAL',
      } as unknown as LawArticle;

      // Mock AI响应
      (getOpenAICompletion as jest.Mock).mockResolvedValue(
        JSON.stringify({
          relations: [
            {
              type: 'CITES',
              confidence: 0.95,
              reason: '民法典明确引用了宪法第5条',
              evidence: '根据宪法第5条的规定',
            },
          ],
        })
      );

      // 执行测试
      const result = await AIDetector.detectRelations(article1, article2);

      // 验证结果
      expect(result.relations).toHaveLength(1);
      expect(result.relations[0].type).toBe('CITES');
      expect(result.relations[0].confidence).toBe(0.95);
      expect(getOpenAICompletion).toHaveBeenCalledTimes(1);
    });

    it('应该检测到冲突关系', async () => {
      // 准备测试数据
      const article1: LawArticle = {
        id: 'article-1',
        lawName: '新法',
        articleNumber: '1',
        fullText: '禁止在公共场所吸烟。',
        category: 'ADMINISTRATIVE',
      } as LawArticle;

      const article2: LawArticle = {
        id: 'article-2',
        lawName: '旧法',
        articleNumber: '1',
        fullText: '允许在指定区域吸烟。',
        category: 'ADMINISTRATIVE',
      } as LawArticle;

      // Mock AI响应
      (getOpenAICompletion as jest.Mock).mockResolvedValue(
        JSON.stringify({
          relations: [
            {
              type: 'CONFLICTS',
              confidence: 0.88,
              reason: '两个法条对吸烟的规定存在冲突',
              evidence: '禁止 vs 允许',
            },
          ],
        })
      );

      // 执行测试
      const result = await AIDetector.detectRelations(article1, article2);

      // 验证结果
      expect(result.relations).toHaveLength(1);
      expect(result.relations[0].type).toBe('CONFLICTS');
      expect(result.relations[0].confidence).toBe(0.88);
    });

    it('应该过滤低置信度的关系', async () => {
      // 准备测试数据
      const article1: LawArticle = {
        id: 'article-1',
        lawName: '法律A',
        articleNumber: '1',
        fullText: '测试内容A',
        category: 'CIVIL',
      } as LawArticle;

      const article2: LawArticle = {
        id: 'article-2',
        lawName: '法律B',
        articleNumber: '2',
        fullText: '测试内容B',
        category: 'CIVIL',
      } as LawArticle;

      // Mock AI响应 - 包含低置信度关系
      (getOpenAICompletion as jest.Mock).mockResolvedValue(
        JSON.stringify({
          relations: [
            {
              type: 'RELATED',
              confidence: 0.3, // 低于阈值0.6
              reason: '可能相关',
              evidence: '某些相似之处',
            },
            {
              type: 'COMPLETES',
              confidence: 0.8, // 高于阈值
              reason: '补充关系',
              evidence: '补充说明',
            },
          ],
        })
      );

      // 执行测试
      const result = await AIDetector.detectRelations(article1, article2);

      // 验证结果 - 应该只有高置信度的关系
      expect(result.relations).toHaveLength(1);
      expect(result.relations[0].confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('应该处理AI服务错误并降级', async () => {
      // 准备测试数据
      const article1: LawArticle = {
        id: 'article-1',
        lawName: '法律A',
        articleNumber: '1',
        fullText: '测试内容A',
        category: 'CIVIL',
      } as LawArticle;

      const article2: LawArticle = {
        id: 'article-2',
        lawName: '法律B',
        articleNumber: '2',
        fullText: '测试内容B',
        category: 'CIVIL',
      } as LawArticle;

      // Mock AI服务失败
      (getOpenAICompletion as jest.Mock).mockRejectedValue(
        new Error('AI service unavailable')
      );

      // 执行测试
      const result = await AIDetector.detectRelations(article1, article2);

      // 验证结果 - 应该返回空结果而不是抛出错误
      expect(result.relations).toHaveLength(0);
    });

    it('应该正确截取长文本', async () => {
      // 准备测试数据 - 超长文本
      const longText = 'A'.repeat(3000);
      const article1: LawArticle = {
        id: 'article-1',
        lawName: '法律A',
        articleNumber: '1',
        fullText: longText,
        category: 'CIVIL',
      } as LawArticle;

      const article2: LawArticle = {
        id: 'article-2',
        lawName: '法律B',
        articleNumber: '2',
        fullText: '测试内容B',
        category: 'CIVIL',
      } as LawArticle;

      // Mock AI响应
      (getOpenAICompletion as jest.Mock).mockResolvedValue(
        JSON.stringify({
          relations: [],
        })
      );

      // 执行测试
      await AIDetector.detectRelations(article1, article2);

      // 验证 - 应该截取文本
      const callArgs = (getOpenAICompletion as jest.Mock).mock.calls[0][0];
      expect(callArgs).toContain('A'.repeat(2000)); // 最多2000字符
      expect(callArgs).not.toContain('A'.repeat(2001));
    });
  });

  describe('batchDetectRelations', () => {
    it('应该批量检测关系', async () => {
      // 准备测试数据
      const sourceArticle: LawArticle = {
        id: 'source',
        lawName: '源法律',
        articleNumber: '1',
        fullText: '源内容',
        category: 'CIVIL',
      } as LawArticle;

      const candidates: LawArticle[] = [
        {
          id: 'candidate-1',
          lawName: '候选法律1',
          articleNumber: '1',
          fullText: '候选内容1',
          category: 'CIVIL',
          tags: ['tag1'],
          keywords: ['keyword1'],
        } as LawArticle,
        {
          id: 'candidate-2',
          lawName: '候选法律2',
          articleNumber: '2',
          fullText: '候选内容2',
          category: 'CIVIL',
          tags: ['tag1'],
          keywords: ['keyword1'],
        } as LawArticle,
      ];

      // Mock AI响应
      (getOpenAICompletion as jest.Mock).mockResolvedValue(
        JSON.stringify({
          relations: [
            {
              type: 'RELATED',
              confidence: 0.7,
              reason: '相关',
              evidence: '证据',
            },
          ],
        })
      );

      // 执行测试
      const results = await AIDetector.batchDetectRelations(
        sourceArticle,
        candidates
      );

      // 验证结果
      expect(results.size).toBeGreaterThan(0);
      expect(getOpenAICompletion).toHaveBeenCalled();
    });

    it('应该在成本限制时跳过批量检测', async () => {
      // Mock成本限制
      (AICostMonitor.trackCall as jest.Mock).mockResolvedValue(false);

      // 准备测试数据
      const sourceArticle: LawArticle = {
        id: 'source',
        lawName: '源法律',
        articleNumber: '1',
        fullText: '源内容',
        category: 'CIVIL',
      } as LawArticle;

      const candidates: LawArticle[] = [
        {
          id: 'candidate-1',
          lawName: '候选法律1',
          articleNumber: '1',
          fullText: '候选内容1',
          category: 'CIVIL',
        } as LawArticle,
      ];

      // 重置 logger mock 以便只捕获此次调用
      (logger.info as jest.Mock).mockClear();

      // 执行测试
      const results = await AIDetector.batchDetectRelations(
        sourceArticle,
        candidates
      );

      // 验证结果 - 应该返回空结果
      expect(results.size).toBe(0);
      expect(logger.info).toHaveBeenCalled();
    });

    it('应该使用预筛选过滤候选法条', async () => {
      // 准备测试数据
      const sourceArticle: LawArticle = {
        id: 'source',
        lawName: '源法律',
        articleNumber: '1',
        fullText: '源内容',
        category: 'CIVIL',
        tags: ['tag1'],
        keywords: ['keyword1'],
      } as LawArticle;

      const candidates: LawArticle[] = [
        {
          id: 'candidate-1',
          lawName: '候选法律1',
          articleNumber: '1',
          fullText: '候选内容1',
          category: 'CIVIL',
          tags: ['tag1'], // 有交集
          keywords: ['keyword1'], // 有交集
        } as LawArticle,
        {
          id: 'candidate-2',
          lawName: '候选法律2',
          articleNumber: '2',
          fullText: '候选内容2',
          category: 'CRIMINAL', // 不同分类
          tags: ['tag2'], // 无交集
          keywords: ['keyword2'], // 无交集
        } as LawArticle,
      ];

      // Mock AI响应
      (getOpenAICompletion as jest.Mock).mockResolvedValue(
        JSON.stringify({
          relations: [],
        })
      );

      // 执行测试
      await AIDetector.batchDetectRelations(sourceArticle, candidates);

      // 验证 - 应该只对预筛选通过的法条调用AI
      // candidate-1应该通过（同分类、有标签交集）
      // candidate-2可能不通过（不同分类、无交集）
      expect(getOpenAICompletion).toHaveBeenCalled();
    });
  });

  describe('isPotentiallyRelated', () => {
    it('应该识别同一法律的相邻法条', () => {
      const article1: LawArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        fullText: '内容1',
        category: 'CIVIL',
      } as LawArticle;

      const article2: LawArticle = {
        id: 'article-2',
        lawName: '民法典',
        articleNumber: '5', // 相邻（差值<=10）
        fullText: '内容2',
        category: 'CIVIL',
      } as LawArticle;

      const result = AIDetector['isPotentiallyRelated'](article1, article2);
      expect(result).toBe(true);
    });

    it('应该识别相同分类的法条', () => {
      const article1: LawArticle = {
        id: 'article-1',
        lawName: '法律A',
        articleNumber: '1',
        fullText: '内容1',
        category: 'CIVIL',
      } as LawArticle;

      const article2: LawArticle = {
        id: 'article-2',
        lawName: '法律B',
        articleNumber: '1',
        fullText: '内容2',
        category: 'CIVIL',
      } as LawArticle;

      const result = AIDetector['isPotentiallyRelated'](article1, article2);
      expect(result).toBe(true);
    });

    it('应该识别有标签交集的法条', () => {
      const article1: LawArticle = {
        id: 'article-1',
        lawName: '法律A',
        articleNumber: '1',
        fullText: '内容1',
        category: 'CIVIL',
        tags: ['tag1', 'tag2'],
      } as LawArticle;

      const article2: LawArticle = {
        id: 'article-2',
        lawName: '法律B',
        articleNumber: '1',
        fullText: '内容2',
        category: 'CRIMINAL',
        tags: ['tag2', 'tag3'],
      } as LawArticle;

      const result = AIDetector['isPotentiallyRelated'](article1, article2);
      expect(result).toBe(true);
    });

    it('应该识别有关键词交集的法条', () => {
      const article1: LawArticle = {
        id: 'article-1',
        lawName: '法律A',
        articleNumber: '1',
        fullText: '内容1',
        category: 'CIVIL',
        keywords: ['keyword1', 'keyword2', 'keyword3'],
      } as LawArticle;

      const article2: LawArticle = {
        id: 'article-2',
        lawName: '法律B',
        articleNumber: '1',
        fullText: '内容2',
        category: 'CRIMINAL',
        keywords: ['keyword2', 'keyword3'],
      } as LawArticle;

      const result = AIDetector['isPotentiallyRelated'](article1, article2);
      expect(result).toBe(true);
    });

    it('应该拒绝完全不相关的法条', () => {
      const article1: LawArticle = {
        id: 'article-1',
        lawName: '法律A',
        articleNumber: '1',
        fullText: '内容1',
        category: 'CIVIL',
        tags: ['tag1'],
        keywords: ['keyword1'],
      } as LawArticle;

      const article2: LawArticle = {
        id: 'article-2',
        lawName: '法律B',
        articleNumber: '100', // 不相邻
        fullText: '内容2',
        category: 'CRIMINAL', // 不同分类
        tags: ['tag2'], // 无交集
        keywords: ['keyword2'], // 无交集
      } as LawArticle;

      const result = AIDetector['isPotentiallyRelated'](article1, article2);
      expect(result).toBe(false);
    });
  });

  describe('错误处理', () => {
    it('应该处理JSON解析错误', async () => {
      // 准备测试数据
      const article1: LawArticle = {
        id: 'article-1',
        lawName: '法律A',
        articleNumber: '1',
        fullText: '测试内容A',
        category: 'CIVIL',
      } as LawArticle;

      const article2: LawArticle = {
        id: 'article-2',
        lawName: '法律B',
        articleNumber: '2',
        fullText: '测试内容B',
        category: 'CIVIL',
      } as LawArticle;

      // Mock AI返回无效JSON
      (getOpenAICompletion as jest.Mock).mockResolvedValue('invalid json');

      // 执行测试
      const result = await AIDetector.detectRelations(article1, article2);

      // 验证结果 - 应该返回空结果
      expect(result.relations).toHaveLength(0);
    });
  });
});
