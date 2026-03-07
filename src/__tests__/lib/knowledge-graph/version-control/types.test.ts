/**
 * 知识图谱版本控制 - 类型定义测试
 *
 * 测试范围：
 * - SnapshotVersion 枚举
 * - SnapshotStatus 枚举
 * - GraphSnapshot 类型
 * - SnapshotStatistics 类型
 * - CreateSnapshotInput 类型
 * - SnapshotComparisonResult 类型
 * - 相关配置类型
 */
import {
  SnapshotVersion,
  SnapshotStatus,
  GraphSnapshot,
  SnapshotStatistics,
  CreateSnapshotInput,
  SnapshotComparisonResult,
  SnapshotVersionInfo,
  DEFAULT_SNAPSHOT_CONFIG,
  validateSnapshotInput,
  calculateSnapshotVersion,
  compareSnapshots,
  formatSnapshotDate,
  parseSnapshotVersion,
} from '@/lib/knowledge-graph/version-control/types';

describe('Version Control Types', () => {
  describe('SnapshotVersion', () => {
    it('应该包含所有预定义的版本类型', () => {
      expect(SnapshotVersion.DAILY).toBe('DAILY');
      expect(SnapshotVersion.WEEKLY).toBe('WEEKLY');
      expect(SnapshotVersion.MONTHLY).toBe('MONTHLY');
      expect(SnapshotVersion.MANUAL).toBe('MANUAL');
    });

    it('应该支持所有版本类型的字符串值', () => {
      const versions = [
        SnapshotVersion.DAILY,
        SnapshotVersion.WEEKLY,
        SnapshotVersion.MONTHLY,
        SnapshotVersion.MANUAL,
      ];
      versions.forEach(version => {
        expect(Object.values(SnapshotVersion)).toContain(version);
      });
    });
  });

  describe('SnapshotStatus', () => {
    it('应该包含所有预定义的状态类型', () => {
      expect(SnapshotStatus.COMPLETED).toBe('COMPLETED');
      expect(SnapshotStatus.IN_PROGRESS).toBe('IN_PROGRESS');
      expect(SnapshotStatus.FAILED).toBe('FAILED');
    });

    it('应该支持所有状态类型的字符串值', () => {
      const statuses: SnapshotStatus[] = ['COMPLETED', 'IN_PROGRESS', 'FAILED'];
      statuses.forEach(status => {
        expect(Object.values(SnapshotStatus)).toContain(status);
      });
    });
  });

  describe('GraphSnapshot', () => {
    it('应该正确构建快照对象', () => {
      const snapshot: GraphSnapshot = {
        id: 'snapshot-123',
        version: 'DAILY',
        snapshotDate: new Date('2026-02-25'),
        versionLabel: 'v2026.02.25',
        statistics: {
          totalArticles: 1000,
          totalRelations: 5000,
          verifiedRelations: 4500,
          pendingRelations: 500,
          averageConfidence: 0.85,
        },
        status: 'COMPLETED',
        createdBy: 'system',
        createdAt: new Date('2026-02-25T10:00:00Z'),
        updatedAt: new Date('2026-02-25T10:00:00Z'),
      };

      expect(snapshot.id).toBe('snapshot-123');
      expect(snapshot.version).toBe('DAILY');
      expect(snapshot.statistics.totalArticles).toBe(1000);
      expect(snapshot.status).toBe('COMPLETED');
    });

    it('应该允许snapshotData为可选', () => {
      const snapshot: GraphSnapshot = {
        id: 'snapshot-456',
        version: 'WEEKLY',
        snapshotDate: new Date('2026-02-24'),
        versionLabel: 'v2026.08',
        statistics: {
          totalArticles: 800,
          totalRelations: 4000,
          verifiedRelations: 3500,
          pendingRelations: 500,
          averageConfidence: 0.8,
        },
        status: 'COMPLETED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(snapshot.snapshotData).toBeUndefined();
    });

    it('应该支持完整的快照数据', () => {
      const snapshotData = {
        nodes: [
          { id: 'article-1', label: '民法典第1条' },
          { id: 'article-2', label: '民法典第2条' },
        ],
        edges: [
          { source: 'article-1', target: 'article-2', relationType: 'CITES' },
        ],
      };

      const snapshot: GraphSnapshot = {
        id: 'snapshot-789',
        version: 'MANUAL',
        snapshotDate: new Date('2026-02-23'),
        versionLabel: 'v2026.02.23.manual',
        statistics: {
          totalArticles: 2,
          totalRelations: 1,
          verifiedRelations: 1,
          pendingRelations: 0,
          averageConfidence: 1.0,
        },
        snapshotData,
        status: 'COMPLETED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(snapshot.snapshotData).toBeDefined();
      expect(snapshot.snapshotData?.nodes).toHaveLength(2);
      expect(snapshot.snapshotData?.edges).toHaveLength(1);
    });

    it('应该支持changes字段记录版本变更', () => {
      const changes: Array<{
        type: 'ADDED' | 'MODIFIED' | 'REMOVED';
        entityType: 'article' | 'relation';
        entityId: string;
        description: string;
      }> = [
        {
          type: 'ADDED',
          entityType: 'relation',
          entityId: 'rel-123',
          description: '新增关系：民法典第1条 -> 民法典第2条',
        },
        {
          type: 'MODIFIED',
          entityType: 'article',
          entityId: 'article-456',
          description: '修改法条：合同法第45条内容更新',
        },
      ];

      const snapshot: GraphSnapshot = {
        id: 'snapshot-101',
        version: SnapshotVersion.DAILY,
        snapshotDate: new Date('2026-02-25'),
        versionLabel: 'v2026.02.25',
        statistics: {
          totalArticles: 100,
          totalRelations: 500,
          verifiedRelations: 450,
          pendingRelations: 50,
          averageConfidence: 0.9,
        },
        changes,
        status: SnapshotStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(snapshot.changes).toBeDefined();
      expect(snapshot.changes).toHaveLength(2);
      expect(snapshot.changes?.[0].type).toBe('ADDED');
      expect(snapshot.changes?.[1].type).toBe('MODIFIED');
    });
  });

  describe('SnapshotStatistics', () => {
    it('应该正确构建统计数据', () => {
      const stats: SnapshotStatistics = {
        totalArticles: 1000,
        totalRelations: 5000,
        verifiedRelations: 4500,
        pendingRelations: 500,
        averageConfidence: 0.85,
      };

      expect(stats.totalArticles).toBe(1000);
      expect(stats.totalRelations).toBe(5000);
      expect(stats.verifiedRelations).toBe(4500);
      expect(stats.averageConfidence).toBe(0.85);
    });

    it('应该支持可选字段', () => {
      const stats: SnapshotStatistics = {
        totalArticles: 500,
        totalRelations: 2500,
      };

      expect(stats.verifiedRelations).toBeUndefined();
      expect(stats.pendingRelations).toBeUndefined();
      expect(stats.averageConfidence).toBeUndefined();
    });
  });

  describe('CreateSnapshotInput', () => {
    it('应该正确构建创建快照输入', () => {
      const input: CreateSnapshotInput = {
        version: 'DAILY',
        includeFullData: true,
        description: '每日快照',
      };

      expect(input.version).toBe('DAILY');
      expect(input.includeFullData).toBe(true);
      expect(input.description).toBe('每日快照');
    });

    it('应该允许可选字段为空', () => {
      const input: CreateSnapshotInput = {
        version: 'MANUAL',
      };

      expect(input.includeFullData).toBeUndefined();
      expect(input.description).toBeUndefined();
      expect(input.includeChanges).toBeUndefined();
    });
  });

  describe('SnapshotComparisonResult', () => {
    it('应该正确构建快照比较结果', () => {
      const result: SnapshotComparisonResult = {
        snapshot1Id: 'snapshot-1',
        snapshot2Id: 'snapshot-2',
        comparisonDate: new Date('2026-02-25'),
        differences: {
          articlesAdded: 10,
          articlesRemoved: 5,
          articlesModified: 3,
          relationsAdded: 50,
          relationsRemoved: 20,
          relationsModified: 10,
        },
        statistics: {
          totalArticles: 1000,
          totalRelations: 5000,
          verifiedRelations: 4500,
          pendingRelations: 500,
          averageConfidence: 0.85,
        },
        trends: {
          articlesGrowthRate: 1.05,
          relationsGrowthRate: 1.08,
          verificationRate: 0.9,
        },
      };

      expect(result.differences.articlesAdded).toBe(10);
      expect(result.differences.relationsAdded).toBe(50);
      expect(result.trends.articlesGrowthRate).toBe(1.05);
    });
  });

  describe('DEFAULT_SNAPSHOT_CONFIG', () => {
    it('应该包含默认配置', () => {
      expect(DEFAULT_SNAPSHOT_CONFIG.maxSnapshots).toBe(100);
      expect(DEFAULT_SNAPSHOT_CONFIG.autoCleanup).toBe(true);
      expect(DEFAULT_SNAPSHOT_CONFIG.retentionDays).toBe(90);
    });

    it('应该支持可选参数', () => {
      expect(DEFAULT_SNAPSHOT_CONFIG.includeFullDataByDefault).toBeDefined();
      expect(DEFAULT_SNAPSHOT_CONFIG.compressionEnabled).toBeDefined();
    });
  });

  describe('validateSnapshotInput', () => {
    it('应该验证有效的快照输入', () => {
      const validInput: CreateSnapshotInput = {
        version: 'WEEKLY',
        includeFullData: false,
      };

      expect(validateSnapshotInput(validInput)).toBe(true);
    });

    it('应该拒绝无效的版本类型', () => {
      const invalidInput = {
        version: 'INVALID_VERSION',
      } as unknown as CreateSnapshotInput;

      expect(validateSnapshotInput(invalidInput)).toBe(false);
    });

    it('应该拒绝空的版本字段', () => {
      const invalidInput = {
        version: '',
      } as unknown as CreateSnapshotInput;

      expect(validateSnapshotInput(invalidInput)).toBe(false);
    });
  });

  describe('calculateSnapshotVersion', () => {
    it('应该为每日快照生成正确的版本标签', () => {
      const date = new Date('2026-02-25');
      const version = calculateSnapshotVersion('DAILY', date);
      expect(version).toBe('v2026.02.25');
    });

    it('应该为每周快照生成正确的版本标签', () => {
      const date = new Date('2026-02-25');
      const version = calculateSnapshotVersion('WEEKLY', date);
      // 2026年2月25日是第9周
      expect(version).toBe('v2026.09');
    });

    it('应该为每月快照生成正确的版本标签', () => {
      const date = new Date('2026-02-25');
      const version = calculateSnapshotVersion('MONTHLY', date);
      expect(version).toBe('v2026.02');
    });

    it('应该为手动快照生成带时间戳的版本标签', () => {
      const date = new Date('2026-02-25T10:30:00Z');
      const version = calculateSnapshotVersion('MANUAL', date);
      expect(version).toContain('v2026.02.25');
      expect(version).toContain('manual');
    });
  });

  describe('compareSnapshots', () => {
    it('应该正确比较两个快照', () => {
      const snapshot1: GraphSnapshot = {
        id: 'snapshot-1',
        version: 'DAILY',
        snapshotDate: new Date('2026-02-24'),
        versionLabel: 'v2026.02.24',
        statistics: {
          totalArticles: 900,
          totalRelations: 4500,
          verifiedRelations: 4000,
          pendingRelations: 500,
          averageConfidence: 0.8,
        },
        status: 'COMPLETED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const snapshot2: GraphSnapshot = {
        id: 'snapshot-2',
        version: 'DAILY',
        snapshotDate: new Date('2026-02-25'),
        versionLabel: 'v2026.02.25',
        statistics: {
          totalArticles: 1000,
          totalRelations: 5000,
          verifiedRelations: 4500,
          pendingRelations: 500,
          averageConfidence: 0.85,
        },
        status: 'COMPLETED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = compareSnapshots(snapshot1, snapshot2);

      expect(result.differences.articlesAdded).toBe(100);
      expect(result.differences.relationsAdded).toBe(500);
      expect(result.trends.articlesGrowthRate).toBeCloseTo(1.111, 2);
    });

    it('应该处理快照数据为空的情况', () => {
      const snapshot1: GraphSnapshot = {
        id: 'snapshot-1',
        version: 'DAILY',
        snapshotDate: new Date('2026-02-24'),
        versionLabel: 'v2026.02.24',
        statistics: {
          totalArticles: 1000,
          totalRelations: 5000,
          verifiedRelations: 4500,
          pendingRelations: 500,
          averageConfidence: 0.85,
        },
        status: 'COMPLETED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = compareSnapshots(snapshot1, snapshot1);

      expect(result.differences.articlesAdded).toBe(0);
      expect(result.differences.relationsAdded).toBe(0);
    });
  });

  describe('formatSnapshotDate', () => {
    it('应该格式化日期为可读字符串', () => {
      const date = new Date('2026-02-25T10:30:00Z');
      const formatted = formatSnapshotDate(date);
      expect(formatted).toContain('2026');
      expect(formatted).toContain('02');
      expect(formatted).toContain('25');
    });
  });

  describe('parseSnapshotVersion', () => {
    it('应该解析每日版本标签', () => {
      const version = parseSnapshotVersion('v2026.02.25');
      expect(version.type).toBe('DAILY');
      expect(version.date).toBeTruthy();
    });

    it('应该解析每周版本标签', () => {
      // 13-53周解析为WEEKLY
      const version = parseSnapshotVersion('v2026.13');
      expect(version.type).toBe('WEEKLY');
    });

    it('应该解析每月版本标签', () => {
      // 1-12解析为MONTHLY
      const version = parseSnapshotVersion('v2026.08');
      expect(version.type).toBe('MONTHLY');
    });

    it('应该解析手动版本标签', () => {
      const version = parseSnapshotVersion('v2026.02.25.manual');
      expect(version.type).toBe('MANUAL');
    });

    it('应该处理无效的版本标签', () => {
      const version = parseSnapshotVersion('invalid-version');
      expect(version.type).toBeUndefined();
    });
  });
});
