/**
 * 批量导入优化版本
 *
 * 使用 createMany 批量插入，速度提升 10-50 倍
 */

import Database from 'better-sqlite3';
import {
  PrismaClient,
  LawType,
  LawCategory,
  LawStatus,
  SyncStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

// SQLite 数据库路径
const SQLITE_DB_PATH = 'd:\\pldowns\\npc_laws.db';

// 批量大小
const BATCH_SIZE = 1000;

// 法律类型映射
const LAW_TYPE_MAP: Record<string, LawType> = {
  宪法: LawType.CONSTITUTION,
  法律: LawType.LAW,
  行政法规: LawType.ADMINISTRATIVE_REGULATION,
  监察法规: LawType.ADMINISTRATIVE_REGULATION,
  司法解释: LawType.JUDICIAL_INTERPRETATION,
  地方法规: LawType.LOCAL_REGULATION,
};

// 法律分类映射
function inferLawCategory(title: string): LawCategory {
  if (
    title.includes('民法') ||
    title.includes('合同') ||
    title.includes('物权') ||
    title.includes('侵权')
  ) {
    return LawCategory.CIVIL;
  }
  if (title.includes('刑法') || title.includes('刑事')) {
    return LawCategory.CRIMINAL;
  }
  if (
    title.includes('行政') ||
    title.includes('行政处罚') ||
    title.includes('行政许可')
  ) {
    return LawCategory.ADMINISTRATIVE;
  }
  if (
    title.includes('公司') ||
    title.includes('企业') ||
    title.includes('商业') ||
    title.includes('证券')
  ) {
    return LawCategory.COMMERCIAL;
  }
  if (
    title.includes('劳动') ||
    title.includes('社会保险') ||
    title.includes('工伤')
  ) {
    return LawCategory.LABOR;
  }
  if (
    title.includes('知识产权') ||
    title.includes('专利') ||
    title.includes('商标') ||
    title.includes('著作权')
  ) {
    return LawCategory.INTELLECTUAL_PROPERTY;
  }
  if (title.includes('诉讼') || title.includes('程序')) {
    return LawCategory.PROCEDURE;
  }
  return LawCategory.OTHER;
}

// 提取发布机关
function extractIssuingAuthority(type: string, title: string): string {
  if (type === '宪法') return '全国人民代表大会';
  if (type === '法律') return '全国人民代表大会常务委员会';
  if (type === '行政法规') return '国务院';
  if (type === '监察法规') return '国家监察委员会';
  if (type === '司法解释') {
    if (title.includes('最高人民法院')) return '最高人民法院';
    if (title.includes('最高人民检察院')) return '最高人民检察院';
    return '最高人民法院';
  }
  if (type === '地方法规') {
    const match = title.match(/^(.{2,4})(省|市|自治区)/);
    if (match) return `${match[0]}人民代表大会常务委员会`;
    return '地方人民代表大会常务委员会';
  }
  return '未知';
}

// 生成可搜索文本
function generateSearchableText(
  lawName: string,
  articleNumber: string,
  fullText: string
): string {
  return `${lawName} 第${articleNumber}条 ${fullText}`.toLowerCase();
}

// 解析日期
function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

interface SQLiteLaw {
  id: number;
  type: string;
  type_id: string;
  title: string;
  publish_date: string | null;
  effective_date: string | null;
  status: string;
  url: string | null;
  law_id: string;
  crawl_time: string | null;
  retry_count: number;
  error_msg: string | null;
  document_type: string | null;
  full_text: string | null;
  has_articles: number;
}

interface SQLiteArticle {
  id: number;
  law_id: string;
  chapter_number: string | null;
  chapter_title: string | null;
  article_number: string;
  article_content: string | null;
}

async function main() {
  console.log('🚀 开始批量导入国家法律法规库数据...\n');

  const sqlite = new Database(SQLITE_DB_PATH, { readonly: true });

  try {
    // 统计信息
    const lawCount = sqlite
      .prepare('SELECT COUNT(*) as count FROM laws WHERE status = ?')
      .get('done') as { count: number };
    const articleCount = sqlite
      .prepare('SELECT COUNT(*) as count FROM law_articles')
      .get() as { count: number };

    console.log(`📊 数据统计:`);
    console.log(`   - 法律总数: ${lawCount.count}`);
    console.log(`   - 条文总数: ${articleCount.count}\n`);

    // 获取所有已完成的法律
    const laws = sqlite
      .prepare(
        `
      SELECT * FROM laws
      WHERE status = 'done'
      ORDER BY id
    `
      )
      .all() as SQLiteLaw[];

    console.log(`📥 开始批量导入 ${laws.length} 部法律...\n`);

    let totalArticles = 0;
    let batchData: Array<Record<string, unknown>> = [];

    for (let i = 0; i < laws.length; i++) {
      const law = laws[i];

      // 获取该法律的所有条文
      const articles = sqlite
        .prepare(
          `
        SELECT * FROM law_articles
        WHERE law_id = ?
        ORDER BY id
      `
        )
        .all(law.law_id) as SQLiteArticle[];

      if (articles.length === 0) continue;

      const lawType = LAW_TYPE_MAP[law.type] || LawType.OTHER;
      const category = inferLawCategory(law.title);
      const issuingAuthority = extractIssuingAuthority(law.type, law.title);
      const effectiveDate = parseDate(law.effective_date) || new Date();

      // 准备批量数据
      for (const article of articles) {
        if (!article.article_content) continue;

        const searchableText = generateSearchableText(
          law.title,
          article.article_number,
          article.article_content
        );

        batchData.push({
          lawName: law.title,
          articleNumber: article.article_number,
          fullText: article.article_content,
          lawType,
          category,
          subCategory: article.chapter_title || undefined,
          tags: [law.type],
          keywords: [],
          version: '1.0',
          effectiveDate,
          status: LawStatus.VALID,
          chapterNumber: article.chapter_number || undefined,
          level: 0,
          issuingAuthority,
          searchableText,
          dataSource: 'npc',
          sourceId: law.law_id,
          importedAt: new Date(),
          lastSyncedAt: new Date(),
          syncStatus: SyncStatus.SYNCED,
        });

        // 达到批量大小时执行插入
        if (batchData.length >= BATCH_SIZE) {
          await prisma.lawArticle.createMany({
            data: batchData,
            skipDuplicates: true,
          });

          totalArticles += batchData.length;
          console.log(
            `✅ 进度: ${i + 1}/${laws.length} (${Math.round(((i + 1) / laws.length) * 100)}%) - 已导入 ${totalArticles} 条`
          );

          batchData = [];
        }
      }
    }

    // 插入剩余数据
    if (batchData.length > 0) {
      await prisma.lawArticle.createMany({
        data: batchData,
        skipDuplicates: true,
      });
      totalArticles += batchData.length;
    }

    console.log('\n✨ 批量导入完成！');
    console.log(`📊 统计结果:`);
    console.log(`   - 成功导入法律: ${laws.length}`);
    console.log(`   - 成功导入条文: ${totalArticles}`);
  } catch (error) {
    console.error('❌ 导入过程中发生错误:', error);
    throw error;
  } finally {
    sqlite.close();
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
