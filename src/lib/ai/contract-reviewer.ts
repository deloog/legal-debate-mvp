/**
 * 合同审查服务 - AI驱动的合同风险识别
 */

import type {
  RiskItem,
  Suggestion,
  ReviewReport,
} from '@/types/contract-review';

/**
 * 模拟AI审查合同
 * 实际项目中应该调用真实的AI服务
 */
export async function reviewContract(
  contractId: string,
  filePath: string,
  content: string
): Promise<
  Omit<
    ReviewReport,
    | 'id'
    | 'contractId'
    | 'fileName'
    | 'fileSize'
    | 'uploadedAt'
    | 'reviewedAt'
    | 'status'
  >
> {
  const startTime = Date.now();

  // 模拟AI分析过程
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 识别风险项
  const risks = identifyRisks(content);

  // 生成建议
  const suggestions = generateSuggestions(risks);

  // 计算评分
  const scores = calculateScores(risks);

  // 统计风险数量
  const riskStats = countRisksByLevel(risks);

  const reviewTime = Date.now() - startTime;

  return {
    ...scores,
    ...riskStats,
    risks,
    suggestions,
    reviewTime,
  };
}

/**
 * 识别合同中的风险项
 */
function identifyRisks(content: string): RiskItem[] {
  const risks: RiskItem[] = [];

  // 检查争议解决条款
  if (
    !content.includes('争议解决') &&
    !content.includes('仲裁') &&
    !content.includes('诉讼')
  ) {
    risks.push({
      id: `risk-${Date.now()}-1`,
      type: 'DISPUTE_RESOLUTION',
      level: 'HIGH',
      title: '缺少争议解决条款',
      description: '合同中未明确约定争议解决方式，可能导致纠纷处理困难',
      location: { page: 1, paragraph: 1 },
      originalText: '',
      impact: '发生纠纷时无法明确处理途径，可能增加解决成本',
      probability: 0.7,
    });
  }

  // 检查保密条款
  if (!content.includes('保密') && !content.includes('商业秘密')) {
    risks.push({
      id: `risk-${Date.now()}-2`,
      type: 'CONFIDENTIALITY',
      level: 'MEDIUM',
      title: '缺少保密条款',
      description: '合同中未约定保密义务，可能导致商业秘密泄露',
      location: { page: 1, paragraph: 1 },
      originalText: '',
      impact: '商业秘密可能被泄露，造成经济损失',
      probability: 0.6,
    });
  }

  // 检查违约责任
  if (!content.includes('违约责任') && !content.includes('违约金')) {
    risks.push({
      id: `risk-${Date.now()}-3`,
      type: 'LIABILITY',
      level: 'HIGH',
      title: '违约责任不明确',
      description: '合同中未明确约定违约责任，可能导致违约后无法追责',
      location: { page: 1, paragraph: 1 },
      originalText: '',
      impact: '违约方可能无需承担责任，守约方权益难以保障',
      probability: 0.8,
    });
  }

  // 检查知识产权条款
  if (
    content.includes('知识产权') ||
    content.includes('专利') ||
    content.includes('著作权')
  ) {
    if (!content.includes('知识产权归属')) {
      risks.push({
        id: `risk-${Date.now()}-4`,
        type: 'INTELLECTUAL_PROPERTY',
        level: 'MEDIUM',
        title: '知识产权归属不明确',
        description: '涉及知识产权但未明确归属，可能引发权属纠纷',
        location: { page: 1, paragraph: 1 },
        originalText: '',
        impact: '知识产权归属不清，可能导致后续纠纷',
        probability: 0.5,
      });
    }
  }

  // 检查付款条款
  if (!content.includes('付款') && !content.includes('支付')) {
    risks.push({
      id: `risk-${Date.now()}-5`,
      type: 'FINANCIAL',
      level: 'CRITICAL',
      title: '缺少付款条款',
      description: '合同中未约定付款方式和时间，可能导致付款纠纷',
      location: { page: 1, paragraph: 1 },
      originalText: '',
      impact: '付款时间和方式不明确，可能导致严重的财务纠纷',
      probability: 0.9,
    });
  }

  return risks;
}

/**
 * 生成修改建议
 */
function generateSuggestions(risks: RiskItem[]): Suggestion[] {
  const suggestions: Suggestion[] = [];

  risks.forEach(risk => {
    let suggestion: Suggestion | null = null;

    switch (risk.type) {
      case 'DISPUTE_RESOLUTION':
        suggestion = {
          id: `suggestion-${Date.now()}-${risk.id}`,
          riskId: risk.id,
          type: 'ADD',
          title: '添加争议解决条款',
          description: '建议添加明确的争议解决方式，如仲裁或诉讼管辖',
          suggestedText:
            '因本合同引起的或与本合同有关的任何争议，双方应友好协商解决；协商不成的，任何一方均可向合同签订地人民法院提起诉讼。',
          priority: 'HIGH',
          reason: '明确争议解决方式有助于降低纠纷处理成本',
        };
        break;

      case 'CONFIDENTIALITY':
        suggestion = {
          id: `suggestion-${Date.now()}-${risk.id}`,
          riskId: risk.id,
          type: 'ADD',
          title: '添加保密条款',
          description: '建议添加保密义务条款，明确保密范围和期限',
          suggestedText:
            '双方应对在合作过程中知悉的对方商业秘密承担保密义务，保密期限为合同终止后三年。违反保密义务的一方应承担违约责任。',
          priority: 'MEDIUM',
          reason: '保护商业秘密，避免信息泄露风险',
        };
        break;

      case 'LIABILITY':
        suggestion = {
          id: `suggestion-${Date.now()}-${risk.id}`,
          riskId: risk.id,
          type: 'ADD',
          title: '明确违约责任',
          description: '建议添加违约责任条款，明确违约金或赔偿标准',
          suggestedText:
            '任何一方违反本合同约定的，应向守约方支付违约金，违约金为合同总金额的20%。违约金不足以弥补损失的，违约方还应赔偿守约方的实际损失。',
          priority: 'HIGH',
          reason: '明确违约责任有助于约束双方履约，保障守约方权益',
        };
        break;

      case 'INTELLECTUAL_PROPERTY':
        suggestion = {
          id: `suggestion-${Date.now()}-${risk.id}`,
          riskId: risk.id,
          type: 'ADD',
          title: '明确知识产权归属',
          description: '建议明确知识产权的归属和使用权限',
          suggestedText:
            '合作过程中产生的知识产权归双方共同所有，任何一方使用该知识产权需经对方书面同意。',
          priority: 'MEDIUM',
          reason: '明确知识产权归属，避免后续权属纠纷',
        };
        break;

      case 'FINANCIAL':
        suggestion = {
          id: `suggestion-${Date.now()}-${risk.id}`,
          riskId: risk.id,
          type: 'ADD',
          title: '添加付款条款',
          description: '建议明确付款金额、方式、时间和账户信息',
          suggestedText:
            '甲方应在合同签订后7个工作日内，将合同总金额的50%作为预付款支付至乙方指定账户；剩余50%应在项目验收合格后7个工作日内支付。',
          priority: 'HIGH',
          reason: '明确付款条件，避免付款纠纷',
        };
        break;
    }

    if (suggestion) {
      suggestions.push(suggestion);
    }
  });

  return suggestions;
}

/**
 * 计算评分
 */
function calculateScores(risks: RiskItem[]): {
  overallScore: number;
  riskScore: number;
  complianceScore: number;
} {
  if (risks.length === 0) {
    return {
      overallScore: 100,
      riskScore: 100,
      complianceScore: 100,
    };
  }

  // 根据风险等级计算扣分
  let totalDeduction = 0;
  risks.forEach(risk => {
    switch (risk.level) {
      case 'CRITICAL':
        totalDeduction += 20;
        break;
      case 'HIGH':
        totalDeduction += 15;
        break;
      case 'MEDIUM':
        totalDeduction += 10;
        break;
      case 'LOW':
        totalDeduction += 5;
        break;
    }
  });

  const riskScore = Math.max(0, 100 - totalDeduction);
  const complianceScore = Math.max(0, 100 - totalDeduction * 0.8);
  const overallScore = Math.round((riskScore + complianceScore) / 2);

  return {
    overallScore,
    riskScore,
    complianceScore,
  };
}

/**
 * 统计各级别风险数量
 */
function countRisksByLevel(risks: RiskItem[]): {
  totalRisks: number;
  criticalRisks: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;
} {
  return {
    totalRisks: risks.length,
    criticalRisks: risks.filter(r => r.level === 'CRITICAL').length,
    highRisks: risks.filter(r => r.level === 'HIGH').length,
    mediumRisks: risks.filter(r => r.level === 'MEDIUM').length,
    lowRisks: risks.filter(r => r.level === 'LOW').length,
  };
}
