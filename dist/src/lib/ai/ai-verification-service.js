"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIVerificationService = void 0;
const unified_service_1 = require("./unified-service");
class AIVerificationService {
  constructor() {
    this.provider = "zhipu";
    this.model = "glm-4-flash";
    // 可以配置使用不同的AI提供商进行交叉验证
  }
  /**
   * 使用AI验证文档解析结果的准确性
   */
  async verifyExtraction(request) {
    try {
      const unifiedService = await (0, unified_service_1.getUnifiedAIService)();
      const verificationPrompt = this.buildVerificationPrompt(request);
      const response = await unifiedService.chatCompletion({
        model: this.model,
        provider: this.provider,
        messages: [
          {
            role: "system",
            content: `你是一个专业的法律文档验证专家。你的任务是客观、准确地评估AI从法律文档中提取信息的质量。

请从以下维度进行评估：
1. 当事人信息准确性 - 检查重复识别、角色错误、信息遗漏
2. 诉讼请求完整性 - 检查遗漏的请求、错误的分类
3. 整体质量评估 - 完整性、一致性、清晰度

请严格按照JSON格式返回评估结果，不要包含任何说明文字。`,
          },
          {
            role: "user",
            content: verificationPrompt,
          },
        ],
        temperature: 0.1, // 使用低温度确保一致性
        maxTokens: 3000,
      });
      if (!response.choices || response.choices.length === 0) {
        throw new Error("AI验证服务返回空响应");
      }
      const aiResponse = response.choices[0].message.content;
      return this.parseVerificationResponse(aiResponse);
    } catch (error) {
      console.error("AI验证失败:", error);
      // 降级到基础验证
      return this.fallbackVerification(request);
    }
  }
  /**
   * 构建验证提示词
   */
  buildVerificationPrompt(request) {
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
2. 诉讼请求：检查是否遗漏重要请求、分类是否准确
3. 整体质量：评估完整性、一致性、清晰度
4. 特别注意：同一人不能被识别为不同的当事人（如张三既是原告又是被告）
`;
    return prompt;
  }
  /**
   * 解析AI验证响应
   */
  parseVerificationResponse(response) {
    try {
      let cleanedResponse = response.trim();
      // 移除代码块标记
      if (cleanedResponse.includes("```json")) {
        cleanedResponse = cleanedResponse
          .replace(/```json\s*/, "")
          .replace(/```\s*$/, "");
      }
      if (cleanedResponse.includes("```")) {
        cleanedResponse = cleanedResponse
          .replace(/```\s*/, "")
          .replace(/```\s*$/, "");
      }
      const parsed = JSON.parse(cleanedResponse);
      // 验证必要字段
      this.validateVerificationResult(parsed);
      return parsed;
    } catch (error) {
      console.error("解析AI验证响应失败:", error);
      throw new Error(
        `AI验证响应解析失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  /**
   * 验证响应结果结构
   */
  validateVerificationResult(result) {
    const requiredFields = [
      "overallAccuracy",
      "partiesAccuracy",
      "claimsAccuracy",
      "qualityAssessment",
      "detailedAnalysis",
      "confidence",
    ];
    for (const field of requiredFields) {
      if (!(field in result)) {
        throw new Error(`AI验证响应缺少必要字段: ${field}`);
      }
    }
    // 验证数值范围
    if (result.overallAccuracy < 0 || result.overallAccuracy > 100) {
      throw new Error("overallAccuracy必须在0-100之间");
    }
    if (result.confidence < 0 || result.confidence > 1) {
      throw new Error("confidence必须在0-1之间");
    }
  }
  /**
   * 降级验证机制（当AI验证失败时）
   */
  fallbackVerification(request) {
    console.warn("使用降级验证机制");
    const { extractedData } = request;
    // 基础逻辑检查
    const duplicates = this.findDuplicates(extractedData.parties);
    const issues = [];
    // 检查重复
    if (duplicates.length > 0) {
      issues.push(
        `发现重复当事人: ${duplicates.map((d) => d.name).join(", ")}`,
      );
    }
    // 基础评分
    let partiesScore = 100;
    let claimsScore = 100;
    if (duplicates.length > 0) {
      partiesScore -= duplicates.length * 20; // 每个重复扣20分
    }
    if (extractedData.claims.length === 0) {
      claimsScore = 0;
      issues.push("未识别到任何诉讼请求");
    }
    return {
      overallAccuracy: Math.round((partiesScore + claimsScore) / 2),
      partiesAccuracy: {
        score: partiesScore,
        issues: issues.filter((i) => i.includes("当事人")),
        correctCount: extractedData.parties.length - duplicates.length,
        totalCount: extractedData.parties.length,
        duplicates,
      },
      claimsAccuracy: {
        score: claimsScore,
        issues: issues.filter((i) => i.includes("诉讼请求")),
        correctCount: extractedData.claims.length,
        totalCount: extractedData.claims.length,
        missingClaims: [],
      },
      qualityAssessment: {
        completeness: 70,
        consistency: Math.max(50, 100 - duplicates.length * 25),
        clarity: 70,
      },
      detailedAnalysis:
        "使用降级验证机制，结果可能不够准确。建议使用完整AI验证。",
      confidence: 0.3,
    };
  }
  /**
   * 查找重复的当事人
   */
  findDuplicates(parties) {
    const nameMap = new Map();
    parties.forEach((party) => {
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
      .filter(([_, data]) => data.count > 1)
      .map(([name, data]) => ({
        name,
        occurrences: data.count,
        roles: data.roles,
      }));
  }
  /**
   * 设置验证配置
   */
  setConfig(provider, model) {
    this.provider = provider;
    this.model = model;
  }
}
exports.AIVerificationService = AIVerificationService;
