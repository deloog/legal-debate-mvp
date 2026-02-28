import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/api-response';
import { prisma } from '@/lib/db/prisma';
import { ApplicabilityAnalyzer } from '@/lib/law-article/applicability/applicability-analyzer';
import type { ApplicabilityInput } from '@/lib/law-article/applicability/types';
import type {
  DocumentAnalysisOutput,
  Party,
  Claim,
  KeyFact,
  DisputeFocus,
  TimelineEvent,
} from '@/lib/agent/doc-analyzer/core/types';

/**
 * POST /api/v1/legal-analysis/applicability
 * 法条适用性分析API
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();

  // 参数验证
  if (!body.caseId) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'caseId参数必填',
        },
      },
      { status: 400 }
    );
  }

  if (
    !body.articleIds ||
    !Array.isArray(body.articleIds) ||
    body.articleIds.length === 0
  ) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'articleIds参数必填且必须是数组',
        },
      },
      { status: 400 }
    );
  }

  const { caseId, articleIds } = body;

  // 获取案件信息
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      documents: {
        where: {
          analysisStatus: 'COMPLETED',
        },
      },
    },
  });

  if (!caseData) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CASE_NOT_FOUND',
          message: '案件不存在',
        },
      },
      { status: 404 }
    );
  }

  // 构建案情摘要（DocumentAnalysisOutput格式）
  const parties = caseData.documents.flatMap(
    doc =>
      (doc.analysisResult as { extractedData?: { parties?: unknown[] } } | null)
        ?.extractedData?.parties || []
  );

  const claims = caseData.documents.flatMap(
    doc =>
      (doc.analysisResult as { extractedData?: { claims?: unknown[] } } | null)
        ?.extractedData?.claims || []
  );

  const keyFacts = caseData.documents.flatMap(
    doc =>
      (
        doc.analysisResult as {
          extractedData?: {
            keyFacts?: unknown[];
          };
        } | null
      )?.extractedData?.keyFacts || []
  );

  const disputeFocuses = caseData.documents.flatMap(
    doc =>
      (
        doc.analysisResult as {
          extractedData?: {
            disputeFocuses?: unknown[];
          };
        } | null
      )?.extractedData?.disputeFocuses || []
  );

  const timeline = caseData.documents.flatMap(
    doc =>
      (
        doc.analysisResult as {
          extractedData?: {
            timeline?: unknown[];
          };
        } | null
      )?.extractedData?.timeline || []
  );

  const caseInfo: DocumentAnalysisOutput = {
    success: true,
    extractedData: {
      parties: parties as unknown as Party[],
      claims: claims as unknown as Claim[],
      keyFacts: keyFacts as unknown as KeyFact[],
      disputeFocuses: disputeFocuses as unknown as DisputeFocus[],
      timeline: timeline as unknown as TimelineEvent[],
    },
    confidence: 0.8,
    processingTime: 0,
    metadata: {
      analysisModel: 'combined',
    },
  };

  // 获取法条详情
  const articles = await prisma.lawArticle.findMany({
    where: {
      id: { in: articleIds },
    },
  });

  if (articles.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ARTICLES_NOT_FOUND',
          message: '未找到指定的法条',
        },
      },
      { status: 404 }
    );
  }

  // 构建适用性分析输入
  const analysisInput: ApplicabilityInput = {
    caseInfo,
    articles,
    config: {
      useAI: true,
      minApplicabilityScore: 0.5,
      parallel: true,
    },
  };

  // 执行适用性分析
  const analyzer = new ApplicabilityAnalyzer();
  await analyzer.initialize();
  const report = await analyzer.analyze(analysisInput);
  await analyzer.destroy();

  // 保存分析结果到LegalReference表
  const timestamp = new Date();
  const applicableCount = report.results.filter(r => r.applicable).length;
  const notApplicableCount = report.results.length - applicableCount;

  // 更新LegalReference记录
  for (const result of report.results) {
    const article = articles.find(a => a.id === result.articleId);
    await prisma.legalReference.upsert({
      where: { id: result.articleId },
      update: {
        applicabilityScore: result.score,
        applicabilityReason: result.reasons?.join('; ') || null,
        analysisResult: result as unknown as Prisma.InputJsonValue,
        analyzedAt: timestamp,
        status: result.applicable ? 'VALID' : 'EXPIRED',
      },
      create: {
        id: result.articleId,
        source: 'LAW_ARTICLE',
        content: article?.fullText || '',
        lawType: article?.lawType || 'OTHER',
        category: article?.category || 'OTHER',
        applicabilityScore: result.score,
        applicabilityReason: result.reasons?.join('; ') || null,
        analysisResult: result as unknown as Prisma.InputJsonValue,
        analyzedAt: timestamp,
        status: result.applicable ? 'VALID' : 'EXPIRED',
        caseId,
      },
    });
  }

  // 转换响应格式
  const results = report.results.map(result => ({
    articleId: result.articleId,
    applicable: result.applicable,
    score: result.score,
    reasons: result.reasons,
    warnings: result.warnings,
    semanticMatch: result.semanticMatch,
    ruleValidation: result.ruleValidation,
  }));

  return createSuccessResponse({
    analyzedAt: report.analyzedAt,
    totalArticles: report.totalArticles,
    applicableArticles: applicableCount,
    notApplicableArticles: notApplicableCount,
    results,
    statistics: report.statistics,
    config: report.config,
  });
});

/**
 * OPTIONS /api/v1/legal-analysis/applicability
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
