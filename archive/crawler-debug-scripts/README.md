# 爬虫调试脚本备份

此目录包含开发期间产生的爬虫相关调试脚本和测试文件，已清理出主项目。

---

## 清理统计

### 初始备份 (2026-03-12)

| 类别 | 文件数 | 大小 |
|------|--------|------|
| scripts-crawler/ | 34 个文件 | ~1.3 MB |
| temp-scripts/ | 3 个文件 | ~8 KB |
| data-test-files/ | 13 个项目 | ~280 KB |
| **总计** | **50 个项目** | **~1.6 MB** |

### 多版本清理后 (2026-03-12)

| 类别 | 文件数 | 减少 |
|------|--------|------|
| scripts-crawler/ | 19 个文件 | -15 (-44%) |
| temp-scripts/ | 3 个文件 | 0 |
| data-test-files/ | 13 个项目 | 0 |
| **总计** | **35 个项目** | **-15** |

**删除的多版本文件：**
- `test-download` 系列：删除 7 个变体，保留 `test-download.ts`
- `test-samr` 系列：删除 2 个变体，保留 `test-samr-search.ts`
- `debug-samr` 系列：删除 3 个调试脚本
- `crawl-all-enhanced.ts`：功能已合并到核心代码
- `check-crawler-coverage.ts`：已过时
- `analyze-samr-structure.ts`：一次性使用

---

## 备份内容

### 1. scripts-crawler/ (19 个文件)

**核心运行脚本（保留）：**
- `run-crawler.ts` - 通用爬虫运行脚本
- `run-full-crawl.ts` - 全量采集脚本
- `run-samr-crawler.ts` - SAMR 爬虫运行脚本
- `run-samr-search-crawler.ts` - SAMR 搜索爬虫
- `run-samr-playwright.ts` - SAMR Playwright 爬虫

**批量处理脚本：**
- `batch-crawler.ts` - 批量采集脚本
- `batch-import-samr-contracts.ts` - SAMR 合同批量导入
- `merge-flk-import.py` - FLK 导入合并脚本
- `update-samr-crawler.ts` - SAMR 爬虫更新

**监控检查脚本：**
- `check-crawler-quality.ts` - 质量检查
- `check-crawler-status.ts` - 状态检查
- `check-latest-and-crawl.ts` - 最新内容检查并采集
- `verify-crawl-quality.ts` - 采集质量验证
- `health-monitor.ts` - 健康监控
- `monitor-progress.ts` - 进度监控

**测试脚本（去重后）：**
- `test-download.ts` - 下载测试（保留唯一版本）
- `test-samr-search.ts` - SAMR 搜索测试（保留唯一版本）
- `test-12315-api.mjs` - 12315 API 测试

**其他：**
- `README.md` - 原目录说明

### 2. temp-scripts/ (3 个文件)

根目录下的临时检查脚本：
- `temp-check-law-articles-content.ts` - 临时法条内容检查
- `temp-check-law-articles.ts` - 临时法条检查
- `temp-test-search.ts` - 临时搜索测试

### 3. data-test-files/ (13 个项目)

数据目录下的测试文件：

**JSON 响应示例：**
- `flk-bundle.js` - FLK 数据打包文件 (1.3MB)
- `flk-detail-response.json` - FLK 详情响应示例
- `flk-list-response.json` - FLK 列表响应示例
- `flk-xianfa-detail.json` - FLK 宪法详情示例
- `flk-xianfa-list.json` - FLK 宪法列表示例

**测试下载文件：**
- `test-downloads/` - 测试下载目录（包含2个docx文件）
- `test-download.docx` - 测试下载文件1
- `test-download2.docx` - 测试下载文件2
- `test-xianfa.docx` - 宪法测试文件
- `download-bb9f86ff535d414097f13246b40a0a67.docx` - 临时下载文件
- `just-laws.zip` - 法律数据压缩包

---

## 保留的核心文件

以下文件仍保留在项目主目录中：

### 爬虫核心代码
```
src/lib/crawler/
├── base-crawler.ts              # 基础爬虫类
├── flk-crawler.ts               # FLK 爬虫实现
├── samr-crawler.ts              # SAMR 爬虫实现
├── samr-playwright.ts           # SAMR Playwright 实现
├── crawl-task-manager.ts        # 任务管理器
├── data-validator.ts            # 数据验证器
├── crawler-logger.ts            # 爬虫日志
├── docx-parser.ts               # DOCX 解析器
├── law-sync-scheduler.ts        # 同步调度器
├── types.ts                     # 类型定义
├── contract-template-types.ts   # 合同模板类型
└── index.ts                     # 模块导出
```

### 爬虫测试（全部保留）
```
src/__tests__/lib/crawler/
├── crawler-security.test.ts     # 安全测试 ✓ (13 tests)
├── data-validator.test.ts       # 数据验证测试 ✓ (5 tests)
├── fix-categories.test.ts       # 分类修复测试 ✓
├── flk-crawler.test.ts          # FLK 爬虫测试 ✓ (15 tests)
├── samr-crawler.test.ts         # SAMR 爬虫测试 ✓ (39 tests)
└── samr-crawl-e2e.test.ts       # SAMR E2E 测试 ✓ (5 tests)

Total: 122 tests passing
```

### API 路由（保留）
```
src/app/api/crawler/
├── run/route.ts                 # 爬虫启动 API（安全增强版）
├── status/[taskId]/route.ts     # 状态查询 API
└── statistics/route.ts          # 统计 API
```

### 采集数据目录（保留）
```
data/
├── crawled/                     # 实际采集数据存储目录
│   ├── flk/                     # FLK 采集数据
│   └── samr/                    # SAMR 采集数据
├── dev.db                       # 开发数据库
└── dev.db-journal               # 数据库日志
```

---

## 多版本清理详情

### 删除的文件清单

**下载测试多版本（删除 7 个）：**
- ❌ `test-download.bat` - Windows批处理版
- ❌ `test-download-simple.mjs` - 简化版
- ❌ `test-download-with-file.mjs` - 带文件版
- ❌ `test-download2.ts` - V2（监察法规专用）
- ❌ `test-download3.ts` - V3
- ❌ `test-download4.ts` - V4
- ❌ `test-download-verification.ts` - 验证版

**SAMR 测试多版本（删除 2 个）：**
- ❌ `test-samr-api.ts` - API测试
- ❌ `test-samr-connectivity.ts` - 连接测试
- ❌ `test-samr-search-extended.ts` - 扩展版

**调试脚本（删除 3 个）：**
- ❌ `debug-samr-detail.ts` - SAMR详情调试
- ❌ `debug-samr-structure.ts` - SAMR结构调试
- ❌ `analyze-samr-structure.ts` - SAMR结构分析

**其他（删除 2 个）：**
- ❌ `crawl-all-enhanced.ts` - 增强版全量采集（功能已合并到核心）
- ❌ `check-crawler-coverage.ts` - 覆盖率检查（已过时）

### 保留的文件理由

| 文件名 | 保留理由 |
|--------|----------|
| `test-download.ts` | 最完整的下载测试版本 |
| `test-samr-search.ts` | SAMR搜索测试基础版 |
| `run-samr-*.ts` (3个) | 实现方式不同，各有用途 |
| `batch-*.ts` | 批量处理功能 |
| `check-*.ts` | 监控检查功能 |

---

## 清理效果

### 清理前
- 项目根目录 cluttered with 临时脚本
- scripts/ 目录包含 34+ 个调试脚本
- data/ 目录包含测试下载文件和 JSON 示例
- 难以区分核心代码和调试代码

### 清理后
- ✓ 核心代码清晰分离
- ✓ 多版本文件已去重
- ✓ 测试全部通过 (122/122)
- ✓ 更好的代码可维护性

---

## 清理时间
- 首次清理：2026-03-12
- 多版本清理：2026-03-12

## 测试验证
```
Test Suites: 6 passed, 6 total
Tests:       122 passed, 122 total
```

## 说明

这些脚本在开发调试期间使用，现在爬虫核心功能已稳定，为避免代码混乱，将这些非核心脚本移动到备份目录。如需恢复使用，可从本目录复制回项目。

### 为什么要清理这些文件？

1. **减少项目体积** - 删除了约 1.6 MB 的临时文件和测试数据
2. **消除多版本混乱** - 合并/删除了 15 个多版本文件
3. **降低维护成本** - 避免维护过时的调试脚本
4. **提高代码可读性** - 核心代码更清晰
5. **避免安全风险** - 移除了可能包含敏感信息的调试脚本
6. **规范项目结构** - 只保留核心功能和必要的测试

### 如果需要恢复使用：

```bash
# 从备份目录复制回项目
cp archive/crawler-debug-scripts/scripts-crawler/xxx.ts scripts/
```
