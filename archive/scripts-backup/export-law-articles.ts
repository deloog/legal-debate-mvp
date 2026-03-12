/**
 * 法律法规数据导出脚本
 * 输出：./data/export/ 目录下的 JSONL 文件（每行一条记录）
 * 用法：npx ts-node scripts/export-law-articles.ts
 *
 * 使用游标分页（cursor-based）避免大 offset 导致的内存和性能问题
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'export');
const BATCH_SIZE = 200;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function exportLawArticles() {
  const total = await prisma.lawArticle.count();
  console.log(`\n导出 law_articles：共 ${total} 条`);

  const filePath = path.join(OUTPUT_DIR, 'law_articles.jsonl');
  const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });

  let exported = 0;
  let cursor: string | undefined = undefined;

  while (true) {
    const rows = cursor
      ? await prisma.lawArticle.findMany({
          take: BATCH_SIZE,
          skip: 1,
          cursor: { id: cursor },
          orderBy: { id: 'asc' },
        })
      : await prisma.lawArticle.findMany({
          take: BATCH_SIZE,
          orderBy: { id: 'asc' },
        });

    if (rows.length === 0) break;

    for (const row of rows) {
      stream.write(JSON.stringify(row) + '\n');
    }

    exported += rows.length;
    cursor = rows[rows.length - 1].id;
    process.stdout.write(`\r  进度：${exported}/${total}`);

    if (rows.length < BATCH_SIZE) break;
  }

  await new Promise<void>(resolve => stream.end(resolve));
  console.log(`\n  已写入：${filePath}`);
  return exported;
}

async function exportLawArticleRelations() {
  const total = await prisma.lawArticleRelation.count();
  console.log(`\n导出 law_article_relations：共 ${total} 条`);

  if (total === 0) {
    console.log('  无数据，跳过');
    return 0;
  }

  const filePath = path.join(OUTPUT_DIR, 'law_article_relations.jsonl');
  const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });

  let exported = 0;
  let cursor: string | undefined = undefined;

  while (true) {
    const rows = cursor
      ? await prisma.lawArticleRelation.findMany({
          take: BATCH_SIZE,
          skip: 1,
          cursor: { id: cursor },
          orderBy: { id: 'asc' },
        })
      : await prisma.lawArticleRelation.findMany({
          take: BATCH_SIZE,
          orderBy: { id: 'asc' },
        });

    if (rows.length === 0) break;

    for (const row of rows) {
      stream.write(JSON.stringify(row) + '\n');
    }

    exported += rows.length;
    cursor = rows[rows.length - 1].id;
    process.stdout.write(`\r  进度：${exported}/${total}`);

    if (rows.length < BATCH_SIZE) break;
  }

  await new Promise<void>(resolve => stream.end(resolve));
  console.log(`\n  已写入：${filePath}`);
  return exported;
}

async function main() {
  ensureDir(OUTPUT_DIR);

  // 清除上次不完整的导出
  const oldFile = path.join(OUTPUT_DIR, 'law_articles.jsonl');
  if (fs.existsSync(oldFile)) {
    fs.unlinkSync(oldFile);
    console.log('已清除上次不完整的导出文件');
  }

  const meta = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    tables: ['law_articles', 'law_article_relations'],
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'meta.json'),
    JSON.stringify(meta, null, 2)
  );

  const t0 = Date.now();
  const articleCount = await exportLawArticles();
  const relationCount = await exportLawArticleRelations();
  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);

  console.log(`\n✓ 导出完成！耗时 ${elapsed} 分钟`);
  console.log(`  law_articles: ${articleCount} 条`);
  console.log(`  law_article_relations: ${relationCount} 条`);
  console.log(`  文件位于：${OUTPUT_DIR}`);
}

main()
  .catch(e => {
    console.error('导出失败：', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
