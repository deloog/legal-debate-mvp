# 改进实施技术指南

> **文档版本**: v1.0  
> **关联文档**: IMPROVEMENT_ROADMAP.md  
> **目标读者**: 开发工程师、架构师

---

## 📋 目录

1. [Agent集成技术规范](#agent集成技术规范)
2. [前端组件开发规范](#前端组件开发规范)
3. [API开发规范](#api开发规范)
4. [数据库变更规范](#数据库变更规范)
5. [测试规范](#测试规范)
6. [代码审查清单](#代码审查清单)

---

## Agent集成技术规范

### VerificationAgent集成

#### 组件架构

```
VerificationResultDisplay
├── VerificationBadge (显示验证状态)
├── VerificationScore (显示分数)
└── VerificationDetail (详情弹窗)
    ├── FactualAccuracySection
    ├── LogicalConsistencySection
    └── CompletenessSection
```

#### 状态定义

```typescript
// src/types/verification.ts
export interface VerificationDisplayState {
  // 整体状态
  overallStatus: 'passed' | 'failed' | 'warning' | 'pending';
  overallScore: number;

  // 三重验证详情
  factual: {
    score: number;
    status: VerificationStatus;
    checks: FactualCheck[];
  };
  logical: {
    score: number;
    status: VerificationStatus;
    issues: LogicalIssue[];
  };
  completeness: {
    score: number;
    status: VerificationStatus;
    missingFields: string[];
  };

  // 元数据
  verifiedAt: Date;
  verifiedBy: string;
}

type VerificationStatus = 'excellent' | 'good' | 'fair' | 'poor';
```

#### 集成点

```typescript
// 在辩论结果页集成
// src/app/debates/[id]/components/ArgumentWithVerification.tsx

interface Props {
  argument: Argument;
  showVerification?: boolean;
}

export function ArgumentWithVerification({
  argument,
  showVerification = true
}: Props) {
  const { data: verification } = useVerification(argument.id);

  return (
    <ArgumentCard argument={argument}>
      {showVerification && verification && (
        <VerificationBadge
          score={verification.overallScore}
          status={verification.overallStatus}
          onClick={() => openDetailModal(verification)}
        />
      )}
    </ArgumentCard>
  );
}
```

---

### MemoryAgent集成

#### 记忆管理数据结构

```typescript
// src/types/memory.ts
export interface MemoryDisplayItem {
  id: string;
  type: 'WORKING' | 'HOT' | 'COLD';
  agentName: string;
  key: string;
  size: number; // 字节
  compressed: boolean;
  compressionRatio?: number;
  importance: number; // 0-1
  accessCount: number;
  lastAccessedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;

  // 预览内容（截断）
  preview: string;
}

export interface MemoryStats {
  totalCount: number;
  totalSize: number;
  byType: {
    WORKING: { count: number; size: number };
    HOT: { count: number; size: number };
    COLD: { count: number; size: number };
  };
  migrationStats: {
    workingToHotTotal: number;
    hotToColdTotal: number;
    lastMigrationAt?: Date;
  };
}
```

#### 管理界面组件

```typescript
// src/app/admin/memories/components/MemoryTable.tsx

interface MemoryTableProps {
  memories: MemoryDisplayItem[];
  onDelete: (ids: string[]) => void;
  onCompress: (ids: string[]) => void;
  loading?: boolean;
}

// 表格列定义
const columns: Column<MemoryDisplayItem>[] = [
  { key: 'type', title: '类型', render: renderTypeBadge },
  { key: 'agentName', title: 'Agent' },
  { key: 'key', title: '键', ellipsis: true },
  { key: 'size', title: '大小', render: formatBytes },
  { key: 'compressionRatio', title: '压缩率', render: renderCompression },
  { key: 'importance', title: '重要性', render: renderImportanceBar },
  { key: 'accessCount', title: '访问次数' },
  { key: 'expiresAt', title: '过期时间', render: renderExpireTime },
  { key: 'actions', title: '操作', render: renderActions },
];
```

---

## 前端组件开发规范

### 组件文件结构

```
src/components/{feature}/{ComponentName}/
├── index.tsx                     # 主组件（默认导出）
├── types.ts                      # 组件类型定义
├── hooks.ts                      # 组件专用hooks
├── utils.ts                      # 工具函数
├── __tests__/
│   ├── index.test.tsx            # 主组件测试
│   └── utils.test.ts             # 工具函数测试
└── styles.ts                     # 样式（如需要）
```

### 组件模板

````typescript
// index.tsx
'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { ComponentProps } from './types';

/**
 * 组件描述
 *
 * @example
 * ```tsx
 * <ComponentName
 *   prop1="value"
 *   prop2={123}
 * />
 * ```
 */
export function ComponentName({
  prop1,
  prop2 = 'default',
  className,
  onAction,
  ...props
}: ComponentProps) {
  const [internalState, setInternalState] = useState(false);

  const handleAction = useCallback(() => {
    setInternalState(true);
    onAction?.();
  }, [onAction]);

  return (
    <div
      className={cn(
        'base-classes',
        className
      )}
      {...props}
    >
      {/* 组件内容 */}
    </div>
  );
}

// 导出类型
export type { ComponentProps } from './types';
````

### 类型定义模板

```typescript
// types.ts
import type { ReactNode, ComponentPropsWithoutRef } from 'react';

/**
 * 组件属性
 */
export interface ComponentProps extends ComponentPropsWithoutRef<'div'> {
  /** 属性1描述 */
  prop1: string;

  /** 属性2描述 */
  prop2?: number;

  /** 回调函数描述 */
  onAction?: () => void;

  /** 自定义子元素 */
  children?: ReactNode;
}

/**
 * 组件状态
 */
export interface ComponentState {
  isLoading: boolean;
  error: Error | null;
  data: DataType | null;
}

/**
 * 数据类型
 */
export interface DataType {
  id: string;
  name: string;
  // ...
}
```

---

## API开发规范

### 路由文件结构

```typescript
// src/app/api/v1/feature/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { authenticateRequest } from '@/lib/middleware/auth';
import { validateRequest } from '@/lib/middleware/validation';

// =============================================================================
// 请求验证模式
// =============================================================================

const RequestSchema = z.object({
  // 定义请求体结构
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

type RequestBody = z.infer<typeof RequestSchema>;

// =============================================================================
// GET 处理器
// =============================================================================

/**
 * 获取列表
 *
 * @route GET /api/v1/feature
 * @query page - 页码 (默认: 1)
 * @query pageSize - 每页数量 (默认: 20, 最大: 100)
 * @returns Feature列表
 */
export async function GET(request: NextRequest) {
  try {
    // 认证
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = Math.min(
      parseInt(searchParams.get('pageSize') ?? '20', 10),
      100
    );

    // 数据库查询
    const [items, total] = await Promise.all([
      prisma.feature.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.feature.count(),
    ]);

    return NextResponse.json({
      success: true,
      data: items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    logger.error('获取Feature列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取列表失败' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST 处理器
// =============================================================================

/**
 * 创建新Feature
 *
 * @route POST /api/v1/feature
 * @body RequestSchema
 * @returns 创建的Feature
 */
export async function POST(request: NextRequest) {
  try {
    // 认证
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    // 验证请求体
    const body = await request.json();
    const validation = RequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: '请求参数无效',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    // 创建记录
    const item = await prisma.feature.create({
      data: {
        ...validation.data,
        userId: authResult.userId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: item,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('创建Feature失败:', error);
    return NextResponse.json(
      { success: false, error: '创建失败' },
      { status: 500 }
    );
  }
}
```

### API响应标准格式

```typescript
// 成功响应
interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

// 分页响应
interface PaginatedResponse<T> extends SuccessResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// 错误响应
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}
```

---

## 数据库变更规范

### 迁移文件命名

```
YYYYMMDDHHMMSS_descriptive_name/migration.sql

示例:
20260331120000_add_client_follow_up/migration.sql
20260331123000_add_memory_indexes/migration.sql
```

### 迁移文件结构

```sql
-- 20260331120000_add_client_follow_up/migration.sql

-- ============================================================
-- 新增客户跟进表
-- ============================================================

CREATE TABLE "client_follow_ups" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "client_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assigned_to" TEXT NOT NULL,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX "idx_follow_up_client" ON "client_follow_ups"("client_id");
CREATE INDEX "idx_follow_up_status_due" ON "client_follow_ups"("status", "due_date");
CREATE INDEX "idx_follow_up_assigned" ON "client_follow_ups"("assigned_to");

-- ============================================================
-- 回滚脚本（注释形式保留）
-- ============================================================

-- DROP TABLE IF EXISTS "client_follow_ups";
-- DROP INDEX IF EXISTS "idx_follow_up_client";
-- DROP INDEX IF EXISTS "idx_follow_up_status_due";
-- DROP INDEX IF EXISTS "idx_follow_up_assigned";
```

### Prisma Schema更新

```prisma
// 新增模型
model ClientFollowUp {
  id          String         @id @default(cuid())
  clientId    String         @map("client_id")
  title       String
  description String?
  dueDate     DateTime       @map("due_date")
  status      FollowUpStatus @default(PENDING) @map("status")
  priority    Priority       @default(MEDIUM) @map("priority")
  assignedTo  String         @map("assigned_to")
  completedAt DateTime?      @map("completed_at")
  createdAt   DateTime       @default(now()) @map("created_at")

  client      Client         @relation(fields: [clientId], references: [id], onDelete: Cascade)
  assignee    User           @relation(fields: [assignedTo], references: [id])

  @@index([clientId])
  @@index([status, dueDate])
  @@index([assignedTo])
  @@map("client_follow_ups")
}

// 扩展已有模型
model Client {
  // ... 已有字段

  // 新增关联
  followUps ClientFollowUp[]
}

// 新增枚举
enum FollowUpStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
```

---

## 测试规范

### 单元测试模板

```typescript
// __tests__/components/ComponentName.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentName } from '@/components/feature/ComponentName';

// Mock依赖
jest.mock('@/lib/hooks/useData', () => ({
  useData: jest.fn(),
}));

describe('ComponentName', () => {
  // 基础渲染测试
  it('renders correctly', () => {
    render(<ComponentName prop1="test" />);
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  // 交互测试
  it('handles click correctly', () => {
    const onAction = jest.fn();
    render(<ComponentName prop1="test" onAction={onAction} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onAction).toHaveBeenCalled();
  });

  // 边界条件测试
  it('handles empty state', () => {
    render(<ComponentName prop1="" />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  // 错误状态测试
  it('handles error state', () => {
    render(<ComponentName prop1="test" error={new Error('Failed')} />);
    expect(screen.getByText('加载失败')).toBeInTheDocument();
  });
});
```

### API测试模板

```typescript
// __tests__/api/feature.test.ts

import { GET, POST } from '@/app/api/v1/feature/route';
import { createMockRequest } from '@/test-utils/api-mocks';

describe('Feature API', () => {
  describe('GET /api/v1/feature', () => {
    it('returns paginated list', async () => {
      const request = createMockRequest({
        url: '/api/v1/feature?page=1&pageSize=20',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeInstanceOf(Array);
      expect(data.pagination).toBeDefined();
    });

    it('requires authentication', async () => {
      const request = createMockRequest({
        url: '/api/v1/feature',
        auth: null, // 无认证
      });

      const response = await GET(request);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/feature', () => {
    it('creates new feature', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: { name: 'Test', description: 'Description' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Test');
    });

    it('validates required fields', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: { description: 'Missing name' },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });
});
```

### E2E测试模板

```typescript
// __tests__/e2e/feature/workflow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Feature Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('complete feature workflow', async ({ page }) => {
    // 1. 访问功能页面
    await page.goto('/feature');
    await expect(page.locator('h1')).toContainText('功能管理');

    // 2. 创建新项目
    await page.click('button:has-text("新建")');
    await page.fill('[name="name"]', 'Test Feature');
    await page.fill('[name="description"]', 'Test Description');
    await page.click('button:has-text("保存")');

    // 3. 验证创建成功
    await expect(page.locator('.toast')).toContainText('创建成功');
    await expect(page.locator('text=Test Feature')).toBeVisible();

    // 4. 编辑项目
    await page.click('[data-testid="edit-button"]');
    await page.fill('[name="name"]', 'Updated Feature');
    await page.click('button:has-text("保存")');

    // 5. 验证更新
    await expect(page.locator('text=Updated Feature')).toBeVisible();

    // 6. 删除项目
    await page.click('[data-testid="delete-button"]');
    await page.click('button:has-text("确认")');

    // 7. 验证删除
    await expect(page.locator('text=Updated Feature')).not.toBeVisible();
  });
});
```

---

## 代码审查清单

### 前端代码审查

#### 组件代码

- [ ] 组件文件不超过200行（复杂组件拆分）
- [ ] Props类型完整定义
- [ ] 使用React.memo优化性能（如需要）
- [ ] 事件处理使用useCallback
- [ ] 副作用使用useEffect并正确设置依赖
- [ ] 加载状态处理完善
- [ ] 错误状态处理完善
- [ ] 无障碍属性完整

#### 样式代码

- [ ] 使用Tailwind CSS类名
- [ ] 支持暗黑模式
- [ ] 响应式设计
- [ ] 无硬编码颜色值

### 后端代码审查

#### API代码

- [ ] 认证检查完整
- [ ] 输入验证使用Zod
- [ ] 错误处理完善
- [ ] 日志记录完整
- [ ] 数据库查询有索引
- [ ] 敏感信息不返回
- [ ] 响应格式符合标准

#### 服务代码

- [ ] 单一职责原则
- [ ] 依赖注入使用
- [ ] 错误边界处理
- [ ] 单元测试覆盖

### 通用代码审查

- [ ] 无console.log（使用logger）
- [ ] 无any类型
- [ ] 命名清晰语义化
- [ ] 注释完整（复杂逻辑）
- [ ] 代码复用（无重复）
- [ ] 测试覆盖率>80%

---

## 附录

### A. 常用命令

```bash
# 运行测试
npm test
npm run test:watch
npm run test:coverage

# E2E测试
npm run test:e2e
npm run test:e2e:ui

# 代码检查
npm run lint
npm run lint:fix
npm run type-check

# 数据库
npx prisma migrate dev
npx prisma generate
npx prisma studio
```

### B. 参考文档

- [Next.js App Router](https://nextjs.org/docs/app)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Prisma](https://www.prisma.io/docs)
- [Testing Library](https://testing-library.com/docs/)

---

**文档维护**: 开发团队  
**最后更新**: 2026-03-31
