/**
 * 导入 LegalKit CaseGen 民事裁判文书数据集
 *
 * 数据集来源：https://github.com/DavidMiao1127/LegalKit
 * 格式：JSONL（每行一个JSON对象），字段：id, title, full_text, fact, judgement,
 *        prosecution, defense, reasoning, event, evidence
 *
 * 数据特点：
 *   - 500 条完整民事裁判文书（合同纠纷、建设工程、房屋销售等）
 *   - 包含原告诉状、被告答辩、事实认定、裁判结果
 *   - 是目前案例库中唯一的民事案件数据来源
 *
 * 使用方法：
 *   npx ts-node --project scripts/tsconfig.json scripts/import-data/import-legalkit-casegen.ts [文件路径]
 *   默认路径：data/LegalKit/data/CaseGen/CaseGen.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, CaseType, CaseResult } from '@prisma/client';

const prisma = new PrismaClient();
const DATA_SOURCE = 'legalkit_casegen';

interface CaseGenRecord {
  id: number | string;
  title: string;
  full_text?: string;
  prosecution?: string;    // 诉状（原告）
  defense?: string;        // 答辩状（被告）
  fact: string;            // 事实认定
  reasoning?: string;      // 裁判理由
  judgement: string;       // 裁判结果
  event?: string;          // 案件经过
  evidence?: string;       // 证据
}

/**
 * 从标题推断案件类型
 * 标题通常形如："李某与某公司买卖合同纠纷一审民事判决书"
 */
function inferCaseType(title: string): CaseType {
  if (title.includes('刑事') || title.includes('犯罪')) return 'CRIMINAL';
  if (title.includes('行政') || title.includes('行政复议')) return 'ADMINISTRATIVE';
  if (title.includes('劳动') || title.includes('工伤') || title.includes('劳务')) return 'LABOR';
  if (title.includes('知识产权') || title.includes('著作权') || title.includes('专利') || title.includes('商标')) return 'INTELLECTUAL';
  if (
    title.includes('买卖') || title.includes('合同') || title.includes('股权') ||
    title.includes('商事') || title.includes('公司') || title.includes('金融') ||
    title.includes('借款') || title.includes('债权')
  ) return 'COMMERCIAL';
  // 民事（包括物权、相邻、婚姻、侵权等）
  return 'CIVIL';
}

/**
 * 提取案由（从标题中截取纠纷类型）
 * 如："杨某与某公司建设工程施工合同纠纷一审民事判决书" → "建设工程施工合同纠纷"
 */
function extractCause(title: string): string {
  // 匹配"纠纷"前面的案由
  const matchDispute = title.match(/([^与和\s,，]{2,20}纠纷)/);
  if (matchDispute) return matchDispute[1];
  // 匹配"合同"
  const matchContract = title.match(/([^与和\s,，]{2,15}合同)/);
  if (matchContract) return matchContract[1] + '纠纷';
  // 匹配"损害赔偿"、"侵权"等
  const matchOther = title.match(/(损害赔偿|人身损害|侵权|相邻关系|物权|婚姻|离婚|继承|赡养)/);
  if (matchOther) return matchOther[1];
  return '民事纠纷';
}

/**
 * 从裁判结果文本中推断胜负
 */
function inferResult(judgement: string, title: string): CaseResult {
  if (!judgement) return 'PARTIAL';
  const j = judgement;
  // 驳回全部 → 原告败诉
  if (j.includes('驳回原告的全部诉讼请求') || j.includes('驳回原告全部诉讼请求')) return 'LOSE';
  // 撤诉
  if (j.includes('准予撤诉') || title.includes('撤诉')) return 'WITHDRAW';
  // 支持全部 → 原告完全胜诉
  if (j.includes('支持原告的全部诉讼请求') || j.includes('全额支持')) return 'WIN';
  // 部分支持（最常见）
  if (
    j.includes('部分支持') || j.includes('部分诉讼请求') ||
    j.includes('驳回原告的其他诉讼请求') || j.includes('驳回原告其余诉讼请求')
  ) return 'PARTIAL';
  // 有具体金额判决通常是部分/完全胜诉
  if (/支付.{0,20}[万千百]\s*元/.test(j) || /赔偿.{0,20}元/.test(j)) return 'PARTIAL';
  return 'PARTIAL';
}

/**
 * 提取案号（如 "(2021)粤0111民初12345号"）
 */
function extractCaseNumber(text: string, fallback: string): string {
  const match = text?.match(/[（(]\d{4}[）)][^\s（(）)]{2,20}[号]/);
  if (match) return match[0];
  return fallback;
}

/**
 * 从 prosecution 文本中提取裁判法院名称
 */
function extractCourt(record: CaseGenRecord, index: number): string {
  const text = record.prosecution ?? record.full_text ?? '';
  const match = text.match(/([^\n\s]{2,20}(?:人民法院|仲裁委员会|仲裁院))/);
  if (match) return match[1];
  return '（数据来源：LegalKit CaseGen民事裁判文书）';
}

/**
 * 推断裁判日期（从 judgement 文本中提取）
 */
function extractDate(judgement: string): Date {
  const match = judgement?.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (match) {
    const d = new Date(`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date('2020-01-01T00:00:00Z');
}

async function importCaseGen(filePath: string) {
  console.log(`\n开始导入 CaseGen 民事案例：${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在：${filePath}`);
    process.exit(1);
  }

  const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
  console.log(`读取到 ${lines.length} 条记录`);

  // 预加载已存在的 sourceId
  const existing = await prisma.caseExample.findMany({
    where: { dataSource: DATA_SOURCE },
    select: { sourceId: true },
  });
  const existingIds = new Set(existing.map(r => r.sourceId).filter(Boolean));
  console.log(`数据库中已有 ${existingIds.size} 条 ${DATA_SOURCE} 记录`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  type CreateData = Parameters<typeof prisma.caseExample.create>[0]['data'];
  const batch: CreateData[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const record: CaseGenRecord = JSON.parse(line);

      if (!record.fact || record.fact.length < 30) {
        skipped++;
        continue;
      }

      const sourceId = `${DATA_SOURCE}-${record.id ?? i}`;
      if (existingIds.has(sourceId)) {
        skipped++;
        continue;
      }

      const title = record.title ?? `民事案件-${i + 1}`;
      const fullText = record.full_text ?? '';
      const caseNumber = extractCaseNumber(fullText || record.judgement, `CASEGEN-${String(i + 1).padStart(4, '0')}`);
      const judgment = record.judgement ?? '（详见原始文书）';

      batch.push({
        title,
        caseNumber,
        court: extractCourt(record, i + 1),
        type: inferCaseType(title),
        cause: extractCause(title),
        facts: record.fact,
        judgment,
        result: inferResult(judgment, title),
        judgmentDate: extractDate(judgment),
        dataSource: DATA_SOURCE,
        sourceId,
        importedAt: new Date(),
        metadata: {
          has_prosecution: !!record.prosecution,
          has_defense: !!record.defense,
          has_evidence: !!record.evidence,
          has_reasoning: !!record.reasoning,
          // 保存诉状和答辩摘要（前500字），用于辩论推荐
          prosecution_summary: record.prosecution?.slice(0, 500),
          defense_summary: record.defense?.slice(0, 500),
        },
      });
    } catch {
      errors++;
      console.warn(`第 ${i + 1} 行解析失败`);
    }
  }

  if (batch.length > 0) {
    try {
      await prisma.caseExample.createMany({ data: batch, skipDuplicates: false });
      imported = batch.length;
    } catch (err) {
      console.error('批量写入失败，逐条重试...', err);
      for (const data of batch) {
        try {
          await prisma.caseExample.create({ data });
          imported++;
        } catch {
          errors++;
        }
      }
    }
  }

  console.log('\n导入完成：');
  console.log(`  成功导入：${imported}`);
  console.log(`  跳过：${skipped}`);
  console.log(`  失败：${errors}`);
}

async function main() {
  const filePath = process.argv[2] ?? path.join(
    process.cwd(), 'data', 'LegalKit', 'data', 'CaseGen', 'CaseGen.json'
  );

  try {
    await importCaseGen(filePath);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('导入失败：', err);
  process.exit(1);
});
