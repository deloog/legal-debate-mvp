/**
 * 辩论推荐API路由
 * GET /api/v1/debates/[id]/recommendations
 *
 * 功能：为指定辩论推荐相关法条
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { searchAllLawArticles } from '@/lib/debate/law-search';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

/**
 * 获取辩论推荐法条
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: '未授权，请先登录' },
      { status: 401 }
    );
  }

  try {
    const { id: debateId } = await params;
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const limitParam = searchParams.get('limit');
    const minScoreParam = searchParams.get('minScore');

    // 验证参数
    let limit = 10; // 默认值
    let minScore = 0; // 默认值

    if (limitParam !== null) {
      limit = parseInt(limitParam, 10);
      if (isNaN(limit) || limit <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'limit参数必须是大于0的整数',
          },
          { status: 400 }
        );
      }
      // 限制最大值
      if (limit > 100) {
        limit = 100;
      }
    }

    if (minScoreParam !== null) {
      minScore = parseFloat(minScoreParam);
      if (isNaN(minScore) || minScore < 0 || minScore > 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'minScore参数必须是0到1之间的数字',
          },
          { status: 400 }
        );
      }
    }

    // 获取辩论信息
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      select: {
        id: true,
        caseId: true,
        title: true,
        status: true,
      },
    });

    if (!debate) {
      return NextResponse.json(
        {
          success: false,
          error: '辩论不存在',
        },
        { status: 404 }
      );
    }

    // 获取关联案件信息（含所有者校验）
    const caseInfo = await prisma.case.findUnique({
      where: { id: debate.caseId },
      select: {
        id: true,
        userId: true,
        title: true,
        description: true,
        type: true,
        cause: true,
        metadata: true,
      },
    });

    if (!caseInfo) {
      return NextResponse.json(
        {
          success: false,
          error: '关联案件不存在',
        },
        { status: 404 }
      );
    }

    // 校验案件归属（防止 IDOR）
    if (caseInfo.userId !== authUser.userId) {
      return NextResponse.json(
        { success: false, error: '无权访问此辩论' },
        { status: 403 }
      );
    }

    // 使用关键词检索引擎获取相关法条（比 category 过滤更可靠）
    const { articles, localCount, lawstarCount } = await searchAllLawArticles(
      caseInfo.type,
      caseInfo.title,
      caseInfo.description,
      limit,
      Math.ceil(limit / 2)
    );

    // 将 LocalArticle 转为组件期望的推荐格式
    const total = articles.length || 1;
    const recommendations = articles.map((a, i) => {
      // 分数：本地DB文章从0.9递减，LawStar补充文章约0.5
      const isLocal = !!a.id;
      const baseScore = isLocal ? 0.9 - (i / total) * 0.35 : 0.5;
      const score = Math.max(baseScore, 0.1);

      const reason = isLocal ? '与案件类型和关键词匹配' : '通过语义检索匹配';

      return {
        article: {
          id: a.id ?? `lawstar_${a.lawName}_${a.articleNumber}`,
          lawName: a.lawName,
          articleNumber: a.articleNumber,
          fullText: a.fullText,
          category: String(a.category),
          effectiveDate: new Date(0),
          status: 'VALID',
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
        score,
        reason,
      };
    });

    // 过滤 minScore
    const filtered =
      minScore > 0
        ? recommendations.filter(r => r.score >= minScore)
        : recommendations;

    logger.info(
      `[recommendations] 辩论 ${debate.id} 推荐法条：本地 ${localCount} 条，LawStar ${lawstarCount} 条，共 ${filtered.length} 条`
    );

    // 返回结果
    return NextResponse.json(
      {
        success: true,
        recommendations: filtered,
        metadata: {
          debateId: debate.id,
          debateTitle: debate.title,
          caseId: caseInfo.id,
          caseTitle: caseInfo.title,
          caseType: caseInfo.type,
          totalCount: filtered.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('获取辩论推荐失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取推荐失败',
      },
      { status: 500 }
    );
  }
}
