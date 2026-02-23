/**
 * 用户法条行为服务
 *
 * 功能：
 * 1. 记录用户搜索行为
 * 2. 记录用户浏览行为
 * 3. 计算用户兴趣
 * 4. 判断是否为新用户
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * 记录用户搜索行为
 */
export async function logSearchHistory(params: {
  userId: string;
  keyword: string;
  category?: string;
  lawType?: string;
  resultsCount: number;
  clickedId?: string;
}) {
  try {
    await prisma.userSearchHistory.create({
      data: {
        userId: params.userId,
        keyword: params.keyword,
        category: params.category,
        lawType: params.lawType,
        resultsCount: params.resultsCount,
        clickedId: params.clickedId,
      },
    });

    // 如果用户点击了某个法条，同时更新兴趣
    if (params.clickedId) {
      await updateUserInterestFromSearch(
        params.userId,
        params.keyword,
        params.category
      );
    }
  } catch (error) {
    logger.error('记录搜索历史失败:', error);
  }
}

/**
 * 记录用户浏览法条行为
 */
export async function logLawArticleView(params: {
  userId: string;
  lawArticleId: string;
  viewDuration?: number;
}) {
  try {
    // 使用 upsert 避免重复记录
    await prisma.userLawArticleView.upsert({
      where: {
        userId_lawArticleId: {
          userId: params.userId,
          lawArticleId: params.lawArticleId,
        },
      },
      update: {
        viewDuration: params.viewDuration,
        createdAt: new Date(), // 更新浏览时间
      },
      create: {
        userId: params.userId,
        lawArticleId: params.lawArticleId,
        viewDuration: params.viewDuration,
      },
    });

    // 更新用户兴趣
    await updateUserInterestFromView(params.userId, params.lawArticleId);
  } catch (error) {
    logger.error('记录浏览历史失败:', error);
  }
}

/**
 * 根据搜索行为更新用户兴趣
 */
async function updateUserInterestFromSearch(
  userId: string,
  keyword: string,
  category?: string
) {
  try {
    // 如果搜索时选择了分类，增加该分类的兴趣分数
    if (category) {
      await prisma.userInterest.upsert({
        where: {
          userId_category: {
            userId,
            category,
          },
        },
        update: {
          score: {
            increment: 5, // 每次搜索 +5 分
          },
        },
        create: {
          userId,
          category,
          score: 5,
        },
      });
    }

    // 分析关键词推断兴趣类别（简化版）
    const keywordCategoryMap: Record<string, string> = {
      民法: 'CIVIL',
      民事: 'CIVIL',
      合同: 'CIVIL',
      侵权: 'CIVIL',
      婚姻: 'CIVIL',
      继承: 'CIVIL',
      刑法: 'CRIMINAL',
      刑事: 'CRIMINAL',
      犯罪: 'CRIMINAL',
      行政: 'ADMINISTRATIVE',
      行政处罚: 'ADMINISTRATIVE',
      行政许可: 'ADMINISTRATIVE',
      劳动: 'LABOR',
      劳动合同: 'LABOR',
      工伤: 'LABOR',
      商事: 'COMMERCIAL',
      公司: 'COMMERCIAL',
      证券: 'COMMERCIAL',
      知识产权: 'INTELLECTUAL_PROPERTY',
      专利: 'INTELLECTUAL_PROPERTY',
      商标: 'INTELLECTUAL_PROPERTY',
      著作权: 'INTELLECTUAL_PROPERTY',
      经济: 'ECONOMIC',
      税收: 'ECONOMIC',
      诉讼: 'PROCEDURE',
      仲裁: 'PROCEDURE',
      民事诉讼: 'PROCEDURE',
    };

    for (const [key, cat] of Object.entries(keywordCategoryMap)) {
      if (keyword.includes(key)) {
        await prisma.userInterest.upsert({
          where: {
            userId_category: {
              userId,
              category: cat,
            },
          },
          update: {
            score: {
              increment: 3, // 每次关键词匹配 +3 分
            },
          },
          create: {
            userId,
            category: cat,
            score: 3,
          },
        });
        break; // 只匹配一个类别
      }
    }
  } catch (error) {
    logger.error('更新搜索兴趣失败:', error);
  }
}

/**
 * 根据浏览行为更新用户兴趣
 */
async function updateUserInterestFromView(
  userId: string,
  lawArticleId: string
) {
  try {
    // 获取法条信息
    const article = await prisma.lawArticle.findUnique({
      where: { id: lawArticleId },
      select: { category: true },
    });

    if (article) {
      await prisma.userInterest.upsert({
        where: {
          userId_category: {
            userId,
            category: article.category,
          },
        },
        update: {
          score: {
            increment: 2, // 每次浏览 +2 分
          },
        },
        create: {
          userId,
          category: article.category,
          score: 2,
        },
      });
    }
  } catch (error) {
    logger.error('更新浏览兴趣失败:', error);
  }
}

/**
 * 判断是否为新用户
 * 新用户定义：搜索历史 < 5 条 且 浏览历史 < 10 条
 */
export async function isNewUser(userId: string): Promise<boolean> {
  const searchCount = await prisma.userSearchHistory.count({
    where: { userId },
  });

  const viewCount = await prisma.userLawArticleView.count({
    where: { userId },
  });

  return searchCount < 5 && viewCount < 10;
}

/**
 * 获取用户兴趣列表
 */
export async function getUserInterests(userId: string) {
  return prisma.userInterest.findMany({
    where: { userId },
    orderBy: { score: 'desc' },
  });
}

/**
 * 获取用户热门搜索关键词
 */
export async function getUserTopKeywords(userId: string, limit: number = 10) {
  const keywords = await prisma.userSearchHistory.groupBy({
    by: ['keyword'],
    where: { userId },
    _count: {
      keyword: true,
    },
    orderBy: {
      _count: {
        keyword: 'desc',
      },
    },
    take: limit,
  });

  return keywords.map(k => ({
    keyword: k.keyword,
    count: k._count.keyword,
  }));
}

/**
 * 获取用户浏览最多的法条ID列表
 */
export async function getUserTopViewedArticleIds(
  userId: string,
  limit: number = 10
): Promise<string[]> {
  const views = await prisma.userLawArticleView.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit * 2,
  });

  // 按 lawArticleId 分组，取最新的
  const articleIds = new Set<string>();
  for (const view of views) {
    if (articleIds.size >= limit) break;
    articleIds.add(view.lawArticleId);
  }

  return Array.from(articleIds);
}
