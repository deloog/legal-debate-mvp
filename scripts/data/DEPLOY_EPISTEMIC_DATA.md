# 认识论数据部署说明

本次更新新增了 `historical_case_article_refs` 表，存储来自 CAIL2018（268万刑事案例聚合）和最高法指导案例（267条）的历史引用数据，用于支撑法条认识论状态计算。

## 数据概览

| 数据源                            | 记录数    | 覆盖案例数    |
| --------------------------------- | --------- | ------------- |
| CAIL2018（刑事案例聚合）          | 5,750     | 2,655,417     |
| SUPREME_GUIDING（最高法指导案例） | 235       | 325           |
| **合计**                          | **5,985** | **2,655,742** |

---

## 部署步骤

### 第一步：拉取最新代码

```bash
git pull origin main
```

### 第二步：执行数据库迁移

创建 `historical_case_article_refs` 新表：

```bash
npx prisma migrate deploy
```

### 第三步：导入历史引用数据

```bash
psql $DATABASE_URL < scripts/data/historical_case_article_refs_seed.sql
```

> 如果服务器用独立的数据库连接串，替换 `$DATABASE_URL` 为实际连接串，格式：
> `postgresql://用户名:密码@host:5432/数据库名`

### 第四步：重算认识论状态

此步骤会读取服务器上已有的 `legal_references`（真实案例引用）+ 刚导入的历史数据，合并计算每条法条的认识论状态：

```bash
npx ts-node --project scripts/tsconfig.json scripts/compute-epistemic-states.ts
```

预计运行时间：1~3 分钟（取决于服务器法条引用数量）。

---

## 验证

运行以下 SQL 确认数据导入成功：

```sql
SELECT "dataSource", COUNT(*) as records, SUM("caseCount") as total_cases
FROM historical_case_article_refs
GROUP BY "dataSource";

-- 预期结果：
-- CAIL2018        | 5750 | 2655417
-- SUPREME_GUIDING |  235 |     325

SELECT profile, COUNT(*) FROM law_article_epistemic_states GROUP BY profile;
-- 预期：应有 IRON_CLAD、UNCERTAIN 等分布
```

---

## 注意事项

- **步骤顺序不可颠倒**：必须先迁移（第二步）再导入（第三步），否则表不存在会报错。
- **第四步必须在服务器上运行**：认识论状态依赖服务器上的真实案例引用数据（`legal_references` 表），不能从本地导出替代。
- **幂等性**：第三步和第四步均可重复执行，不会产生重复数据。
