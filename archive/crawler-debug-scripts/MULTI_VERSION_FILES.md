# 多版本文件清理清单

## 概述

在整理爬虫相关文件时，发现存在大量多版本/多实现方式的文件。这些文件是开发过程中逐步迭代产生的，现在核心功能已稳定，建议清理冗余版本。

---

## 1. 下载测试脚本多版本 (8 个文件)

**问题：** `test-download` 有 8 个不同版本，功能重叠

| 文件名 | 版本 | 说明 | 建议 |
|--------|------|------|------|
| `test-download.bat` | Windows批处理 | 简单的curl下载测试 | **删除** |
| `test-download-simple.mjs` | 简化版ESM | 简化下载测试 | **删除** |
| `test-download-with-file.mjs` | 带文件版ESM | 带文件保存 | **删除** |
| `test-download.ts` | V1 | 基础下载测试 | **保留** (最完整) |
| `test-download2.ts` | V2 | 监察法规专用 | **删除** |
| `test-download3.ts` | V3 | 未知 | **删除** |
| `test-download4.ts` | V4 | 未知 | **删除** |
| `test-download-verification.ts` | 验证版 | 下载验证 | **删除** |

**建议：** 保留 `test-download.ts` 作为下载测试示例，其余删除

---

## 2. SAMR 测试脚本多版本 (4 个文件)

**问题：** SAMR 相关测试脚本功能重叠

| 文件名 | 功能 | 建议 |
|--------|------|------|
| `test-samr-api.ts` | API测试 | **删除** |
| `test-samr-connectivity.ts` | 连接测试 | **删除** |
| `test-samr-search.ts` | 搜索测试基础版 | **保留** |
| `test-samr-search-extended.ts` | 搜索测试扩展版 | **删除** (合并到基础版) |

**建议：** 保留 `test-samr-search.ts` 作为SAMR测试示例

---

## 3. SAMR 运行脚本多版本 (3 个文件)

**问题：** 多个运行脚本实现方式不同

| 文件名 | 实现方式 | 建议 |
|--------|----------|------|
| `run-samr-crawler.ts` | 基础爬虫运行 | **保留** |
| `run-samr-search-crawler.ts` | 搜索模式运行 | **保留** |
| `run-samr-playwright.ts` | Playwright方式 | **保留** (技术不同) |

**建议：** 全部保留，实现方式不同，各有用途

---

## 4. 增强版脚本 (1 个文件)

| 文件名 | 说明 | 建议 |
|--------|------|------|
| `crawl-all-enhanced.ts` | 增强版全量采集 | **评估后决定** |

**说明：** 这是完整的功能增强版，包含：
- 断点续采
- 增量采集
- 完整数据处理流程

**建议：** 
- 如果 `src/lib/crawler/flk-crawler.ts` 已包含这些功能 → **删除**
- 如果仍有独特功能 → **保留并评估是否合并到核心代码**

---

## 5. 采集数据多版本 (2 个目录)

**问题：** `data/crawled/` 下有多个采集数据目录

| 目录 | 说明 | 建议 |
|------|------|------|
| `data/crawled/flk/` | FLK 采集数据 | **保留** (核心数据源) |
| `data/crawled/samr/` | SAMR 主采集 | **保留** |
| `data/crawled/samr-search/` | SAMR 搜索采集 | **评估后清理** |

**分析：**
- `samr/` - 使用Playwright/基础爬虫采集
- `samr-search/` - 使用搜索模式采集

**建议：** 
- 如果 `samr/` 数据更完整 → **删除 `samr-search/`**
- 如果两者数据互补 → **合并后删除 `samr-search/`**

---

## 6. 其他多版本/重复功能文件

| 文件名 | 说明 | 建议 |
|--------|------|------|
| `debug-samr-detail.ts` | SAMR详情调试 | **删除** (功能被覆盖) |
| `debug-samr-structure.ts` | SAMR结构调试 | **删除** (功能被覆盖) |
| `analyze-samr-structure.ts` | SAMR结构分析 | **删除** (一次性使用) |
| `check-crawler-coverage.ts` | 覆盖率检查 | **删除** (已过时) |
| `check-crawler-quality.ts` | 质量检查 | **评估** |
| `check-crawler-status.ts` | 状态检查 | **评估** |
| `health-monitor.ts` | 健康监控 | **评估** |
| `monitor-progress.ts` | 进度监控 | **评估** |

---

## 清理建议汇总

### 立即删除（共 15 个文件）

```bash
# 下载测试多版本
test-download.bat
test-download-simple.mjs
test-download-with-file.mjs
test-download2.ts
test-download3.ts
test-download4.ts
test-download-verification.ts

# SAMR测试多版本
test-samr-api.ts
test-samr-connectivity.ts
test-samr-search-extended.ts

# 调试脚本（功能被覆盖）
debug-samr-detail.ts
debug-samr-structure.ts
analyze-samr-structure.ts

# 过时的检查脚本
check-crawler-coverage.ts
```

### 评估后决定（共 6 个文件/目录）

```bash
# 功能可能已合并到核心代码
crawl-all-enhanced.ts

# 监控/检查脚本（看是否有在用）
check-crawler-quality.ts
check-crawler-status.ts
health-monitor.ts
monitor-progress.ts

# 数据目录
samr-search/ (对比samr/后决定)
```

### 建议保留（共 15 个文件）

```bash
# 基础下载测试
test-download.ts

# SAMR运行脚本（实现方式不同）
run-samr-crawler.ts
run-samr-search-crawler.ts
run-samr-playwright.ts
test-samr-search.ts

# 批量/导入脚本
batch-crawler.ts
batch-import-samr-contracts.ts
merge-flk-import.py
update-samr-crawler.ts

# 检查脚本（如有需要）
check-latest-and-crawl.ts
verify-crawl-quality.ts

# 其他
run-crawler.ts
run-full-crawl.ts
```

---

## 清理后预期

| 指标 | 清理前 | 清理后 | 减少 |
|------|--------|--------|------|
| 脚本文件数 | 34 | 15-21 | ~40% |
| 数据目录数 | 3 | 2 | 1 |
| 总大小 | ~1.3 MB | ~0.8 MB | ~40% |

---

## 备注

- 所有删除的文件都在 `archive/crawler-debug-scripts/` 中备份
- 如需恢复，可从备份目录复制
- 建议先评估功能是否已合并到核心代码，再决定是否删除
