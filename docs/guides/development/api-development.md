# API 开发规范指南

本文档定义了项目 API 开发的统一规范，包括类型定义、路由开发、错误处理和文档要求。

## 目录

- [1. 类型定义规范](#1-类型定义规范)
- [2. API 路由开发标准](#2-api-路由开发标准)
- [3. 错误处理规范](#3-错误处理规范)
- [4. 文档要求](#4-文档要求)

---

## 1. 类型定义规范

### 1.1 类型文件位置

所有模块的类型定义必须统一放在 `src/types/` 目录下：

| 模块     | 类型文件                      |
| -------- | ----------------------------- |
| 证人     | `src/types/witness.ts`        |
| 客户     | `src/types/client.ts`         |
| 证据     | `src/types/evidence.ts`       |
| 案件     | `src/types/case.ts`           |
| 法庭日程 | `src/types/court-schedule.ts` |

### 1.2 类型命名规范

```typescript
// ✅ 正确的命名方式

// 详情类型
export interface WitnessDetail { ... }
export interface ClientDetail { ... }

// 列表响应类型
export interface WitnessListResponse { ... }
export interface ClientListResponse { ... }

// 统计类型
export interface WitnessStatistics { ... }
export interface ClientStatistics { ... }

// 输入类型
export interface CreateWitnessInput { ... }
export interface UpdateWitnessInput { ... }

// 批量操作类型
export interface WitnessBulkActionInput { ... }
export interface WitnessBulkActionResponse { ... }

// 搜索类型
export interface WitnessSearchParams { ... }
export interface WitnessSearchResult { ... }
```

```typescript
// ❌ 错误的命名方式

// 在路由文件中定义类型
type WitnessDetail = { ... };  // 应使用 interface
interface IClientDetail { ... }  // 不要使用前缀
```

### 1.3 类型导出规范

```typescript
// src/types/witness.ts

import {
  Witness as PrismaWitness,
  WitnessStatus as PrismaWitnessStatus,
} from '@prisma/client';

// 重新导出 Prisma 类型
export type { PrismaWitness, PrismaWitnessStatus };

// 导出自定义类型
export interface WitnessDetail extends PrismaWitness {
  case?: { id: string; title: string };
  caseTitle?: string;
  courtScheduleTitle?: string;
}

export interface WitnessListResponse {
  witnesses: WitnessDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 枚举类型
export enum WitnessStatus {
  NEED_CONTACT = 'NEED_CONTACT',
  CONTACTED = 'CONTACTED',
  CONFIRMED = 'CONFIRMED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED',
}

// 工具函数
export const WITNESS_STATUS_LABELS: Record<WitnessStatus, string> = {
  [WitnessStatus.NEED_CONTACT]: '待联系',
  [WitnessStatus.CONTACTED]: '已联系',
  [WitnessStatus.CONFIRMED]: '已确认出庭',
  [WitnessStatus.DECLINED]: '拒绝出庭',
  [WitnessStatus.CANCELLED]: '已取消',
};

// 类型守卫
export function isValidWitnessStatus(value: string): value is WitnessStatus {
  return Object.values(WitnessStatus).includes(value as WitnessStatus);
}
```

### 1.4 禁止在路由文件中定义类型

```typescript
// ❌ 错误：在 route.ts 中定义类型
// src/app/api/witnesses/route.ts

type WitnessDetail = {
  // 禁止！
  id: string;
  name: string;
};

// ✅ 正确：从 types 文件导入
// src/app/api/witnesses/route.ts

import { WitnessDetail } from '@/types/witness';
```

---

## 2. API 路由开发标准

### 2.1 路由文件结构

```
src/app/api/
├── lib/                    # 共享的 API 工具
│   ├── errors/
│   │   └── error-handler.ts
│   └── responses/
│       └── success.ts
├── witnesses/              # 证人模块
│   ├── route.ts           # 列表和创建
│   ├── [id]/              # 单个资源操作
│   │   └── route.ts
│   ├── statistics/         # 统计功能
│   │   └── route.ts
│   ├── bulk-action/       # 批量操作
│   │   └── route.ts
│   └── search/             # 搜索功能
│       └── route.ts
└── cases/
    └── [id]/
        └── witnesses/     # 案件关联的证人
            └── route.ts
```

### 2.2 基本路由模板

```typescript
// src/app/api/witnesses/route.ts

import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createSuccessResponse,
  createCreatedResponse,
} from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { WitnessDetail, WitnessListResponse } from '@/types/witness';

// 验证模式定义
const createWitnessSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(20).optional(),
  // ... 其他字段
});

const queryWitnessSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  // ... 其他查询参数
});

/**
 * GET /api/witnesses - 获取证人列表
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = queryWitnessSchema.parse(Object.fromEntries(searchParams));

  // 实现逻辑...

  const response: WitnessListResponse = {
    witnesses: [],
    total: 0,
    page: query.page,
    limit: query.limit,
    totalPages: 0,
  };

  return createSuccessResponse(response, {
    pagination: {
      page: query.page,
      limit: query.limit,
      total: response.total,
      totalPages: response.totalPages,
    },
  });
});

/**
 * POST /api/witnesses - 创建证人
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // 实现逻辑...
  return createCreatedResponse(witnessDetail);
});

/**
 * OPTIONS /api/witnesses - CORS 预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
```

### 2.3 响应格式规范

```typescript
// 成功响应
return createSuccessResponse(data, {
  pagination: {
    /* 分页信息 */
  },
  meta: {
    /* 元数据 */
  },
});

// 创建响应 (201)
return createCreatedResponse(data);

// 错误响应 (自动处理)
throw new ApiError('错误信息', 400);
```

### 2.4 认证和权限

```typescript
// 认证检查
const authUser = await getAuthUser(request);
if (!authUser) {
  return NextResponse.json(
    { error: '未认证', message: '请先登录' },
    { status: 401 }
  );
}

// 资源权限检查
const resource = await prisma.resource.findFirst({
  where: {
    id: resourceId,
    userId: authUser.userId,
  },
});

if (!resource) {
  return NextResponse.json(
    { error: '资源不存在或无权限', message: '您没有权限访问此资源' },
    { status: 404 }
  );
}
```

### 2.5 验证模式使用

```typescript
// 使用 Zod 进行请求体验证
const schema = z.object({
  name: z.string().min(1, '名称不能为空').max(200),
  email: z.string().email('邮箱格式不正确').optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const validatedData = schema.parse(body); // 会自动抛出验证错误

  // 使用验证后的数据...
});
```

---

## 3. 错误处理规范

### 3.1 统一错误处理

```typescript
// src/app/api/lib/errors/error-handler.ts

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export function withErrorHandler(
  handler: (request: NextRequest, ...args: unknown[]) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: unknown[]) => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      // Zod 验证错误
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: '参数验证失败',
            message: error.errors
              .map(e => `${e.path}: ${e.message}`)
              .join(', '),
          },
          { status: 400 }
        );
      }

      // Prisma 错误
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          return NextResponse.json(
            { error: '唯一约束冲突', message: '该资源已存在' },
            { status: 409 }
          );
        }
        if (error.code === 'P2025') {
          return NextResponse.json(
            { error: '资源不存在', message: '找不到指定的资源' },
            { status: 404 }
          );
        }
      }

      // 自定义错误
      if (error instanceof Error && error.name === 'ApiError') {
        return NextResponse.json(
          { error: '请求失败', message: error.message },
          { status: (error as { statusCode?: number }).statusCode || 400 }
        );
      }

      // 未知错误
      console.error('API Error:', error);
      return NextResponse.json(
        { error: '内部服务器错误', message: '发生了未知错误' },
        { status: 500 }
      );
    }
  };
}
```

### 3.2 错误响应格式

```typescript
// 400 - 请求参数错误
{
  "error": "参数验证失败",
  "message": "name: 名称不能为空"
}

// 401 - 未认证
{
  "error": "未认证",
  "message": "请先登录"
}

// 403 - 无权限
{
  "error": "权限不足",
  "message": "您没有权限执行此操作"
}

// 404 - 资源不存在
{
  "error": "资源不存在",
  "message": "找不到指定的证人"
}

// 409 - 冲突
{
  "error": "唯一约束冲突",
  "message": "该证人已存在"
// 500 - 服务器错误
{
  "error": "内部服务器错误",
  "message": "发生了未知错误"
}
```

### 3.3 日志记录

```typescript
// 在错误处理中记录日志
import { logger } from '@/lib/monitoring/logger';

// ...

catch (error) {
  logger.error('API Error', {
    method: request.method,
    url: request.url,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  return NextResponse.json(
    { error: '内部服务器错误', message: '发生了未知错误' },
    { status: 500 }
  );
}
```

---

## 4. 文档要求

### 4.1 API 注释规范

```typescript
/**
 * GET /api/witnesses - 获取证人列表
 *
 * @description 获取当前用户的所有证人，支持分页和筛选
 * @authentication 需要认证
 * @param {string} caseId - 可选，案件ID筛选
 * @param {string} status - 可选，状态筛选
 * @param {number} page - 页码，默认1
 * @param {number} limit - 每页数量，默认20
 * @returns {WitnessListResponse} 证人列表响应
 * @throws {401} 未认证
 * @throws {404} 案件不存在
 *
 * @example
 * // 请求
 * GET /api/witnesses?caseId=xxx&status=CONFIRMED&page=1&limit=20
 *
 * // 响应
 * {
 *   "data": {
 *     "witnesses": [...],
 *     "total": 100,
 *     "page": 1,
 *     "limit": 20,
 *     "totalPages": 5
 *   },
 *   "pagination": {...}
 * }
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  // 实现...
});
```

### 4.2 API 路由清单

在模块目录下创建 `README.md`：

```markdown
# Witness API 路由清单

## 基础路由

| 方法 | 路径             | 描述         | 状态      |
| ---- | ---------------- | ------------ | --------- |
| GET  | `/api/witnesses` | 获取证人列表 | ✅ 已实现 |
| POST | `/api/witnesses` | 创建证人     | ✅ 已实现 |

## 单个资源

| 方法   | 路径                  | 描述         | 状态      |
| ------ | --------------------- | ------------ | --------- |
| GET    | `/api/witnesses/[id]` | 获取证人详情 | ✅ 已实现 |
| PUT    | `/api/witnesses/[id]` | 更新证人     | ✅ 已实现 |
| DELETE | `/api/witnesses/[id]` | 删除证人     | ✅ 已实现 |

## 增强功能

| 方法 | 路径                         | 描述         | 状态      |
| ---- | ---------------------------- | ------------ | --------- |
| GET  | `/api/witnesses/statistics`  | 获取统计信息 | ✅ 已实现 |
| POST | `/api/witnesses/bulk-action` | 批量操作     | ✅ 已实现 |
| GET  | `/api/witnesses/search`      | 搜索证人     | ✅ 已实现 |

## 关联资源

| 方法 | 路径                        | 描述         | 状态      |
| ---- | --------------------------- | ------------ | --------- |
| GET  | `/api/cases/[id]/witnesses` | 获取案件证人 | ✅ 已实现 |
```

---

## 5. 最佳实践

### 5.1 代码组织

1. **验证模式** - 在路由文件顶部定义 Zod 验证模式
2. **类型导入** - 只从 `src/types/` 导入类型
3. **工具函数** - 将共享的映射函数放在路由文件顶部
4. **错误处理** - 使用 `withErrorHandler` 包装所有路由

### 5.2 性能优化

```typescript
// 使用 Promise.all 并行查询
const [resource1, resource2, resource3] = await Promise.all([
  prisma.resource1.findMany({...}),
  prisma.resource2.findMany({...}),
  prisma.resource3.count({...}),
]);

// 使用 include 减少查询次数
const witness = await prisma.witness.findUnique({
  where: { id },
  include: {
    case: { select: { id: true, title: true } },
    courtSchedule: { select: { id: true, title: true } },
  },
});
```

### 5.3 安全考虑

1. **认证** - 所有 API 必须检查认证状态
2. **权限** - 验证用户对资源的访问权限
3. **输入验证** - 使用 Zod 验证所有输入
4. **SQL 注入** - 使用 Prisma 参数化查询
5. **敏感数据** - 不要在响应中返回敏感字段

```typescript
// 过滤敏感数据
const { password, ...safeUser } = user;
return createSuccessResponse(safeUser);
```

---

## 6. 检查清单

新 API 开发时，请检查以下项目：

- [ ] 类型定义在 `src/types/` 目录中
- [ ] 路由文件使用 `withErrorHandler` 包装
- [ ] 使用 Zod 进行输入验证
- [ ] 实现了认证检查
- [ ] 实现了权限检查
- [ ] 响应格式符合规范
- [ ] 提供了 API 注释
- [ ] 单元测试覆盖核心功能
- [ ] API 文档已更新

---

## 7. 相关资源

- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Zod 文档](https://zod.dev/)
- [Prisma 文档](https://www.prisma.io/docs)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)
