/**
 * 增量分析管理器测试
 * 验证完整的增量分析流程
 */

import { IncrementalManager } from '../../../lib/debate/incremental/incremental-manager';
import { generateFingerprint } from '../../../lib/debate/incremental/diff-detector';
import { Material } from '../../../lib/debate/incremental/types';

describe('IncrementalManager', () => {
  let manager: IncrementalManager;

  beforeEach(() => {
    manager = new IncrementalManager();
  });

  describe('完整增量分析流程', () => {
    it('应执行完整的增量分析流程', async () => {
      // 使用固定时间以确保指纹计算一致
      const fixedTime = new Date('2024-01-01T00:00:00.000Z');

      const historicalMaterial: Material = {
        id: '1',
        type: 'DOCUMENT',
        content: '旧文档内容',
        fingerprint: '',
        metadata: { source: 'test', uploadTime: fixedTime },
      };
      // 预先计算指纹（execute会对newMaterials重新计算，历史材料需手动对齐）
      historicalMaterial.fingerprint = generateFingerprint(historicalMaterial);

      const historicalContext = {
        materials: [historicalMaterial],
        analysisResults: {
          documents: [],
          lawArticles: [],
          evidence: [],
        },
      };

      const newMaterials: Material[] = [
        {
          // id='1'，与历史相同内容和元数据 → execute重算后fingerprint一致 → unchanged
          id: '1',
          type: 'DOCUMENT',
          content: '旧文档内容',
          fingerprint: '',
          metadata: { source: 'test', uploadTime: fixedTime },
        },
        {
          id: '2',
          type: 'DOCUMENT',
          content: '新文档内容',
          fingerprint: '',
          metadata: { source: 'test', uploadTime: fixedTime },
        },
      ];

      const input = {
        historicalContext,
        newMaterials,
      };

      const result = await manager.execute(input);

      expect(result.diff.added).toHaveLength(1);
      expect(result.diff.unchanged).toHaveLength(1);
      expect(result.statistics.totalMaterials).toBe(2);
      expect(result.statistics.newMaterials).toBe(1);
      expect(result.statistics.reusedMaterials).toBe(1);
      expect(result.statistics.reuseRate).toBe(0.5);
      expect(result.statistics.timeSaved).toBeGreaterThan(0);
    });

    it('应正确合并上下文', async () => {
      const historicalContext = {
        materials: [],
        analysisResults: {
          documents: [],
          lawArticles: [],
          evidence: [],
        },
      };

      const newMaterials: Material[] = [
        {
          id: '1',
          type: 'DOCUMENT' as const,
          content: '新内容',
          fingerprint: 'hash',
          metadata: {
            source: 'test',
            uploadTime: new Date(),
          },
        },
      ];

      const result = await manager.execute({
        historicalContext,
        newMaterials,
      });

      expect(result.mergedContext.materials).toHaveLength(1);
      expect(result.mergedContext.analysisResults).toBeDefined();
    });
  });

  describe('配置管理', () => {
    it('应正确更新配置', () => {
      const newConfig = {
        diffDetection: {
          enabled: false,
          algorithm: 'semantic' as const,
          similarityThreshold: 0.8,
        },
      };

      manager.updateConfig(newConfig);
      const config = manager.getConfig();

      expect(config.diffDetection.enabled).toBe(false);
      expect(config.diffDetection.algorithm).toBe('semantic');
      expect(config.diffDetection.similarityThreshold).toBe(0.8);
    });

    it('应提供对子组件的访问', () => {
      expect(manager.getDiffDetector()).toBeDefined();
      expect(manager.getIncrementalAnalyzer()).toBeDefined();
      expect(manager.getContextMerger()).toBeDefined();
    });
  });
});
