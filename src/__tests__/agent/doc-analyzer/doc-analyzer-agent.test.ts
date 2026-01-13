/**
 * DocAnalyzerAgent单元测试
 */

import { DocAnalyzerAgent } from '../../../lib/agent/doc-analyzer/doc-analyzer-agent';
import { AgentType } from '../../../types/agent';
import type { AgentContext } from '../../../types/agent';
import type { DocumentAnalysisInput } from '../../../lib/agent/doc-analyzer/core/types';

describe('DocAnalyzerAgent', () => {
  let agent: DocAnalyzerAgent;

  beforeEach(() => {
    agent = new DocAnalyzerAgent();
  });

  describe('基础属性', () => {
    it('应该返回正确的名称', () => {
      expect(agent.name).toBe('DocAnalyzer');
    });

    it('应该返回正确的类型', () => {
      expect(agent.type).toBe(AgentType.DOC_ANALYZER);
    });

    it('应该返回版本号', () => {
      expect(agent.version).toBe('3.0.0');
    });

    it('应该返回描述', () => {
      expect(agent.description).toBe(
        '模块化文档分析智能体，实现五层处理架构和Reviewer审查流程'
      );
    });
  });

  describe('能力描述', () => {
    it('应该返回能力列表', () => {
      const capabilities = agent.getCapabilities();
      expect(capabilities).toContain('DOCUMENT_ANALYSIS');
      expect(capabilities).toContain('TEXT_EXTRACTION');
      expect(capabilities).toContain('STRUCTURED_DATA_EXTRACTION');
      expect(capabilities).toContain('QUALITY_REVIEW');
    });

    it('应该返回支持的任务列表', () => {
      const tasks = agent.getSupportedTasks();
      expect(tasks).toContain('DOCUMENT_PARSE');
      expect(tasks).toContain('DOCUMENT_ANALYZE');
      expect(tasks).toContain('INFO_EXTRACT');
      expect(tasks).toContain('QUALITY_CHECK');
    });

    it('应该返回依赖列表', () => {
      const dependencies = agent.getDependencies();
      expect(dependencies).toEqual([]);
    });

    it('应该返回可选配置列表', () => {
      const optionalConfig = agent.getOptionalConfig();
      expect(optionalConfig).toContain('aiTimeout');
      expect(optionalConfig).toContain('maxRetries');
      expect(optionalConfig).toContain('cacheEnabled');
    });

    it('应该返回处理步骤', () => {
      const steps = agent.getProcessingSteps();
      expect(steps).toHaveLength(7);
      expect(steps[0]).toBe('Input validation');
      expect(steps[1]).toBe('Layer 0: Text extraction');
      expect(steps[2]).toBe('Layer 1: Filter (OCR quality + doc type)');
      expect(steps[3]).toBe('Layer 2: AI core understanding');
      expect(steps[4]).toBe('Layer 3: Rule validation');
      expect(steps[5]).toBe('Layer 4: Reviewer check');
      expect(steps[6]).toBe('Layer 5: Cache');
    });
  });

  describe('生命周期方法', () => {
    it('应该能够初始化', async () => {
      await expect(agent.initialize()).resolves.not.toThrow();
    });

    it('应该能够清理', async () => {
      await expect(agent.cleanup()).resolves.not.toThrow();
    });
  });

  describe('执行逻辑', () => {
    const mockInput: DocumentAnalysisInput = {
      documentId: 'test-doc-001',
      filePath: '/test/path.pdf',
      fileType: 'PDF',
      content: '测试文档内容',
      options: {
        extractParties: true,
        extractClaims: true,
        generateSummary: true,
      },
    };

    const mockContext: AgentContext = {
      task: 'DOCUMENT_ANALYZE',
      taskType: 'DOCUMENT_ANALYZE',

      priority: 'MEDIUM' as any,
      data: mockInput as unknown as Record<string, unknown>,
      userId: 'user-001',
      sessionId: 'session-001',
      requestId: 'request-001',
    };

    it('应该执行文档分析', async () => {
      // 注意：这个测试需要mock所有依赖组件
      // 这里只测试接口调用，实际集成测试会覆盖完整流程
      await expect(agent.execute(mockContext)).resolves.toBeDefined();
    }, 30000);
  });
});
