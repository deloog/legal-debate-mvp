/**
 * EvidenceClassifier - 证据分类器
 *
 * 功能：
 * 1. 从已提取数据和文本中收集证据字符串（结构型辅助）
 * 2. 根据关键词将证据映射到枚举类型（元数据分类，非语义法律推理）
 *
 * 注意：determineEvidenceType 使用关键词枚举映射（物证/书证/证人证言/鉴定意见），
 * 这属于结构型元数据分类，不是语义法律分析，无需 AI。
 */

import type { ExtractedData, EvidenceType } from '../core/types';

// =============================================================================
// EvidenceClassifier 类
// =============================================================================

export class EvidenceClassifier {
  /**
   * 从各个模块提取原始证据
   */
  extractRawEvidence(
    extractedData: ExtractedData,
    text: string
  ): Map<string, string> {
    const evidence = new Map<string, string>();

    if (extractedData.claims) {
      for (const claim of extractedData.claims) {
        if (claim.evidence) {
          for (const ev of claim.evidence) {
            if (ev.trim() && !evidence.has(ev)) {
              evidence.set(ev, `诉讼请求证据: ${claim.type}`);
            }
          }
        }
      }
    }

    if (extractedData.disputeFocuses) {
      for (const focus of extractedData.disputeFocuses) {
        if (focus.evidence) {
          for (const ev of focus.evidence) {
            if (ev.trim() && !evidence.has(ev)) {
              evidence.set(ev, `争议焦点证据: ${focus.coreIssue}`);
            }
          }
        }
      }
    }

    if (extractedData.keyFacts) {
      for (const fact of extractedData.keyFacts) {
        if (fact.evidence) {
          for (const ev of fact.evidence) {
            if (ev.trim() && !evidence.has(ev)) {
              evidence.set(ev, `关键事实证据: ${fact.category}`);
            }
          }
        }
      }
    }

    const textEvidence = this.extractEvidenceFromText(text);
    for (const ev of textEvidence) {
      if (!evidence.has(ev)) {
        evidence.set(ev, '文本直接提取');
      }
    }

    return evidence;
  }

  /**
   * 从文本中提取证据描述（正则匹配证据标记词）
   */
  extractEvidenceFromText(text: string): string[] {
    const evidence: string[] = [];
    const patterns = [
      /证据[：:\s]([^\n,。]+)/g,
      /根据\s*《([^》]+)》/g,
      /依据\s*([^\n,。]+)/g,
      /附件[：:\s]([^\n,。]+)/g,
      /材料[：:\s]([^\n,。]+)/g,
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].trim()) {
          evidence.push(match[1].trim());
        }
      }
    }

    return [...new Set(evidence)];
  }

  /**
   * 根据内容关键词确定证据枚举类型（结构型元数据分类）
   * 优先级：物证 > 证人证言 > 鉴定意见 > 书证（默认）
   */
  determineEvidenceType(content: string): EvidenceType {
    if (/物证|实物|照片|录像|录音|监控/.test(content)) {
      return 'PHYSICAL_EVIDENCE';
    }
    if (/证人|证言|陈述|作证|表示/.test(content)) {
      return 'WITNESS_TESTIMONY';
    }
    if (/鉴定|鉴定人|鉴定意见|评估|检测意见/.test(content)) {
      return 'EXPERT_OPINION';
    }
    return 'DOCUMENTARY_EVIDENCE';
  }
}
