# 法律法规采集器

纯 TypeScript 实现的法律法规数据采集模块，集成在主项目中。

## 模块结构

```
scripts/crawler/           # 脚本目录
src/lib/crawler/           # 采集模块核心代码
├── base-crawler.ts        # 基础爬虫类
├── flk-crawler.ts         # 国家法律法规数据库爬虫 (两阶段架构)
├── npc-crawler.ts         # 全国人大爬虫
├── court-crawler.ts       # 法院裁判文书爬虫
├── docx-parser.ts         # DOCX 文档解析器 (4级降级)
├── crawl-task-manager.ts  # 任务管理
├── data-validator.ts      # 数据验证
├── law-sync-scheduler.ts  # 同步调度
└── types.ts               # 类型定义
```

## FLK 采集器 (核心)

### 两阶段架构

针对国家法律法规数据库 (https://flk.npc.gov.cn) 的采集分为两个独立阶段：

```
Phase 1: 下载阶段               Phase 2: 解析阶段
┌─────────────────────┐         ┌─────────────────────┐
│ API 分页列表遍历     │         │ 读取磁盘 DOCX 文件   │
│ 逐页拉取+逐条下载   │  ───>   │ docx-parser 4级降级  │
│ DOCX 存盘到本地     │         │ 解析结果写入数据库    │
│ checkpoint.json 断点 │         │ parse-results.json   │
└─────────────────────┘         └─────────────────────┘
```

**为什么分两阶段：**

- 下载失败不丢失已下载的文件
- 解析失败可以随时重试 (改进解析器后 reparseFailed)
- 支持中断续采（断点恢复）
- 逐页拉取+逐条下载，不会先拉完全部列表再下载

### 文件存储

```
data/crawled/flk/
├── checkpoint.json        # 下载断点 (页码/进度)
├── parse-results.json     # 解析状态 (成功/失败/统计)
├── flfg/                  # 宪法/法律
│   └── {sourceId}.docx
├── xzfg/                  # 行政法规
├── jcfg/                  # 监察法规
├── sfjs/                  # 司法解释
└── dfxfg/                 # 地方性法规
```

### API 接口

```bash
# 全流程采集 (下载+解析)
curl -X POST http://localhost:3000/api/crawler/run \
  -H "Content-Type: application/json" \
  -d '{"source":"flk","crawlType":"full"}'

# 仅下载 (推荐先下载, 可中断/续采)
curl -X POST http://localhost:3000/api/crawler/run \
  -H "Content-Type: application/json" \
  -d '{"source":"flk","crawlType":"full","phase":"download"}'

# 仅解析 (对已下载的文件)
curl -X POST http://localhost:3000/api/crawler/run \
  -H "Content-Type: application/json" \
  -d '{"source":"flk","phase":"parse"}'

# 重新解析失败的文件
curl -X POST http://localhost:3000/api/crawler/run \
  -H "Content-Type: application/json" \
  -d '{"source":"flk","phase":"reparse"}'

# 增量采集 (过去7天)
curl -X POST http://localhost:3000/api/crawler/run \
  -H "Content-Type: application/json" \
  -d '{"source":"flk","crawlType":"incremental"}'

# 查看下载/解析统计
curl http://localhost:3000/api/crawler/run?source=flk&stats=true

# 查看采集历史
curl http://localhost:3000/api/crawler/run?source=flk
```

### 数据源分类

| type 参数 | 分类       | 预估数量 |
| --------- | ---------- | -------- |
| flfg      | 宪法/法律  | ~300     |
| xzfg      | 行政法规   | ~800     |
| jcfg      | 监察法规   | ~10      |
| sfjs      | 司法解释   | ~600     |
| dfxfg     | 地方性法规 | ~15000+  |

### 稳定性保障

| 特性         | 说明                                           |
| ------------ | ---------------------------------------------- |
| 断点续采     | checkpoint.json 每页自动保存，中断后从断点恢复 |
| 5次重试      | 指数退避+随机抖动，最长等60秒                  |
| 45秒超时     | 应对网站不稳定                                 |
| DOCX 4级降级 | mammoth → XML → OLE → 纯文本                   |
| 解析容错     | 解析失败仍存元数据，reparseFailed 可重试       |
| 逐页下载     | 拉一页列表即下载，不会先拉全部列表             |
| 每页50条     | 减少列表请求次数 (15000条仅300页)              |

## 其他数据源

| 数据源 | 说明               | 状态            |
| ------ | ------------------ | --------------- |
| flk    | 国家法律法规数据库 | 已实现 (两阶段) |
| npc    | 全国人大法律库     | Mock 数据       |
| court  | 法院裁判文书       | Mock 数据       |

## 运行测试

```bash
npx jest src/__tests__/lib/crawler --no-coverage
```
