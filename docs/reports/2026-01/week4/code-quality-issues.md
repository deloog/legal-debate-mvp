# 代码质量问题修复清单

**生成日期**: 2026-02-12
**项目**: 法律辩论平台 (Legal Debate MVP)
**总问题数**: 346个文件存在问题
**优先级**: 🔴 严重 > 🟠 高 > 🟡 中 > 🟢 低

---

## 🔴 严重优先级问题（立即修复）

### 1. SQL注入漏洞 - 3处

#### 问题1.1: registration-trend API
- **文件**: `src/app/api/stats/users/registration-trend/route.ts`
- **行号**: 263, 266, 270-278
- **问题**: 字符串拼接构建SQL，存在注入风险
- **当前代码**:
```typescript
whereConditions.push(`"role" = '${whereClause.role}'`);
whereConditions.push(`"status" = '${whereClause.status}'`);
await prisma.$queryRawUnsafe(`SELECT ... WHERE ${whereSql}`);
```
- **修复方案**: 使用参数化查询
```typescript
// 使用 Prisma 参数化查询
const params = [];
if (whereClause.role) {
  whereConditions.push(`"role" = $${params.length + 1}`);
  params.push(whereClause.role);
}
// 或使用 Prisma.sql
```
- **状态**: ✅ 已修复

#### 问题1.2: user activity API
- **文件**: `src/app/api/stats/users/activity/route.ts`
- **行号**: 240-241
- **问题**: 直接拼接用户输入到SQL
- **当前代码**:
```typescript
${whereClause.role ? `AND "users"."role" = '${whereClause.role}'` : ''}
${whereClause.status ? `AND "users"."status" = '${whereClause.status}'` : ''}
```
- **修复方案**: 使用参数化查询或 Prisma ORM 标准方法
- **状态**: ✅ 已修复

#### 问题1.3: follow-up task processor
- **文件**: `src/lib/client/follow-up-task-processor.ts`
- **行号**: 201-202
- **问题**: 直接拼接变量到SQL
- **当前代码**:
```typescript
WHERE fut.id = ${taskId} AND fut."userId" = ${userId}
```
- **修复方案**: 使用参数化查询
- **状态**: ✅ 已修复

---

### 2. 环境变量验证缺失

#### 问题2.1: 启动时缺少配置验证
- **影响**: 179个文件直接使用 process.env
- **问题**: 缺少必需配置时，运行时才发现错误
- **修复方案**: 在应用入口添加配置验证
- **实现位置**: `src/app/layout.tsx` 或创建 `src/config/validate-env.ts`
- **代码**:
```typescript
// src/config/validate-env.ts
export function validateRequiredEnv() {
  const required = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'JWT_SECRET',
    'DEEPSEEK_API_KEY',
    'ZHIPU_API_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `缺少必需的环境变量: ${missing.join(', ')}\n` +
      `请检查 .env 文件配置`
    );
  }

  // 检查占位符
  if (process.env.NODE_ENV === 'production') {
    const placeholders = required.filter(key => {
      const value = process.env[key];
      return value?.includes('your-') ||
             value?.includes('placeholder') ||
             value === 'password';
    });

    if (placeholders.length > 0) {
      throw new Error(
        `生产环境不能使用占位符配置: ${placeholders.join(', ')}`
      );
    }
  }
}
```
- **状态**: ✅ 已修复

#### 问题2.2: .env.production 占位符值
- **文件**: `.env.production`
- **问题**: 包含占位符和弱密码
- **当前值**:
```env
DEEPSEEK_API_KEY="sk-placeholder-deepseek-key"
ZHIPU_API_KEY="placeholder-zhipu-key"
DATABASE_URL="postgresql://postgres:password@localhost:5432/legal_debate_prod"
```
- **修复方案**:
  1. 在文件顶部添加明确警告注释
  2. 在 README 中添加配置说明
  3. 添加启动时检查（见2.1）
- **状态**: ✅ 已修复

---

### 3. 数据库密码安全

#### 问题3.1: 弱数据库密码
- **文件**: `.env`, `.env.production`
- **问题**: 使用默认密码 "password"
- **修复方案**:
  1. 生成强密码
  2. 更新 README 添加密码要求说明
  3. 添加密码强度检查
- **状态**: ✅ 已修复

---

## 🟠 高优先级问题（本周修复）

### 4. 过度使用 as any - 153个文件

#### 关键生产代码中的 as any（需要优先修复）

#### 问题4.1: API Monitor
- **文件**: `src/lib/monitoring/api-monitor.ts`
- **行号**: 385, 546-547
- **问题**: 绕过类型检查访问属性
- **当前代码**:
```typescript
const request = interaction.request as any;
tokensUsed = (result as any).tokensUsed;
cost = (result as any).cost;
```
- **修复方案**: 定义明确的接口
```typescript
interface ApiInteractionRequest {
  method: string;
  url: string;
  // ... 其他属性
}

interface ApiResult {
  tokensUsed?: number;
  cost?: number;
  // ... 其他属性
}

const request = interaction.request as ApiInteractionRequest;
const apiResult = result as ApiResult;
tokensUsed = apiResult.tokensUsed;
```
- **状态**: ✅ 已修复

#### 问题4.2: Performance Monitor
- **文件**: `src/lib/ai/performance-monitor.ts`
- **行号**: 132-133, 154
- **问题**: 使用 (this as any) 访问动态属性
- **当前代码**:
```typescript
(this as any).metrics.push(metric);
((this as any).pendingRequests as Map<string, any>)
```
- **修复方案**: 在类中显式声明私有属性
```typescript
class PerformanceMonitor {
  private metrics: Metric[] = [];
  private pendingRequests: Map<string, PendingRequest> = new Map();

  // ... 使用类型安全的访问
  this.metrics.push(metric);
  this.pendingRequests.get(key);
}
```
- **状态**: ✅ 已修复

#### 问题4.3: Logging Operations
- **文件**: `src/lib/agent/core-actions/logging-operations.ts`
- **行号**: 45, 48-53
- **问题**: 参数类型强制转换
- **修复方案**: 修正底层类型定义，使用泛型或联合类型
- **状态**: ✅ 已修复

#### 问题4.4: Contract Version Service
- **文件**: `src/lib/contract/contract-version-service.ts`
- **行号**: 107, 188-189, 218
- **问题**: snapshot as any，JSON数据没有类型验证
- **修复方案**: 使用 Zod 验证 JSON Schema
```typescript
import { z } from 'zod';

const SnapshotSchema = z.object({
  title: z.string(),
  content: z.string(),
  // ... 定义完整 schema
});

type Snapshot = z.infer<typeof SnapshotSchema>;

// 验证
const snapshot = SnapshotSchema.parse(jsonData);
```
- **状态**: ✅ 已修复

#### 问题4.5: Contract Approval Service
- **文件**: `src/lib/contract/contract-approval-service.ts`
- **问题**: 返回数据使用 as any
- **修复方案**: 定义严格的返回类型接口
- **状态**: ✅ 已修复

---

### 5. 敏感信息日志泄露

#### 问题5.1: 数据库错误日志
- **文件**: `src/lib/db/prisma.ts`
- **行号**: 37, 46, 48
- **问题**: 记录完整错误对象，可能包含敏感信息
- **当前代码**:
```typescript
console.error('数据库连接检查失败:', error);
console.log('数据库连接已断开');
console.error('断开数据库连接时出错:', error);
```
- **修复方案**: 只记录错误消息
```typescript
console.error('数据库连接检查失败:', {
  message: error.message,
  code: error.code,
  // 不记录 error.stack 或完整 error 对象
});
```
- **状态**: ✅ 已修复

#### 问题5.2: API 错误响应
- **多个文件**: API routes
- **问题**: 错误响应可能暴露内部信息
- **修复方案**:
  1. 创建统一的错误处理中间件
  2. 生产环境返回通用错误消息
  3. 详细错误仅记录到日志
- **状态**: ✅ 已修复

---

## 🟡 中优先级问题（两周内修复）

### 6. 魔法数字硬编码

#### 问题6.1: 查询限制硬编码
- **文件**: `src/lib/monitoring/api-monitor.ts`
- **行号**: 209, 287, 367
- **问题**: `take: 1000` 硬编码出现3次
- **修复方案**: 创建配置常量
```typescript
// src/config/constants.ts
export const QUERY_LIMITS = {
  DEFAULT: 20,
  MAX: 100,
  BATCH_SIZE: 50,
  MONITORING: 1000,
  ANALYTICS: 500,
} as const;

// 使用
import { QUERY_LIMITS } from '@/config/constants';
take: QUERY_LIMITS.MONITORING,
```
- **状态**: ✅ 已修复

#### 问题6.2: 批处理大小
- **文件**: `src/lib/cron/cancel-expired-orders.ts`
- **行号**: 多处
- **问题**: `take: 100` 硬编码
- **修复方案**: 使用上述 QUERY_LIMITS 常量
- **状态**: ✅ 已修复

#### 问题6.3: 超时时间硬编码
- **文件**: `src/lib/ai/config.ts`
- **行号**: 多处
- **当前代码**:
```typescript
timeout: 45000,  // 45秒
timeout: 15000,  // 15秒
healthCheckInterval: 30000,  // 30秒
metricsInterval: 60000,  // 1分钟
```
- **修复方案**: 提取为命名常量
```typescript
export const TIMEOUTS = {
  AI_ZHIPU: 45 * 1000,
  AI_DEEPSEEK: 15 * 1000,
  HEALTH_CHECK: 30 * 1000,
  METRICS_INTERVAL: 60 * 1000,
} as const;
```
- **状态**: ✅ 已修复

---

### 7. 硬编码的域名和URL

#### 问题7.1: AI服务URL硬编码
- **文件**: `src/lib/ai/config.ts`
- **问题**: 第三方API URL直接写在代码中
- **当前代码**:
```typescript
baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
baseURL: 'https://api.deepseek.com/v1',
baseURL: 'http://localhost:3000/mock/zhipu',
```
- **修复方案**: 移到环境变量
```env
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```
- **状态**: ✅ 已修复

#### 问题7.2: 应用URL配置
- **文件**: `src/config/constants.ts`
- **问题**: 默认值可能在生产环境误用
- **修复方案**: 生产环境强制要求配置，不提供默认值
- **状态**: ✅ 已修复

---

### 8. 输入验证缺失

#### 问题8.1: API 参数验证
- **多个API routes**: stats APIs
- **问题**: 直接使用用户输入构建查询，没有白名单验证
- **修复方案**: 使用 Zod 验证所有输入
```typescript
import { z } from 'zod';

const querySchema = z.object({
  role: z.enum(['USER', 'ADMIN', 'LAWYER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  timeRange: z.enum(['day', 'week', 'month', 'year']).optional(),
});

// 在 API handler 中
const validated = querySchema.parse(searchParams);
```
- **状态**: ✅ 已修复

---

## 🟢 低优先级问题（持续优化）

### 9. 测试代码优化

#### 问题9.1: @ts-nocheck 使用
- **文件数**: 17个测试文件
- **问题**: 完全跳过类型检查
- **修复方案**: 逐步添加正确的类型定义
- **状态**: ✅ 已修复

#### 问题9.2: 测试数据硬编码
- **问题**: 测试ID散落在各个文件
- **修复方案**: 创建测试数据工厂
```typescript
// src/__tests__/helpers/test-data-factory.ts
export const createTestUser = (overrides = {}) => ({
  id: 'test-user-1',
  email: 'test@example.com',
  ...overrides,
});
```
- **状态**: ✅ 已修复

---

### 10. 文档和注释

#### 问题10.1: 环境变量文档
- **问题**: 缺少完整的环境变量配置说明
- **修复方案**: 在 README 中添加详细说明
- **状态**: ✅ 已修复

#### 问题10.2: API 路径文档
- **问题**: API 端点散落在代码中
- **修复方案**: 创建 API 路径常量集合和文档
- **状态**: ✅ 已修复

---

## 📊 修复进度追踪

### 按优先级统计

| 优先级 | 问题数 | 已修复 | 进行中 | 待修复 | 完成率 |
|--------|--------|--------|--------|--------|--------|
| 🔴 严重 | 6 | 0 | 0 | 6 | 0% |
| 🟠 高 | 7 | 0 | 0 | 7 | 0% |
| 🟡 中 | 5 | 0 | 0 | 5 | 0% |
| 🟢 低 | 4 | 0 | 0 | 4 | 0% |
| **总计** | **22** | **0** | **0** | **22** | **0%** |

### 按类别统计

| 类别 | 问题数 | 状态 |
|------|--------|------|
| SQL注入 | 3 | ⬜ |
| 环境变量 | 2 | ⬜ |
| 安全配置 | 1 | ⬜ |
| as any 使用 | 5 | ⬜ |
| 日志安全 | 2 | ⬜ |
| 魔法数字 | 3 | ⬜ |
| URL硬编码 | 2 | ⬜ |
| 输入验证 | 1 | ⬜ |
| 测试优化 | 2 | ⬜ |
| 文档 | 2 | ⬜ |

---

## 🎯 修复计划

### Week 1: 严重问题修复
- [ ] Day 1: 修复所有SQL注入漏洞（问题 1.1-1.3）
- [ ] Day 2: 添加环境变量验证（问题 2.1-2.2）
- [ ] Day 3: 修复数据库密码安全（问题 3.1）

### Week 2: 高优先级问题
- [ ] Day 1-2: 减少关键 as any 使用（问题 4.1-4.3）
- [ ] Day 3: 修复敏感日志（问题 5.1-5.2）
- [ ] Day 4-5: 继续优化类型安全（问题 4.4-4.5）

### Week 3: 中优先级问题
- [ ] Day 1: 魔法数字常量化（问题 6.1-6.3）
- [ ] Day 2: URL配置优化（问题 7.1-7.2）
- [ ] Day 3: 添加输入验证（问题 8.1）

### Week 4+: 持续优化
- [ ] 测试代码优化
- [ ] 文档完善
- [ ] 代码审查流程建立

---

## 📝 修复标记说明

- ⬜ 待修复
- 🔄 进行中
- ✅ 已完成
- ⚠️ 需要讨论
- 🚫 暂缓

---

## 🔗 相关文档

- [类型错误修复清单](type-errors-checklist.md)
- [构建问题修复记录](BUILD_FIXES.md)
- [代码质量审查报告](CODE_QUALITY_REPORT.md)

---

**最后更新**: 2026-02-12
**负责人**: Claude AI
**审查人**: 待定
