"""
U盘 flk 法律数据合并导入脚本
策略：ON CONFLICT (lawName, articleNumber) DO NOTHING
  - 本机已有的 npc 条文保持不变
  - U盘独有的 flk 条文追加插入

用法：python scripts/merge-flk-import.py
"""

import json
import sys
import time
import uuid
import psycopg2
import psycopg2.extras
from datetime import datetime, timezone

# ── 配置 ──────────────────────────────────────────────────────────────────────
JSONL_PATH = "F:/legal-export/law_articles.jsonl"
DB_DSN = "host=localhost port=5432 dbname=legal_debate_dev user=postgres password=TFL5650056btg"
BATCH_SIZE = 500
# ─────────────────────────────────────────────────────────────────────────────

INSERT_SQL = """
INSERT INTO law_articles (
    id, "lawName", "articleNumber", "fullText", "lawType", category,
    "subCategory", tags, keywords, version, "effectiveDate", "expiryDate",
    status, "amendmentHistory", "parentId", "chapterNumber", "sectionNumber",
    level, "issuingAuthority", jurisdiction, "relatedArticles", "legalBasis",
    "searchableText", "viewCount", "referenceCount", "dataSource", "sourceId",
    "importedAt", "lastSyncedAt", "syncStatus", "createdAt", "updatedAt"
)
VALUES %s
ON CONFLICT ("lawName", "articleNumber") DO NOTHING
"""

def gen_id():
    return str(uuid.uuid4()).replace("-", "")[:25]

def parse_dt(s):
    if s is None:
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00"))

def make_row(obj):
    return (
        gen_id(),
        obj["lawName"],
        obj["articleNumber"],
        obj["fullText"],
        obj["lawType"],
        obj["category"],
        obj.get("subCategory"),
        obj.get("tags") or [],
        obj.get("keywords") or [],
        obj.get("version", "1.0"),
        parse_dt(obj.get("effectiveDate")),
        parse_dt(obj.get("expiryDate")),
        obj.get("status", "VALID"),
        json.dumps(obj["amendmentHistory"], ensure_ascii=False) if obj.get("amendmentHistory") else None,
        obj.get("parentId"),
        obj.get("chapterNumber"),
        obj.get("sectionNumber"),
        obj.get("level", 0),
        obj.get("issuingAuthority", ""),
        obj.get("jurisdiction"),
        obj.get("relatedArticles") or [],
        obj.get("legalBasis"),
        obj.get("searchableText", ""),
        obj.get("viewCount", 0),
        obj.get("referenceCount", 0),
        obj.get("dataSource", "flk"),
        obj.get("sourceId"),
        parse_dt(obj.get("importedAt")),
        parse_dt(obj.get("lastSyncedAt")),
        obj.get("syncStatus", "SYNCED"),
        parse_dt(obj.get("createdAt")) or datetime.now(timezone.utc),
        parse_dt(obj.get("updatedAt")) or datetime.now(timezone.utc),
    )

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    print(f"[{datetime.now():%H:%M:%S}] 开始导入 U盘 flk 数据...")
    print(f"来源文件：{JSONL_PATH}")
    print(f"批次大小：{BATCH_SIZE}")
    print("-" * 60)

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur = conn.cursor()

    # 导入前统计
    cur.execute("SELECT COUNT(*) FROM law_articles")
    before_total = cur.fetchone()[0]
    cur.execute("SELECT COUNT(DISTINCT \"lawName\") FROM law_articles")
    before_laws = cur.fetchone()[0]
    print(f"导入前：{before_total:,} 条条文，{before_laws:,} 部法律\n")

    start_time = time.time()
    total_read = 0
    total_inserted = 0
    total_skipped = 0
    batch = []
    errors = []

    with open(JSONL_PATH, "r", encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                batch.append(make_row(obj))
                total_read += 1
            except Exception as e:
                errors.append(f"第{lineno}行解析失败: {e}")
                continue

            if len(batch) >= BATCH_SIZE:
                try:
                    result = psycopg2.extras.execute_values(
                        cur, INSERT_SQL, batch, fetch=False, page_size=BATCH_SIZE
                    )
                    # rowcount = 实际插入数（跳过冲突的）
                    inserted = cur.rowcount if cur.rowcount >= 0 else 0
                    skipped = len(batch) - inserted
                    total_inserted += inserted
                    total_skipped += skipped
                    conn.commit()
                except Exception as e:
                    conn.rollback()
                    errors.append(f"批次插入失败(第{total_read}条附近): {e}")
                batch = []

                elapsed = time.time() - start_time
                speed = total_read / elapsed if elapsed > 0 else 0
                eta = (674681 - total_read) / speed if speed > 0 else 0
                print(
                    f"\r已读 {total_read:,} | 新增 {total_inserted:,} | "
                    f"跳过 {total_skipped:,} | 速度 {speed:.0f}条/s | 预计剩余 {eta:.0f}s",
                    end="", flush=True
                )

    # 处理最后一批
    if batch:
        try:
            psycopg2.extras.execute_values(cur, INSERT_SQL, batch, fetch=False)
            inserted = cur.rowcount if cur.rowcount >= 0 else 0
            skipped = len(batch) - inserted
            total_inserted += inserted
            total_skipped += skipped
            conn.commit()
        except Exception as e:
            conn.rollback()
            errors.append(f"最后批次插入失败: {e}")

    # 导入后统计
    cur.execute("SELECT COUNT(*) FROM law_articles")
    after_total = cur.fetchone()[0]
    cur.execute("SELECT COUNT(DISTINCT \"lawName\") FROM law_articles")
    after_laws = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM law_articles WHERE \"dataSource\" = 'flk'")
    flk_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM law_articles WHERE \"dataSource\" = 'npc'")
    npc_count = cur.fetchone()[0]

    cur.close()
    conn.close()

    elapsed = time.time() - start_time
    print(f"\n\n{'=' * 60}")
    print("导入完成 — 详细报告")
    print(f"{'=' * 60}")
    print(f"耗时：{elapsed:.1f} 秒")
    print()
    print("【读取情况】")
    print(f"  U盘总行数：   {total_read:>10,}")
    print(f"  解析错误：    {len(errors):>10,}")
    print()
    print("【写入情况】")
    print(f"  新增条文：    {total_inserted:>10,}  ← flk 独有，已追加")
    print(f"  跳过条文：    {total_skipped:>10,}  ← 与本机重复(lawName+articleNumber)，保留原npc数据")
    print()
    print("【数据库前后对比】")
    print(f"  导入前总条文：{before_total:>10,}  (来自 {before_laws:,} 部法律)")
    print(f"  导入后总条文：{after_total:>10,}  (来自 {after_laws:,} 部法律)")
    print(f"  净增条文：    {after_total - before_total:>10,}")
    print(f"  净增法律数：  {after_laws - before_laws:>10,}")
    print()
    print("【来源分布】")
    print(f"  npc（全国人大网）：{npc_count:>10,} 条")
    print(f"  flk（法律库网）：  {flk_count:>10,} 条")
    print()
    if errors:
        print(f"【警告：{len(errors)} 个错误】")
        for e in errors[:20]:
            print(f"  - {e}")
        if len(errors) > 20:
            print(f"  ... 及其他 {len(errors)-20} 个错误")
    else:
        print("【数据质量】无任何解析或写入错误，全部成功")
    print(f"{'=' * 60}")

if __name__ == "__main__":
    main()
