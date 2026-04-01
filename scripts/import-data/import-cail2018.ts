/**
 * 导入 CAIL2018 刑事裁判文书数据集到案例库
 *
 * 数据集来源：https://github.com/thunlp/CAIL2018
 * 格式：每行一个JSON对象（JSONL），字段：fact, meta
 *
 * 使用方法：
 *   1. 下载数据集：
 *      curl -L "https://cail.oss-cn-qingdao.aliyuncs.com/CAIL2018_ALL_DATA.zip" -o data/cail2018.zip
 *      unzip data/cail2018.zip -d data/cail2018/
 *      小数据集（~19.6万条）：data/cail2018/CAIL2018_ALL_DATA/final_all_data/exercise_contest/data_train.json
 *   2. 运行：npx ts-node --project scripts/tsconfig.json scripts/import-data/import-cail2018.ts [文件路径]
 *
 * 字段映射：
 *   fact              → facts（案情经过）
 *   meta.accusation   → cause（罪名，多个用顿号连接）
 *   meta.criminals    → title（被告人 + 罪名组合）
 *   meta.relevant_articles → metadata.articles
 *   term_of_imprisonment → result 推断（有实刑=WIN即定罪，无刑=LOSE即无罪）
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { PrismaClient, CaseType, CaseResult } from '@prisma/client';

const prisma = new PrismaClient();
const DATA_SOURCE = 'cail2018';

// CAIL2018 原始数据格式
interface Cail2018Meta {
  accusation: string[];
  relevant_articles: number[];
  term_of_imprisonment: {
    imprisonment: number;       // 有期徒刑月数，-1=无期，0=无刑
    death_penalty: boolean;
    life_imprisonment: boolean;
  };
  criminals: string[];
  punish_of_money: number;      // 罚金（元）
}

interface Cail2018Record {
  fact: string;
  meta: Cail2018Meta;
}

/**
 * 根据刑期信息推断案件结果
 * 有罪判决（定罪）→ WIN；免于刑事处罚/证据不足 → LOSE
 */
function inferResult(meta: Cail2018Meta): CaseResult {
  const t = meta.term_of_imprisonment;
  if (t.death_penalty || t.life_imprisonment || t.imprisonment > 0) {
    return 'WIN'; // 检察机关胜诉（被告人被定罪）
  }
  if (t.imprisonment === 0 && !t.death_penalty && !t.life_imprisonment) {
    if (meta.punish_of_money > 0) return 'PARTIAL'; // 仅罚金
    return 'LOSE';
  }
  return 'WIN';
}

function buildTitle(meta: Cail2018Meta, index: number): string {
  const criminals = meta.criminals.slice(0, 2).join('、') || `被告人${index}`;
  const accusation = meta.accusation.slice(0, 2).join('、') || '刑事案件';
  return `${criminals}${accusation}案`;
}

function buildJudgment(meta: Cail2018Meta): string {
  const t = meta.term_of_imprisonment;
  const accusation = meta.accusation.join('、') || '刑事罪名';
  const articles = meta.relevant_articles.length > 0
    ? `（依据《刑法》第${meta.relevant_articles.join('、')}条）`
    : '';

  if (t.death_penalty) {
    return `被告人犯${accusation}罪，判处死刑${articles}。`;
  }
  if (t.life_imprisonment) {
    return `被告人犯${accusation}罪，判处无期徒刑${articles}。`;
  }
  if (t.imprisonment > 0) {
    const years = Math.floor(t.imprisonment / 12);
    const months = t.imprisonment % 12;
    const term = years > 0
      ? `有期徒刑${years}年${months > 0 ? months + '个月' : ''}`
      : `有期徒刑${months}个月`;
    const fine = meta.punish_of_money > 0
      ? `，并处罚金人民币${meta.punish_of_money}元`
      : '';
    return `被告人犯${accusation}罪，判处${term}${fine}${articles}。`;
  }
  if (meta.punish_of_money > 0) {
    return `被告人犯${accusation}罪，免予有期徒刑，处罚金人民币${meta.punish_of_money}元${articles}。`;
  }
  return `被告人被控${accusation}罪，经审理，依法裁判${articles}。`;
}

async function importCail2018(filePath: string) {
  console.log(`\n开始导入 CAIL2018 数据集：${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在：${filePath}`);
    console.error('请先下载数据集，参考脚本头部注释中的下载说明');
    process.exit(1);
  }

  const stat = fs.statSync(filePath);
  console.log(`文件大小：${(stat.size / 1024 / 1024).toFixed(1)} MB`);

  // 预先加载该数据源已存在的 sourceId，用于去重
  console.log('加载已导入记录...');
  const existing = await prisma.caseExample.findMany({
    where: { dataSource: DATA_SOURCE },
    select: { sourceId: true },
  });
  const existingIds = new Set(existing.map(r => r.sourceId).filter(Boolean));
  console.log(`数据库中已有 ${existingIds.size} 条 ${DATA_SOURCE} 记录`);

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let total = 0;
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const BATCH_SIZE = 200;

  type CreateData = Parameters<typeof prisma.caseExample.create>[0]['data'];
  let batch: CreateData[] = [];

  const flushBatch = async () => {
    if (batch.length === 0) return;
    try {
      await prisma.caseExample.createMany({ data: batch, skipDuplicates: false });
      imported += batch.length;
    } catch (err) {
      // 批量失败时逐条重试
      for (const data of batch) {
        try {
          await prisma.caseExample.create({ data });
          imported++;
        } catch {
          errors++;
        }
      }
    }
    batch = [];
  };

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    total++;

    try {
      const record: Cail2018Record = JSON.parse(trimmed);

      if (!record.fact || record.fact.length < 20) {
        skipped++;
        continue;
      }

      const sourceId = `${DATA_SOURCE}-${total}`;
      if (existingIds.has(sourceId)) {
        skipped++;
        continue;
      }

      const meta = record.meta;
      const cause = (meta.accusation ?? []).join('、') || '刑事案件';

      batch.push({
        title: buildTitle(meta, total),
        caseNumber: `CAIL2018-${String(total).padStart(6, '0')}`,
        court: '（数据来源：CAIL2018刑事裁判文书数据集）',
        type: 'CRIMINAL' as CaseType,
        cause,
        facts: record.fact,
        judgment: buildJudgment(meta),
        result: inferResult(meta),
        judgmentDate: new Date('2016-01-01T00:00:00Z'),
        dataSource: DATA_SOURCE,
        sourceId,
        importedAt: new Date(),
        metadata: {
          accusation: meta.accusation,
          relevant_articles: meta.relevant_articles,
          term_of_imprisonment: meta.term_of_imprisonment,
          criminals: meta.criminals,
          punish_of_money: meta.punish_of_money,
        },
      });

      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
        if (imported % 5000 === 0) {
          console.log(`进度：已处理 ${total} 条，导入 ${imported} 条，跳过 ${skipped} 条`);
        }
      }
    } catch {
      errors++;
      if (errors <= 5) {
        console.warn(`第 ${total} 行解析失败，已跳过`);
      }
    }
  }

  await flushBatch();

  console.log('\n导入完成：');
  console.log(`  总行数：${total}`);
  console.log(`  成功导入：${imported}`);
  console.log(`  跳过（无效/重复）：${skipped}`);
  console.log(`  失败：${errors}`);
}

async function main() {
  const filePath = process.argv[2] ?? path.join(
    process.cwd(), 'data', 'cail2018',
    'CAIL2018_ALL_DATA', 'final_all_data', 'exercise_contest', 'data_train.json'
  );

  try {
    await importCail2018(filePath);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('导入失败：', err);
  process.exit(1);
});
