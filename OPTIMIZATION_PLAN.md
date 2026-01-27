# 法律助手系统 - 优化计划文档

> **版本**: v1.0
> **创建日期**: 2026-01-27
> **预计完成**: 分3个阶段，每个阶段约2-3天
> **优化目标**: 提升系统安全性、用户体验和性能

---

## 📋 目录

1. [当前系统状态评估](#当前系统状态评估)
2. [优化优先级矩阵](#优化优先级矩阵)
3. [第一阶段：安全性增强](#第一阶段安全性增强)
4. [第二阶段：用户体验优化](#第二阶段用户体验优化)
5. [第三阶段：功能增强](#第三阶段功能增强)
6. [实施检查清单](#实施检查清单)

---

## 当前系统状态评估

### ✅ 已具备的优势
- [x] 完整的数据库架构（Prisma + PostgreSQL）
- [x] JWT认证系统基础实现
- [x] AI服务集成（智谱AI、DeepSeek）
- [x] 现代化的UI设计（Tailwind CSS）
- [x] 代码分割和懒加载（Layout Suspense）
- [x] 完善的JWT工具函数（access/refresh token）

### ⚠️ 存在的问题
- [ ] **安全性**: Token存储在localStorage，易受XSS攻击
- [ ] **权限控制**: 无路由级别的权限保护
- [ ] **错误处理**: 缺少全局错误边界
- [ ] **AI成本**: 无使用配额控制机制
- [ ] **用户体验**: 未登录时访问受保护页面体验差
- [ ] **数据查询**: 可能存在N+1查询问题

---

## 优化优先级矩阵

| 优先级 | 分类 | 任务 | 影响范围 | 实施难度 | 预计时间 |
|-------|------|------|---------|---------|---------|
| 🔴 P0 | 安全性 | Cookie存储Token | 全局 | 低 | 1h |
| 🔴 P0 | 安全性 | 路由权限保护 | 全局 | 中 | 2h |
| 🟡 P1 | 体验 | 全局错误边界 | 全局 | 低 | 1h |
| 🟡 P1 | 体验 | 认证上下文管理 | 全局 | 中 | 2h |
| 🟡 P1 | 功能 | AI配额控制 | AI模块 | 中 | 3h |
| 🟢 P2 | 性能 | 数据库查询优化 | 数据层 | 高 | 4h |
| 🟢 P2 | 功能 | AI流式响应 | AI模块 | 高 | 4h |
| 🟢 P2 | 功能 | 操作审计日志 | 全局 | 中 | 3h |

---

## 第一阶段：安全性增强

**目标**: 保护用户数据和系统安全
**预计时间**: 4-6小时
**必须完成**: 是

### 1.1 Cookie存储Token（P0）

**问题**: 当前Token存储在localStorage，容易受到XSS攻击

**解决方案**:
```typescript
// 文件: src/app/api/auth/login/route.ts
// 修改: 将refreshToken存储到httpOnly cookie

const response = NextResponse.json(authResponse);

// 设置httpOnly cookie
response.cookies.set('refreshToken', refreshToken, {
  httpOnly: true,      // JS无法访问
  secure: process.env.NODE_ENV === 'production', // 生产环境仅HTTPS
  sameSite: 'lax',     // CSRF保护
  maxAge: 7 * 24 * 60 * 60, // 7天
  path: '/',
});

// accessToken仍在响应体中（用于API调用）
```

**涉及文件**:
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/refresh/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/login/page.tsx`

**验证方法**:
```bash
# 登录后检查浏览器Cookie
# 应该看到httpOnly的refreshToken cookie
```

---

### 1.2 路由权限保护（P0）

**问题**: 未登录用户可以访问所有页面，没有权限控制

**解决方案**: 创建Next.js middleware进行路由保护

```typescript
// 文件: src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路径（无需登录）
  const publicPaths = ['/', '/login', '/api/auth/login', '/api/auth/register'];
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith('/api/health'));

  if (isPublicPath) {
    return NextResponse.next();
  }

  // 从Authorization header或cookie获取token
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || request.cookies.get('accessToken')?.value;

  if (!token) {
    // 未登录，重定向到登录页
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 验证token
  const { valid, payload } = verifyToken(token);

  if (!valid) {
    // Token无效，重定向到登录页
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 管理员路径权限检查
  if (pathname.startsWith('/admin') && payload?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 在请求头中添加用户信息（供API使用）
  const response = NextResponse.next();
  response.headers.set('x-user-id', payload?.userId || '');
  response.headers.set('x-user-role', payload?.role || '');

  return response;
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (网站图标)
     * - public文件夹
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
};
```

**涉及文件**:
- `src/middleware.ts` (新建)
- `src/app/login/page.tsx` (添加redirect参数处理)

---

### 1.3 CSRF保护增强

**问题**: API端点缺少CSRF保护

**解决方案**: 添加CSRF token验证

```typescript
// 文件: src/lib/security/csrf.ts (新建)
import { randomBytes } from 'crypto';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf-token';

export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

export function validateCsrfToken(token: string, cookieToken: string): boolean {
  if (!token || !cookieToken) return false;
  return token === cookieToken;
}
```

---

### 1.4 安全响应头

**问题**: 缺少安全相关的HTTP响应头

**解决方案**: 在middleware中添加安全头

```typescript
// 在 src/middleware.ts 中添加
response.headers.set('X-Content-Type-Options', 'nosniff');
response.headers.set('X-Frame-Options', 'DENY');
response.headers.set('X-XSS-Protection', '1; mode=block');
response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
response.headers.set(
  'Content-Security-Policy',
  "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
);
```

---

## 第二阶段：用户体验优化

**目标**: 提升用户交互体验和错误处理
**预计时间**: 6-8小时
**必须完成**: 建议完成

### 2.1 全局错误边界（P1）

**问题**: 页面崩溃时用户看到白屏

**解决方案**: 创建全局和页面级错误边界

```typescript
// 文件: src/app/error.tsx (新建)
'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 记录错误到监控系统
    console.error('全局错误:', error);
  }, [error]);

  return (
    <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50'>
      <div className='max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xl'>
        <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100'>
          <svg
            className='h-8 w-8 text-red-600'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
            />
          </svg>
        </div>

        <h2 className='mb-2 text-2xl font-bold text-slate-900'>出错了</h2>
        <p className='mb-6 text-sm text-slate-600'>
          {error.message || '页面加载失败，请重试'}
        </p>

        <div className='flex gap-3'>
          <button
            onClick={reset}
            className='flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl'
          >
            重试
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className='flex-1 rounded-xl border-2 border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition-all hover:bg-slate-50'
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
```

**涉及文件**:
- `src/app/error.tsx` (新建)
- `src/app/cases/error.tsx` (新建)
- `src/app/clients/error.tsx` (新建)
- `src/app/debates/error.tsx` (新建)

---

### 2.2 认证上下文管理（P1）

**问题**: 多个组件重复处理认证逻辑

**解决方案**: 创建AuthContext统一管理认证状态

```typescript
// 文件: src/contexts/AuthContext.tsx (新建)
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // 初始化时检查认证状态
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.data.user);
      }
    } catch (error) {
      console.error('检查认证状态失败:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || '登录失败');
    }

    // 保存accessToken到内存（或sessionStorage）
    if (data.data?.token) {
      sessionStorage.setItem('accessToken', data.data.token);
    }

    setUser(data.data.user);
    router.push('/');
    router.refresh();
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('登出失败:', error);
    } finally {
      setUser(null);
      sessionStorage.removeItem('accessToken');
      router.push('/login');
    }
  }

  async function refreshAuth() {
    await checkAuth();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**使用方法**:
```typescript
// 在 src/app/layout.tsx 中包裹
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          <Suspense fallback={<LoadingFallback />}>
            {children}
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}

// 在组件中使用
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <div>请先登录</div>;
  }

  return <div>欢迎, {user.name}</div>;
}
```

---

### 2.3 加载骨架屏

**问题**: 数据加载时页面空白

**解决方案**: 为关键页面添加Skeleton加载状态

```typescript
// 文件: src/components/ui/Skeleton.tsx (新建)
export function TableSkeleton() {
  return (
    <div className='space-y-4'>
      {[...Array(5)].map((_, i) => (
        <div key={i} className='flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4'>
          <div className='h-12 w-12 animate-pulse rounded-full bg-slate-200' />
          <div className='flex-1 space-y-2'>
            <div className='h-4 w-1/3 animate-pulse rounded bg-slate-200' />
            <div className='h-3 w-1/2 animate-pulse rounded bg-slate-200' />
          </div>
        </div>
      ))}
    </div>
  );
}
```

**涉及文件**:
- `src/components/ui/Skeleton.tsx` (新建)
- `src/app/cases/loading.tsx` (新建)
- `src/app/clients/loading.tsx` (新建)

---

### 2.4 Toast通知系统

**问题**: 操作反馈不明显

**解决方案**: 集成toast通知库（项目已有sonner）

```typescript
// 文件: src/components/providers/ToastProvider.tsx (新建)
'use client';

import { Toaster } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster
      position='top-right'
      toastOptions={{
        style: {
          background: 'white',
          color: '#0f172a',
          border: '1px solid #e2e8f0',
        },
        className: 'shadow-lg',
      }}
    />
  );
}

// 在 layout.tsx 中添加
import { ToastProvider } from '@/components/providers/ToastProvider';

// 使用示例
import { toast } from 'sonner';

function handleSave() {
  try {
    // ... 保存逻辑
    toast.success('保存成功！');
  } catch (error) {
    toast.error('保存失败，请重试');
  }
}
```

---

## 第三阶段：功能增强

**目标**: 增强AI功能和系统能力
**预计时间**: 8-10小时
**必须完成**: 可选

### 3.1 AI配额控制（P1）

**问题**: AI调用无限制，可能导致成本失控

**解决方案**: 实现配额管理系统

```typescript
// 文件: src/lib/ai/quota.ts (新建)
import { prisma } from '@/lib/db/prisma';

export interface QuotaConfig {
  dailyLimit: number;
  monthlyLimit: number;
  perRequestLimit: number;
}

// 不同角色的配额配置
const QUOTA_CONFIGS: Record<string, QuotaConfig> = {
  FREE: {
    dailyLimit: 10,
    monthlyLimit: 100,
    perRequestLimit: 1000, // tokens
  },
  BASIC: {
    dailyLimit: 50,
    monthlyLimit: 1000,
    perRequestLimit: 2000,
  },
  PRO: {
    dailyLimit: 200,
    monthlyLimit: 5000,
    perRequestLimit: 4000,
  },
  ADMIN: {
    dailyLimit: -1, // 无限制
    monthlyLimit: -1,
    perRequestLimit: -1,
  },
};

export async function checkAIQuota(
  userId: string,
  tokensToUse: number = 0
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  // 获取用户角色
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    return { allowed: false, reason: '用户不存在' };
  }

  const config = QUOTA_CONFIGS[user.role] || QUOTA_CONFIGS.FREE;

  // 管理员无限制
  if (config.dailyLimit === -1) {
    return { allowed: true };
  }

  // 检查单次请求token数量
  if (tokensToUse > config.perRequestLimit) {
    return {
      allowed: false,
      reason: `单次请求超过限制（${config.perRequestLimit} tokens）`,
    };
  }

  // 获取今日使用量
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayUsage = await prisma.aIInteraction.aggregate({
    where: {
      userId,
      createdAt: { gte: today },
      success: true,
    },
    _sum: {
      tokensUsed: true,
    },
    _count: true,
  });

  const dailyUsed = todayUsage._count || 0;
  const dailyRemaining = config.dailyLimit - dailyUsed;

  if (dailyUsed >= config.dailyLimit) {
    return {
      allowed: false,
      reason: `今日配额已用完（${config.dailyLimit}次）`,
      remaining: 0,
    };
  }

  // 检查本月使用量
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const monthUsage = await prisma.aIInteraction.count({
    where: {
      userId,
      createdAt: { gte: monthStart },
      success: true,
    },
  });

  if (monthUsage >= config.monthlyLimit) {
    return {
      allowed: false,
      reason: `本月配额已用完（${config.monthlyLimit}次）`,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: dailyRemaining,
  };
}

// 记录AI使用
export async function recordAIUsage(data: {
  userId: string;
  type: string;
  provider: string;
  model?: string;
  tokensUsed: number;
  duration: number;
  success: boolean;
  error?: string;
}) {
  await prisma.aIInteraction.create({
    data: {
      type: data.type,
      provider: data.provider,
      model: data.model,
      request: {},
      response: {},
      tokensUsed: data.tokensUsed,
      duration: data.duration,
      success: data.success,
      error: data.error,
    },
  });
}
```

**使用方法**:
```typescript
// 在AI API端点中使用
import { checkAIQuota, recordAIUsage } from '@/lib/ai/quota';

export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');

  // 检查配额
  const quotaCheck = await checkAIQuota(userId);
  if (!quotaCheck.allowed) {
    return NextResponse.json(
      { success: false, message: quotaCheck.reason },
      { status: 429 }
    );
  }

  const startTime = Date.now();

  try {
    // 调用AI服务
    const result = await callAIService();

    // 记录使用
    await recordAIUsage({
      userId,
      type: 'debate_generation',
      provider: 'zhipu',
      tokensUsed: result.tokens,
      duration: Date.now() - startTime,
      success: true,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    await recordAIUsage({
      userId,
      type: 'debate_generation',
      provider: 'zhipu',
      tokensUsed: 0,
      duration: Date.now() - startTime,
      success: false,
      error: error.message,
    });

    throw error;
  }
}
```

---

### 3.2 AI流式响应（P2）

**问题**: AI生成内容时用户需要等待完整响应

**解决方案**: 实现Server-Sent Events (SSE)流式响应

```typescript
// 文件: src/app/api/v1/debates/[id]/stream/route.ts
import { NextRequest } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const debateId = params.id;

  // 创建流式响应
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 调用AI服务（假设支持流式）
        const response = await fetch('https://api.zhipuai.cn/v4/stream', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'glm-4',
            messages: [/* ... */],
            stream: true,
          }),
        });

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader');

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            controller.enqueue(
              new TextEncoder().encode('data: [DONE]\n\n')
            );
            controller.close();
            break;
          }

          // 转发数据块到客户端
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**前端使用**:
```typescript
// 在客户端组件中
const [streamedContent, setStreamedContent] = useState('');

async function startDebate() {
  const response = await fetch(`/api/v1/debates/${debateId}/stream`, {
    method: 'POST',
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') break;

        try {
          const json = JSON.parse(data);
          setStreamedContent(prev => prev + json.content);
        } catch (e) {
          console.error('Parse error:', e);
        }
      }
    }
  }
}
```

---

### 3.3 操作审计日志（P2）

**问题**: 无法追踪重要操作历史

**解决方案**: 实现审计日志系统

```typescript
// 文件: src/lib/audit/logger.ts (新建)
import { prisma } from '@/lib/db/prisma';

export interface AuditLogData {
  userId: string;
  action: string; // 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW'
  resource: string; // 'CASE' | 'CLIENT' | 'DOCUMENT' | etc.
  resourceId: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(data: AuditLogData) {
  try {
    // 注意：需要在Prisma schema中添加AuditLog模型
    await prisma.$executeRaw`
      INSERT INTO audit_logs (
        user_id, action, resource, resource_id,
        changes, metadata, ip_address, user_agent, created_at
      ) VALUES (
        ${data.userId}, ${data.action}, ${data.resource}, ${data.resourceId},
        ${JSON.stringify(data.changes || {})}, ${JSON.stringify(data.metadata || {})},
        ${data.ipAddress || ''}, ${data.userAgent || ''}, NOW()
      )
    `;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // 不阻断主流程
  }
}

// 使用示例
export async function updateCase(caseId: string, userId: string, updates: any) {
  const oldCase = await prisma.case.findUnique({ where: { id: caseId } });

  const updatedCase = await prisma.case.update({
    where: { id: caseId },
    data: updates,
  });

  // 记录审计日志
  await createAuditLog({
    userId,
    action: 'UPDATE',
    resource: 'CASE',
    resourceId: caseId,
    changes: {
      before: oldCase,
      after: updatedCase,
    },
  });

  return updatedCase;
}
```

---

### 3.4 数据库查询优化（P2）

**问题**: 可能存在N+1查询和缺少索引

**解决方案**: 优化查询和添加索引

```typescript
// 优化前（N+1问题）
const cases = await prisma.case.findMany();
for (const case of cases) {
  const user = await prisma.user.findUnique({ where: { id: case.userId } }); // N+1!
}

// 优化后（使用include）
const cases = await prisma.case.findMany({
  include: {
    user: true,
    documents: {
      select: {
        id: true,
        filename: true,
        fileType: true,
      },
      take: 5, // 只取前5个
    },
    _count: {
      select: {
        debates: true,
        documents: true,
      },
    },
  },
});

// 添加数据库索引（在Prisma schema中）
model Case {
  @@index([userId, status])
  @@index([createdAt])
  @@index([type, status])
}

model User {
  @@index([email])
  @@index([role, status])
  @@index([lastLoginAt])
}
```

---

## 实施检查清单

### 第一阶段检查项
- [ ] Cookie存储RefreshToken实现
- [ ] Middleware路由保护实现
- [ ] CSRF保护实现
- [ ] 安全响应头配置
- [ ] 登录页redirect参数处理
- [ ] 测试：未登录访问保护页面被重定向
- [ ] 测试：登录后正常访问
- [ ] 测试：管理员访问/admin成功
- [ ] 测试：普通用户访问/admin被拒绝

### 第二阶段检查项
- [ ] 全局error.tsx实现
- [ ] 页面级error.tsx实现（cases, clients, debates）
- [ ] AuthContext实现
- [ ] Layout中集成AuthProvider
- [ ] 骨架屏组件实现
- [ ] loading.tsx实现（主要页面）
- [ ] Toast通知集成
- [ ] 测试：页面错误显示友好提示
- [ ] 测试：加载状态显示骨架屏
- [ ] 测试：操作成功显示toast

### 第三阶段检查项
- [ ] AI配额系统实现
- [ ] 配额检查集成到AI端点
- [ ] 配额用量统计页面
- [ ] AI流式响应实现
- [ ] 流式响应前端集成
- [ ] 审计日志系统实现
- [ ] 审计日志查询页面
- [ ] 数据库查询优化
- [ ] 索引添加和验证
- [ ] 测试：AI配额限制生效
- [ ] 测试：流式响应正常工作
- [ ] 测试：审计日志正确记录

---

## 性能监控指标

优化完成后应关注以下指标：

| 指标 | 优化前 | 目标 | 测量方法 |
|------|--------|------|----------|
| 首页加载时间 | - | < 2s | Lighthouse |
| API响应时间 | - | < 500ms | Network面板 |
| 数据库查询数 | - | 减少50% | Prisma日志 |
| 登录流程时间 | - | < 1s | 手动测试 |
| AI响应首字时间 | - | < 3s | 流式响应 |

---

## 回滚计划

如果某个优化导致问题：

1. **立即回滚**:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **分支策略**:
   - 每个阶段在独立分支开发
   - 测试通过后再合并到main
   - 保留分支至少7天

3. **关键文件备份**:
   - middleware.ts
   - layout.tsx
   - auth相关文件

---

## 总结

本优化计划遵循**安全优先、体验次之、功能增强**的原则，分三个阶段实施：

1. **第一阶段（必须）**: 安全性增强，保护用户数据
2. **第二阶段（建议）**: 用户体验优化，提升满意度
3. **第三阶段（可选）**: 功能增强，增加系统价值

建议按顺序实施，每完成一个阶段进行充分测试后再进入下一阶段。

---

**文档维护**: 随着实施进度更新检查清单，记录实际遇到的问题和解决方案。
