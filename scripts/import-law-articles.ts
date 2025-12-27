import { PrismaClient, LawCategory, LawType, LawStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * 法条数据导入脚本
 * 用于导入基础法条数据到数据库
 */

interface LawArticleData {
  lawName: string;
  articleNumber: string;
  fullText: string;
  lawType: string;
  category: string;
  subCategory: string;
  tags: string[];
  keywords: string[];
  version: string;
  effectiveDate: string;
  status: string;
  issuingAuthority: string;
  jurisdiction: string;
  searchableText: string;
  viewCount: number;
  referenceCount: number;
}

interface LawArticleFile {
  data: LawArticleData[];
}

// 法律类别映射
const CATEGORY_MAP: Record<string, LawCategory> = {
  CIVIL: 'CIVIL',
  CRIMINAL: 'CRIMINAL',
  ADMINISTRATIVE: 'ADMINISTRATIVE',
  COMMERCIAL: 'COMMERCIAL',
  LABOR: 'LABOR',
  PROCEDURAL: 'PROCEDURE',
  INTELLECTUAL: 'INTELLECTUAL_PROPERTY',
};

// 法律类型映射
const LAWTYPE_MAP: Record<string, LawType> = {
  LAW: 'LAW',
  CONSTITUTION: 'CONSTITUTION',
  ADMINISTRATIVE_REGULATION: 'ADMINISTRATIVE_REGULATION',
  LOCAL_REGULATION: 'LOCAL_REGULATION',
  JUDICIAL_INTERPRETATION: 'JUDICIAL_INTERPRETATION',
  DEPARTMENTAL_RULE: 'DEPARTMENTAL_RULE',
  OTHER: 'OTHER',
};

/**
 * 验证法条数据格式
 */
function validateArticleData(article: LawArticleData): boolean {
  const requiredFields = [
    'lawName',
    'articleNumber',
    'fullText',
    'category',
    'subCategory',
  ];

  for (const field of requiredFields) {
    if (!article[field]) {
      console.error(`法条缺少必要字段: ${field}`);
      return false;
    }
  }

  if (!CATEGORY_MAP[article.category]) {
    console.error(`无效的法律类别: ${article.category}`);
    return false;
  }

  return true;
}

/**
 * 从JSON文件读取法条数据
 */
function loadArticlesFromFile(filePath: string): LawArticleData[] {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    const data: LawArticleFile = JSON.parse(fileContent);
    return data.data;
  } catch (error) {
    console.error(`读取文件失败: ${filePath}`, error);
    return [];
  }
}

/**
 * 导入单个法条
 */
async function importArticle(article: LawArticleData): Promise<boolean> {
  try {
    // 先查找是否存在
    const existing = await prisma.lawArticle.findFirst({
      where: {
        lawName: article.lawName,
        articleNumber: article.articleNumber,
      },
    });

    if (existing) {
      // 如果存在，则更新
      await prisma.lawArticle.update({
        where: {
          id: existing.id,
        },
        data: {
          fullText: article.fullText,
          category: CATEGORY_MAP[article.category],
          subCategory: article.subCategory,
          tags: article.tags,
          keywords: article.keywords,
          effectiveDate: new Date(article.effectiveDate),
          status: article.status === 'VALID' ? LawStatus.VALID : LawStatus.DRAFT,
          jurisdiction: article.jurisdiction,
          searchableText: article.searchableText,
        },
      });
    } else {
      // 如果不存在，则创建
      await prisma.lawArticle.create({
        data: {
          lawName: article.lawName,
          articleNumber: article.articleNumber,
          fullText: article.fullText,
          lawType: LAWTYPE_MAP[article.lawType] || LawType.LAW,
          category: CATEGORY_MAP[article.category],
          subCategory: article.subCategory,
          tags: article.tags,
          keywords: article.keywords,
          version: article.version,
          effectiveDate: new Date(article.effectiveDate),
          status: article.status === 'VALID' ? LawStatus.VALID : LawStatus.DRAFT,
          issuingAuthority: article.issuingAuthority,
          jurisdiction: article.jurisdiction,
          searchableText: article.searchableText,
          viewCount: article.viewCount,
          referenceCount: article.referenceCount,
        },
      });
    }

    return true;
  } catch (error) {
    console.error(`导入法条失败: ${article.lawName} ${article.articleNumber}`, error);
    return false;
  }
}

/**
 * 创建法条索引
 */
async function createIndexes(): Promise<void> {
  try {
    console.log('创建法条索引...');

    // 简单索引（不需要pg_trgm扩展）
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "idx_law_article_category_sub" 
      ON "law_articles" ("category", "subCategory")
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "idx_law_article_status" 
      ON "law_articles" ("status")
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "idx_law_article_law_type" 
      ON "law_articles" ("lawType")
    `;

    // 尝试创建GIN索引（需要pg_trgm扩展）
    try {
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "idx_law_article_keywords" 
        ON "law_articles" USING gin ("keywords")
      `;

      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "idx_law_article_tags" 
        ON "law_articles" USING gin ("tags")
      `;
    } catch (ginError) {
      console.warn('GIN索引创建失败（需要pg_trgm扩展）:', ginError);
    }

    console.log('法条索引创建完成');
  } catch (error) {
    console.error('创建索引失败:', error);
  }
}

/**
 * 主导入流程
 */
async function main() {
  console.log('开始导入法条数据...\n');

  const dataFiles = [
    'data/law-articles-civil-contract.json',
    'data/law-articles-criminal.json',
    'data/law-articles-administrative.json',
    'data/law-articles-commercial.json',
    'data/law-articles-labor.json',
    'data/law-articles-procedural.json',
    'data/law-articles-intellectual.json',
  ];

  let totalArticles = 0;
  let successCount = 0;
  let failCount = 0;

  // 导入所有法条数据
  for (const dataFile of dataFiles) {
    console.log(`处理文件: ${dataFile}`);
    const articles = loadArticlesFromFile(dataFile);

    for (const article of articles) {
      totalArticles++;

      if (!validateArticleData(article)) {
        failCount++;
        continue;
      }

      const success = await importArticle(article);
      if (success) {
        successCount++;
        console.log(`  ✓ ${article.lawName} ${article.articleNumber}`);
      } else {
        failCount++;
      }
    }

    console.log(`  完成 ${articles.length} 条法条\n`);
  }

  // 创建索引
  await createIndexes();

  // 统计结果
  console.log('\n导入完成！');
  console.log('====================');
  console.log(`总法条数: ${totalArticles}`);
  console.log(`成功导入: ${successCount}`);
  console.log(`导入失败: ${failCount}`);
  console.log('====================\n');

  // 验证导入结果
  const countByCategory = await prisma.lawArticle.groupBy({
    by: ['category'],
    _count: true,
  });

  console.log('按类别统计导入结果：');
  for (const item of countByCategory) {
    console.log(`  ${item.category}: ${item._count} 条`);
  }
}

main()
  .catch((e) => {
    console.error('导入失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
