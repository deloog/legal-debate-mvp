import { DocAnalyzerAgent } from '@/lib/agent/doc-analyzer';
import { _TaskPriority } from '@/types/agent';

describe('DocAnalyzer Agent - 基础测试', () => {
  let agent: DocAnalyzerAgent;

  beforeEach(() => {
    agent = new DocAnalyzerAgent();
  });

  afterEach(async () => {
    if (agent) {
      await agent.cleanup();
    }
  });

  describe('基础功能', () => {
    test('应该正确初始化Agent', () => {
      expect(agent.name).toBe('DocAnalyzer');
      expect(agent.type).toBe('doc_analyzer');
      expect(agent.version).toBe('3.0.0');
      expect(agent.description).toContain('模块化文档分析智能体');
    });

    test('应该返回正确的能力列表', () => {
      const capabilities = agent.getCapabilities();
      expect(capabilities).toContain('DOCUMENT_ANALYSIS');
      expect(capabilities).toContain('TEXT_EXTRACTION');
      expect(capabilities).toContain('STRUCTURED_DATA_EXTRACTION');
      expect(capabilities).toContain('QUALITY_REVIEW');
    });

    test('应该返回支持的任务列表', () => {
      const tasks = agent.getSupportedTasks();
      expect(tasks).toContain('DOCUMENT_PARSE');
      expect(tasks).toContain('DOCUMENT_ANALYZE');
      expect(tasks).toContain('INFO_EXTRACT');
      expect(tasks).toContain('QUALITY_CHECK');
    });
  });

  describe('Agent元数据', () => {
    test('应该返回正确的依赖关系', () => {
      const deps = agent.getDependencies();
      expect(deps).toEqual([]);
    });

    test('应该返回配置要求', () => {
      const required = agent.getRequiredConfig();
      expect(required).toEqual([]);

      const optional = agent.getOptionalConfig();
      expect(optional).toContain('aiTimeout');
      expect(optional).toContain('maxRetries');
      expect(optional).toContain('cacheEnabled');
    });

    test('应该返回处理步骤', () => {
      const steps = agent.getProcessingSteps();
      expect(steps).toContain('Input validation');
      expect(steps).toContain('Layer 0: Text extraction');
      expect(steps).toContain('Layer 1: Filter (OCR quality + doc type)');
      expect(steps).toContain('Layer 2: AI core understanding');
      expect(steps).toContain('Layer 3: Rule validation');
      expect(steps).toContain('Layer 4: Reviewer check');
      expect(steps).toContain('Layer 5: Cache');
    });
  });
});
