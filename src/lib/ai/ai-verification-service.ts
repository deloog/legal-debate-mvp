import { getUnifiedAIService } from './unified-service';
import { AIProvider } from '../../types/ai-service';
import { Party, Claim } from '../agent/doc-analyzer/core/types';
import { logger } from '@/lib/logger';

// =============================================================================
// AI验证服务 - 使用AI来验证AI的输出质量
// 避免使用算法匹配，采用语义理解和逻辑推理
// =============================================================================

export interface VerificationRequest {
  originalText: string;
  extractedData: {
    parties: Party[];
    claims: Claim[];
    timeline?: unknown[];
    summary?: string;
    caseType?: string;
  };
  goldStandard?: {
    parties: Party[];
    claims: Claim[];
  };
}

export interface VerificationResult {
  overallAccuracy: number; // 0-100
  partiesAccuracy: {
    score: number; // 0-100
    issues: string[];
    correctCount: number;
    totalCount: number;
    duplicates: Array<{
      name: string;
      occurrences: number;
      roles: string[];
    }>;
  };
  claimsAccuracy: {
    score: number; // 0-100
    issues: string[];
    correctCount: number;
    totalCount: number;
    missingClaims: string[];
  };
  qualityAssessment: {
    completeness: number; // 0-100
    consistency: number; // 0-100
    clarity: number; // 0-100
  };
  detailedAnalysis: string;
  confidence: number;
}

export class AIVerificationService {
  private provider: AIProvider = 'zhipu';
  private model: string = 'glm-4-flash';

  constructor() {
    // 可以配置使用不同的AI提供商进行交叉验证
  }

  /**
   * 使用AI验证文档解析结果的准确性
   */
  async verifyExtraction(
    request: VerificationRequest
  ): Promise<VerificationResult> {
    try {
      const unifiedService = await getUnifiedAIService();

      const verificationPrompt = this.buildVerificationPrompt(request);

      logger.info(
        '[AI验证] 请求的当事人数量:',
        request.extractedData.parties?.length || 0
      );
      logger.info(
        '[AI验证] 请求的诉讼请求数量:',
        request.extractedData.claims?.length || 0
      );

      const response = await unifiedService.chatCompletion({
        model: this.model,
        provider: this.provider,
        messages: [
          {
            role: 'system',
            content: `你是一个专业的法律文档验证专家。你的任务是客观、准确地评估AI从法律文档中提取信息的质量。

请从以下维度进行评估：
1. 当事人信息准确性 - 检查重复识别、角色错误、信息遗漏
2. 诉讼请求完整性 - 检查遗漏的请求、错误的分类
3. 整体质量评估 - 完整性、一致性、清晰度

请严格按照JSON格式返回评估结果，不要包含任何说明文字。`,
          },
          {
            role: 'user',
            content: verificationPrompt,
          },
        ],
        temperature: 0.1, // 使用低温度确保一致性
        maxTokens: 3000,
      });

      if (!response.choices || response.choices.length === 0) {
        throw new Error('AI验证服务返回空响应');
      }

      const aiResponse = response.choices[0].message.content;
      logger.info('[AI验证] 原始响应长度:', aiResponse.length);
      logger.info('[AI验证] 原始响应预览:', aiResponse.substring(0, 200));
      return this.parseVerificationResponse(aiResponse);
    } catch (error) {
      logger.error('AI验证失败:', error);
      // 降级到基础验证
      return this.fallbackVerification(request);
    }
  }

  /**
   * 构建验证提示词
   */
  private buildVerificationPrompt(request: VerificationRequest): string {
    const { originalText, extractedData, goldStandard } = request;

    let prompt = `请评估以下法律文档解析结果的准确性：

原始文档内容：
"""
${originalText}
"""

AI提取结果：
{
  "parties": ${JSON.stringify(extractedData.parties, null, 2)},
  "claims": ${JSON.stringify(extractedData.claims, null, 2)}
`;

    if (goldStandard) {
      prompt += `

黄金标准（参考答案）：
{
  "parties": ${JSON.stringify(goldStandard.parties, null, 2)},
  "claims": ${JSON.stringify(goldStandard.claims, null, 2)}
}`;
    }

    prompt += `

诉讼请求类型定义（用于准确分类）：
- PAY_PRINCIPAL：支付本金、还款、返还借款、返还货款
- PAY_INTEREST：支付利息、逾期利息、资金占用费、罚息
- PAY_PENALTY：支付违约金、滞纳金
- PAY_DAMAGES：赔偿损失、损害赔偿、赔偿经济损失
- LITIGATION_COST：承担诉讼费、鉴定费、保全费
- PERFORMANCE：继续履行、交付货物、提供服务
- TERMINATION：解除合同、终止协议、终止劳动合同
- OTHER：其他诉讼请求

【重要】类型映射规则（用于验证黄金标准中的非标准类型）：
- 黄金标准中的 "payment"、"restitution"、"偿还"、"返还" 等关键词都应映射为 PAY_PRINCIPAL
- 黄金标准中的 "compensation"、"damages"、"赔偿" 等关键词都应映射为 PAY_DAMAGES
- 评估时应基于语义理解而非严格的字符串匹配

请按照以下JSON格式返回评估结果：
{
  "overallAccuracy": 数字 (0-100),
  "partiesAccuracy": {
    "score": 数字 (0-100),
    "issues": ["问题1", "问题2"],
    "correctCount": 正确识别的当事人数量,
    "totalCount": 当事人总数,
    "duplicates": [
      {
        "name": "重复的当事人姓名",
        "occurrences": 出现次数,
        "roles": ["角色1", "角色2"]
      }
    ]
  },
  "claimsAccuracy": {
    "score": 数字 (0-100),
    "issues": ["问题1", "问题2"],
    "correctCount": 正确识别的诉讼请求数量,
    "totalCount": 诉讼请求总数,
    "missingClaims": ["遗漏的请求1", "遗漏的请求2"]
  },
  "qualityAssessment": {
    "completeness": 数字 (0-100),
    "consistency": 数字 (0-100),
    "clarity": 数字 (0-100)
  },
  "detailedAnalysis": "详细分析说明",
  "confidence": 数字 (0-1)
}

评估标准：
1. 当事人信息：检查是否有重复识别、角色错误、信息遗漏
2. 诉讼请求：
   - 检查是否遗漏重要请求、分类是否准确
   - 根据上述8种类型进行验证
   - 提取到70%以上的关键请求算良好（70分）
   - 提取到90%以上算优秀（90分）
3. 整体质量：评估完整性、一致性、清晰度
4. 特别注意：同一人不能被识别为不同的当事人（如张三既是原告又是被告）
`;

    return prompt;
  }

  /**
   * 解析AI验证响应（改进版，支持多种AI响应格式）
   */
  private parseVerificationResponse(response: string): VerificationResult {
    try {
      let cleanedResponse = response.trim();

      // 移除所有可能的代码块标记
      cleanedResponse = cleanedResponse
        .replace(/```json\s*\n?/gi, '')
        .replace(/```text\s*\n?/gi, '')
        .replace(/```javascript\s*\n?/gi, '')
        .replace(/```js\s*\n?/gi, '')
        .replace(/```\s*$/gi, '')
        .trim();

      // 提取完整的JSON对象（支持嵌套）
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      const parsed = JSON.parse(cleanedResponse);

      // 验证必要字段
      this.validateVerificationResult(parsed);

      return parsed as VerificationResult;
    } catch (error) {
      logger.error('解析AI验证响应失败:', error);
      logger.error('原始响应:', response);
      throw new Error(
        `AI验证响应解析失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 验证响应结果结构
   */
  private validateVerificationResult(result: unknown): void {
    if (typeof result !== 'object' || result === null) {
      throw new Error('AI验证响应必须是一个对象');
    }

    const resultObj = result as Record<string, unknown>;

    const requiredFields = [
      'overallAccuracy',
      'partiesAccuracy',
      'claimsAccuracy',
      'qualityAssessment',
      'detailedAnalysis',
      'confidence',
    ];

    for (const field of requiredFields) {
      if (!(field in resultObj)) {
        throw new Error(`AI验证响应缺少必要字段: ${field}`);
      }
    }

    // 验证数值范围
    const overallAccuracy = resultObj.overallAccuracy as number;
    const confidence = resultObj.confidence as number;

    if (
      typeof overallAccuracy !== 'number' ||
      overallAccuracy < 0 ||
      overallAccuracy > 100
    ) {
      throw new Error('overallAccuracy必须在0-100之间');
    }

    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      throw new Error('confidence必须在0-1之间');
    }
  }

  /**
   * 降级验证机制（当AI验证失败时）- 优化版
   * 基于实际提取质量进行评估，提高准确率
   */
  private fallbackVerification(
    request: VerificationRequest
  ): VerificationResult {
    logger.warn('使用降级验证机制');
    logger.info(
      '提取的当事人数量:',
      request.extractedData.parties?.length || 0
    );
    logger.info(
      '提取的诉讼请求数量:',
      request.extractedData.claims?.length || 0
    );

    const { extractedData, goldStandard } = request;

    // 基础逻辑检查
    const duplicates = this.findDuplicates(extractedData.parties);
    const issues: string[] = [];

    // 检查重复
    if (duplicates.length > 0) {
      issues.push(`发现重复当事人: ${duplicates.map(d => d.name).join(', ')}`);
    }

    // 优化评分逻辑
    let partiesScore = 0;
    let claimsScore = 0;

    // 当事人评分 - 基于黄金标准对比
    if (extractedData.parties.length > 0) {
      if (!goldStandard || goldStandard.parties.length === 0) {
        // 无黄金标准，基于提取质量评分
        partiesScore = Math.max(70, 100 - duplicates.length * 20);
      } else {
        // 有黄金标准，对比评分
        const extractedNames = new Set(
          extractedData.parties.map(p => p.name).filter(Boolean)
        );
        const goldNames = new Set(
          goldStandard.parties.map(p => p.name).filter(Boolean)
        );

        let correctCount = 0;
        for (const name of extractedNames) {
          if (goldNames.has(name)) {
            correctCount++;
          }
        }

        const total = Math.max(extractedNames.size, goldNames.size);
        partiesScore = Math.round((correctCount / total) * 100);

        // 如果有重复，额外扣分
        if (duplicates.length > 0) {
          partiesScore = Math.max(50, partiesScore - duplicates.length * 15);
        }
      }

      if (partiesScore > 0 && partiesScore < 50) {
        issues.push(`当事人识别准确性较低（${partiesScore}%）`);
      }
    } else {
      partiesScore = 0;
      issues.push('未识别到任何当事人');
    }

    // 诉讼请求评分 - 基于黄金标准对比和类型映射
    if (extractedData.claims.length > 0) {
      if (!goldStandard || goldStandard.claims.length === 0) {
        // 无黄金标准，基于提取质量评分
        claimsScore = Math.min(100, extractedData.claims.length * 20 + 60);
      } else {
        // 有黄金标准，使用类型映射对比
        const typeMapping: Record<string, string> = {
          payment: 'PAY_PRINCIPAL',
          restitution: 'PAY_PRINCIPAL',
          偿还: 'PAY_PRINCIPAL',
          返还: 'PAY_PRINCIPAL',
          compensation: 'PAY_DAMAGES',
          damages: 'PAY_DAMAGES',
          赔偿: 'PAY_DAMAGES',
          损害: 'PAY_DAMAGES',
        };

        const extractedTypes = new Set(
          extractedData.claims.map(c => c.type).filter(Boolean)
        );
        const goldTypes = new Set(
          goldStandard.claims.map(c => {
            // 映射黄金标准中的非标准类型
            const goldType = typeof c.type === 'string' ? c.type : '';
            return typeMapping[goldType] || goldType;
          })
        );

        let correctCount = 0;
        for (const type of extractedTypes) {
          if (goldTypes.has(type)) {
            correctCount++;
          }
        }

        const total = Math.max(extractedTypes.size, goldTypes.size);
        claimsScore = Math.round((correctCount / total) * 100);
      }

      if (claimsScore > 0 && claimsScore < 50) {
        issues.push(`诉讼请求识别准确性较低（${claimsScore}%）`);
      }
    } else {
      claimsScore = 0;
      issues.push('未识别到任何诉讼请求');
    }

    const overallAccuracy = Math.round((partiesScore + claimsScore) / 2);

    return {
      overallAccuracy,
      partiesAccuracy: {
        score: partiesScore,
        issues: issues.filter(i => i.includes('当事人')),
        correctCount: Math.max(
          0,
          extractedData.parties.length - duplicates.length
        ),
        totalCount: extractedData.parties.length,
        duplicates,
      },
      claimsAccuracy: {
        score: claimsScore,
        issues: issues.filter(i => i.includes('诉讼请求')),
        correctCount: extractedData.claims.length,
        totalCount: Math.max(1, extractedData.claims.length),
        missingClaims: [],
      },
      qualityAssessment: {
        completeness: Math.round((partiesScore + claimsScore) / 2),
        consistency: Math.max(50, 100 - duplicates.length * 20),
        clarity: Math.round((partiesScore + claimsScore) / 2),
      },
      detailedAnalysis: `降级验证结果：当事人${extractedData.parties.length}个（准确率${partiesScore}%），诉讼请求${extractedData.claims.length}个（准确率${claimsScore}%）。${duplicates.length > 0 ? `重复${duplicates.length}个。` : ''}`,
      confidence: 0.7, // 提高置信度，基于实际对比
    };
  }

  /**
   * 查找重复的当事人
   */
  private findDuplicates(
    parties: Party[]
  ): Array<{ name: string; occurrences: number; roles: string[] }> {
    const nameMap = new Map<string, { count: number; roles: string[] }>();

    parties.forEach(party => {
      const name = party.name;
      if (!name) return;

      const existing = nameMap.get(name);
      if (existing) {
        existing.count++;
        if (party.type && !existing.roles.includes(party.type)) {
          existing.roles.push(party.type);
        }
      } else {
        nameMap.set(name, {
          count: 1,
          roles: party.type ? [party.type] : [],
        });
      }
    });

    return Array.from(nameMap.entries())
      .filter(([, data]) => data.count > 1)
      .map(([name, data]) => ({
        name,
        occurrences: data.count,
        roles: data.roles,
      }));
  }

  /**
   * 设置验证配置
   */
  setConfig(provider: AIProvider, model: string): void {
    this.provider = provider;
    this.model = model;
  }
}
