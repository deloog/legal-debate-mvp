/**
 * 证据链分析服务
 *
 * 功能：
 * - 使用AI分析证据之间的关联性
 * - 构建完整证据链结构
 * - 计算证据链完整性
 * - 识别证据链缺口
 * - 提供证据收集建议
 */

import type { Evidence } from '@prisma/client';
import { AIService } from '@/lib/ai/clients';

/**
 * 证据链分析输入
 */
export interface EvidenceChainAnalysisInput {
  caseId: string;
  evidences: Evidence[];
  targetFact: string; // 待证明的事实
}

/**
 * 证据链节点
 */
export interface EvidenceChainNode {
  evidenceId: string;
  evidenceName: string;
  role: string; // 在证据链中的作用
  proves: string; // 证明什么
  strength: 'strong' | 'medium' | 'weak'; // 证据强度
}

/**
 * 证据关联关系
 */
export interface EvidenceConnection {
  from: string; // 证据A ID
  to: string; // 证据B ID
  relationship: string; // 关联关系描述
}

/**
 * 证据链分析结果
 */
export interface EvidenceChainAnalysisResult {
  chains: EvidenceChainNode[]; // 证据链结构
  connections: EvidenceConnection[]; // 关联关系
  completeness: number; // 完整性 0-100
  gaps: string[]; // 证据链缺口
  suggestions: string[]; // 建议
}

/**
 * AI响应结构
 */
interface AIAnalysisResponse {
  chains: EvidenceChainNode[];
  connections: EvidenceConnection[];
  completeness: number;
  gaps: string[];
  suggestions: string[];
}

/**
 * 证据链分析服务类
 */
export class EvidenceChainService {
  constructor() {
    // AIService是静态类，不需要实例化
  }

  /**
   * 分析证据链
   */
  async analyzeChain(
    input: EvidenceChainAnalysisInput
  ): Promise<EvidenceChainAnalysisResult> {
    // 验证输入
    this.validateInput(input);

    // 处理空证据列表
    if (input.evidences.length === 0) {
      return {
        chains: [],
        connections: [],
        completeness: 0,
        gaps: ['缺少任何证据材料'],
        suggestions: ['请上传相关证据材料以建立证据链'],
      };
    }

    // 生成AI提示词
    const prompt = this.buildAnalysisPrompt(input);

    try {
      // 调用AI服务
      const aiResponse = await AIService.analyzeDocument(
        prompt,
        'evidence-chain'
      );

      // 解析AI响应
      const result = this.parseAIResponse(aiResponse.content);

      return result;
    } catch (error) {
      console.error('证据链分析失败:', error);
      throw new Error(
        `证据链分析失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 验证输入参数
   */
  private validateInput(input: EvidenceChainAnalysisInput): void {
    if (!input.caseId) {
      throw new Error('案件ID不能为空');
    }

    if (!input.targetFact || input.targetFact.trim() === '') {
      throw new Error('待证明事实不能为空');
    }

    if (!Array.isArray(input.evidences)) {
      throw new Error('证据列表必须是数组');
    }

    // 验证证据数据完整性
    for (const evidence of input.evidences) {
      if (!evidence.id || !evidence.name || !evidence.type) {
        throw new Error('证据数据不完整，缺少必要字段');
      }
    }
  }

  /**
   * 构建AI分析提示词
   */
  private buildAnalysisPrompt(input: EvidenceChainAnalysisInput): string {
    const { evidences, targetFact } = input;

    // 构建证据列表描述
    const evidenceList = evidences
      .map((e, index) => {
        return `${index + 1}. 【${e.name}】
   - 类型: ${this.getEvidenceTypeLabel(e.type)}
   - 描述: ${e.description || '无'}
   - 状态: ${this.getEvidenceStatusLabel(e.status)}
   - 相关性评分: ${e.relevanceScore || '未评分'}`;
      })
      .join('\n\n');

    return `请分析以下证据链，目标是证明：${targetFact}

## 证据列表
${evidenceList}

## 分析要求
请从以下几个方面进行分析：

1. **证据链结构**：分析每个证据在证据链中的作用和地位
2. **证据关联**：识别证据之间的关联关系（相互印证、补充、矛盾等）
3. **完整性评估**：评估证据链的完整性（0-100分）
4. **缺口识别**：指出证据链中存在的缺口
5. **收集建议**：提供补充证据的建议

## 输出格式
请严格按照以下JSON格式输出（不要包含任何其他文字）：

\`\`\`json
{
  "chains": [
    {
      "evidenceId": "证据ID",
      "evidenceName": "证据名称",
      "role": "在证据链中的作用",
      "proves": "证明什么事实",
      "strength": "strong|medium|weak"
    }
  ],
  "connections": [
    {
      "from": "证据A的ID",
      "to": "证据B的ID",
      "relationship": "关联关系描述"
    }
  ],
  "completeness": 85,
  "gaps": [
    "缺口描述1",
    "缺口描述2"
  ],
  "suggestions": [
    "建议1",
    "建议2"
  ]
}
\`\`\`

注意：
- chains数组应包含所有证据的分析
- connections数组描述证据之间的关联
- completeness是0-100的整数
- gaps和suggestions应具体明确
- 必须返回有效的JSON格式`;
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(response: string): EvidenceChainAnalysisResult {
    try {
      // 提取JSON内容（处理可能的markdown代码块）
      let jsonStr = response.trim();

      // 移除markdown代码块标记
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // 解析JSON
      const parsed: AIAnalysisResponse = JSON.parse(jsonStr);

      // 验证响应结构
      if (!parsed.chains || !Array.isArray(parsed.chains)) {
        throw new Error('AI响应缺少chains字段');
      }

      if (!parsed.connections || !Array.isArray(parsed.connections)) {
        throw new Error('AI响应缺少connections字段');
      }

      if (typeof parsed.completeness !== 'number') {
        throw new Error('AI响应缺少completeness字段');
      }

      if (!parsed.gaps || !Array.isArray(parsed.gaps)) {
        throw new Error('AI响应缺少gaps字段');
      }

      if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
        throw new Error('AI响应缺少suggestions字段');
      }

      // 确保completeness在0-100范围内
      const completeness = Math.max(0, Math.min(100, parsed.completeness));

      return {
        chains: parsed.chains,
        connections: parsed.connections,
        completeness,
        gaps: parsed.gaps,
        suggestions: parsed.suggestions,
      };
    } catch (error) {
      console.error('解析AI响应失败:', error);
      console.error('原始响应:', response);
      throw new Error(
        `解析AI响应失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 获取证据类型标签
   */
  private getEvidenceTypeLabel(type: string): string {
    const typeMap: Record<string, string> = {
      DOCUMENT: '书证',
      PHYSICAL: '物证',
      WITNESS: '证人证言',
      AUDIO: '视听资料',
      ELECTRONIC: '电子数据',
      APPRAISAL: '鉴定意见',
      INSPECTION: '勘验笔录',
    };

    return typeMap[type] || type;
  }

  /**
   * 获取证据状态标签
   */
  private getEvidenceStatusLabel(status: string): string {
    const statusMap: Record<string, string> = {
      PENDING: '待审核',
      APPROVED: '已采纳',
      REJECTED: '已驳回',
      CHALLENGED: '被质疑',
    };

    return statusMap[status] || status;
  }

  /**
   * 获取服务实例（单例模式）
   */
  private static instance: EvidenceChainService | null = null;

  static getInstance(): EvidenceChainService {
    if (!EvidenceChainService.instance) {
      EvidenceChainService.instance = new EvidenceChainService();
    }
    return EvidenceChainService.instance;
  }
}
