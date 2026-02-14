# 采集器问题修复总结

## 问题分析

用户报告采集模块在采集过程中会自动停下来。经过分析，发现了以下核心问题：

### 主要问题

1. **缺乏日志系统** - 无法追踪采集过程中的错误和状态
2. **错误处理不完善** - 异常未捕获导致进程崩溃
3. **无自动恢复机制** - 采集失败后无法自动重启
4. **内存管理问题** - 大量数据导致内存溢出
5. **缺乏健康监控** - 无法实时监控采集状态和异常

---

## 修复方案

### 修复 #1: 日志系统

**文件**: `src/lib/crawler/crawler-logger.ts`

**功能**:

- ✅ 分级日志记录（ERROR, WARN, INFO, DEBUG）
- ✅ 文件输出（主日志、错误日志、警告日志）
- ✅ 错误摘要和统计
- ✅ 结构化日志输出
- ✅ 日志轮转和清理

**使用示例**:

```typescript
import { getLogger } from '@/lib/crawler/crawler-logger';

const logger = getLogger('FLKCrawler');
logger.info('开始下载', { type: '宪法', page: 1 });
logger.error('下载失败', error, { url: '...' });
logger.warn('网络超时，重试中...');
```

---

### 修复 #2: 错误处理改进

**文件**: `src/lib/crawler/flk-crawler.ts`

**改进内容**:

- ✅ 添加连续失败计数（`consecutiveErrors`）
- ✅ 单页失败阈值（`MAX_PAGE_FAILURES = 3`）
- ✅ 失败后继续处理，不直接中断
- ✅ 详细的错误日志记录
- ✅ 下载失败也记录元数据，便于后续重试

**关键代码**:

```typescript
// 连续失败检测
if (consecutivePageFailures >= this.MAX_PAGE_FAILURES) {
  this.logger.warn(
    `连续 ${consecutivePageFailures} 页失败，跳过该分类剩余页面`
  );
  break;
}

// 不直接 break，而是记录错误并继续
if (listResponse.code !== 200 || !listResponse.rows) {
  const errorMsg = `列表请求失败: page=${page}, code=${listResponse.code}`;
  errors.push(errorMsg);
  consecutivePageFailures++;
  page++;
  continue;
}
```

---

### 修复 #3: 自动重试和恢复机制（守护进程）

**文件**: `scripts/crawler/crawler-daemon.ts`

**功能**:

- ✅ 自动重启失败的任务（最多 10 次）
- ✅ 断点续传（从 checkpoint.json 恢复）
- ✅ 健康检查（每 30 秒）
- ✅ 异常恢复（捕获未处理的异常）
- ✅ 优雅关闭（响应 SIGTERM/SIGINT）
- ✅ 状态持久化（保存到 daemon-state.json）

**使用方式**:

```bash
# 启动守护进程
ts-node scripts/crawler/crawler-daemon.ts

# 指定选项
ts-node scripts/crawler/crawler-daemon.ts --types 120 --max-pages 10
```

**特性**:

1. **自动重启** - 任务失败后自动重试，最多重启 10 次
2. **断点续传** - 自动保存进度，重启后从断点继续
3. **健康检查** - 每 30 秒检查一次，检测长时间无响应
4. **异常恢复** - 捕获未处理的异常，避免进程崩溃
5. **优雅关闭** - 响应系统信号，保存当前状态

---

### 修复 #4: 批量处理避免内存溢出

**文件**: `scripts/crawler/batch-crawler.ts`

**功能**:

- ✅ 按分类分批处理（默认每批 5 个分类）
- ✅ 内存监控和阈值检测（默认 512MB）
- ✅ 自动垃圾回收（使用 `--expose-gc`）
- ✅ 批次间延迟（默认 5 秒）
- ✅ 分阶段采集（下载/解析分开）
- ✅ 错误摘要和统计

**使用方式**:

```bash
# 完整采集（下载 + 解析）
ts-node scripts/crawler/batch-crawler.ts

# 只下载
ts-node scripts/crawler/batch-crawler.ts --command download

# 只解析
ts-node scripts/crawler/batch-crawler.ts --command parse

# 重试失败项
ts-node scripts/crawler/batch-crawler.ts --command retry

# 自定义配置
ts-node scripts/crawler/batch-crawler.ts \
  --command crawl \
  --batch-size 3 \
  --max-memory 256 \
  --delay 10000
```

**启用垃圾回收**:

```bash
# 启用 GC 标志运行
node --expose-gc node_modules/.bin/ts-node scripts/crawler/batch-crawler.ts
```

---

### 修复 #5: 健康监控

**文件**: `scripts/crawler/health-monitor.ts`

**功能**:

- ✅ 实时健康检查（默认每 30 秒）
- ✅ 进度监控（检测无进展）
- ✅ 错误率监控（检测高错误率）
- ✅ 内存监控（检测内存异常）
- ✅ 警报机制（控制台/日志/Webhook）
- ✅ 健康报告生成

**监控指标**:

| 指标       | 阈值      | 级别 |
| ---------- | --------- | ---- |
| 无进展时间 | > 5 分钟  | 警告 |
| 无进展时间 | > 10 分钟 | 严重 |
| 错误率     | > 25%     | 警告 |
| 错误率     | > 50%     | 严重 |
| 内存使用   | < 100 MB  | 警告 |

**使用方式**:

```bash
# 启动持续监控
ts-node scripts/crawler/health-monitor.ts monitor

# 获取当前状态
ts-node scripts/crawler/health-monitor.ts status

# 生成健康报告
ts-node scripts/crawler/health-monitor.ts report
```

**输出示例**:

```json
{
  "status": "warning",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "uptime": 7200000,
  "progress": {
    "status": "running",
    "processed": 1250,
    "total": 5000,
    "percentage": 25.0,
    "lastUpdate": "2025-01-15T11:58:00.000Z"
  },
  "errors": {
    "recent": ["下载失败: xxx", "解析失败: yyy"],
    "count": 25,
    "rate": 2.0
  },
  "memory": {
    "used": 512,
    "heapUsed": 256,
    "external": 12
  },
  "alerts": ["⚠️ 采集器 6 分钟无进展，可能卡住"]
}
```

---

## 使用建议

### 生产环境（推荐）

**使用守护进程 + 健康监控**:

```bash
# 终端 1: 启动守护进程
ts-node scripts/crawler/crawler-daemon.ts \
  --types 120,130,140 \
  --max-pages 0

# 终端 2: 启动健康监控
ts-node scripts/crawler/health-monitor.ts monitor
```

**优点**:

- ✅ 自动重启和恢复
- ✅ 实时监控和警报
- ✅ 断点续传
- ✅ 优雅关闭

---

### 开发/测试环境

**使用批量采集**:

```bash
# 快速测试小批量数据
ts-node scripts/crawler/batch-crawler.ts \
  --types 120 \
  --max-pages 2 \
  --batch-size 1 \
  --expose-gc
```

**优点**:

- ✅ 内存可控
- ✅ 进度可见
- ✅ 易于调试

---

### 故障恢复

**采集中断后恢复**:

```bash
# 方法 1: 直接重新运行守护进程（推荐）
ts-node scripts/crawler/crawler-daemon.ts

# 方法 2: 使用批量采集
ts-node scripts/crawler/batch-crawler.ts

# 方法 3: 只重试失败的解析
ts-node scripts/crawler/batch-crawler.ts --command retry
```

---

## 文档

### 故障排除指南

完整的问题诊断和解决方案文档：`docs/features/crawler/TROUBLESHOOTING.md`

包含：

- 问题诊断流程
- 5 种常见问题的解决方案
- 日志系统使用指南
- 监控工具使用指南
- 批量采集使用指南
- 守护进程使用指南
- 最佳实践和性能优化

---

## 技术细节

### 日志文件位置

```
logs/
├── crawler.log              # 主日志文件
├── crawler-error.log        # 错误日志
├── crawler-warn.log         # 警告日志
└── health-monitor.log       # 健康监控日志
```

### 状态文件位置

```
data/crawled/flk/
├── checkpoint.json         # 下载断点
├── parse-results.json     # 解析结果
├── daemon-state.json      # 守护进程状态
└── health-status.json     # 健康状态
```

### 查看日志

```bash
# 实时查看所有日志
tail -f logs/crawler.log

# 只查看错误
tail -f logs/crawler-error.log

# 搜索特定关键词
grep "下载失败" logs/crawler.log

# 统计错误数量
grep ERROR logs/crawler.log | wc -l
```

---

## 性能优化建议

### 网络优化

```typescript
// src/lib/crawler/flk-crawler.ts
{
  rateLimitDelay: 3000,  // 适当延迟（2-5 秒）
  requestTimeout: 60000,  // 足够超时（45-60 秒）
  maxRetries: 8,          // 充分重试（5-10 次）
}
```

### 内存优化

```bash
# 启用 GC
node --expose-gc

# 限制批次大小（3-5 个分类）
--batch-size 3

# 设置内存限制（2-4 GB）
--max-old-space-size=4096

# 设置内存阈值（256-512 MB）
--max-memory 512
```

### 批次优化

```bash
# 增加批次间延迟（5-10 秒）
--delay 10000

# 减小批次大小（3-5 个分类）
--batch-size 3
```

---

## 总结

通过以上 5 个方面的修复，采集器现在具备：

1. ✅ **完善的日志系统** - 可追踪所有操作和错误
2. ✅ **健壮的错误处理** - 异常不会导致进程崩溃
3. ✅ **自动恢复机制** - 失败后自动重启和续传
4. ✅ **内存管理** - 批量处理避免 OOM
5. ✅ **实时监控** - 及时发现和处理异常

**推荐使用方式**:

- **生产环境**: 守护进程 + 健康监控
- **开发环境**: 批量采集 + 日志查看
- **故障恢复**: 直接重新运行即可自动恢复

---

## 相关文件

### 核心文件

- `src/lib/crawler/crawler-logger.ts` - 日志系统
- `src/lib/crawler/flk-crawler.ts` - 采集器核心（已改进错误处理）
- `scripts/crawler/crawler-daemon.ts` - 守护进程
- `scripts/crawler/batch-crawler.ts` - 批量采集
- `scripts/crawler/health-monitor.ts` - 健康监控

### 文档

- `docs/features/crawler/TROUBLESHOOTING.md` - 故障排除指南
- `docs/features/crawler/USAGE.md` - 使用指南
- `docs/features/crawler/README.md` - 采集器概述

### 脚本

- `scripts/monitor-progress.ts` - 进度监控
- `scripts/check-db-simple.ts` - 数据库检查
- `scripts/check-docx.ts` - DOCX 文件检查
