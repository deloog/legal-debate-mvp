/**
 * 导入 HuggingFace CFA（中国司法文书分析）数据集
 *
 * 数据集来源：https://huggingface.co/datasets/coastalcph/lex_glue 或
 *             https://huggingface.co/datasets/THUIR/CFA_Judgement_Corpus
 *
 * CFA（China Fudicial Analysis）涵盖民事、行政案件，补充 CAIL2018 的刑事偏重问题。
 *
 * 使用方法：
 *   1. 安装 huggingface_hub：pip install huggingface_hub datasets
 *   2. 下载数据：
 *      python -c "
 *      from datasets import load_dataset
 *      ds = load_dataset('THUIR/CFA_Judgement_Corpus', split='train')
 *      ds.to_json('data/cfa/cfa_train.jsonl')
 *      "
 *   3. 或手动下载 parquet 文件后转 JSONL
 *   4. 运行：npx ts-node --project scripts/tsconfig.json scripts/import-data/import-cfa.ts
 *
 * CFA 数据集典型字段：
 * {
 *   "id": "...",
 *   "case_number": "（2021）粤0111民初12345号",
 *   "court": "广州市白云区人民法院",
 *   "case_type": "民事",
 *   "cause_of_action": "买卖合同纠纷",
 *   "fact": "案情描述...",
 *   "judgment_result": "判决原告胜诉...",
 *   "date": "2021-05-15",
 *   "outcome": "plaintiff_wins"  // plaintiff_wins|defendant_wins|partial|dismissed
 * }
 *
 * 如遇到字段名不同，在 mapCfaRecord 函数中调整即可
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { PrismaClient, CaseType, CaseResult } from '@prisma/client';

const prisma = new PrismaClient();

// CFA 原始数据格式（字段名可能有多种变体，下面做了兼容处理）
interface CfaRecord {
  id?: string;
  case_id?: string;
  case_number?: string;
  case_no?: string;
  court?: string;
  court_name?: string;
  case_type?: string;
  type?: string;
  cause_of_action?: string;
  cause?: string;
  reason?: string;
  fact?: string;
  facts?: string;
  case_fact?: string;
  judgment_result?: string;
  judgment?: string;
  decision?: string;
  date?: string;
  judgment_date?: string;
  trial_date?: string;
  outcome?: string;
  result?: string;
  [key: string]: unknown;
}

function getCaseType(record: CfaRecord): CaseType {
  const raw = record.case_type ?? record.type ?? '';
  if (raw.includes('刑') || raw === 'criminal') return 'CRIMINAL';
  if (raw.includes('行政') || raw === 'administrative') return 'ADMINISTRATIVE';
  if (raw.includes('劳动') || raw === 'labor') return 'LABOR';
  if (raw.includes('知识产权') || raw === 'intellectual') return 'INTELLECTUAL';
  if (raw.includes('商事') || raw === 'commercial') return 'COMMERCIAL';
  if (raw.includes('民') || raw === 'civil' || raw === '') return 'CIVIL'; // CFA 以民事为主
  return 'CIVIL';
}

function getCause(record: CfaRecord): string | undefined {
  return record.cause_of_action ?? record.cause ?? record.reason ?? undefined;
}

function getFact(record: CfaRecord): string {
  return record.fact ?? record.facts ?? record.case_fact ?? '';
}

function getJudgment(record: CfaRecord): string {
  return (
    record.judgment_result ??
    record.judgment ??
    record.decision ??
    '（详见原始文书）'
  );
}

function getCourt(record: CfaRecord): string {
  return (
    record.court ?? record.court_name ?? '（数据来源：CFA中国司法文书数据集）'
  );
}

function getCaseNumber(record: CfaRecord, index: number): string {
  return (
    record.case_number ??
    record.case_no ??
    `CFA-${String(index).padStart(6, '0')}`
  );
}

function getDate(record: CfaRecord): Date {
  const raw = record.date ?? record.judgment_date ?? record.trial_date;
  if (raw) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date('2020-01-01T00:00:00Z'); // CFA 数据集以近年案件为主
}

function getResult(record: CfaRecord): CaseResult {
  const raw = (record.outcome ?? record.result ?? '').toLowerCase();
  if (
    raw.includes('plaintiff_wins') ||
    raw.includes('原告胜') ||
    raw.includes('支持诉讼请求')
  )
    return 'WIN';
  if (
    raw.includes('defendant_wins') ||
    raw.includes('被告胜') ||
    raw.includes('驳回')
  )
    return 'LOSE';
  if (raw.includes('dismissed') || raw.includes('撤诉')) return 'WITHDRAW';
  if (raw.includes('partial') || raw.includes('部分')) return 'PARTIAL';
  // 兜底：民事案件通常是部分支持
  return 'PARTIAL';
}

function buildTitle(record: CfaRecord, index: number): string {
  const cause = getCause(record) ?? getCaseType(record) + '纠纷';
  const caseNo = getCaseNumber(record, index);
  return `${cause}（${caseNo}）`;
}

async function importCfaFile(
  filePath: string
): Promise<{ imported: number; skipped: number; errors: number }> {
  console.log(`\n读取文件：${filePath}`);
  const stat = fs.statSync(filePath);
  console.log(`文件大小：${(stat.size / 1024 / 1024).toFixed(1)} MB`);

  const ext = path.extname(filePath).toLowerCase();
  let records: CfaRecord[] = [];

  if (ext === '.json') {
    // 整体 JSON 数组
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    records = Array.isArray(parsed)
      ? parsed
      : (parsed.data ?? parsed.records ?? []);
  } else {
    // JSONL 格式（逐行）
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      const t = line.trim();
      if (!t) continue;
      try {
        records.push(JSON.parse(t) as CfaRecord);
      } catch {
        /* skip */
      }
    }
  }

  console.log(`解析到 ${records.length} 条记录`);

  // 预先加载该数据源已存在的 sourceId，用于去重
  const existing = await prisma.caseExample.findMany({
    where: { dataSource: 'cfa' },
    select: { sourceId: true },
  });
  const existingIds = new Set(existing.map(r => r.sourceId).filter(Boolean));
  console.log(`数据库中已有 ${existingIds.size} 条 cfa 记录`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const BATCH_SIZE = 150;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);

    const toCreate = chunk
      .map((record, j) => {
        const index = i + j + 1;
        const fact = getFact(record);

        if (!fact || fact.length < 30) {
          skipped++;
          return null;
        }

        const sourceId = record.id ?? record.case_id ?? `cfa-${index}`;

        if (existingIds.has(sourceId)) {
          skipped++;
          return null;
        }

        return {
          title: buildTitle(record, index),
          caseNumber: getCaseNumber(record, index),
          court: getCourt(record),
          type: getCaseType(record),
          cause: getCause(record),
          facts: fact,
          judgment: getJudgment(record),
          result: getResult(record),
          judgmentDate: getDate(record),
          dataSource: 'cfa' as string,
          sourceId,
          importedAt: new Date(),
          metadata: {
            original_type: record.case_type ?? record.type,
            original_result: record.outcome ?? record.result,
          },
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    try {
      await prisma.caseExample.createMany({
        data: toCreate,
        skipDuplicates: false,
      });
      imported += toCreate.length;
    } catch (err) {
      console.error(`第 ${i + 1}-${i + chunk.length} 条批量写入失败：`, err);
      errors += chunk.length;
    }

    if ((i / BATCH_SIZE) % 10 === 0) {
      console.log(
        `进度：${Math.min(i + BATCH_SIZE, records.length)} / ${records.length}，已导入 ${imported}`
      );
    }
  }

  return { imported, skipped, errors };
}

async function main() {
  const dataDir = process.argv[2] ?? path.join(process.cwd(), 'data', 'cfa');

  if (!fs.existsSync(dataDir)) {
    console.error(`数据目录不存在：${dataDir}`);
    console.error('请先下载数据集，参考脚本头部注释中的下载说明');
    process.exit(1);
  }

  const files = fs
    .readdirSync(dataDir)
    .filter(f => f.endsWith('.json') || f.endsWith('.jsonl'))
    .map(f => path.join(dataDir, f));

  if (files.length === 0) {
    console.error(`目录中没有 JSON/JSONL 文件：${dataDir}`);
    process.exit(1);
  }

  console.log(`找到 ${files.length} 个数据文件`);

  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const filePath of files) {
    const result = await importCfaFile(filePath);
    totalImported += result.imported;
    totalSkipped += result.skipped;
    totalErrors += result.errors;
  }

  console.log('\n全部导入完成：');
  console.log(`  导入：${totalImported}`);
  console.log(`  跳过：${totalSkipped}`);
  console.log(`  失败：${totalErrors}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('导入失败：', err);
  prisma.$disconnect();
  process.exit(1);
});
