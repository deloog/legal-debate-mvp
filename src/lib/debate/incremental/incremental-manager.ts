/**
 * 增量分析管理器（IncrementalManager）
 * 整合差异识别、增量分析和上下文合并的完整流程
 */

import { DiffDetector, generateFingerprints } from "./diff-detector";
import { IncrementalAnalyzer } from "./incremental-analyzer";
import { ContextMerger } from "./context-merger";
import {
  IncrementalAnalysisInput,
  IncrementalAnalysisResult,
  IncrementalAnalysisConfig,
  DEFAULT_INCREMENTAL_CONFIG,
} from "./types";

/**
 * 增量分析管理器类
 */
export class IncrementalManager {
  private diffDetector: DiffDetector;
  private incrementalAnalyzer: IncrementalAnalyzer;
  private contextMerger: ContextMerger;
  private config: IncrementalAnalysisConfig;

  constructor(config?: Partial<IncrementalAnalysisConfig>) {
    this.config = {
      ...DEFAULT_INCREMENTAL_CONFIG,
      ...config,
    };

    this.diffDetector = new DiffDetector(this.config.diffDetection);
    this.incrementalAnalyzer = new IncrementalAnalyzer(this.config);
    this.contextMerger = new ContextMerger(this.config.merge);
  }

  /**
   * 执行增量分析（主入口）
   */
  async execute(
    input: IncrementalAnalysisInput,
  ): Promise<IncrementalAnalysisResult> {
    const startTime = Date.now();

    // 1. 为新增资料生成指纹
    generateFingerprints(input.newMaterials);

    // 2. 检测差异
    const diff = this.diffDetector.detect(
      input.historicalContext.materials,
      input.newMaterials,
    );

    // 3. 执行增量分析
    const incrementalAnalysis = await this.incrementalAnalyzer.analyze(
      diff,
      input.historicalContext,
    );

    // 4. 合并上下文
    const mergeResult = this.contextMerger.merge(
      diff,
      input.historicalContext,
      incrementalAnalysis,
    );

    // 5. 计算统计信息
    const endTime = Date.now();
    const analysisTime = endTime - startTime;

    const totalMaterials = mergeResult.mergedContext.materials.length;
    const newMaterials = diff.added.length + diff.modified.length;
    const reusedMaterials = diff.unchanged.length;
    const reuseRate = totalMaterials > 0 ? reusedMaterials / totalMaterials : 0;

    // 估算节省的时间（假设每份资料分析需要500ms）
    const estimatedTimePerMaterial = 500;
    const timeSaved = reusedMaterials * estimatedTimePerMaterial;

    const result: IncrementalAnalysisResult = {
      diff,
      incrementalAnalysis,
      mergedContext: mergeResult.mergedContext,
      statistics: {
        totalMaterials,
        newMaterials,
        reusedMaterials,
        reuseRate,
        analysisTime,
        timeSaved,
      },
    };

    return result;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<IncrementalAnalysisConfig>): void {
    this.config = { ...this.config, ...config };

    // 更新子组件配置
    if (config.diffDetection) {
      this.diffDetector.updateConfig(config.diffDetection);
    }
    if (config.merge) {
      this.contextMerger.updateConfig(config.merge);
    }
    if (config.analysis || config.diffDetection || config.merge) {
      this.incrementalAnalyzer.updateConfig(this.config);
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): IncrementalAnalysisConfig {
    return { ...this.config };
  }

  /**
   * 获取差异检测器
   */
  getDiffDetector(): DiffDetector {
    return this.diffDetector;
  }

  /**
   * 获取增量分析器
   */
  getIncrementalAnalyzer(): IncrementalAnalyzer {
    return this.incrementalAnalyzer;
  }

  /**
   * 获取上下文合并器
   */
  getContextMerger(): ContextMerger {
    return this.contextMerger;
  }
}

/**
 * 工厂函数：创建增量分析管理器
 */
export function createIncrementalManager(
  config?: Partial<IncrementalAnalysisConfig>,
): IncrementalManager {
  return new IncrementalManager(config);
}

/**
 * 快捷函数：执行增量分析
 */
export async function executeIncrementalAnalysis(
  input: IncrementalAnalysisInput,
  config?: Partial<IncrementalAnalysisConfig>,
): Promise<IncrementalAnalysisResult> {
  const manager = createIncrementalManager(config);
  return manager.execute(input);
}
