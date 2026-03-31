import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import type { CaseType } from '@/lib/agent/doc-analyzer/core/types';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/api-response';
import { prisma } from '@/lib/db/prisma';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth/jwt';
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

/** 从请求头中解析 JWT，返回 userId 或 null */
function resolveUserId(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader ?? '');
  const result = verifyToken(token ?? '');
  if (result.valid && result.payload) {
    return result.payload.userId;
  }
  return null;
}

/**
 * POST /api/v1/legal-analysis/applicability
 * 法条适用性分析 API
 *
 * 两阶段分析：Phase 0 硬性过滤 → Phase 1 AI 并行分析。
 * 结果以 (caseId, articleId) 为唯一键写入 LegalReference 表。
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // ─── 身份验证 ────────────────────────────────────────────────────────────
  const userId = resolveUserId(request);
  if (!userId) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  // ─── 参数验证 ────────────────────────────────────────────────────────────
  const body = await request.json();

  if (!body.caseId) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'caseId参数必填' },
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

  const caseId = String(body.caseId);
  const articleIds: string[] = (body.articleIds as unknown[]).filter(
    (id): id is string => typeof id === 'string'
  );

  if (articleIds.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'articleIds 必须包含字符串元素',
        },
      },
      { status: 400 }
    );
  }

  // ─── 查询案件（验证归属 + 获取文档分析结果） ─────────────────────────────
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      documents: {
        where: { analysisStatus: 'COMPLETED' },
      },
    },
  });

  if (!caseData) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CASE_NOT_FOUND', message: '案件不存在' },
      },
      { status: 404 }
    );
  }

  // ─── 所有权校验：确保案件归属当前用户 ────────────────────────────────────
  if (caseData.userId !== userId) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: '无权访问此案件' },
      },
      { status: 403 }
    );
  }

  // ─── 从已完成分析的文档中聚合案情数据 ───────────────────────────────────
  type AnalysisResultShape = {
    extractedData?: {
      caseType?: string;
      parties?: unknown[];
      claims?: unknown[];
      keyFacts?: unknown[];
      disputeFocuses?: unknown[];
      timeline?: unknown[];
      summary?: string;
    };
  } | null;

  const analysisResults = caseData.documents.map(
    doc => doc.analysisResult as AnalysisResultShape
  );

  const firstCaseType = analysisResults
    .map(r => r?.extractedData?.caseType)
    .find((t): t is string => Boolean(t));

  const parties = analysisResults.flatMap(r => r?.extractedData?.parties ?? []);
  const claims = analysisResults.flatMap(r => r?.extractedData?.claims ?? []);
  const keyFacts = analysisResults.flatMap(
    r => r?.extractedData?.keyFacts ?? []
  );
  const disputeFocuses = analysisResults.flatMap(
    r => r?.extractedData?.disputeFocuses ?? []
  );
  const timeline = analysisResults.flatMap(
    r => r?.extractedData?.timeline ?? []
  );
  const summary = analysisResults
    .map(r => r?.extractedData?.summary)
    .find((s): s is string => Boolean(s));

  const caseInfo: DocumentAnalysisOutput = {
    success: true,
    extractedData: {
      caseType: firstCaseType as CaseType,
      parties: parties as unknown as Party[],
      claims: claims as unknown as Claim[],
      keyFacts: keyFacts as unknown as KeyFact[],
      disputeFocuses: disputeFocuses as unknown as DisputeFocus[],
      timeline: timeline as unknown as TimelineEvent[],
      summary,
    },
    confidence: 0.8,
    processingTime: 0,
    metadata: { analysisModel: 'combined' },
  };

  // ─── 查询法条 ────────────────────────────────────────────────────────────
  const articles = await prisma.lawArticle.findMany({
    where: { id: { in: articleIds } },
  });

  if (articles.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'ARTICLES_NOT_FOUND', message: '未找到指定的法条' },
      },
      { status: 404 }
    );
  }

  // 通知调用方哪些 ID 未找到（不阻断，仅提示）
  const foundIds = new Set(articles.map(a => a.id));
  const missingIds = articleIds.filter(id => !foundIds.has(id));

  // ─── 执行适用性分析 ───────────────────────────────────────────────────────
  const analysisInput: ApplicabilityInput = {
    caseInfo,
    articles,
    config: {
      useAI: true,
      minApplicabilityScore: 0.5,
      concurrency: 5,
    },
  };

  const analyzer = new ApplicabilityAnalyzer();
  await analyzer.initialize();
  const report = await analyzer.analyze(analysisInput);
  await analyzer.destroy();

  // ─── 写入 LegalReference（以 caseId+articleId 为唯一键） ─────────────────
  const timestamp = new Date();
  for (const result of report.results) {
    const article = articles.find(a => a.id === result.articleId);
    await prisma.legalReference.upsert({
      where: { caseId_articleId: { caseId, articleId: result.articleId } },
      update: {
        applicabilityScore: result.score,
        applicabilityReason: result.reasons.join('; ') || null,
        analysisResult: result as unknown as Prisma.InputJsonValue,
        analyzedAt: timestamp,
        status: result.applicable ? 'VALID' : 'EXPIRED',
      },
      create: {
        caseId,
        articleId: result.articleId,
        source: 'LAW_ARTICLE',
        content: article?.fullText ?? '',
        lawType: article?.lawType ?? 'OTHER',
        category: article?.category ?? null,
        applicabilityScore: result.score,
        applicabilityReason: result.reasons.join('; ') || null,
        analysisResult: result as unknown as Prisma.InputJsonValue,
        analyzedAt: timestamp,
        status: result.applicable ? 'VALID' : 'EXPIRED',
      },
    });
  }

  // ─── 构造响应 ─────────────────────────────────────────────────────────────
  const applicableCount = report.results.filter(r => r.applicable).length;
  const notApplicableCount = report.results.length - applicableCount;

  return createSuccessResponse({
    analyzedAt: report.analyzedAt,
    totalArticles: report.totalArticles,
    applicableArticles: applicableCount,
    notApplicableArticles: notApplicableCount,
    missingArticleIds: missingIds.length > 0 ? missingIds : undefined,
    results: report.results.map(r => ({
      articleId: r.articleId,
      applicable: r.applicable,
      score: r.score,
      reasons: r.reasons,
      warnings: r.warnings,
      ruleValidation: r.ruleValidation,
    })),
    statistics: report.statistics,
    config: report.config,
  });
});

/**
 * OPTIONS /api/v1/legal-analysis/applicability
 * CORS 预检
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
});
