/**
 * 证据链分析服务
 *
 * 功能：
 * - AI分析证据关联性
 * - 构建证据链图谱
 * - 识别证据链缺口
 * - 生成证据链可视化数据
 * - AI解析失败时提供降级方案
 */

import type { Evidence } from '@prisma/client';
import { AIService } from '@/lib/ai/clients';
import { logger } from '@/lib/logger';

/**
 * 证据链分析输入
 */
export interface EvidenceChainAnalysisInput {
  caseId: string;
  evidences: Evidence[];
  targetFact: string;
}

/**
 * 证据链节点
 */
export interface EvidenceChainNode {
  evidenceId: string;
  evidenceName: string;
  role: 'key' | 'supporting' | 'peripheral';
  description: string;
}

/**
 * 证据链连接
 */
export interface EvidenceConnection {
  from: string;
  to: string;
  relation: string;
  strength: number; // 0-1
}

/**
 * 证据链分析结果
 */
export interface EvidenceChainAnalysisResult {
  chains: EvidenceChainNode[];
  connections: EvidenceConnection[];
  completeness: number; // 0-100
  gaps: string[];
  suggestions: string[];
}

/**
 * AI分析响应结构
 */
interface AIAnalysisResponse {
  chains: Array<{
    evidenceId: string;
    evidenceName: string;
    role: string;
    description: string;
  }>;
  connections: Array<{
    from: string;
    to: string;
    relation: string;
    strength: number;
  }>;
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

    // 空证据列表降级处理
    if (input.evidences.length === 0) {
      return this.getEmptyEvidenceResult();
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
      return this.parseAIResponse(aiResponse.content);
    } catch (error) {
      logger.error('证据链分析失败:', error);
      // AI解析失败时返回降级结果
      return this.getFallbackResult(input.evidences);
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

    if (input.targetFact.length > 5000) {
      throw new Error('待证明事实过长，最多5000字符');
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

    const evidenceList = evidences
      .map(
        (e, index) =>
          `${index + 1}. ${e.name} (${e.type}) - ${e.description || '无描述'}`
      )
      .join('\n');

    return `请作为一位经验丰富的诉讼律师，分析以下证据链的完整性和关联性。

## 待证明事实
${targetFact}

## 证据列表
${evidenceList}

## 分析要求
1. **证据链节点分析**
   - 识别关键证据（key）
   - 识别支持性证据（supporting）
   - 识别边缘证据（peripheral）
   - 说明每个证据在链中的作用

2. **证据关联性分析**
   - 识别证据之间的逻辑关系
   - 评估关联强度（0-1）
   - 描述关联类型（支持、补充、印证等）

3. **完整性评估**
   - 评估证据链整体完整性（0-100）
   - 识别证据链缺口
   - 提出补充证据建议

## 输出格式
请严格按照以下JSON格式输出（不要包含任何其他文字）：

\`\`\`json
{
  "chains": [
    {
      "evidenceId": "证据ID",
      "evidenceName": "证据名称",
      "role": "key|supporting|peripheral",
      "description": "该证据在证据链中的作用描述"
    }
  ],
  "connections": [
    {
      "from": "源证据ID",
      "to": "目标证据ID",
      "relation": "关系描述",
      "strength": 0.8
    }
  ],
  "completeness": 75,
  "gaps": ["证据链缺口1", "证据链缺口2"],
  "suggestions": ["补充证据建议1", "补充证据建议2"]
}
\`\`\`

注意：
- completeness必须是0-100之间的整数
- chains数组应包含所有证据
- connections数组描述证据之间的关系
- gaps数组列出证据链的不足之处
- suggestions数组提供具体的改进建议
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

      // 验证并规范化质证意见
      const validatedChains = parsed.chains.map(chain => {
        // 验证role
        if (!['key', 'supporting', 'peripheral'].includes(chain.role)) {
          chain.role = 'peripheral'; // 默认降级
        }

        return {
          evidenceId: String(chain.evidenceId),
          evidenceName: String(chain.evidenceName),
          role: chain.role as 'key' | 'supporting' | 'peripheral',
          description: String(chain.description || ''),
        };
      });

      // 验证并规范化connections
      const validatedConnections = parsed.connections.map(conn => ({
        from: String(conn.from),
        to: String(conn.to),
        relation: String(conn.relation || '关联'),
        strength: Math.max(0, Math.min(1, conn.strength || 0.5)),
      }));

      // 确保completeness在0-100范围内
      const completeness = Math.max(0, Math.min(100, parsed.completeness));

      return {
        chains: validatedChains,
        connections: validatedConnections,
        completeness,
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps.map(String) : [],
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions.map(String)
          : [],
      };
    } catch (error) {
      logger.error('解析AI响应失败:', error);
      logger.error('原始响应:', response);
      throw new Error(
        `解析AI响应失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 空证据列表的降级结果
   */
  private getEmptyEvidenceResult(): EvidenceChainAnalysisResult {
    return {
      chains: [],
      connections: [],
      completeness: 0,
      gaps: ['缺少任何证据材料'],
      suggestions: ['请上传相关证据材料以建立证据链'],
    };
  }

  /**
   * AI解析失败时的降级结果
   */
  private getFallbackResult(
    evidences: Evidence[]
  ): EvidenceChainAnalysisResult {
    // 基于简单规则生成降级结果
    const chains: EvidenceChainNode[] = evidences.map((evidence, index) => ({
      evidenceId: evidence.id,
      evidenceName: evidence.name,
      role: index === 0 ? 'key' : 'supporting',
      description: `${evidence.name} (${evidence.type}) - 需要进一步分析`,
    }));

    return {
      chains,
      connections: [],
      completeness: Math.min(30, evidences.length * 10), // 简单估计
      gaps: ['AI分析服务暂时不可用，无法评估证据链完整性'],
      suggestions: ['请稍后重试证据链分析', '检查证据材料的完整性'],
    };
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
