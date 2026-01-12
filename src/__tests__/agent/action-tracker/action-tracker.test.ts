/**
 * ActionTracker集成测试
 */

import { ActionTracker } from '@/lib/agent/action-tracker/action-tracker';
import { actionLogger } from '@/lib/agent/action-tracker/action-logger';
import { performanceAnalyzer } from '@/lib/agent/action-tracker/performance-analyzer';
import { behaviorAnalyzer } from '@/lib/agent/action-tracker/behavior-analyzer';
import { layerStatistics } from '@/lib/agent/action-tracker/layer-statistics';
import { ActionLayer, ActionType } from '@prisma/client';

jest.mock('@/lib/agent/action-tracker/action-logger', () => ({
  actionLogger: {
    logAction: jest.fn(),
    buildActionChain: jest.fn(),
    queryActions: jest.fn(),
    cleanupOldActions: jest.fn(),
  },
}));

jest.mock('@/lib/agent/action-tracker/performance-analyzer', () => ({
  performanceAnalyzer: {
    getPerformanceReport: jest.fn(),
  },
}));

jest.mock('@/lib/agent/action-tracker/behavior-analyzer', () => ({
  behaviorAnalyzer: {
    getBehaviorReport: jest.fn(),
  },
}));

jest.mock('@/lib/agent/action-tracker/layer-statistics', () => ({
  layerStatistics: {
    getLayerReport: jest.fn(),
  },
}));

describe('ActionTracker', () => {
  let tracker: ActionTracker;

  beforeEach(() => {
    tracker = new ActionTracker();
    jest.clearAllMocks();
  });

  describe('配置管理', () => {
    it('应该使用默认配置初始化', () => {
      const config = tracker.getConfig();
      expect(config.autoTrackingEnabled).toBe(true);
      expect(config.performanceAnalysisEnabled).toBe(true);
      expect(config.behaviorAnalysisEnabled).toBe(true);
      expect(config.inefficientThreshold).toBe(5000);
    });

    it('应该能够更新配置', () => {
      tracker.updateConfig({
        autoTrackingEnabled: false,
        inefficientThreshold: 3000,
      });

      const config = tracker.getConfig();
      expect(config.autoTrackingEnabled).toBe(false);
      expect(config.inefficientThreshold).toBe(3000);
    });
  });

  describe('trackAction', () => {
    it('应该追踪并执行行动', async () => {
      const mockResult = { success: true };
      (actionLogger.logAction as jest.Mock).mockResolvedValue(mockResult);

      const input = {
        agentName: 'TestAgent',
        actionType: ActionType.ANALYZE,
        actionName: 'testAction',
        actionLayer: ActionLayer.CORE,
        parameters: {},
      };

      const executeFn = jest.fn().mockResolvedValue(mockResult);
      const result = await tracker.trackAction(input, executeFn);

      expect(result).toEqual(mockResult);
      expect(actionLogger.logAction).toHaveBeenCalledWith(input, executeFn);
    });

    it('当自动追踪禁用时不追踪', async () => {
      tracker.updateConfig({ autoTrackingEnabled: false });

      const mockResult = { success: true };
      const executeFn = jest.fn().mockResolvedValue(mockResult);

      const input = {
        agentName: 'TestAgent',
        actionType: ActionType.ANALYZE,
        actionName: 'testAction',
        actionLayer: ActionLayer.CORE,
        parameters: {},
      };

      const result = await tracker.trackAction(input, executeFn);

      expect(result).toEqual(mockResult);
      expect(actionLogger.logAction).not.toHaveBeenCalled();
    });
  });

  describe('buildActionChain', () => {
    it('应该构建行动链', async () => {
      const mockChain = {
        chainId: 'chain-1',
        rootActionId: 'action-1',
        depth: 2,
        actions: [],
        totalExecutionTime: 1000,
      };

      (actionLogger.buildActionChain as jest.Mock).mockResolvedValue(mockChain);

      const result = await tracker.buildActionChain('action-1');

      expect(result).toEqual(mockChain);
      expect(actionLogger.buildActionChain).toHaveBeenCalledWith('action-1');
    });
  });

  describe('生成报告', () => {
    it('应该生成性能报告', async () => {
      const mockReport = {
        generatedAt: new Date(),
        filters: {},
        overallMetrics: {
          count: 100,
          avgExecutionTime: 500,
          minExecutionTime: 100,
          maxExecutionTime: 2000,
          successRate: 0.95,
          errorRate: 0.05,
          avgRetryCount: 0.1,
        },
        byActionName: new Map(),
        byAgentName: new Map(),
        byActionLayer: new Map(),
      };

      (performanceAnalyzer.getPerformanceReport as jest.Mock).mockResolvedValue(
        mockReport
      );

      const result = await tracker.generatePerformanceReport();

      expect(result).toEqual(mockReport);
      expect(performanceAnalyzer.getPerformanceReport).toHaveBeenCalled();
    });

    it('应该生成行为报告', async () => {
      const mockReport = {
        generatedAt: new Date(),
        filters: {},
        commonPaths: [],
        errorPatterns: [],
        layerPreference: {},
        retryPatterns: new Map(),
      };

      (behaviorAnalyzer.getBehaviorReport as jest.Mock).mockResolvedValue(
        mockReport
      );

      const result = await tracker.generateBehaviorReport();

      expect(result).toEqual(mockReport);
      expect(behaviorAnalyzer.getBehaviorReport).toHaveBeenCalled();
    });

    it('应该生成分层报告', async () => {
      const mockReport = {
        generatedAt: new Date(),
        coreLayer: {
          count: 50,
          avgExecutionTime: 100,
          successRate: 0.98,
          percentage: 50,
          uniqueActions: 10,
          topActions: [],
        },
        utilityLayer: {
          count: 30,
          avgExecutionTime: 300,
          successRate: 0.95,
          percentage: 30,
          uniqueActions: 8,
          topActions: [],
        },
        scriptLayer: {
          count: 20,
          avgExecutionTime: 1000,
          successRate: 0.9,
          percentage: 20,
          uniqueActions: 5,
          topActions: [],
        },
        comparison: {
          coreVsUtilityRatio: 0.33,
          utilityVsScriptRatio: 0.3,
          healthScore: 0.85,
        },
      };

      (layerStatistics.getLayerReport as jest.Mock).mockResolvedValue(
        mockReport
      );

      const result = await tracker.generateLayerReport();

      expect(result).toEqual(mockReport);
      expect(layerStatistics.getLayerReport).toHaveBeenCalled();
    });

    it('应该生成综合报告', async () => {
      const mockPerformanceReport = {
        generatedAt: new Date(),
        filters: {},
        overallMetrics: {
          count: 100,
          avgExecutionTime: 500,
          minExecutionTime: 100,
          maxExecutionTime: 2000,
          successRate: 0.95,
          errorRate: 0.05,
          avgRetryCount: 0.1,
        },
        byActionName: new Map(),
        byAgentName: new Map(),
        byActionLayer: new Map(),
      };

      const mockBehaviorReport = {
        generatedAt: new Date(),
        filters: {},
        commonPaths: [],
        errorPatterns: [],
        layerPreference: {},
        retryPatterns: new Map(),
      };

      const mockLayerReport = {
        generatedAt: new Date(),
        coreLayer: {
          count: 50,
          avgExecutionTime: 100,
          successRate: 0.98,
          percentage: 50,
          uniqueActions: 10,
          topActions: [],
        },
        utilityLayer: {
          count: 30,
          avgExecutionTime: 300,
          successRate: 0.95,
          percentage: 30,
          uniqueActions: 8,
          topActions: [],
        },
        scriptLayer: {
          count: 20,
          avgExecutionTime: 1000,
          successRate: 0.9,
          percentage: 20,
          uniqueActions: 5,
          topActions: [],
        },
        comparison: {
          coreVsUtilityRatio: 0.33,
          utilityVsScriptRatio: 0.3,
          healthScore: 0.85,
        },
      };

      (performanceAnalyzer.getPerformanceReport as jest.Mock).mockResolvedValue(
        mockPerformanceReport
      );
      (behaviorAnalyzer.getBehaviorReport as jest.Mock).mockResolvedValue(
        mockBehaviorReport
      );
      (layerStatistics.getLayerReport as jest.Mock).mockResolvedValue(
        mockLayerReport
      );

      (actionLogger.queryActions as jest.Mock).mockResolvedValue([
        {
          id: 'action-1',
          agentName: 'TestAgent',
          actionName: 'testAction',
          status: 'COMPLETED',
          executionTime: 100,
        },
      ]);

      const filters = {
        includePerformance: true,
        includeBehavior: true,
        includeLayers: true,
      };

      const result = await tracker.generateComprehensiveReport(filters);

      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('filters', filters);
      expect(result).toHaveProperty('performanceReport');
      expect(result).toHaveProperty('behaviorReport');
      expect(result).toHaveProperty('layerReport');
      expect(result).toHaveProperty('summary');
    });
  });

  describe('getRealtimeMetrics', () => {
    it('应该获取实时指标', async () => {
      const mockActions = [
        {
          status: 'RUNNING',
        },
        {
          status: 'COMPLETED',
          executionTime: 100,
        },
        {
          status: 'FAILED',
        },
      ];

      (actionLogger.queryActions as jest.Mock).mockResolvedValue(mockActions);

      const result = await tracker.getRealtimeMetrics();

      expect(result).toHaveProperty('updatedAt');
      expect(result).toHaveProperty('runningActions');
      expect(result).toHaveProperty('recentSuccessCount');
      expect(result).toHaveProperty('recentFailureCount');
      expect(result).toHaveProperty('recentAvgExecutionTime');
      expect(result).toHaveProperty('currentErrorRate');
      expect(result).toHaveProperty('peakConcurrency');
    });
  });

  describe('cleanup', () => {
    it('应该清理过期数据', async () => {
      (actionLogger.cleanupOldActions as jest.Mock).mockResolvedValue(10);

      const result = await tracker.cleanup(30);

      expect(result).toBe(10);
      expect(actionLogger.cleanupOldActions).toHaveBeenCalledWith(30);
    });

    it('应该使用配置中的默认保留天数', async () => {
      (actionLogger.cleanupOldActions as jest.Mock).mockResolvedValue(10);

      await tracker.cleanup();

      expect(actionLogger.cleanupOldActions).toHaveBeenCalledWith(30);
    });
  });
});
