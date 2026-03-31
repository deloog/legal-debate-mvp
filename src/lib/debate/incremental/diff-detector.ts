/**
 * 差异识别器（DiffDetector）
 * 用于识别新旧资料之间的差异，支持多种算法
 */

import { createHash } from 'crypto';
import {
  Material,
  DiffResult,
  IncrementalAnalysisConfig,
  DEFAULT_INCREMENTAL_CONFIG,
} from './types';

/**
 * 差异识别器类
 */
export class DiffDetector {
  private config: IncrementalAnalysisConfig['diffDetection'];

  constructor(config?: Partial<IncrementalAnalysisConfig['diffDetection']>) {
    this.config = {
      ...DEFAULT_INCREMENTAL_CONFIG.diffDetection,
      ...config,
    };
  }

  /**
   * 计算文本相似度（使用编辑距离）
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0 && len2 === 0) return 1.0;
    if (len1 === 0 || len2 === 0) return 0.0;

    // 优化：如果字符串完全相同
    if (str1 === str2) return 1.0;

    // 使用动态规划计算编辑距离
    const dp: number[][] = [];
    for (let i = 0; i <= len1; i++) {
      dp[i] = [];
      dp[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      dp[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // 删除
          dp[i][j - 1] + 1, // 插入
          dp[i - 1][j - 1] + cost // 替换
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return 1.0 - dp[len1][len2] / maxLen;
  }

  /**
   * 基于指纹检测差异
   */
  private detectByFingerprint(
    oldMaterials: Material[],
    newMaterials: Material[]
  ): DiffResult {
    const result: DiffResult = {
      added: [],
      modified: [],
      deleted: [],
      unchanged: [],
    };

    const oldMap = new Map<string, Material>();
    oldMaterials.forEach(m => oldMap.set(m.id, m));

    const newMap = new Map<string, Material>();
    newMaterials.forEach(m => newMap.set(m.id, m));

    // 检查新资料
    for (const newMaterial of newMaterials) {
      const oldMaterial = oldMap.get(newMaterial.id);

      if (!oldMaterial) {
        // 新增资料
        result.added.push(newMaterial);
      } else if (
        oldMaterial.fingerprint !== newMaterial.fingerprint ||
        oldMaterial.content !== newMaterial.content
      ) {
        // 修改资料
        result.modified.push(newMaterial);
      } else {
        // 未变更资料
        result.unchanged.push(newMaterial);
      }
    }

    // 检查删除资料
    for (const oldMaterial of oldMaterials) {
      if (!newMap.has(oldMaterial.id)) {
        result.deleted.push(oldMaterial);
      }
    }

    return result;
  }

  /**
   * 基于语义相似度检测差异
   */
  private detectBySemantic(
    oldMaterials: Material[],
    newMaterials: Material[]
  ): DiffResult {
    const result: DiffResult = {
      added: [],
      modified: [],
      deleted: [],
      unchanged: [],
    };

    const oldMap = new Map<string, Material>();
    oldMaterials.forEach(m => oldMap.set(m.id, m));

    const newMap = new Map<string, Material>();
    newMaterials.forEach(m => newMap.set(m.id, m));

    // 检查新资料
    for (const newMaterial of newMaterials) {
      const oldMaterial = oldMap.get(newMaterial.id);

      if (!oldMaterial) {
        // 新增资料
        result.added.push(newMaterial);
      } else {
        // 计算相似度
        const similarity = this.calculateSimilarity(
          oldMaterial.content,
          newMaterial.content
        );

        if (similarity < this.config.similarityThreshold) {
          // 修改资料（相似度低于阈值）
          result.modified.push(newMaterial);
        } else {
          // 未变更资料
          result.unchanged.push(newMaterial);
        }
      }
    }

    // 检查删除资料
    for (const oldMaterial of oldMaterials) {
      if (!newMap.has(oldMaterial.id)) {
        result.deleted.push(oldMaterial);
      }
    }

    return result;
  }

  /**
   * 混合算法：先使用指纹快速匹配，再用语义相似度验证
   */
  private detectByHybrid(
    oldMaterials: Material[],
    newMaterials: Material[]
  ): DiffResult {
    // 先用指纹检测
    const fingerprintResult = this.detectByFingerprint(
      oldMaterials,
      newMaterials
    );

    // 对指纹识别为"修改"的资料，用语义相似度进一步验证
    const verifiedModified: Material[] = [];
    const reclassifiedAsUnchanged: Material[] = [];

    for (const modified of fingerprintResult.modified) {
      const oldMaterial = oldMaterials.find(m => m.id === modified.id);
      if (oldMaterial) {
        const similarity = this.calculateSimilarity(
          oldMaterial.content,
          modified.content
        );

        if (similarity >= this.config.similarityThreshold) {
          // 虽然指纹不同，但内容语义相似，视为未变更
          reclassifiedAsUnchanged.push(modified);
        } else {
          // 确实是修改
          verifiedModified.push(modified);
        }
      } else {
        verifiedModified.push(modified);
      }
    }

    return {
      added: fingerprintResult.added,
      modified: verifiedModified,
      deleted: fingerprintResult.deleted,
      unchanged: [...fingerprintResult.unchanged, ...reclassifiedAsUnchanged],
    };
  }

  /**
   * 检测差异（主入口）
   */
  detect(oldMaterials: Material[], newMaterials: Material[]): DiffResult {
    if (!this.config.enabled) {
      // 未启用差异检测，假设全部新增
      return {
        added: [...newMaterials],
        modified: [],
        deleted: [],
        unchanged: [],
      };
    }

    // 根据算法选择检测方式
    switch (this.config.algorithm) {
      case 'fingerprint':
        return this.detectByFingerprint(oldMaterials, newMaterials);
      case 'semantic':
        return this.detectBySemantic(oldMaterials, newMaterials);
      case 'hybrid':
        return this.detectByHybrid(oldMaterials, newMaterials);
      default:
        return this.detectByFingerprint(oldMaterials, newMaterials);
    }
  }

  /**
   * 更新配置
   */
  updateConfig(
    config: Partial<IncrementalAnalysisConfig['diffDetection']>
  ): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): IncrementalAnalysisConfig['diffDetection'] {
    return { ...this.config };
  }
}

/**
 * 工具函数：为资料生成指纹
 */
export function generateFingerprint(material: Material): string {
  const hash = createHash('md5');
  hash.update(material.content);
  if (material.metadata) {
    hash.update(JSON.stringify(material.metadata));
  }
  return hash.digest('hex');
}

/**
 * 工具函数：批量生成指纹
 */
export function generateFingerprints(
  materials: Material[]
): Map<string, string> {
  const fingerprintMap = new Map<string, string>();
  for (const material of materials) {
    const fingerprint = generateFingerprint(material);
    material.fingerprint = fingerprint;
    fingerprintMap.set(material.id, fingerprint);
  }
  return fingerprintMap;
}
