/**
 * scripts/build-law-knowledge-graph.ts
 *
 * 批量构建法律知识图谱（规则引擎）
 *
 * 覆盖三类关系：
 *   CITES / CITED_BY      — 法条正文中显式引用（"根据《X法》第N条"）
 *   IMPLEMENTS / IMPLEMENTED_BY — 下位法声明依据上位法（"根据《X法》制定"）
 *   SUPERSEDES / SUPERSEDED_BY  — 明文废止旧法（"《旧法》同时废止"）
 *
 * 运行（全量）：
 *   npx ts-node -P scripts/tsconfig.json scripts/build-law-knowledge-graph.ts
 *
 * 断点续跑（从上次中断处继续）：
 *   RESUME=true npx ts-node -P scripts/tsconfig.json scripts/build-law-knowledge-graph.ts
 *
 * 只处理某部法律（调试）：
 *   LAW_NAME=民法典 npx ts-node -P scripts/tsconfig.json scripts/build-law-knowledge-graph.ts
 */

import { PrismaClient, RelationType, DiscoveryMethod, VerificationStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient({ log: [] });

// ── 配置 ──────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 500;
const INSERT_BATCH = 200;         // 每次写入数量
const CHECKPOINT_PATH = path.join(__dirname, 'kg-build-checkpoint.json');
const RESUME = process.env.RESUME === 'true';
const FILTER_LAW = process.env.LAW_NAME ?? null;

// ── 正则模式（与 patterns.ts 保持一致，不 import src/ 避免 TS 路径问题）──────

/** 明确引用特定条文：根据《X法》第N条 */
const CITE_SPECIFIC_PATTERNS = [
  /根据《([^》]+)》第?(\d+)条/g,
  /依照《([^》]+)》第?(\d+)条/g,
  /按照《([^》]+)》第?(\d+)条/g,
  /参照《([^》]+)》第?(\d+)条/g,
  /适用《([^》]+)》第?(\d+)条/g,
  /引用《([^》]+)》第?(\d+)条/g,
  /依据《([^》]+)》第?(\d+)条/g,
  /遵照《([^》]+)》第?(\d+)条/g,
];

/** 通用引用（不带条文号，但也不是"制定"关系）：根据《X法》的规定 / 依照《X法》 */
const CITE_GENERAL_PATTERNS = [
  /根据《([^》]{2,40})》的规定/g,
  /依照《([^》]{2,40})》的规定/g,
  /依据《([^》]{2,40})》的规定/g,
  /按照《([^》]{2,40})》的规定/g,
  /适用《([^》]{2,40})》的规定/g,
  /参照《([^》]{2,40})》的规定/g,
  /违反《([^》]{2,40})》/g,
  /《([^》]{2,40})》另有规定/g,
];

const HIERARCHY_PATTERNS_RAW = [
  /根据《([^》]+)》制定/g,
  /依据《([^》]+)》制定/g,
  /为实施《([^》]+)》/g,
  /为执行《([^》]+)》/g,
  /根据《([^》]+)》[，,]制定本/g,
];

const SUPERSEDE_PATTERNS_RAW = [
  /本[法律规定]+自.+施行[，,][《]?([^》，,。\n]{2,30})[》]?同时废止/g,
  /[《]?([^》，,。\n]{2,30})[》]?自本[法律规定]+施行之日起废止/g,
  /原[《]([^》，,。\n]{2,30})[》]?废止/g,
];

// ── 类型 ─────────────────────────────────────────────────────────────────────

interface PendingRelation {
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  confidence: number;
  evidence: string;
}

interface Checkpoint {
  offset: number;
  inserted: number;
  skipped: number;
}

// ── 工具 ─────────────────────────────────────────────────────────────────────

/** 把中文条文号统一成数字字符串，方便比对 */
function normalizeArticleNumber(num: string): string {
  const t = (num ?? '').trim().replace(/第|条$/g, '');
  // 如果是纯数字字符串，直接返回
  if (/^\d+$/.test(t)) return t;
  // 简单中文数字转整数（覆盖常见条文号）
  const CN: Record<string, number> = {
    零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
    十: 10, 百: 100, 千: 1000, 万: 10000,
  };
  let result = 0, temp = 0;
  for (const ch of t) {
    const v = CN[ch];
    if (v === undefined) return t; // 无法解析，原样返回
    if (v >= 10) {
      if (temp === 0) temp = 1;
      if (v === 10 && result === 0) { result = temp * v; temp = 0; }
      else { result += temp * v; temp = 0; }
    } else {
      temp = v;
    }
  }
  result += temp;
  return result > 0 ? String(result) : t;
}

/** 去掉书名号和常见后缀，用于模糊匹配法律名 */
function normalizeLawName(name: string): string {
  return name
    .replace(/《|》/g, '')
    .replace(/（\d{4}年）$/, '')
    .replace(/（\d{4}年修正文本）$/, '')
    .trim();
}

// ── 关系检测 ──────────────────────────────────────────────────────────────────

interface CitedRef {
  lawName: string;
  articleNumber: string | null; // null = 引用整部法律，解析为第一条
  evidence: string;
}

interface HierarchyRef {
  parentLawName: string;
  evidence: string;
}

interface SupersedeRef {
  oldLawName: string;
  evidence: string;
}

function detectCites(fullText: string): CitedRef[] {
  const results: CitedRef[] = [];

  // 1. 含条文号的明确引用
  for (const pattern of CITE_SPECIFIC_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(fullText)) !== null) {
      if (m[1] && m[2]) {
        results.push({ lawName: normalizeLawName(m[1].trim()), articleNumber: m[2].trim(), evidence: m[0] });
      }
    }
  }

  // 2. 通用引用（整部法律，条文号为 null）
  for (const pattern of CITE_GENERAL_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(fullText)) !== null) {
      if (m[1]) {
        results.push({ lawName: normalizeLawName(m[1].trim()), articleNumber: null, evidence: m[0] });
      }
    }
  }

  return results;
}

function detectHierarchy(fullText: string): HierarchyRef[] {
  const results: HierarchyRef[] = [];
  for (const pattern of HIERARCHY_PATTERNS_RAW) {
    pattern.lastIndex = 0;
    const m = pattern.exec(fullText);
    if (m?.[1]) {
      results.push({ parentLawName: normalizeLawName(m[1].trim()), evidence: m[0] });
    }
  }
  return results;
}

function detectSupersede(fullText: string): SupersedeRef[] {
  const results: SupersedeRef[] = [];
  for (const pattern of SUPERSEDE_PATTERNS_RAW) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(fullText)) !== null) {
      if (m[1]) {
        results.push({ oldLawName: normalizeLawName(m[1].trim()), evidence: m[0] });
      }
    }
  }
  return results;
}

// ── 主流程 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== 法律知识图谱批量构建 ===');
  console.log(`时间: ${new Date().toLocaleString('zh-CN')}`);
  if (FILTER_LAW) console.log(`调试模式，仅处理: ${FILTER_LAW}`);

  // ── 1. 预建法律名索引（lawName → firstArticleId + 按条文号索引文章 ID）
  console.log('\n[1/4] 预建法律名索引...');
  // law name → first article id（用于 IMPLEMENTS 解析）
  const lawFirstArticleMap = new Map<string, string>();
  // law name → article number → article id（用于 CITES 解析，懒填充）
  // 这里先只加载 lawName → [所有文章ID 按 articleNumber]，太大，改为按需查

  // 从数据库加载所有不重复的法律名及其条文（仅加载第一条）
  // 使用 raw SQL 高效聚合
  const lawIndex = await prisma.$queryRaw<{ lawName: string; firstId: string }[]>`
    SELECT "lawName", MIN(id) as "firstId"
    FROM law_articles
    GROUP BY "lawName"
  `;
  for (const row of lawIndex) {
    const normalized = normalizeLawName(row.lawName);
    if (!lawFirstArticleMap.has(normalized)) {
      lawFirstArticleMap.set(normalized, row.firstId);
    }
    // 也存原始名
    if (!lawFirstArticleMap.has(row.lawName)) {
      lawFirstArticleMap.set(row.lawName, row.firstId);
    }
  }
  console.log(`  法律名索引: ${lawFirstArticleMap.size} 条目`);

  // ── 2. 加载已有关系到 Set，用于去重
  console.log('\n[2/4] 加载已有关系...');
  const existingSet = new Set<string>();
  const existingRels = await prisma.lawArticleRelation.findMany({
    select: { sourceId: true, targetId: true, relationType: true },
  });
  for (const r of existingRels) {
    existingSet.add(`${r.sourceId}:${r.targetId}:${r.relationType}`);
  }
  console.log(`  已有关系: ${existingSet.size} 条`);

  // ── 3. 读取断点
  let startOffset = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  if (RESUME && fs.existsSync(CHECKPOINT_PATH)) {
    const ckpt: Checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8'));
    startOffset = ckpt.offset;
    totalInserted = ckpt.inserted;
    totalSkipped = ckpt.skipped;
    console.log(`\n[断点续跑] 从 offset=${startOffset} 继续，已插入 ${totalInserted}，已跳过 ${totalSkipped}`);
  }

  // ── 4. 统计总量
  const where = FILTER_LAW ? { lawName: FILTER_LAW } : {};
  const total = await prisma.lawArticle.count({ where });
  console.log(`\n[3/4] 开始处理 ${total.toLocaleString()} 条法条（batch=${BATCH_SIZE}）\n`);

  const startTime = Date.now();
  let offset = startOffset;

  while (offset < total) {
    const articles = await prisma.lawArticle.findMany({
      where,
      select: { id: true, lawName: true, articleNumber: true, fullText: true },
      skip: offset,
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
    });

    if (articles.length === 0) break;

    const batchRelations: PendingRelation[] = [];

    // 收集本批次需要解析的引用
    const citedRefs: Array<{ sourceId: string; lawName: string; articleNumber: string; evidence: string }> = [];
    const hierarchyRefs: Array<{ sourceId: string; parentLawName: string; evidence: string }> = [];

    for (const article of articles) {
      const text = article.fullText ?? '';
      if (!text) continue;

      // 引用关系
      for (const ref of detectCites(text)) {
        citedRefs.push({ sourceId: article.id, lawName: ref.lawName, articleNumber: ref.articleNumber, evidence: ref.evidence });
      }

      // 层级关系（IMPLEMENTS）
      for (const ref of detectHierarchy(text)) {
        const parentId = lawFirstArticleMap.get(ref.parentLawName) ?? lawFirstArticleMap.get(normalizeLawName(ref.parentLawName));
        if (parentId && parentId !== article.id) {
          addRelationPair(batchRelations, existingSet, {
            sourceId: article.id,
            targetId: parentId,
            relationType: RelationType.IMPLEMENTS,
            confidence: 0.85,
            evidence: ref.evidence,
          });
        }
      }

      // 废止关系（SUPERSEDES）
      for (const ref of detectSupersede(text)) {
        const oldId = lawFirstArticleMap.get(ref.oldLawName) ?? lawFirstArticleMap.get(normalizeLawName(ref.oldLawName));
        if (oldId && oldId !== article.id) {
          addRelationPair(batchRelations, existingSet, {
            sourceId: article.id,
            targetId: oldId,
            relationType: RelationType.SUPERSEDES,
            confidence: 0.92,
            evidence: ref.evidence,
          });
        }
      }
    }

    // 批量解析引用关系
    if (citedRefs.length > 0) {
      // 区分：需要精确条文查询 vs 只需要第一条（用 lawFirstArticleMap）
      const specificRefs = citedRefs.filter(r => r.articleNumber !== null);
      const generalRefs = citedRefs.filter(r => r.articleNumber === null);

      // 解析通用引用（用预建索引直接查第一条）
      for (const ref of generalRefs) {
        const targetId = lawFirstArticleMap.get(ref.lawName) ?? lawFirstArticleMap.get(normalizeLawName(ref.lawName));
        if (targetId && targetId !== ref.sourceId) {
          addRelationPair(batchRelations, existingSet, {
            sourceId: ref.sourceId,
            targetId,
            relationType: RelationType.CITES,
            confidence: 0.80,  // 通用引用置信度略低
            evidence: ref.evidence,
          });
        }
      }

      // 解析精确条文引用（批量查询 DB）
      if (specificRefs.length > 0) {
        const uniqueLawNames = [...new Set(specificRefs.map(r => r.lawName))];
        const citedArticles = await prisma.lawArticle.findMany({
          where: { lawName: { in: uniqueLawNames } },
          select: { id: true, lawName: true, articleNumber: true },
        });

        // 建立 (normalizedLawName, normalizedArticleNum) → id 映射
        const citationLookup = new Map<string, string>();
        for (const a of citedArticles) {
          const key = `${normalizeLawName(a.lawName)}:${normalizeArticleNumber(a.articleNumber)}`;
          if (!citationLookup.has(key)) citationLookup.set(key, a.id);
        }

        for (const ref of specificRefs) {
          const key = `${ref.lawName}:${ref.articleNumber!}`;
          const targetId = citationLookup.get(key);
          if (targetId && targetId !== ref.sourceId) {
            addRelationPair(batchRelations, existingSet, {
              sourceId: ref.sourceId,
              targetId,
              relationType: RelationType.CITES,
              confidence: 0.95,
              evidence: ref.evidence,
            });
          }
        }
      }
    }

    // 批量写入（batchRelations 中的条目已经由 addRelationPair 去重，直接写入即可）
    if (batchRelations.length > 0) {
      for (let i = 0; i < batchRelations.length; i += INSERT_BATCH) {
        const chunk = batchRelations.slice(i, i + INSERT_BATCH);
        await prisma.lawArticleRelation.createMany({
          data: chunk.map(r => ({
            sourceId: r.sourceId,
            targetId: r.targetId,
            relationType: r.relationType,
            confidence: r.confidence,
            evidence: { text: r.evidence },
            discoveryMethod: DiscoveryMethod.RULE_BASED,
            verificationStatus: VerificationStatus.VERIFIED,
            strength: r.confidence,
          })),
          skipDuplicates: true,
        });
      }
      totalInserted += batchRelations.length;
    }

    offset += articles.length;
    totalSkipped += batchRelations.length === 0 ? articles.length : 0;

    // 进度输出
    const pct = ((offset / total) * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const eta = offset > startOffset
      ? (((total - offset) / (offset - startOffset)) * (Date.now() - startTime) / 1000).toFixed(0)
      : '?';
    process.stdout.write(
      `\r  ${pct}%  offset=${offset.toLocaleString()}/${total.toLocaleString()}  ` +
      `插入=${totalInserted.toLocaleString()}  耗时=${elapsed}s  ETA=${eta}s   `
    );

    // 保存断点
    const ckpt: Checkpoint = { offset, inserted: totalInserted, skipped: totalSkipped };
    fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(ckpt));
  }

  console.log('\n\n[4/4] 完成！');
  console.log(`  总处理: ${total.toLocaleString()} 条法条`);
  console.log(`  新增关系: ${totalInserted.toLocaleString()} 条`);
  console.log(`  总耗时: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  // 清理断点文件
  if (fs.existsSync(CHECKPOINT_PATH)) fs.unlinkSync(CHECKPOINT_PATH);

  // 最终统计
  const finalCount = await prisma.lawArticleRelation.count();
  const byType = await prisma.lawArticleRelation.groupBy({
    by: ['relationType'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  console.log(`\n  数据库关系总数: ${finalCount.toLocaleString()}`);
  console.log('  按类型分布:');
  for (const row of byType) {
    console.log(`    ${row.relationType.padEnd(20)} ${row._count.id.toLocaleString()}`);
  }

  await prisma.$disconnect();
}

// ── 辅助：添加双向关系对 ─────────────────────────────────────────────────────

function addRelationPair(
  list: PendingRelation[],
  existingSet: Set<string>,
  forward: PendingRelation
) {
  const reverseType = REVERSE_TYPE[forward.relationType];
  if (!reverseType) return;

  const fKey = `${forward.sourceId}:${forward.targetId}:${forward.relationType}`;
  const rKey = `${forward.targetId}:${forward.sourceId}:${reverseType}`;

  if (!existingSet.has(fKey)) {
    list.push(forward);
    existingSet.add(fKey); // 立即标记，防止同批次重复
  }
  if (!existingSet.has(rKey)) {
    list.push({
      sourceId: forward.targetId,
      targetId: forward.sourceId,
      relationType: reverseType,
      confidence: forward.confidence,
      evidence: forward.evidence,
    });
    existingSet.add(rKey);
  }
}

const REVERSE_TYPE: Partial<Record<RelationType, RelationType>> = {
  [RelationType.CITES]: RelationType.CITED_BY,
  [RelationType.CITED_BY]: RelationType.CITES,
  [RelationType.IMPLEMENTS]: RelationType.IMPLEMENTED_BY,
  [RelationType.IMPLEMENTED_BY]: RelationType.IMPLEMENTS,
  [RelationType.SUPERSEDES]: RelationType.SUPERSEDED_BY,
  [RelationType.SUPERSEDED_BY]: RelationType.SUPERSEDES,
  [RelationType.CONFLICTS]: RelationType.CONFLICTS,
  [RelationType.COMPLETES]: RelationType.COMPLETED_BY,
  [RelationType.COMPLETED_BY]: RelationType.COMPLETES,
};

main().catch(err => {
  console.error('\n错误:', err);
  process.exit(1);
});
