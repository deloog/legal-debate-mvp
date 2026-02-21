/**
 * POST /api/risk-assessment
 * 独立的法律风险评估接口（不依赖具体案件ID）
 * 前端 risk-assessment/page.tsx 传入 { formData } 调用此接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { AIRiskIdentifier } from '@/lib/ai/risk/risk-identifier';
import { RiskScorer } from '@/lib/ai/risk/risk-scorer';
import { AIRiskAdvisor } from '@/lib/ai/risk/risk-advisor';
import { AIServiceFactory } from '@/lib/ai/service-refactored';
import type {
  RiskIdentificationInput,
  RiskAssessmentResult,
} from '@/types/risk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // 前端发送的格式: { formData: { caseId?, caseTitle, caseType, ... } }
    const raw = (body.formData ?? body) as Record<string, unknown>;

    const {
      caseId = 'standalone',
      caseTitle,
      caseType,
      parties,
      facts,
      claims,
      evidence,
      legalBasis,
      enableAI = true,
    } = raw as {
      caseId?: string;
      caseTitle?: string;
      caseType?: string;
      parties?: { plaintiff?: string; defendant?: string };
      facts?: string[];
      claims?: string[];
      evidence?: Array<{ name: string; type: string; description?: string }>;
      legalBasis?: Array<{ lawName: string; articleNumber: string }>;
      enableAI?: boolean;
    };

    if (!caseTitle || !facts || !Array.isArray(facts) || facts.length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：caseTitle 和 facts' },
        { status: 400 }
      );
    }

    const input: RiskIdentificationInput = {
      caseId: caseId as string,
      caseTitle,
      caseType,
      parties,
      facts,
      claims,
      evidence,
      legalBasis,
    };

    const aiService = await AIServiceFactory.getInstance();

    const identifier = new AIRiskIdentifier({
      aiService,
      enableFallback: true,
      confidenceThreshold: 0.6,
    });
    const risks = await identifier.identify(input);

    const scorer = new RiskScorer();
    const assessment = scorer.assess(caseId as string, risks);

    let suggestions = assessment.suggestions;
    if (enableAI && assessment.statistics.totalRisks > 0) {
      const advisor = new AIRiskAdvisor({
        aiService,
        enableFallback: true,
        confidenceThreshold: 0.6,
      });
      suggestions = await advisor.advise(assessment);
    }

    return NextResponse.json({
      success: true,
      data: { ...assessment, suggestions } as RiskAssessmentResult,
    });
  } catch (error) {
    logger.error('[风险评估] 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '风险评估失败',
      },
      { status: 500 }
    );
  }
}
