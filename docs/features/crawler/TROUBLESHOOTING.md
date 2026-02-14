# 采集器故障排除指南

本指南提供了采集器常见问题的诊断和解决方案。

## 目录

- [问题诊断](#问题诊断)
- [常见问题及解决方案](#常见问题及解决方案)
- [日志系统](#日志系统)
- [监控工具](#监控工具)
- [批量采集](#批量采集)
- [守护进程](#守护进程)

---

## 问题诊断

### 快速诊断命令

```bash
# 检查数据库中的采集统计
npm run check-db

# 生成健康报告
ts-node scripts/crawler/health-monitor.ts report

# 检查日志文件
tail -f logs/crawler.log
```

### 诊断流程图

```
采集异常
  ├─ 检查数据库连接
  │   └─ npm run check-db
  ├─ 检查采集日志
  │   └─ tail -f logs/crawler.log
  ├─ 检查健康状态
  │   └─ ts-node scripts/crawler/health-monitor.ts status
  └─ 检查进度和统计
      └─ ts-node scripts/monitor-progress.ts
```

---

## 常见问题及解决方案

### 问题 1: 采集器自动停止

**症状**

- 采集过程中途自动停止
- 没有错误信息
- 进程意外退出

**原因分析**

1. 内存溢出（OOM）
2. 未捕获的异常
3. 网络连接超时
4. API 限流或拒绝服务

**解决方案**

#### 方案 1: 使用批量采集模式

```bash
# 使用批量采集脚本，按分批处理
ts-node scripts/crawler/batch-crawler.ts \
  --command crawl \
  --batch-size 5 \
  --max-memory 512 \
  --expose-gc
```

#### 方案 2: 使用守护进程（推荐）

```bash
# 启动守护进程，自动重启和恢复
ts-node scripts/crawler/crawler-daemon.ts \
  --types 120 \
  --max-pages 10
```

守护进程特性：

- ✅ 自动重启失败的任务
- ✅ 断点续传
- ✅ 健康检查
- ✅ 异常恢复
- ✅ 优雅关闭

#### 方案 3: 增加内存和超时设置

```bash
# 增加 Node.js 内存限制
node --max-old-space-size=4096 node_modules/.bin/ts-node scripts/run-crawler.ts

# 或在 .env 中设置
NODE_OPTIONS=--max-old-space-size=4096
```

---

### 问题 2: 采集进度停滞

**症状**

- 采集器显示运行中，但进度不更新
- CPU 使用率低
- 没有新日志输出

**原因分析**

1. 网络请求阻塞
2. API 响应缓慢
3. 处理某个文件时卡住

**解决方案**

#### 方案 1: 检查健康状态

```bash
# 获取当前健康状态
ts-node scripts/crawler/health-monitor.ts status
```

查看输出中的：

- `noProgressTime`: 无进展时间
- `alerts`: 警报信息

#### 方案 2: 查看详细日志

```bash
# 查看最近的错误日志
tail -100 logs/crawler.log | grep ERROR

# 查看警告日志
tail -100 logs/crawler.log | grep WARN
```

#### 方案 3: 使用健康监控（推荐）

```bash
# 启动持续健康监控
ts-node scripts/crawler/health-monitor.ts monitor
```

监控会自动检测：

- 10 分钟无进展 → 警报
- 错误率超过 50% → 警报
- 采集器状态异常 → 警报

---

### 问题 3: 大量下载失败

**症状**

- 下载错误率高
- 网络超时频繁
- API 返回 429/5xx 错误

**解决方案**

#### 方案 1: 检查网络连接

```bash
# 测试 API 连接
curl -I https://flk.npc.gov.cn

# 测试下载接口
curl "https://flk.npc.gov.cn/law-search/search/list" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"pageNum":1,"pageSize":1,"searchType":2}'
```

#### 方案 2: 调整限速策略

编辑 `src/lib/crawler/flk-crawler.ts`:

```typescript
// 增加请求间隔
rateLimitDelay: 5000, // 从 2000 改为 5000

// 增加重试次数
maxRetries: 10, // 从 5 改为 10

// 增加超时时间
requestTimeout: 60000, // 从 45000 改为 60000
```

#### 方案 3: 使用断点续传

```bash
# 直接重新运行，会自动跳过已下载的文件
ts-node scripts/run-crawler.ts

# 或使用守护进程
ts-node scripts/crawler/crawler-daemon.ts
```

断点续传会：

- 自动读取 `checkpoint.json`
- 跳过已下载的分类
- 跳过已下载的文件
- 记录失败的项以便重试

---

### 问题 4: 内存使用过高

**症状**

- Node.js 进程内存持续增长
- 最终导致崩溃
- GC 频繁但无效

**解决方案**

#### 方案 1: 启用垃圾回收

```bash
# 启用 GC 标志运行
node --expose-gc node_modules/.bin/ts-node scripts/run-crawler.ts
```

#### 方案 2: 使用批量处理

```bash
# 减小批次大小
ts-node scripts/crawler/batch-crawler.ts \
  --command crawl \
  --batch-size 3 \
  --max-memory 256
```

#### 方案 3: 分阶段采集

```bash
# 第一阶段：只下载
ts-node scripts/crawler/batch-crawler.ts --command download

# 第二阶段：只解析
ts-node scripts/crawler/batch-crawler.ts --command parse
```

#### 方案 4: 增加批次间延迟

```bash
ts-node scripts/crawler/batch-crawler.ts \
  --command crawl \
  --delay 10000 \  # 10 秒延迟
  --max-memory 512
```

---

### 问题 5: 解析失败率高

**症状**

- `parse-results.json` 显示大量失败
- 文件已下载但无法解析
- 内容为空或格式错误

**解决方案**

#### 方案 1: 检查下载文件

```bash
# 检查下载的文件大小
ls -lh data/crawled/flk/*/*.docx

# 检查是否有小文件（可能下载失败）
find data/crawled/flk -name "*.docx" -size -1k
```

#### 方案 2: 重试失败的解析

```bash
# 只重试失败的项
ts-node scripts/crawler/batch-crawler.ts --command retry
```

或使用守护进程：

```bash
ts-node scripts/crawler/crawler-daemon.ts --output-dir data/crawled/flk
```

#### 方案 3: 诊断具体文件

```bash
# 使用诊断脚本
ts-node scripts/crawler/diagnose-metadata-only.ts

# 或检查文件内容
ts-node scripts/check-docx.ts data/crawled/flk/flfg/example.docx
```

#### 方案 4: 恢复元数据记录

```bash
# 重新下载失败的文件
ts-node scripts/crawler/recover-metadata-records.ts

# 或重试内容为空的记录
ts-node scripts/crawler/recover-short-content.ts
```

---

## 日志系统

### 日志级别

- **ERROR**: 错误信息，需要立即关注
- **WARN**: 警告信息，可能影响采集
- **INFO**: 一般信息，记录采集进度
- **DEBUG**: 调试信息，详细追踪

### 日志文件位置

```
logs/
├── crawler.log              # 主日志文件
├── crawler-error.log        # 错误日志
├── crawler-warn.log         # 警告日志
└── health-monitor.log       # 健康监控日志
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

### 日志分析

```bash
# 获取错误摘要
ts-node -e "
import { getLogger } from './src/lib/crawler/crawler-logger';
const logger = getLogger('FLKCrawler');
console.log(JSON.stringify(logger.getErrorSummary(), null, 2));
"

# 查看最近的错误
tail -100 logs/crawler-error.log
```

---

## 监控工具

### 健康监控

```bash
# 启动持续监控
ts-node scripts/crawler/health-monitor.ts monitor

# 获取当前状态
ts-node scripts/crawler/health-monitor.ts status

# 生成报告
ts-node scripts/crawler/health-monitor.ts report
```

### 进度监控

```bash
# 实时监控采集进度
ts-node scripts/monitor-progress.ts

# 查看统计信息
ts-node scripts/check-db-simple.ts
```

### 监控指标

监控会检查以下指标：

| 指标       | 阈值      | 级别 |
| ---------- | --------- | ---- |
| 无进展时间 | > 5 分钟  | 警告 |
| 无进展时间 | > 10 分钟 | 严重 |
| 错误率     | > 25%     | 警告 |
| 错误率     | > 50%     | 严重 |
| 内存使用   | < 100 MB  | 警告 |

---

## 批量采集

### 基本用法

```bash
# 完整采集（下载 + 解析）
ts-node scripts/crawler/batch-crawler.ts

# 只下载
ts-node scripts/crawler/batch-crawler.ts --command download

# 只解析
ts-node scripts/crawler/batch-crawler.ts --command parse

# 重试失败项
ts-node scripts/crawler/batch-crawler.ts --command retry
```

### 高级选项

```bash
# 指定分类
ts-node scripts/crawler/batch-crawler.ts \
  --types 120,130,140

# 限制页数
ts-node scripts/crawler/batch-crawler.ts \
  --max-pages 5

# 自定义批次大小
ts-node scripts/crawler/batch-crawler.ts \
  --batch-size 3 \
  --delay 10000

# 设置内存限制
ts-node scripts/crawler/batch-crawler.ts \
  --max-memory 256

# 自定义输出目录
ts-node scripts/crawler/batch-crawler.ts \
  --output-dir data/custom-output
```

### 启用垃圾回收

```bash
# 启用 GC 标志运行批量采集
node --expose-gc node_modules/.bin/ts-node \
  scripts/crawler/batch-crawler.ts
```

---

## 守护进程

### 启动守护进程

```bash
# 基本用法
ts-node scripts/crawler/crawler-daemon.ts

# 指定选项
ts-node scripts/crawler/crawler-daemon.ts \
  --types 120 \
  --max-pages 10
```

### 守护进程特性

守护进程提供以下功能：

1. **自动重启**
   - 任务失败后自动重试
   - 最多重启 10 次
   - 可配置重试间隔

2. **健康检查**
   - 每 30 秒检查一次
   - 检测长时间无响应
   - 自动记录状态

3. **断点续传**
   - 自动保存进度
   - 重启后恢复采集
   - 跳过已完成的项

4. **异常恢复**
   - 捕获未处理的异常
   - 记录错误详情
   - 避免进程崩溃

5. **优雅关闭**
   - 响应 SIGTERM/SIGINT 信号
   - 保存当前状态
   - 清理资源

### 守护进程状态

```bash
# 查看守护进程状态
cat data/crawled/flk/daemon-state.json

# 输出示例：
{
  "pid": 12345,
  "startTime": "2025-01-15T10:00:00.000Z",
  "restartCount": 2,
  "consecutiveFailures": 0,
  "lastSuccess": "2025-01-15T12:00:00.000Z",
  "lastFailure": null,
  "status": "running"
}
```

### 控制守护进程

```bash
# 发送重载信号（SIGHUP）
kill -HUP <pid>

# 发送终止信号（SIGTERM）
kill -TERM <pid>

# 或使用 Ctrl+C 发送 SIGINT
```

---

## 最佳实践

### 1. 生产环境使用守护进程

```bash
# 推荐配置
ts-node scripts/crawler/crawler-daemon.ts \
  --types 120,130,140 \
  --max-pages 0
```

### 2. 开发环境使用批量采集

```bash
# 快速测试
ts-node scripts/crawler/batch-crawler.ts \
  --types 120 \
  --max-pages 2 \
  --batch-size 1
```

### 3. 始终启用健康监控

```bash
# 在另一个终端运行监控
ts-node scripts/crawler/health-monitor.ts monitor
```

### 4. 定期检查日志

```bash
# 每天检查错误日志
grep ERROR logs/crawler.log | tail -50
```

### 5. 使用断点续传

```bash
# 采集中断后，直接重新运行即可恢复
ts-node scripts/crawler/crawler-daemon.ts
```

---

## 性能优化

### 1. 网络优化

```typescript
// src/lib/crawler/flk-crawler.ts
{
  rateLimitDelay: 3000,  // 适当延迟
  requestTimeout: 60000,  // 足够超时
  maxRetries: 8,          // 充分重试
}
```

### 2. 内存优化

```bash
# 启用 GC
node --expose-gc

# 限制批次大小
--batch-size 3

# 设置内存限制
--max-old-space-size=4096
```

### 3. 并发优化

```bash
# 使用多进程（高级）
# 参考进程池模式实现
```

---

## 故障恢复

### 1. 恢复中断的采集

```bash
# 方法 1: 直接重新运行（推荐）
ts-node scripts/crawler/crawler-daemon.ts

# 方法 2: 使用批量采集
ts-node scripts/crawler/batch-crawler.ts
```

### 2. 修复失败的解析

```bash
# 重试所有失败的解析
ts-node scripts/crawler/batch-crawler.ts --command retry
```

### 3. 清理并重新开始

```bash
# 清理采集数据（谨慎使用）
rm -rf data/crawled/flk/checkpoint.json
rm -rf data/crawled/flk/parse-results.json

# 重新开始采集
ts-node scripts/crawler/crawler-daemon.ts
```

---

## 获取帮助

如果问题仍未解决：

1. 查看完整日志
2. 生成健康报告
3. 检查数据库状态
4. 提交 Issue 并附上：
   - 健康报告
   - 错误日志
   - 数据库统计
   - 系统环境信息

```bash
# 生成完整的诊断信息
ts-node scripts/crawler/health-monitor.ts report > health-report.txt
tail -500 logs/crawler.log > recent-logs.txt
ts-node scripts/check-db-simple.ts > db-stats.txt
```
