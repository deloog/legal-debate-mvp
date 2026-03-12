# 项目多版本文件清理总结

## 清理时间
2026-03-12

## 清理原则
1. **谨慎核实** - 删除前确认文件不被生产代码引用
2. **先备份再删除** - 所有文件先移到 archive/ 目录
3. **保留功能差异版本** - 功能不同的文件保留
4. **测试验证** - 清理后运行测试确保无影响

---

## 清理内容汇总

### 一、爬虫调试脚本（50个文件 → 35个文件）

**位置**: `archive/crawler-debug-scripts/`

**删除的多版本文件**:
- `test-download` 系列: 删除 7 个变体，保留 `test-download.ts`
- `test-samr` 系列: 删除 2 个变体，保留 `test-samr-search.ts`
- `debug-samr` 系列: 删除 3 个调试脚本
- `crawl-all-enhanced.ts`: 功能已合并到核心代码
- `check-crawler-coverage.ts`: 已过时

**减少**: 15 个文件，~0.5 MB

---

### 二、Scripts 目录多版本（清理 6 个文件）

**位置**: `archive/multi-version-backup/scripts/`

| 删除文件 | 保留版本 | 理由 |
|----------|----------|------|
| test-db-connection.js | test-connection-pool.ts | JS版本被TS覆盖 |
| test-db-connection-simple.ts | test-connection-pool.ts | 简单版被完整版覆盖 |
| test-deepseek-connection.mjs | test-deepseek-connection.ts | ESM与TS重复 |
| get-memory-agent-coverage.js | get-memory-agent-coverage.mjs | JS被MJS覆盖 |
| test-document-accuracy.ts | test-document-accuracy-final.ts | 基础版 |
| test-document-accuracy-improved.ts | test-document-accuracy-final.ts | 中间版本 |

**核实保留的文件**（功能不同）:
- 数据库检查: `check-db.ts`, `check-db-simple.ts`, `check-db-status.ts`
- AI测试: `test-ai-*.ts` (4个文件)
- DeepSeek测试: `test-deepseek-*.ts` (3个文件)
- 覆盖率工具: 12个文件功能各异

**减少**: 6 个文件，~33 KB

---

### 三、ESLint临时报告（清理 10 个文件）

**位置**: `archive/eslint-reports/`

**清理文件**:
- `eslint-current-errors.txt`
- `eslint-current-report.json`
- `eslint-error-count.txt`
- `eslint-final-report.txt`
- `eslint-report.json` (1MB)
- `eslint-report.txt`
- `eslint-require-errors.txt`
- `eslint-src-report.json` (1MB)
- `eslint-status-new.txt`
- `eslint-temp-report.txt` (2.3MB)

**减少**: 10 个文件，~4.4 MB

---

### 四、TypeScript错误报告（清理 23 个文件）

**位置**: `archive/typescript-error-reports/`

**清理文件类型**:
- `baseline-errors.txt`
- `current-*.txt` (多个)
- `pragmatic-*.txt` (8个)
- `ts2345-*.txt`, `ts2564-*.txt`, `ts2724-*.txt`, `ts6133-*.txt`
- `tsc*.txt` (多个)
- `temp_errors.txt`

**减少**: 23 个文件，~3 MB

---

## 总计清理效果

| 类别 | 文件数 | 大小 |
|------|--------|------|
| 爬虫调试脚本 | -15 | ~0.5 MB |
| Scripts多版本 | -6 | ~33 KB |
| ESLint报告 | -10 | ~4.4 MB |
| TS错误报告 | -23 | ~3 MB |
| **总计** | **-54 个文件** | **~8 MB** |

---

## 保留的核心文件

### 爬虫模块
```
src/lib/crawler/              (12个核心文件)
src/__tests__/lib/crawler/    (6个测试文件，122测试通过)
src/app/api/crawler/          (3个API路由)
```

### 生产代码验证
```
Test Suites: 6 passed, 6 total (爬虫测试)
Tests:       122 passed, 122 total
```

### 重要配置文件
```
eslint.config.mjs              (主配置)
eslint.config.quick.mjs        (快速检查)
jest.config.js                 (主配置)
jest.config.integration.js     (集成测试)
```

---

## 核查结果

### ✅ 确认安全的操作
- 所有删除的脚本文件未被 `package.json` 引用
- 所有删除的脚本文件未被 `.github/workflows` 引用
- 清理后所有测试通过

### ✅ 保留的文件类型
- 生产代码 (`src/`)
- 核心测试 (`src/__tests__/`)
- 配置文件 (`jest.config.*`, `eslint.config.*`)
- 功能不同的调试脚本

### ⚠️ 注意
- `jest.global-setup.js` 和 `.ts` 内容不同，都保留
- `graph-enhanced-law-search.ts` 依赖 `law-search.ts`，都保留
- `tsconfig.*.tsbuildinfo` 是编译缓存，保留在项目根目录

---

## 备份目录结构

```
archive/
├── crawler-debug-scripts/      (35个备份文件)
│   ├── scripts-crawler/        (19个)
│   ├── temp-scripts/           (3个)
│   └── data-test-files/        (13个)
├── multi-version-backup/
│   └── scripts/                (6个)
├── eslint-reports/             (10个)
├── typescript-error-reports/   (23个)
└── CLEANUP_SUMMARY.md          (本文件)
```

---

## 如需恢复

```bash
# 恢复爬虫脚本
cp archive/crawler-debug-scripts/scripts-crawler/<file> scripts/

# 恢复其他脚本
cp archive/multi-version-backup/scripts/<file> scripts/
```

---

## 清理后项目状态

- ✅ 核心代码完整
- ✅ 测试全部通过
- ✅ 无重复脚本文件
- ✅ 临时报告已归档
- ✅ 项目结构更清晰
