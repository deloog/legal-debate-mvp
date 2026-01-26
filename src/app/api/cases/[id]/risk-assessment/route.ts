import { NextRequest, NextResponse } from 'next/server';
import { AIRiskIdentifier } from '@/lib/ai/risk/risk-identifier';
import { RiskScorer } from '@/lib/ai/risk/risk-scorer';
import { AIRiskAdvisor } from '@/lib/ai/risk/risk-advisor';
import { AIServiceFactory } from '@/lib/ai/service-refactored';
import type {
  RiskIdentificationInput,
  RiskAssessmentResult,
} from '@/types/risk';
import { logger } from '@/lib/agent/security/logger';

/**
 * POST /api/cases/[id]/risk-assessment
 * 执行完整的案件风险评估
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const caseId = params.id;

    // 解析请求体
    const body = await request.json();
    const {
      caseTitle,
      caseType,
      parties,
      facts,
      claims,
      evidence,
      legalBasis,
      enableAI = true,
    } = body;

    // 验证必填字段
    if (!caseTitle || !facts || !Array.isArray(facts) || facts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要参数：caseTitle 和 facts',
        },
        { status: 400 }
      );
    }

    // 构建风险识别输入
    const input: RiskIdentificationInput = {
      caseId,
      caseTitle,
      caseType,
      parties,
      facts,
      claims,
      evidence,
      legalBasis,
    };

    // 获取AI服务
    const aiService = await AIServiceFactory.getInstance();

    // 步骤1: 识别风险
    const identifier = new AIRiskIdentifier({
      aiService,
      enableFallback: true,
      confidenceThreshold: 0.6,
    });

    const risks = await identifier.identify(input);

    // 步骤2: 计算风险评分
    const scorer = new RiskScorer();
    const assessment = scorer.assess(caseId, risks);

    // 步骤3: 生成风险建议（如果有高优先级风险）
    let suggestions = assessment.suggestions;
    if (enableAI && assessment.statistics.totalRisks > 0) {
      const advisor = new AIRiskAdvisor({
        aiService,
        enableFallback: true,
        confidenceThreshold: 0.6,
      });

      const aiSuggestions = await advisor.advise(assessment);
      suggestions = aiSuggestions;
    }

    // 返回完整的评估结果
    return NextResponse.json({
      success: true,
      data: {
        ...assessment,
        suggestions,
      } as RiskAssessmentResult,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to assess risk', new Error(errorMessage), {
      caseId: params.id,
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
