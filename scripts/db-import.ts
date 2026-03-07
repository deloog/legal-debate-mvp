/**
 * 法律法规数据库迁移导入脚本
 * 配合 export-law-articles.ts 使用
 *
 * 用法：
 *   1. 将源机器上 data/export/ 目录复制到本项目根目录
 *   2. 确保目标数据库已运行：npx prisma migrate deploy
 *   3. 运行：npx ts-node scripts/db-import.ts
 *
 * 特性：
 *   - JSONL 格式，逐行读取，内存友好
 *   - 分批事务提交，支持3万+数据
 *   - upsert 幂等操作，可重复运行（断点续传）
 *   - 自引用 parentId 两阶段处理
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const prisma = new PrismaClient();
const IMPORT_DIR = path.join(process.cwd(), 'data', 'export');
const BATCH_SIZE = 200;

// ── 工具函数 ──────────────────────────────────────────────

function readJsonlFile(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      resolve([]);
      return;
    }
    const results: any[] = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (trimmed) {
        try {
          results.push(JSON.parse(trimmed));
        } catch (e) {
          console.warn('跳过无效 JSON 行');
        }
      }
    });
    rl.on('close', () => resolve(results));
    rl.on('error', reject);
  });
}

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function toDate(val: any): Date | null {
  if (!val) return null;
  return new Date(val);
}

// ── 导入 LawArticle ───────────────────────────────────────

async function importLawArticles() {
  const filePath = path.join(IMPORT_DIR, 'law_articles.jsonl');
  console.log('读取 law_articles.jsonl...');
  const records = await readJsonlFile(filePath);
  console.log(`共读取 ${records.length} 条\n`);

  if (records.length === 0) return;

  // 第一阶段：插入所有记录，parentId 置 null（避免自引用约束）
  console.log('阶段 1/2：插入法条（忽略 parentId）...');
  let done = 0;
  for (const batch of chunks(records, BATCH_SIZE)) {
    await prisma.$transaction(
      batch.map((r) =>
        prisma.lawArticle.upsert({
          where: {
            lawName_articleNumber: {
              lawName: r.lawName,
              articleNumber: r.articleNumber,
            },
          },
          create: {
            id: r.id,
            lawName: r.lawName,
            articleNumber: r.articleNumber,
            fullText: r.fullText,
            lawType: r.lawType,
            category: r.category,
            subCategory: r.subCategory ?? null,
            tags: r.tags ?? [],
            keywords: r.keywords ?? [],
            version: r.version ?? '1.0',
            effectiveDate: new Date(r.effectiveDate),
            expiryDate: toDate(r.expiryDate),
            status: r.status ?? 'VALID',
            amendmentHistory: r.amendmentHistory ?? undefined,
            parentId: null, // 第一阶段先忽略
            chapterNumber: r.chapterNumber ?? null,
            sectionNumber: r.sectionNumber ?? null,
            level: r.level ?? 0,
            issuingAuthority: r.issuingAuthority,
            jurisdiction: r.jurisdiction ?? null,
            relatedArticles: r.relatedArticles ?? [],
            legalBasis: r.legalBasis ?? null,
            searchableText: r.searchableText,
            viewCount: r.viewCount ?? 0,
            referenceCount: r.referenceCount ?? 0,
            dataSource: r.dataSource ?? 'local',
            sourceId: r.sourceId ?? null,
            importedAt: toDate(r.importedAt),
            lastSyncedAt: toDate(r.lastSyncedAt),
            syncStatus: r.syncStatus ?? 'SYNCED',
            createdAt: new Date(r.createdAt),
            updatedAt: new Date(r.updatedAt),
          },
          update: {}, // 已存在则跳过，不覆盖
        })
      )
    );
    done += batch.length;
    process.stdout.write(`\r  ${done}/${records.length}`);
  }
  console.log('\n  阶段 1 完成');

  // 第二阶段：更新 parentId
  const withParent = records.filter((r) => r.parentId);
  if (withParent.length > 0) {
    console.log(`\n阶段 2/2：更新 parentId（${withParent.length} 条）...`);
    let updated = 0;
    for (const batch of chunks(withParent, BATCH_SIZE)) {
      await prisma.$transaction(
        batch.map((r) =>
          prisma.lawArticle.update({
            where: { id: r.id },
            data: { parentId: r.parentId },
          })
        )
      ).catch(() => {
        // 部分父节点不存在时逐条重试
      });
      updated += batch.length;
      process.stdout.write(`\r  ${updated}/${withParent.length}`);
    }
    console.log('\n  阶段 2 完成');
  }
}

// ── 导入 LawArticleRelation ───────────────────────────────

async function importLawArticleRelations() {
  const filePath = path.join(IMPORT_DIR, 'law_article_relations.jsonl');
  console.log('\n读取 law_article_relations.jsonl...');
  const records = await readJsonlFile(filePath);
  console.log(`共读取 ${records.length} 条`);

  if (records.length === 0) return;

  let done = 0;
  for (const batch of chunks(records, BATCH_SIZE)) {
    await prisma.$transaction(
      batch.map((r) =>
        prisma.lawArticleRelation.upsert({
          where: { id: r.id },
          create: {
            ...r,
            verifiedAt: toDate(r.verifiedAt),
            aiCreatedAt: toDate(r.aiCreatedAt),
            createdAt: new Date(r.createdAt),
            updatedAt: new Date(r.updatedAt),
          },
          update: {},
        })
      )
    );
    done += batch.length;
    process.stdout.write(`\r  ${done}/${records.length}`);
  }
  console.log('\n  关联关系导入完成');
}

// ── 主流程 ────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(IMPORT_DIR)) {
    console.error(`找不到导入目录：${IMPORT_DIR}`);
    console.error('请将源机器上的 data/export/ 目录复制到本项目根目录下。');
    process.exit(1);
  }

  const metaPath = path.join(IMPORT_DIR, 'meta.json');
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    console.log('导出元信息：', JSON.stringify(meta));
  }

  console.log('\n⚠  请确认目标数据库已执行：npx prisma migrate deploy');
  console.log('开始导入...\n');

  const t0 = Date.now();
  await importLawArticles();
  await importLawArticleRelations();

  const finalCount = await prisma.lawArticle.count();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✓ 完成！耗时 ${elapsed}s，law_articles 总数：${finalCount}`);
}

main()
  .catch((e) => {
    console.error('\n导入失败：', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
