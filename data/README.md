# 案例库数据集说明

## 当前状态

| 数据集            | 案件类型         | 导入数量   | 状态        |
| ----------------- | ---------------- | ---------- | ----------- |
| CAIL2018 Exercise | 刑事（全部）     | 154,547 条 | ✅ 已导入   |
| CAIL2023-Argmine  | 多类型（论辩对） | 0          | ⏳ 等待数据 |
| 民事/行政案例     | 民事、行政、劳动 | 0          | ⏳ 等待数据 |

---

## 一、CAIL2018 刑事案例（已完成）

**已导入 154,547 条刑事裁判文书**，覆盖盗窃、故意伤害、诈骗、交通肇事等主要罪名。

### 更新数据

如需导入 CAIL2018 更大版本（约 268 万条），下载完整数据集后运行：

```bash
curl -L "https://cail.oss-cn-qingdao.aliyuncs.com/CAIL2018_ALL_DATA.zip" -o data/cail2018_full.zip
# 解压后运行（文件路径按实际解压位置调整）
npx ts-node --project scripts/tsconfig.json scripts/import-data/import-cail2018.ts \
  data/cail2018/CAIL2018_ALL_DATA/final_all_data/exercise_contest/data_train.json
```

---

## 二、CAIL2023-Argmine 论辩评测数据（待导入）

该数据集用于辩论论点质量评测基准，需向官方申请下载：

1. 访问：https://cail.cipsc.org.cn/task_summit.html
2. 注册账号并参加 CAIL2023 "论辩理解（lblj）" 赛道
3. 下载 `train.json` 和 `test.json` 到 `data/cail2023-argmine/` 目录
4. 运行：
   ```bash
   npx ts-node --project scripts/tsconfig.json scripts/import-data/import-cail2023-argmine.ts data/cail2023-argmine/
   ```

导入脚本同时会输出论辩评测基准文件 `*-benchmark.json`，用于测试 AI 辩论质量。

---

## 三、民事/行政案例（待导入）

目前没有找到免费可下载的大规模中文民事/行政裁判文书数据集。以下是可选方案：

### 方案 A：裁判文书网（推荐，量最大）

- 网址：https://wenshu.court.gov.cn/
- 支持按案件类型（民事/行政/劳动/知识产权）批量导出
- 导出格式为 JSON，可直接用 `import-cfa.ts` 脚本导入
- **限制**：需注册账号，每天有导出数量限制

### 方案 B：CAIL2019 婚姻家庭案例

- 向 CAIL 官方申请：https://cail.cipsc.org.cn/
- 包含约 1 万条婚姻纠纷民事案件，字段格式与 CAIL2018 类似

### 方案 C：OpenDataLab（商汤科技开放平台）

- 网址：https://opendatalab.com/
- 搜索关键词："裁判文书" 或 "judicial document"
- 部分数据集可免费下载，需注册

### 导入方法（方案 A/C 的 JSON/JSONL 文件）

将文件放到 `data/cfa/` 目录，运行：

```bash
npx ts-node --project scripts/tsconfig.json scripts/import-data/import-cfa.ts data/cfa/
```

脚本会自动适配以下字段名（任一格式均可）：

- 事实描述：`fact` / `facts` / `case_fact`
- 裁判结果：`judgment_result` / `judgment` / `decision`
- 案号：`case_number` / `case_no`
- 法院：`court` / `court_name`
- 案件类型：`case_type` / `type`
- 裁判日期：`date` / `judgment_date` / `trial_date`

---

## 四、目录结构

```
data/
├── README.md                    # 本文件
├── cail2018/
│   ├── data_train.jsonl         # 训练集（154,592 条，已转换）
│   ├── data_valid.jsonl         # 验证集（17,131 条）
│   ├── data_test.jsonl          # 测试集（32,508 条）
│   ├── exercise_contest_train.parquet  # 原始 Parquet（可删除）
│   ├── exercise_contest_valid.parquet
│   └── exercise_contest_test.parquet
├── cail2023-argmine/            # 等待放置数据文件
└── cfa/                        # 等待放置民事/行政案例数据
```
