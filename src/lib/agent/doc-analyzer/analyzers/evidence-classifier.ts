/**
 * EvidenceClassifier - 证据分类器
 *
 * 功能：
 * 1. 确定证据类型（物证、书证、证人证言等）
 * 2. 提取原始证据
 * 3. 从文本中识别证据描述
 */

import type { ExtractedData, EvidenceType } from '../core/types';

// =============================================================================
// EvidenceClassifier类
// =============================================================================

export class EvidenceClassifier {
  private readonly evidenceTypePatterns: Map<EvidenceType, RegExp[]>;

  constructor() {
    this.evidenceTypePatterns = this.initializeEvidencePatterns();
  }

  /**
   * 从各个模块提取原始证据
   */
  extractRawEvidence(
    extractedData: ExtractedData,
    text: string
  ): Map<string, string> {
    const evidence = new Map<string, string>();

    // 从诉讼请求提取证据
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

    // 从争议焦点提取证据
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

    // 从关键事实提取证据
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

    // 从文本中直接提取证据描述
    const textEvidence = this.extractEvidenceFromText(text);
    for (const ev of textEvidence) {
      if (!evidence.has(ev)) {
        evidence.set(ev, '文本直接提取');
      }
    }

    return evidence;
  }

  /**
   * 从文本中提取证据描述
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

    return [...new Set(evidence)]; // 去重
  }

  /**
   * 确定证据类型
   */
  determineEvidenceType(content: string): EvidenceType {
    // 检查每种证据类型的模式
    for (const [type, patterns] of this.evidenceTypePatterns.entries()) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return type;
        }
      }
    }

    // 默认为书证
    return 'DOCUMENTARY_EVIDENCE';
  }

  /**
   * 初始化证据类型模式
   */
  private initializeEvidencePatterns(): Map<EvidenceType, RegExp[]> {
    const patterns = new Map<EvidenceType, RegExp[]>();

    patterns.set('PHYSICAL_EVIDENCE', [
      /物证|实物|原物|样品/gi,
      /照片|录像|录音|录音/gi,
    ]);

    patterns.set('DOCUMENTARY_EVIDENCE', [
      /书证|合同|协议|票据|单据|证明|文件|档案|记录/gi,
      /判决|裁定|决定|裁决|意见书/gi,
    ]);

    patterns.set('WITNESS_TESTIMONY', [
      /证人|证言|陈述|证词/gi,
      /当事人.*说|当事人.*陈述|原告.*表示|被告.*表示/gi,
    ]);

    patterns.set('EXPERT_OPINION', [
      /鉴定|评估|检测|测试|化验|意见/gi,
      /鉴定人|评估人|检测机构/gi,
    ]);

    patterns.set('AUDIO_VIDEO_EVIDENCE', [
      /录像|视频|录音|音频/gi,
      /监控|拍照|摄影/gi,
    ]);

    patterns.set('ELECTRONIC_EVIDENCE', [
      /电子数据|聊天记录|邮件|短信|微信|支付宝/gi,
      /截图|打印件|复制件/gi,
    ]);

    return patterns;
  }
}
