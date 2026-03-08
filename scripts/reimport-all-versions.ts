/**
 * 全量重导入脚本（支持历史版本）
 *
 * 解决问题：原来 @@unique([lawName, articleNumber]) 导致同名法律不同版本互相覆盖。
 * 现在改为 @@unique([lawName, articleNumber, effectiveDate])，同一法律的每个时间版本单独存储。
 *
 * 前置条件（在另一台电脑上运行）：
 *   1. git pull 拿到最新代码
 *   2. 将 data/crawled/flk/export.json 和 data/crawled/flk/parsed/ 从U盘复制到项目对应路径
 *   3. npx prisma migrate deploy（应用新的 schema 迁移）
 *   4. 清空 law_articles 表（脚本会提示确认）
 *   5. npx ts-node --transpile-only scripts/reimport-all-versions.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const p = new PrismaClient();
const PARSED_DIR = path.join(process.cwd(), 'data/crawled/flk/parsed');
const EXPORT_JSON = path.join(process.cwd(), 'data/crawled/flk/export.json');
const BATCH_SIZE = 100;

// FLK 状态 → DB 状态映射
const STATUS_MAP: Record<string, string> = {
  valid: 'VALID',
  amended: 'AMENDED',
  repealed: 'REPEALED',
  draft: 'DRAFT',
};

// FLK 类别代码 → LawType
const LAWTYPE_MAP: Record<number, string> = {
  100: 'CONSTITUTION',
  110: 'LAW',
  120: 'LAW',
  130: 'JUDICIAL_INTERPRETATION',
  140: 'ADMINISTRATIVE_REGULATION',
  150: 'DEPARTMENTAL_RULE',
  160: 'LOCAL_REGULATION',
  170: 'LOCAL_REGULATION',
  180: 'LOCAL_REGULATION',
  200: 'LOCAL_REGULATION',
  210: 'DEPARTMENTAL_RULE',
  220: 'DEPARTMENTAL_RULE',
};

// FLK 类别 → LawCategory
const CATEGORY_MAP: Record<string, string> = {
  '宪法': 'OTHER',
  '民法': 'CIVIL',
  '刑法': 'CRIMINAL',
  '行政法': 'ADMINISTRATIVE',
  '经济法': 'ECONOMIC',
  '劳动法': 'LABOR',
  '诉讼法': 'PROCEDURE',
  '知识产权': 'INTELLECTUAL_PROPERTY',
  '商法': 'COMMERCIAL',
};

function getLawCategory(category: string): string {
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (category.includes(key)) return val;
  }
  return 'OTHER';
}

// 按条文拆分全文
function splitArticles(text: string): { articleNumber: string; content: string }[] {
  const articles: { articleNumber: string; content: string }[] = [];
  // 匹配"第X条"开头，支持中文数字
  const pattern = /第[一二三四五六七八九十百千零〇\d]+条[　\s]*/g;
  const matches = [...text.matchAll(pattern)];

  if (matches.length === 0) {
    // 没有条文结构，整体作为一条
    const clean = text.trim();
    if (clean.length > 10) {
      articles.push({ articleNumber: '全文', content: clean });
    }
    return articles;
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = match.index! + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const articleNumber = match[0].trim().replace(/[　\s]+$/, '');
    const content = text.slice(start, end).trim();
    if (content.length > 0) {
      articles.push({ articleNumber, content });
    }
  }
  return articles;
}

// 确认操作
async function confirm(msg: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`${msg} (y/N): `, ans => {
      rl.close();
      resolve(ans.trim().toLowerCase() === 'y');
    });
  });
}

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

async function main() {
  // 检查文件
  if (!fs.existsSync(EXPORT_JSON)) {
    console.error(`找不到 ${EXPORT_JSON}`);
    console.error('请将 export.json 从U盘复制到 data/crawled/flk/ 目录');
    process.exit(1);
  }
  if (!fs.existsSync(PARSED_DIR)) {
    console.error(`找不到 ${PARSED_DIR}`);
    console.error('请将 parsed/ 目录从U盘复制到 data/crawled/flk/ 目录');
    process.exit(1);
  }

  console.log('读取 export.json...');
  const exportData = JSON.parse(fs.readFileSync(EXPORT_JSON, 'utf8'));
  const docs: any[] = exportData.items;
  console.log(`共 ${docs.length} 个文档`);

  const currentCount = await p.lawArticle.count();
  console.log(`\n当前数据库 law_articles: ${currentCount} 条`);
  console.log('⚠️  即将清空 law_articles 表，重新导入所有版本（包含历史版本）');

  const ok = await confirm('确认继续？');
  if (!ok) { console.log('已取消'); return; }

  // 清空表
  console.log('\n清空 law_articles...');
  await p.lawArticle.deleteMany({});
  console.log('已清空');

  const t0 = Date.now();
  let totalDocs = 0;
  let totalArticles = 0;
  let skippedDocs = 0;

  for (const batchDocs of chunks(docs, 10)) {
    const records: any[] = [];

    for (const doc of batchDocs) {
      const txtPath = path.join(PARSED_DIR, `${doc.sourceId}.txt`);
      if (!fs.existsSync(txtPath)) {
        skippedDocs++;
        continue;
      }

      const text = fs.readFileSync(txtPath, 'utf8');
      const articles = splitArticles(text);
      if (articles.length === 0) {
        skippedDocs++;
        continue;
      }

      const effectiveDate = doc.effectiveDate
        ? new Date(doc.effectiveDate)
        : new Date(doc.publishDate || '2000-01-01');

      const lawType = LAWTYPE_MAP[doc.categoryCode] || 'OTHER';
      const category = getLawCategory(doc.category || '');
      const status = STATUS_MAP[doc.status] || 'VALID';

      for (const art of articles) {
        records.push({
          lawName: doc.title,
          articleNumber: art.articleNumber,
          fullText: art.content,
          searchableText: art.content.slice(0, 500),
          lawType,
          category,
          issuingAuthority: doc.issuingAuthority || '未知',
          effectiveDate,
          status,
          dataSource: 'flk',
          sourceId: doc.sourceId,
          version: '1.0',
          level: 0,
          tags: [],
          keywords: [],
          relatedArticles: [],
          importedAt: new Date(),
        });
      }

      totalDocs++;
      totalArticles += articles.length;
    }

    // 分批写入
    for (const batch of chunks(records, BATCH_SIZE)) {
      await p.$transaction(
        batch.map(r =>
          p.lawArticle.upsert({
            where: {
              lawName_articleNumber_effectiveDate: {
                lawName: r.lawName,
                articleNumber: r.articleNumber,
                effectiveDate: r.effectiveDate,
              },
            },
            create: r,
            update: {},
          })
        )
      );
    }

    process.stdout.write(`\r  处理文档: ${totalDocs}/${docs.length}，法条: ${totalArticles}`);
  }

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  const finalCount = await p.lawArticle.count();

  console.log(`\n\n✓ 导入完成！耗时 ${elapsed} 分钟`);
  console.log(`  处理文档: ${totalDocs}（跳过: ${skippedDocs}）`);
  console.log(`  写入法条: ${totalArticles}`);
  console.log(`  数据库验证: ${finalCount} 条`);

  // 版本分布统计
  const versions = await p.$queryRaw<any[]>`
    SELECT "lawName", COUNT(*) as version_count
    FROM law_articles
    GROUP BY "lawName"
    HAVING COUNT(*) > 24
    ORDER BY version_count DESC
    LIMIT 5
  `;
  console.log('\n历史版本最多的法律（Top 5）:');
  versions.forEach((r: any) =>
    console.log(`  ${r.lawName?.slice(0, 40)} → ${r.version_count} 条（含多版本）`)
  );
}

main().catch(e => {
  console.error('\n失败：', e);
  process.exit(1);
}).finally(() => p.$disconnect());
