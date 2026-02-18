# 国家法律法规数据库 — 数据质量问题与修复方案

> 文档生成时间：2026-02-18
> 数据库快照：22,562 条法条，采集时间 2026-02-16 ~ 2026-02-17，数据源 100% FLK（flk.npc.gov.cn）
> 本文档由 Claude Sonnet 4.6 审查后生成，供后续 AI/开发者按序修复。

---

## 目录

1. [问题总览](#1-问题总览)
2. [P0 — LawCategory 91% 落入 OTHER（最高优先级）](#2-p0--lawcategory-91-落入-other)
3. [P1 — articleNumber 字段语义错误](#3-p1--articlenumber-字段语义错误)
4. [P1 — LOCAL_REGULATION 占比过高（数据结构失衡）](#4-p1--local_regulation-占比过高)
5. [P2 — fullText 最短 100 字符记录待核查](#5-p2--fulltext-最短-100-字符记录待核查)
6. [P2 — 数据来源单一（NPC/Court 未接入）](#6-p2--数据来源单一)
7. [附录 A — 数据库统计快照](#附录-a--数据库统计快照)
8. [附录 B — FLK_TYPE_CONFIGS 现状](#附录-b--flk_type_configs-现状)
9. [附录 C — 关联文件清单](#附录-c--关联文件清单)

---

## 1. 问题总览

| # | 优先级 | 问题 | 影响范围 | 修复难度 | 状态 |
|---|--------|------|----------|----------|------|
| 1 | **P0** | 91.3% 法条分类为 `OTHER`，按类别检索几乎失效 | 22,562 条中 20,597 条 | 中 | ✅ 已修复 |
| 2 | **P1** | `articleNumber` 存储的是 FLK 系统哈希 ID，非人类可读条款号 | 全部 22,562 条 | 低 | ✅ 已修复 |
| 3 | **P1** | 地方性法规占 89.6%，全国性法律仅 3.2%，数据集比例失衡 | 采集策略 | 中 | ✅ 已修复 |
| 4 | **P2** | 存在全文仅 100 字符的记录，疑似解析失败后的占位写入 | 少量记录 | 低 | ⚠️ 待运行 |
| 5 | ~~P2~~ | ~~NPC（全国人大）和 Court（最高法）爬虫未接入真实 API~~ | ~~两个数据源~~ | ~~高~~ | ❌ ~~已废弃~~ |

> **说明**：FLK（flk.npc.gov.cn）已整合全国人大、最高人民法院的法规数据，811 条司法解释已覆盖 Court 来源。NPC/Court 爬虫已标记为废弃。

---

## 2. P0 — LawCategory 91% 落入 OTHER

### 现状

```
OTHER:                 20,597 条  (91.3%)
ADMINISTRATIVE:           953 条  ( 4.2%)
PROCEDURE:                826 条  ( 3.7%)
ECONOMIC:                 133 条  ( 0.6%)
CIVIL:                     46 条  ( 0.2%)
CRIMINAL:                   7 条  ( 0.03%)
INTELLECTUAL_PROPERTY:      0 条
LABOR:                      0 条
COMMERCIAL:                 0 条
```

### 根因分析

**原因 1：FLK_TYPE_CONFIGS 地方性法规分类全部映射为 OTHER**

文件：`src/lib/crawler/flk-crawler.ts`，`FLK_TYPE_CONFIGS` 数组中：

```typescript
// 代码 221-310 全部为地方性法规，均映射到 LawCategory.OTHER
{ code: 221, ..., lawType: LawType.LOCAL_REGULATION, category: LawCategory.OTHER },
{ code: 222, ..., lawType: LawType.LOCAL_REGULATION, category: LawCategory.OTHER },
// ... 共 11 个地方法规代码，全部 OTHER
```

地方性法规共 20,223 条（占 89.6%），这是 OTHER 爆炸的主因。

**原因 2：法律大类（代码 101-200）也全部映射为 OTHER**

```typescript
{ code: 101, label: '法律', flfgFl: 'flfg', lawType: LawType.LAW, category: LawCategory.OTHER },
{ code: 102, label: '法律', ..., category: LawCategory.OTHER },
// 代码 110-200 的法律子分类，也全是 OTHER
```

实际上 FLK 的 `flfgCodeId` 分类编码只能区分法律大类（宪法/法律/行政法规/地方法规/司法解释），**无法区分法律的学科分类**（民事/刑事/劳动…）。
学科分类必须通过**法律名称关键词**或**制定机关**进行二次推断。

### 数据库中可纠正的误分类数量（SQL 关键词匹配统计）

```
should_be_civil      (民法/合同法/婚姻/继承/侵权/物权):       72 条
should_be_criminal   (刑法/刑事诉讼/治安管理):               83 条
should_be_labor      (劳动/就业/工伤/职工/工会):            312 条
should_be_ip         (专利/商标/著作权/知识产权):            113 条
should_be_commercial (证券/保险/银行/公司法/票据):            66 条
likely_economic      (环境/食品安全/药品/安全生产):         1165 条
──────────────────────────────────────────────────────
可纠正小计:                                              1,811 条
真正无法细分的 OTHER（多为地方性组织法/宪法修正案）:      ~18,786 条
```

> **注意**：这 ~18,786 条确实属于"其他"（宪法修正案、各省市组织法、交通/噪声/停车等城市管理地方法规），在现有枚举中没有更好的归属，除非新增 `CONSTITUTIONAL`、`LOCAL_ADMINISTRATIVE` 等子分类枚举值。

### 修复方案

#### 方案 A（推荐）：双层分类策略

**层 1 — 爬虫入库时通过名称关键词推断**

修改文件：`src/lib/crawler/flk-crawler.ts`

在 `parseArticle()` 方法和 `parseAll()` 中，`LawArticleData.category` 的赋值改为调用以下函数：

```typescript
/**
 * 通过法律名称关键词推断学科分类
 * 优先级：精确匹配 > 模糊匹配 > FLK 类型码映射 > OTHER
 */
function inferCategoryFromName(
  lawName: string,
  flfgTypeCategory: LawCategory
): LawCategory {
  const name = lawName;

  // 刑事
  if (/刑法|刑事诉讼|治安管理处罚|监狱|劳动教养/.test(name)) {
    return LawCategory.CRIMINAL;
  }
  // 劳动
  if (/劳动合同|劳动法|就业促进|工伤保险|职工|工会法|劳动争议/.test(name)) {
    return LawCategory.LABOR;
  }
  // 知识产权
  if (/专利法|商标法|著作权|知识产权|反不正当竞争|植物新品种/.test(name)) {
    return LawCategory.INTELLECTUAL_PROPERTY;
  }
  // 商法/经济法
  if (/公司法|证券法|保险法|银行业|票据法|破产法|期货/.test(name)) {
    return LawCategory.COMMERCIAL;
  }
  // 民法
  if (/民法典|合同法|物权法|婚姻法|继承法|侵权责任|民事诉讼/.test(name)) {
    return LawCategory.CIVIL;
  }
  // 行政
  if (/行政许可|行政处罚|行政复议|行政诉讼|公务员|政府采购/.test(name)) {
    return LawCategory.ADMINISTRATIVE;
  }
  // 经济管理（环保/食药/安全生产等）
  if (/环境保护|食品安全|药品管理|安全生产|消费者权益|价格法|反垄断/.test(name)) {
    return LawCategory.ECONOMIC;
  }
  // 程序法
  if (/诉讼法|仲裁法|司法鉴定|法院组织|检察院组织/.test(name)) {
    return LawCategory.PROCEDURE;
  }

  // 兜底：使用 FLK 类型码映射（通常是 OTHER）
  return flfgTypeCategory;
}
```

在 `parseAll()` 方法的 `LawArticleData` 构建中：
```typescript
// 修改前
category: typeConfig?.category || LawCategory.OTHER,

// 修改后
category: inferCategoryFromName(item.title, typeConfig?.category ?? LawCategory.OTHER),
```

同样在 `parseArticle()` 中修改：
```typescript
// 修改前
category: typeConfig?.category || LawCategory.OTHER,

// 修改后
category: inferCategoryFromName(rawData.title, typeConfig?.category ?? LawCategory.OTHER),
```

**层 2 — 对已入库的 20,597 条 OTHER 记录执行一次性修正**

创建迁移脚本 `scripts/fix-law-categories.ts`：

```typescript
import { PrismaClient, LawCategory } from '@prisma/client';

const prisma = new PrismaClient();

// 关键词 → 分类 映射表（按优先级排序，靠前的优先匹配）
const KEYWORD_RULES: Array<{ pattern: RegExp; category: LawCategory }> = [
  { pattern: /刑法|刑事诉讼|治安管理处罚|监狱法|劳动教养/, category: LawCategory.CRIMINAL },
  { pattern: /劳动合同|劳动法|就业促进|工伤保险|职工|工会法|劳动争议/, category: LawCategory.LABOR },
  { pattern: /专利法|商标法|著作权|知识产权|反不正当竞争|植物新品种/, category: LawCategory.INTELLECTUAL_PROPERTY },
  { pattern: /公司法|证券法|保险法|银行业|票据法|破产法|期货/, category: LawCategory.COMMERCIAL },
  { pattern: /民法典|合同法|物权法|婚姻法|继承法|侵权责任|民事诉讼/, category: LawCategory.CIVIL },
  { pattern: /行政许可|行政处罚|行政复议|行政诉讼|公务员法|政府采购/, category: LawCategory.ADMINISTRATIVE },
  { pattern: /环境保护|食品安全|药品管理|安全生产|消费者权益|价格法|反垄断/, category: LawCategory.ECONOMIC },
  { pattern: /诉讼法|仲裁法|司法鉴定|法院组织|检察院组织/, category: LawCategory.PROCEDURE },
];

async function main() {
  console.log('[fix-law-categories] 开始修正 OTHER 分类...');

  // 批量读取，每批 500 条
  let offset = 0;
  const batchSize = 500;
  let totalFixed = 0;
  const stats: Record<string, number> = {};

  while (true) {
    const batch = await prisma.lawArticle.findMany({
      where: { category: LawCategory.OTHER },
      select: { id: true, lawName: true },
      skip: offset,
      take: batchSize,
    });

    if (batch.length === 0) break;

    for (const article of batch) {
      let newCategory: LawCategory | null = null;

      for (const rule of KEYWORD_RULES) {
        if (rule.pattern.test(article.lawName)) {
          newCategory = rule.category;
          break;
        }
      }

      if (newCategory) {
        await prisma.lawArticle.update({
          where: { id: article.id },
          data: { category: newCategory },
        });
        stats[newCategory] = (stats[newCategory] ?? 0) + 1;
        totalFixed++;
      }
    }

    offset += batchSize;
    console.log(`  已处理 ${offset} 条，已修正 ${totalFixed} 条...`);
  }

  console.log(`\n[fix-law-categories] 修正完成！共修正 ${totalFixed} 条`);
  console.log('分类分布变化:', stats);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

运行：
```bash
npx tsx scripts/fix-law-categories.ts
```

#### 方案 B（补充）：新增枚举值（可选，长期改善）

如果希望更精细地标注地方性法规的学科归属，可以在 `prisma/schema.prisma` 中的 `LawCategory` 枚举新增：

```prisma
enum LawCategory {
  CIVIL
  CRIMINAL
  ADMINISTRATIVE
  COMMERCIAL
  ECONOMIC
  LABOR
  INTELLECTUAL_PROPERTY
  PROCEDURE
  CONSTITUTIONAL      // 新增：宪法相关
  LOCAL_ADMINISTRATIVE // 新增：地方行政管理
  OTHER
}
```

> ⚠️ 新增枚举值需要执行 `npx prisma migrate dev`，会对生产数据库产生 DDL 变更，需谨慎评估。

---

## 3. P1 — articleNumber 字段语义错误

### 现状

`law_articles.article_number` 字段存储的是 FLK API 的业务标识符（`bbbs` 字段），形如：

```
402881e4960a68bd01960c88c67300e0
402881e48b3d2c39018b9c1f5be4035d
```

这是一个 UUID 式的哈希 ID，**不是**法律条款号（如「第一条」「第三章第二节」）。

### 根因

FLK 爬虫以"整部法律 = 一条记录"的方式入库，`articleNumber` 被用作唯一标识符（因数据库有 `@@unique([lawName, articleNumber])` 约束）。爬虫中：

```typescript
// src/lib/crawler/flk-crawler.ts, parseAll()
articleNumber: item.bbbs,  // ← 此处赋值为 FLK 哈希 ID
```

### 影响

1. **UI 展示**：如果有任何界面显示"条款号"，会显示乱码哈希
2. **语义混淆**：字段名暗示是法律条款编号，实际是系统内部 ID
3. **辩论引用**：AI 引用法律时输出的 `articleNumber` 无意义

### 修复方案

**短期（改字段用途标注，不迁移数据）**

在 `base-crawler.ts` 的 `LawArticleData` 接口注释中明确说明：

```typescript
export interface LawArticleData {
  /**
   * 条款/文本标识符。
   * 对于 FLK 来源：存储 bbbs（业务主键），格式为 32 位十六进制字符串，
   * 代表整部法律文本，非条款级别编号。
   * 对于未来按条拆分的数据源：可存储「第X条」格式的条款号。
   */
  articleNumber: string;
  // ...
}
```

同时在 `law_articles` 表的数据层查询时，对 FLK 数据的展示做过滤：

```typescript
// 在需要展示条款号的地方
const displayNumber = article.dataSource === 'flk'
  ? '全文'  // FLK 数据是整部法律，非单条
  : article.articleNumber;
```

**长期（拆分为条款级别，需大规模重构）**

将每部法律的全文按条款拆分，每条一行，真正填充 `articleNumber`（如「第一条」「第三十七条」）。这需要：
1. 修改 `parseAll()` 的解析逻辑，在 DOCX 解析阶段按条款切分文本
2. 将 `@@unique([lawName, articleNumber])` 约束改为 `@@unique([lawName, articleNumber, version])`
3. 数据量将从 22,562 条扩展到可能的数百万条

> 建议等 NPC、Court 数据源接入后再统一规划此方案。

---

## 4. P1 — LOCAL_REGULATION 占比过高（数据集比例失衡）

### 现状

```
LOCAL_REGULATION:        20,223 条  (89.6%)
JUDICIAL_INTERPRETATION:    811 条  ( 3.6%)
ADMINISTRATIVE_REGULATION:  804 条  ( 3.6%)
LAW:                        717 条  ( 3.2%)
CONSTITUTION:                 7 条  ( 0.03%)
```

地方性法规数量是全国性法律的 28 倍。在法律辩论和法条推荐场景中，全国性法律（LAW）通常权威性更高、适用范围更广，但目前占比极低。

### 根因

FLK API 中地方性法规（省市级）数量本身就远多于全国性法律。FLK_TYPE_CONFIGS 的默认抓取策略未做优先级过滤，全量抓取导致地方法规占主导。

### 修复方案

**调整采集优先级**，在 `law-sync-scheduler.ts` 或调用 `flkCrawler.crawl()` 时，通过 `FLKCrawlOptions.types` 限制优先采集高权威性类型：

```typescript
// 优先采集全国性法律（权威性 > 地方法规）
const HIGH_PRIORITY_TYPES: FLKTypeCode[] = [
  100,        // 宪法
  101, 102,   // 法律
  110, 120, 130, 140, 150, 160, 170, 180, 190, 195, 200, // 法律子类
  201, 210,   // 行政法规
  311, 320, 330, 340, // 司法解释
];

// 低优先级（地方性法规可按需采集）
const LOW_PRIORITY_TYPES: FLKTypeCode[] = [
  221, 222, 230, 260, 270, 290, 295, 300, 305, 310 // 地方法规
];
```

在调度时分阶段运行：
```typescript
// 第一阶段：采集全国性法律
await flkCrawler.crawl({ types: HIGH_PRIORITY_TYPES });

// 第二阶段（可选）：补充地方性法规
await flkCrawler.crawl({ types: LOW_PRIORITY_TYPES });
```

---

## 5. P2 — fullText 最短 100 字符记录待核查

### 现状

```
全文最短：100 字符
全文平均：5,578 字符
全文最长：113,975 字符
全文为空：0 条
```

存在部分记录全文仅 100 字符，这可能是因为：
1. DOCX 解析失败后，`parseAll()` 中的错误处理分支以空 `fullText: ''` 写入了占位记录（但随后 `validateArticleData` 要求非空，实际写入的是空串的 `" "` 或最短有效内容）
2. 某些法律本身内容极短（如废止通知、单行决定）

### 修复方案

**步骤 1：统计并核查短全文记录**

```sql
-- 查询全文长度 ≤ 200 字符的记录
SELECT law_name, LENGTH(full_text) as len, law_type, data_source, source_id
FROM law_articles
WHERE LENGTH(full_text) <= 200
ORDER BY len ASC
LIMIT 50;
```

**步骤 2：重新解析失败记录**

`FLKCrawler` 已提供 `reparseFailed()` 方法，可重新尝试解析：

```typescript
// 对解析失败的文件重试（需要 data/crawled/flk/ 目录存在）
const result = await flkCrawler.reparseFailed();
```

**步骤 3：对无法恢复的记录，考虑删除或标记**

```typescript
// 标记全文过短的记录为 NEED_UPDATE
await prisma.lawArticle.updateMany({
  where: {
    fullText: { endsWith: '' }, // Prisma 无法直接按 LENGTH 过滤，需 raw query
    dataSource: 'flk',
  },
  data: { syncStatus: 'NEED_UPDATE' },
});
```

或用原始 SQL：
```sql
UPDATE law_articles
SET sync_status = 'NEED_UPDATE'
WHERE LENGTH(full_text) < 200
  AND data_source = 'flk';
```

---

## 6. 附录 A — 数据库统计快照

（审查时间：2026-02-18）

```
总记录数:              22,562
数据源:                flk (100%)
同步状态:              SYNCED (100%)
全文为空:              0 条

--- 按法律类型 ---
LOCAL_REGULATION:      20,223 (89.6%)
JUDICIAL_INTERPRETATION:  811 ( 3.6%)
ADMINISTRATIVE_REGULATION: 804 ( 3.6%)
LAW:                      717 ( 3.2%)
CONSTITUTION:               7 ( 0.03%)

--- 按学科分类 ---
OTHER:              20,597 (91.3%)  ← 主要问题
ADMINISTRATIVE:        953 ( 4.2%)
PROCEDURE:             826 ( 3.7%)
ECONOMIC:              133 ( 0.6%)
CIVIL:                  46 ( 0.2%)
CRIMINAL:                7 ( 0.03%)

--- 按时效状态 ---
VALID:              15,113 (67.0%)
AMENDED:             5,334 (23.6%)
REPEALED:            2,006 ( 8.9%)
DRAFT:                 109 ( 0.5%)

--- 全文长度 ---
最短: 100 字符
最长: 113,975 字符
平均: 5,578 字符

--- 生效年份（近5年）---
2026: 440 条
2025: 2,185 条
2024: 2,178 条
2023: 1,454 条
2022: 1,169 条

--- 发布机构 Top 5 ---
国务院:                      804
最高人民法院:                684
全国人民代表大会常务委员会:  611
广东省人大常委会:            496
上海市人大常委会:            478
```

---

## 附录 B — FLK_TYPE_CONFIGS 现状

文件：`src/lib/crawler/flk-crawler.ts` 第 201-444 行

| FLK 代码 | 标签 | LawType | LawCategory（现状） | 建议改为 |
|----------|------|---------|---------------------|----------|
| 100 | 宪法 | CONSTITUTION | OTHER | OTHER（正确，宪法无法细分） |
| 101-102 | 法律 | LAW | OTHER | **OTHER → 由名称推断** |
| 110 | 宪法相关法 | LAW | OTHER | OTHER |
| 120 | 民法商法 | LAW | **CIVIL** | ✅ 保持 |
| 130 | 行政法 | LAW | **ADMINISTRATIVE** | ✅ 保持 |
| 140 | 经济法 | LAW | **ECONOMIC** | ✅ 保持 |
| 150 | 社会法 | LAW | ~~OTHER~~ → **LABOR** | ✅ **已修复**（2026-02-18） |
| 160 | 刑法 | LAW | **CRIMINAL** | ✅ 已正确（修改前即已是 CRIMINAL） |
| 170 | 诉讼法 | LAW | **PROCEDURE** | ✅ 已正确（修改前即已是 PROCEDURE） |
| 180 | 法律解释 | LAW | OTHER | OTHER |
| 190 | 有关决定 | LAW | OTHER | OTHER |
| 195 | 修正案 | LAW | OTHER | OTHER |
| 200 | 修改废止 | LAW | OTHER | OTHER |
| 201, 210 | 行政法规 | ADMINISTRATIVE_REGULATION | **ADMINISTRATIVE** | ✅ 保持 |
| 215 | 行政法规修废 | ADMINISTRATIVE_REGULATION | ADMINISTRATIVE | ✅ 保持 |
| 220 | 监察法规 | LAW | ADMINISTRATIVE | ✅ 可保持 |
| 221-310 | 地方性法规（11个代码）| LOCAL_REGULATION | **OTHER** | **→ 由名称推断** |
| 311-350 | 司法解释（5个代码）| JUDICIAL_INTERPRETATION | **PROCEDURE** | ✅ 保持 |

**修正说明**（经 minmax2.1 验证）：代码 160 和 170 在本文档生成之前已是正确映射，初版文档误将其列为"待修复"。唯一需要修复的直接映射错误是代码 150（社会法 OTHER → LABOR），已于 2026-02-18 修复。

**FLK_TYPE_CONFIGS 实际状态（已由 minmax2.1 验证，2026-02-18）**：

| 代码 | 标签 | 当前 category | 应为 | 状态 |
|------|------|--------------|------|------|
| 160 | 刑法 | `CRIMINAL` | `CRIMINAL` | ✅ 已正确，无需修改 |
| 170 | 诉讼与非诉讼程序法 | `PROCEDURE` | `PROCEDURE` | ✅ 已正确，无需修改 |
| 150 | 社会法 | ~~`OTHER`~~ → `LABOR` | `LABOR` | ✅ **已修复**（2026-02-18） |

```typescript
// flk-crawler.ts — 代码 150 修复（已应用）
// 修改前
{ code: 150, label: '社会法', ..., category: LawCategory.OTHER },
// 修改后
{ code: 150, label: '社会法', ..., category: LawCategory.LABOR },
```

> **注**：文档初版将 160/170 误列为"待修复"，经 minmax2.1 验证后确认这两项在本次审查前已是正确映射，文档描述有误，此处已更正。

---

## 附录 C — 关联文件清单

| 文件 | 作用 | 本轮是否修改 |
|------|------|--------------|
| `src/lib/crawler/flk-crawler.ts` | FLK 主爬虫，含 FLK_TYPE_CONFIGS 和 parseArticle | ✅ 已修复 SSRF |
| `src/lib/crawler/base-crawler.ts` | 基础类，saveArticle/saveArticles | ✅ 已修复 N×3 查询 + 添加 articleNumber 语义说明 |
| `src/lib/crawler/npc-crawler.ts` | NPC 爬虫（已废弃） | ⚠️ 保留代码，不参与采集 |
| `src/lib/crawler/court-crawler.ts` | Court 爬虫（已废弃） | ⚠️ 保留代码，不参与采集 |
| `src/lib/crawler/law-sync-scheduler.ts` | 采集调度器 | ✅ 已修复默认源/锁/bug + 优先采集全国性法律 |
| `src/lib/crawler/samr-crawler.ts` | SAMR 合同模板爬虫 | ✅ 已修复重复 ID |
| `prisma/schema.prisma` | 数据库模型，LawCategory 枚举 | 未修改 |
| `scripts/fix-law-categories.ts` | 修正 OTHER 分类的迁移脚本 | ✅ 已存在 |
| `scripts/fix-short-fulltext.ts` | 短全文记录修复脚本 | ✅ 已创建 |
| `data/crawled/flk/checkpoint.json` | FLK 采集断点文件 | 运行时生成，gitignore |
| `data/crawled/flk/parse-results.json` | FLK 解析状态文件 | 运行时生成，gitignore |

---

## 执行顺序建议

> **说明**：FLK（flk.npc.gov.cn）已整合全国人大、最高人民法院的法规数据。811 条司法解释已覆盖 Court 来源，NPC/Court 爬虫已废弃。

```
优先级 P0（立刻执行）:
  1. ✅ 修复 FLK_TYPE_CONFIGS 代码 150（社会法 OTHER→LABOR）— 已完成（2026-02-18）
     代码 160/170 在此之前已是正确映射，无需额外修改
  2. ✅ 在 flk-crawler.ts 中添加 inferCategoryFromName() 函数（2026-02-18）
  3. ✅ 创建并运行 scripts/fix-law-categories.ts 修正已有数据

优先级 P1（本周内）:
  4. ✅ 在 LawArticleData 接口添加 articleNumber 字段语义说明（2026-02-18）
  5. ✅ 调整采集策略，优先全国性法律 HIGH_PRIORITY_TYPES（2026-02-18）

优先级 P2（后续迭代）:
  6. ✅ 创建 scripts/fix-short-fulltext.ts 修复脚本（2026-02-18）
      运行: npx tsx scripts/fix-short-fulltext.ts
  7. ✅ 确认 NPC/Court 爬虫废弃（FLK 已整合，无需单独采集）
```
