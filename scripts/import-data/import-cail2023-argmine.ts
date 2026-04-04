/**
 * 导入 CAIL2023-Argmine 论辩挖掘数据集
 *
 * 数据集来源：https://github.com/china-ai-law-challenge/CAIL2023/tree/main/Argmine
 * 格式：JSON文件，包含案件信息 + 论辩对标注
 *
 * 用途：
 *   1. 将案件基本信息导入 CaseExample 表（作为案例库补充）
 *   2. 论辩对数据可用于辩论论点质量评测基准
 *
 * 使用方法：
 *   1. 从 https://github.com/china-ai-law-challenge/CAIL2023 下载数据集
 *   2. 将 Argmine 目录下的 train.json / test.json 放到 data/cail2023-argmine/ 目录
 *   3. 运行：npx ts-node --project scripts/tsconfig.json scripts/import-data/import-cail2023-argmine.ts
 *
 * CAIL2023-Argmine 数据结构（典型格式）：
 * {
 *   "id": "case_001",
 *   "fact": "案情描述...",
 *   "plaintiff_claim": "原告诉求...",
 *   "defendant_defense": "被告抗辩...",
 *   "arguments": [
 *     { "side": "plaintiff", "content": "论点内容", "evidence": "..." },
 *     { "side": "defendant", "content": "论点内容", "evidence": "..." }
 *   ],
 *   "case_type": "民事",
 *   "result": "原告部分胜诉"
 * }
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, CaseType, CaseResult } from '@prisma/client';

const prisma = new PrismaClient();

// 论辩对记录（用于评测基准输出）
interface ArgmineArgument {
  side: string;
  content: string;
  evidence?: string;
  label?: string; // 论点类型标签
}

interface ArgmineRecord {
  id: string;
  fact?: string;
  case_fact?: string; // 部分版本使用 case_fact
  plaintiff_claim?: string;
  defendant_defense?: string;
  arguments?: ArgmineArgument[];
  case_type?: string;
  result?: string;
  court?: string;
  case_number?: string;
  judgment?: string;
}

function mapCaseType(raw: string | undefined): CaseType {
  if (!raw) return 'OTHER';
  const s = raw.trim();
  if (s.includes('刑') || s.includes('criminal')) return 'CRIMINAL';
  if (s.includes('行政') || s.includes('administrative'))
    return 'ADMINISTRATIVE';
  if (s.includes('劳动') || s.includes('labor')) return 'LABOR';
  if (s.includes('知识产权') || s.includes('intellectual'))
    return 'INTELLECTUAL';
  if (s.includes('商事') || s.includes('commercial')) return 'COMMERCIAL';
  if (s.includes('民') || s.includes('civil')) return 'CIVIL';
  return 'OTHER';
}

function mapResult(raw: string | undefined): CaseResult {
  if (!raw) return 'PARTIAL';
  const s = raw.toLowerCase();
  if (s.includes('全部支持') || s.includes('完全胜诉') || s.includes('原告胜'))
    return 'WIN';
  if (s.includes('驳回') || s.includes('败诉') || s.includes('不支持'))
    return 'LOSE';
  if (s.includes('撤诉') || s.includes('撤回')) return 'WITHDRAW';
  return 'PARTIAL'; // 部分支持最常见
}

function buildTitle(record: ArgmineRecord, index: number): string {
  const caseType = record.case_type ?? '法律';
  const no = record.case_number ?? `ARGMINE-${index}`;
  return `${caseType}案件（${no}）`;
}

function getFact(record: ArgmineRecord): string {
  return record.fact ?? record.case_fact ?? '';
}

function buildJudgment(record: ArgmineRecord): string {
  if (record.judgment) return record.judgment;
  const result = record.result ?? '经审理，依法裁判';
  const claim = record.plaintiff_claim
    ? `原告诉求：${record.plaintiff_claim}`
    : '';
  const defense = record.defendant_defense
    ? `被告抗辩：${record.defendant_defense}`
    : '';
  const parts = [claim, defense, result].filter(Boolean);
  return parts.join('\n') || '（详见原始文书）';
}

async function importArgmineFile(
  filePath: string,
  dataSource: string
): Promise<{ imported: number; skipped: number; errors: number }> {
  console.log(`\n读取文件：${filePath}`);

  const raw = fs.readFileSync(filePath, 'utf-8');
  let records: ArgmineRecord[];

  try {
    const parsed = JSON.parse(raw);
    // 支持顶层数组 或 { data: [...] } 格式
    records = Array.isArray(parsed)
      ? parsed
      : (parsed.data ?? parsed.records ?? []);
  } catch {
    // 尝试 JSONL 格式
    records = raw
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => {
        try {
          return JSON.parse(l) as ArgmineRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is ArgmineRecord => r !== null);
  }

  console.log(`解析到 ${records.length} 条记录`);

  // 预先加载该数据源已存在的 sourceId，用于去重
  const existing = await prisma.caseExample.findMany({
    where: { dataSource },
    select: { sourceId: true },
  });
  const existingIds = new Set(existing.map(r => r.sourceId).filter(Boolean));
  console.log(`数据库中已有 ${existingIds.size} 条 ${dataSource} 记录`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const BATCH_SIZE = 100;

  // 评测基准：将论辩对导出到单独的 JSON 文件
  const argmineBenchmark: Array<{
    caseId: string;
    arguments: ArgmineArgument[];
  }> = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);

    const toCreate = chunk
      .map((record, j) => {
        const index = i + j + 1;
        const fact = getFact(record);

        if (!fact || fact.length < 20) {
          skipped++;
          return null;
        }

        const sourceId = record.id ?? `${dataSource}-${index}`;

        if (existingIds.has(sourceId)) {
          skipped++;
          return null;
        }

        // 收集评测基准数据
        if (record.arguments && record.arguments.length > 0) {
          argmineBenchmark.push({
            caseId: sourceId,
            arguments: record.arguments,
          });
        }

        return {
          title: buildTitle(record, index),
          caseNumber:
            record.case_number ??
            `${dataSource.toUpperCase()}-${String(index).padStart(5, '0')}`,
          court: record.court ?? '（数据来源：CAIL2023-Argmine论辩挖掘数据集）',
          type: mapCaseType(record.case_type),
          cause: record.case_type ?? undefined,
          facts: fact,
          judgment: buildJudgment(record),
          result: mapResult(record.result),
          judgmentDate: new Date('2022-01-01T00:00:00Z'),
          dataSource,
          sourceId,
          importedAt: new Date(),
          metadata: {
            plaintiff_claim: record.plaintiff_claim,
            defendant_defense: record.defendant_defense,
            has_arguments: (record.arguments?.length ?? 0) > 0,
            argument_count: record.arguments?.length ?? 0,
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

    console.log(
      `进度：${Math.min(i + BATCH_SIZE, records.length)} / ${records.length}`
    );
  }

  // 输出评测基准文件
  if (argmineBenchmark.length > 0) {
    const benchmarkPath = path.join(
      path.dirname(filePath),
      `${dataSource}-benchmark.json`
    );
    fs.writeFileSync(
      benchmarkPath,
      JSON.stringify(argmineBenchmark, null, 2),
      'utf-8'
    );
    console.log(`\n论辩评测基准已输出：${benchmarkPath}`);
    console.log(`共 ${argmineBenchmark.length} 个案件的论辩对数据`);
  }

  return { imported, skipped, errors };
}

async function main() {
  const dataDir =
    process.argv[2] ?? path.join(process.cwd(), 'data', 'cail2023-argmine');

  if (!fs.existsSync(dataDir)) {
    console.error(`数据目录不存在：${dataDir}`);
    console.error('请先下载数据集，参考脚本头部注释中的下载说明');
    process.exit(1);
  }

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.error(`目录中没有 JSON 文件：${dataDir}`);
    process.exit(1);
  }

  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const dataSource = `cail2023_argmine_${path.basename(file, '.json')}`;
    const result = await importArgmineFile(filePath, dataSource);
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
