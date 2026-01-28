# TODO 实施路线图

**生成时间**: 2026-01-28
**执行周期**: 3 周（21 天）
**执行模式**: AI 自主推进
**技术决策**: 已根据最佳实践完成

---

## 🎯 执行原则

1. **最佳实践优先**: 选择成熟、稳定的技术方案
2. **渐进式实施**: 先核心功能，后辅助功能
3. **充分测试**: 每个功能完成后立即测试
4. **代码质量**: 保持代码规范和可维护性
5. **向后兼容**: 不破坏现有功能

---

## 📋 技术决策（已确定）

### 邮件服务
- **选择**: nodemailer + SMTP
- **理由**:
  - 最通用的解决方案
  - 支持多种邮件服务商
  - 成本低（可用免费 SMTP）
  - 易于迁移

### PDF 生成
- **选择**: pdfkit
- **理由**:
  - 轻量级（vs puppeteer）
  - 适合发票等结构化文档
  - 纯 Node.js 实现
  - 性能好

### 通知系统
- **选择**: 数据库表 + 轮询
- **理由**:
  - 简单可靠
  - 已有 Prisma ORM
  - 易于扩展（后续可改 WebSocket）

### 备份存储
- **选择**: 本地文件系统
- **理由**:
  - 先实现核心功能
  - 后续易于扩展到云存储
  - 成本为零

### LLM 服务
- **选择**: 继续使用 DeepSeek/智谱
- **理由**:
  - 已集成
  - 成本低
  - 中文支持好

---

## 📅 Week 1: 核心功能修复（Critical Priority）

### Day 1-2: 修复 AI 增量分析器（重中之重）

#### Task 1.1: 检查现有服务状态
- [ ] 检查 DocAnalyzer 是否已实现
- [ ] 检查 ApplicabilityAnalyzer 是否可直接调用
- [ ] 检查 EvidenceAnalyzer 是否存在
- [ ] 评估现有代码可复用程度

#### Task 1.2: 集成文档分析服务
**文件**: [src/lib/debate/incremental/incremental-analyzer.ts:101](src/lib/debate/incremental/incremental-analyzer.ts#L101)

**实施方案**:
```typescript
// 检查现有的 DocAnalyzer
import { DocAnalyzer } from '@/lib/agent/legal-agent/doc-analyzer';

private async analyzeDocument(material: Material): Promise<DocumentAnalysisOutput> {
  const analyzer = new DocAnalyzer();
  const result = await analyzer.analyze({
    content: material.content,
    caseId: material.metadata?.caseId,
  });

  return {
    parties: result.parties || [],
    claims: result.claims || [],
    facts: result.facts || [],
    keyDates: result.keyDates || [],
    extractedAt: new Date().toISOString(),
  };
}
```

**测试要求**:
- 单元测试覆盖率 > 80%
- 集成测试验证真实文档解析

#### Task 1.3: 集成法条适用性分析服务
**文件**: [src/lib/debate/incremental/incremental-analyzer.ts:128](src/lib/debate/incremental/incremental-analyzer.ts#L128)

**实施方案**:
```typescript
import { ApplicabilityAnalyzer } from '@/lib/agent/legal-agent/applicability-analyzer';

private async analyzeLawArticle(material: Material): Promise<LawArticleApplicabilityResult> {
  const analyzer = new ApplicabilityAnalyzer();

  return await analyzer.analyzeApplicability({
    articleId: material.id,
    lawName: material.metadata?.lawName || '未知法律',
    articleNumber: material.metadata?.articleNumber || '未知条款',
    articleContent: material.content,
    caseInfo: material.metadata?.caseInfo,
  });
}
```

#### Task 1.4: 集成证据分析服务
**文件**: [src/lib/debate/incremental/incremental-analyzer.ts:146](src/lib/debate/incremental/incremental-analyzer.ts#L146)

**实施方案**:
```typescript
// 如果没有现成的 EvidenceAnalyzer，创建基于 LLM 的实现
import { analyzeEvidenceWithLLM } from '@/lib/agent/legal-agent/evidence-llm-analyzer';

private async analyzeEvidence(material: Material): Promise<EvidenceAnalysisResult> {
  // 使用 LLM 分析证据
  const result = await analyzeEvidenceWithLLM({
    evidenceId: material.id,
    content: material.content,
    caseId: material.metadata?.caseId,
    caseType: material.metadata?.caseType,
  });

  return {
    evidenceId: material.id,
    content: material.content,
    relevance: result.relevance,
    strength: result.strength,
    credibility: result.credibility,
    relatedClaims: result.relatedClaims || [],
    analyzedAt: new Date().toISOString(),
  };
}
```

**交付物**:
- ✅ 增量分析器使用真实服务
- ✅ 所有 mock 代码已移除
- ✅ 测试通过率 100%

**工作量**: 2 天

---

### Day 3-5: 集成外部法条 API

#### Task 2.1: API 准备工作
- [ ] 调研法律之星和北大法宝 API 文档
- [ ] 选择性价比最优方案（建议：法律之星，成本约 ¥5,000/年）
- [ ] 如无法立即获取 API，先实现接口层，使用本地数据模拟

#### Task 2.2: 实现 API 客户端
**新建文件**: `src/lib/law-article/external-api-client.ts`

```typescript
/**
 * 外部法条 API 客户端
 * 支持：法律之星、北大法宝
 */

export interface ExternalLawArticleAPI {
  search(query: string, options?: SearchOptions): Promise<LawArticle[]>;
  getById(id: string): Promise<LawArticle | null>;
}

// 法律之星客户端
class LawStarClient implements ExternalLawArticleAPI {
  private apiKey: string;
  private baseURL: string;

  constructor() {
    this.apiKey = process.env.LAWSTAR_API_KEY || '';
    this.baseURL = process.env.LAWSTAR_BASE_URL || 'https://api.lawstar.cn';
  }

  async search(query: string, options?: SearchOptions): Promise<LawArticle[]> {
    // 实现 API 调用
    const response = await fetch(`${this.baseURL}/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, ...options }),
    });

    const data = await response.json();
    return this.transformToLawArticles(data);
  }

  private transformToLawArticles(data: unknown): LawArticle[] {
    // 转换 API 响应格式
  }
}

// 本地降级客户端
class LocalFallbackClient implements ExternalLawArticleAPI {
  async search(query: string): Promise<LawArticle[]> {
    // 使用本地数据
    const { searchLocalLawArticles } = await import('./local-search');
    return searchLocalLawArticles(query);
  }
}

// 工厂函数
export function createLawArticleAPIClient(): ExternalLawArticleAPI {
  const provider = process.env.LAW_ARTICLE_PROVIDER || 'local';

  switch (provider) {
    case 'lawstar':
      return new LawStarClient();
    case 'pkulaw':
      return new PkulawClient();
    default:
      return new LocalFallbackClient();
  }
}
```

#### Task 2.3: 集成到 law-searcher
**文件**: [src/lib/agent/legal-agent/law-searcher.ts:113](src/lib/agent/legal-agent/law-searcher.ts#L113)

```typescript
// 替换 TODO
const externalResults: LawArticle[] = [];
if (localResults.length < 5 && query.enableVectorSearch !== false) {
  try {
    const apiClient = createLawArticleAPIClient();
    const apiResults = await apiClient.search(query.keywords.join(' '), {
      limit: 20,
      caseType: query.caseType,
    });
    externalResults.push(...apiResults);
  } catch (error) {
    logger.error('外部 API 检索失败，使用本地降级', error);
  }
}
```

#### Task 2.4: 实现缓存层
**新建文件**: `src/lib/law-article/api-cache.ts`

```typescript
import { Redis } from 'ioredis';

export class LawArticleAPICache {
  private redis?: Redis;
  private memoryCache = new Map<string, { data: unknown; expiry: number }>();

  constructor() {
    // 如果有 Redis 环境变量则使用 Redis，否则用内存
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL);
    }
  }

  async get(key: string): Promise<LawArticle[] | null> {
    if (this.redis) {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    }

    const cached = this.memoryCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data as LawArticle[];
    }
    return null;
  }

  async set(key: string, data: LawArticle[], ttl = 3600): Promise<void> {
    if (this.redis) {
      await this.redis.setex(key, ttl, JSON.stringify(data));
    } else {
      this.memoryCache.set(key, {
        data,
        expiry: Date.now() + ttl * 1000,
      });
    }
  }
}
```

#### Task 2.5: 环境变量配置
**更新文件**: `.env.example`

```env
# 法条 API 配置
LAW_ARTICLE_PROVIDER=local  # local | lawstar | pkulaw
LAWSTAR_API_KEY=your_api_key_here
LAWSTAR_BASE_URL=https://api.lawstar.cn
PKULAW_API_KEY=your_api_key_here

# Redis 缓存（可选）
REDIS_URL=redis://localhost:6379
```

**交付物**:
- ✅ 外部 API 客户端实现
- ✅ 降级机制（API 失败时使用本地）
- ✅ 缓存层（提升性能）
- ✅ 配置文档更新

**工作量**: 3 天

---

## 📅 Week 2: 重要功能完善（High Priority）

### Day 6-7: 集成邮件服务

#### Task 3.1: 安装依赖
```bash
npm install nodemailer @types/nodemailer
```

#### Task 3.2: 实现邮件服务
**更新文件**: [src/lib/auth/email-service.ts:252](src/lib/auth/email-service.ts#L252)

```typescript
import nodemailer from 'nodemailer';

class ProdEmailService implements IEmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendPasswordResetEmail(
    email: string,
    code: string,
    expiresAt: Date
  ): Promise<EmailSendResult> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || '"法律辩论系统" <noreply@legal-debate.com>',
        to: email,
        subject: '密码重置验证码',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>密码重置验证码</h2>
            <p>您好，</p>
            <p>您请求重置密码。您的验证码是：</p>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px;">
              ${code}
            </div>
            <p>验证码有效期至：${expiresAt.toLocaleString('zh-CN')}</p>
            <p>如果您没有请求重置密码，请忽略此邮件。</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
          </div>
        `,
      });

      logger.info(`密码重置邮件已发送: ${email}`, { messageId: info.messageId });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      logger.error('发送密码重置邮件失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '发送失败',
      };
    }
  }

  async sendVerificationEmail(
    email: string,
    code: string,
    expiresAt: Date
  ): Promise<EmailSendResult> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || '"法律辩论系统" <noreply@legal-debate.com>',
        to: email,
        subject: '邮箱验证码',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>邮箱验证</h2>
            <p>欢迎注册法律辩论系统！</p>
            <p>您的邮箱验证码是：</p>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px;">
              ${code}
            </div>
            <p>验证码有效期至：${expiresAt.toLocaleString('zh-CN')}</p>
            <p>如果您没有注册账号，请忽略此邮件。</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
          </div>
        `,
      });

      logger.info(`验证邮件已发送: ${email}`, { messageId: info.messageId });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      logger.error('发送验证邮件失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '发送失败',
      };
    }
  }
}
```

#### Task 3.3: 复用到错误告警
**更新文件**: [src/lib/error/alert-manager.ts:604](src/lib/error/alert-manager.ts#L604)

```typescript
private async sendEmailAlert(alert: Alert): Promise<boolean> {
  try {
    const emailService = getEmailService();

    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.ALERT_EMAIL_TO || 'admin@legal-debate.com',
      subject: `[${alert.severity}] ${alert.title}`,
      html: `
        <h2>系统告警</h2>
        <p><strong>级别</strong>: ${alert.severity}</p>
        <p><strong>标题</strong>: ${alert.title}</p>
        <p><strong>消息</strong>: ${alert.message}</p>
        <p><strong>时间</strong>: ${alert.createdAt.toLocaleString('zh-CN')}</p>
        ${alert.metadata ? `<pre>${JSON.stringify(alert.metadata, null, 2)}</pre>` : ''}
      `,
    });

    return true;
  } catch (error) {
    logger.error('发送告警邮件失败', error);
    return false;
  }
}
```

#### Task 3.4: 环境变量配置
**更新 `.env.example`**:
```env
# SMTP 邮件配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="法律辩论系统 <noreply@legal-debate.com>"
ALERT_EMAIL_TO=admin@legal-debate.com
```

**交付物**:
- ✅ 密码重置邮件功能
- ✅ 邮箱验证邮件功能
- ✅ 错误告警邮件功能
- ✅ 邮件模板美观
- ✅ 配置文档完整

**工作量**: 2 天

---

### Day 8-9: 实现站内提醒系统

#### Task 4.1: 创建通知表（如需要）
**检查 schema.prisma**，如果没有 Notification 表，创建迁移：

```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      NotificationType
  title     String
  message   String
  link      String?  // 点击后跳转链接
  read      Boolean  @default(false)
  metadata  Json?
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, read])
  @@index([createdAt])
}

enum NotificationType {
  TASK_REMINDER      // 任务提醒
  SYSTEM_ALERT       // 系统告警
  CASE_UPDATE        // 案件更新
  DEBATE_COMPLETE    // 辩论完成
}
```

#### Task 4.2: 实现通知服务
**新建文件**: `src/lib/notification/notification-service.ts`

```typescript
import { prisma } from '@/lib/db/prisma';
import { NotificationType } from '@prisma/client';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export class NotificationService {
  /**
   * 创建通知
   */
  static async create(params: CreateNotificationParams) {
    return await prisma.notification.create({
      data: params,
    });
  }

  /**
   * 批量创建通知
   */
  static async createMany(notifications: CreateNotificationParams[]) {
    return await prisma.notification.createMany({
      data: notifications,
    });
  }

  /**
   * 获取用户未读通知
   */
  static async getUnread(userId: string) {
    return await prisma.notification.findMany({
      where: {
        userId,
        read: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * 标记为已读
   */
  static async markAsRead(notificationIds: string[]) {
    return await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
      },
      data: {
        read: true,
      },
    });
  }

  /**
   * 清理旧通知（保留最近 30 天）
   */
  static async cleanup() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
        read: true,
      },
    });
  }
}
```

#### Task 4.3: 集成到客户跟进提醒
**更新文件**: [src/lib/client/follow-up-reminder.ts:141](src/lib/client/follow-up-reminder.ts#L141)

```typescript
import { NotificationService } from '@/lib/notification/notification-service';
import { NotificationType } from '@prisma/client';

private static async sendInAppReminder(task: FollowUpTask): Promise<boolean> {
  try {
    await NotificationService.create({
      userId: task.userId,
      type: NotificationType.TASK_REMINDER,
      title: '客户跟进任务提醒',
      message: this.generateReminderMessage(task),
      link: `/clients/${task.clientId}/tasks/${task.id}`,
      metadata: {
        taskId: task.id,
        clientId: task.clientId,
        dueDate: task.dueDate,
        priority: task.priority,
      },
    });

    logger.info(`站内提醒已创建: 用户 ${task.userId} 任务 ${task.id}`);
    return true;
  } catch (error) {
    logger.error('创建站内提醒失败', error);
    return false;
  }
}
```

#### Task 4.4: 创建通知 API
**新建文件**: `src/app/api/notifications/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { NotificationService } from '@/lib/notification/notification-service';
import { successResponse, errorResponse } from '@/lib/api/responses';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse('未授权', 401);
  }

  const unreadNotifications = await NotificationService.getUnread(session.user.id);

  return successResponse({
    notifications: unreadNotifications,
    total: unreadNotifications.length,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse('未授权', 401);
  }

  const { notificationIds } = await request.json();

  await NotificationService.markAsRead(notificationIds);

  return successResponse({ message: '已标记为已读' });
}
```

#### Task 4.5: 前端通知组件（简化版）
**新建文件**: `src/components/notification/NotificationBell.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // 每分钟轮询一次
    const fetchNotifications = async () => {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      setNotifications(data.data.notifications);
      setUnreadCount(data.data.total);
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <Bell className="w-6 h-6 cursor-pointer" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </div>
  );
}
```

**交付物**:
- ✅ 通知数据库表和模型
- ✅ 通知服务封装
- ✅ 客户跟进提醒集成
- ✅ 通知 API 接口
- ✅ 前端通知铃铛组件

**工作量**: 2 天

---

### Day 10-11: 实现 PDF 生成功能

#### Task 5.1: 安装依赖
```bash
npm install pdfkit @types/pdfkit
```

#### Task 5.2: 实现 PDF 生成器
**更新文件**: [src/lib/invoice/generate-pdf.ts:284](src/lib/invoice/generate-pdf.ts#L284)

```typescript
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export async function generateInvoicePDF(invoice: Invoice): Promise<string> {
  // 确保输出目录存在
  const outputDir = path.join(process.cwd(), 'public', 'invoices');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `invoice_${invoice.invoiceNo}_${Date.now()}.pdf`;
  const filepath = path.join(outputDir, filename);

  return new Promise((resolve, reject) => {
    try {
      // 创建 PDF 文档
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `发票 ${invoice.invoiceNo}`,
          Author: '法律辩论系统',
        },
      });

      // 输出到文件
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // 注册中文字体（如果需要）
      // doc.registerFont('SimSun', path.join(process.cwd(), 'fonts', 'simsun.ttf'));
      // doc.font('SimSun');

      // 标题
      doc.fontSize(24)
         .text('发票', { align: 'center' })
         .moveDown();

      // 发票信息
      doc.fontSize(12);

      doc.text(`发票号: ${invoice.invoiceNo}`, 50, 150);
      doc.text(`开票日期: ${invoice.issuedAt.toLocaleDateString('zh-CN')}`, 50, 170);
      doc.text(`订单号: ${invoice.orderId}`, 50, 190);

      // 客户信息
      doc.moveDown();
      doc.fontSize(14).text('客户信息', 50, 230);
      doc.fontSize(12);
      doc.text(`名称: ${invoice.buyerName}`, 50, 255);
      if (invoice.buyerTaxId) {
        doc.text(`税号: ${invoice.buyerTaxId}`, 50, 275);
      }

      // 发票项目表格
      doc.moveDown();
      const tableTop = 320;
      doc.fontSize(14).text('发票明细', 50, tableTop);

      // 表头
      const headerY = tableTop + 30;
      doc.fontSize(10);
      doc.text('项目', 50, headerY);
      doc.text('单价', 250, headerY);
      doc.text('数量', 350, headerY);
      doc.text('金额', 450, headerY);

      // 表格线
      doc.moveTo(50, headerY + 15)
         .lineTo(550, headerY + 15)
         .stroke();

      // 项目详情
      let currentY = headerY + 25;
      invoice.items.forEach((item: InvoiceItem) => {
        doc.text(item.description, 50, currentY);
        doc.text(`¥${item.unitPrice.toFixed(2)}`, 250, currentY);
        doc.text(item.quantity.toString(), 350, currentY);
        doc.text(`¥${item.amount.toFixed(2)}`, 450, currentY);
        currentY += 20;
      });

      // 总计
      doc.moveTo(50, currentY + 10)
         .lineTo(550, currentY + 10)
         .stroke();

      doc.fontSize(12);
      doc.text('合计', 350, currentY + 20);
      doc.text(`¥${invoice.totalAmount.toFixed(2)}`, 450, currentY + 20);

      // 备注
      if (invoice.notes) {
        doc.moveDown();
        doc.fontSize(10);
        doc.text(`备注: ${invoice.notes}`, 50, currentY + 60, {
          width: 500,
        });
      }

      // 页脚
      doc.fontSize(8)
         .text(
           '此发票由系统自动生成 | 法律辩论系统',
           50,
           doc.page.height - 50,
           { align: 'center' }
         );

      // 完成
      doc.end();

      stream.on('finish', () => {
        resolve(`/invoices/${filename}`);
      });

      stream.on('error', reject);

    } catch (error) {
      reject(error);
    }
  });
}
```

#### Task 5.3: 更新返回路径
**更新文件**: [src/lib/invoice/generate-pdf.ts:306](src/lib/invoice/generate-pdf.ts#L306)

```typescript
export async function generateAndSaveInvoicePDF(invoiceId: string): Promise<string> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      order: true,
    },
  });

  if (!invoice) {
    throw new Error('发票不存在');
  }

  // 生成 PDF
  const pdfPath = await generateInvoicePDF(invoice);

  // 更新数据库中的 PDF 路径
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { pdfPath },
  });

  return pdfPath;
}
```

#### Task 5.4: 创建下载 API
**新建文件**: `src/app/api/invoices/[id]/download/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db/prisma';
import { generateAndSaveInvoicePDF } from '@/lib/invoice/generate-pdf';
import path from 'path';
import fs from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return new Response('未授权', { status: 401 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
  });

  if (!invoice) {
    return new Response('发票不存在', { status: 404 });
  }

  // 如果 PDF 不存在，生成它
  let pdfPath = invoice.pdfPath;
  if (!pdfPath) {
    pdfPath = await generateAndSaveInvoicePDF(invoice.id);
  }

  // 读取文件
  const filepath = path.join(process.cwd(), 'public', pdfPath);
  const fileBuffer = fs.readFileSync(filepath);

  // 返回文件
  return new Response(fileBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice_${invoice.invoiceNo}.pdf"`,
    },
  });
}
```

**交付物**:
- ✅ PDF 生成功能完整
- ✅ 发票 PDF 格式美观
- ✅ 文件存储机制
- ✅ 下载 API 实现

**工作量**: 2 天

---

## 📅 Week 3: 体验优化与首页改造（Medium Priority）

### Day 12-14: 首页双模式实现（重要功能）

#### Task 6.1: 设计双模式配置
**新建文件**: `src/config/homepage-modes.ts`

```typescript
export type UserRole = 'lawyer' | 'legal_dept' | 'general';

export interface HomepageMode {
  hero: {
    title: string;
    subtitle: string;
    cta: string;
  };
  features: Array<{
    title: string;
    description: string;
    icon: string;
    link: string;
  }>;
  navigation: Array<{
    label: string;
    href: string;
  }>;
}

export const HOMEPAGE_MODES: Record<UserRole, HomepageMode> = {
  lawyer: {
    hero: {
      title: '让诉讼辩护更高效、更智能',
      subtitle: '基于 AI 的法律辩论系统，为律师提供专业的案件分析和辩论策略',
      cta: '开始案件分析',
    },
    features: [
      {
        title: '案件管理',
        description: '全流程案件管理，从立案到结案，轻松掌控',
        icon: 'folder',
        link: '/cases',
      },
      {
        title: 'AI 辩论',
        description: '智能生成正反方观点，模拟庭审辩论',
        icon: 'brain',
        link: '/debates',
      },
      {
        title: '法条检索',
        description: '快速查找适用法条，支持智能推荐',
        icon: 'book',
        link: '/law-articles',
      },
      {
        title: '证据管理',
        description: '证据链构建，支持多种格式文档',
        icon: 'file',
        link: '/evidence',
      },
      {
        title: '客户跟进',
        description: '任务提醒，客户沟通记录',
        icon: 'users',
        link: '/clients',
      },
      {
        title: '庭审日程',
        description: '开庭日程管理，不错过重要节点',
        icon: 'calendar',
        link: '/schedule',
      },
    ],
    navigation: [
      { label: '案件管理', href: '/cases' },
      { label: 'AI 辩论', href: '/debates' },
      { label: '客户管理', href: '/clients' },
      { label: '文书模板', href: '/templates' },
    ],
  },
  legal_dept: {
    hero: {
      title: '让企业法务更高效、更合规',
      subtitle: '为企业法务部门提供合同审查、风险评估、合规管理一站式解决方案',
      cta: '开始合同审查',
    },
    features: [
      {
        title: '合同审查',
        description: 'AI 智能识别合同风险点，提供修改建议',
        icon: 'file-check',
        link: '/contracts/review',
      },
      {
        title: '风险评估',
        description: '企业法律风险预警，合规性检查',
        icon: 'alert-triangle',
        link: '/risk-assessment',
      },
      {
        title: '合规管理',
        description: '法规更新追踪，合规培训管理',
        icon: 'shield',
        link: '/compliance',
      },
      {
        title: '法律意见',
        description: 'AI 辅助生成法律意见书',
        icon: 'file-text',
        link: '/legal-opinions',
      },
      {
        title: '诉讼管理',
        description: '涉诉案件追踪，诉讼成本控制',
        icon: 'folder',
        link: '/cases',
      },
      {
        title: '知识库',
        description: '企业法律知识库，经验沉淀',
        icon: 'book',
        link: '/knowledge-base',
      },
    ],
    navigation: [
      { label: '合同审查', href: '/contracts/review' },
      { label: '风险评估', href: '/risk-assessment' },
      { label: '合规管理', href: '/compliance' },
      { label: '诉讼管理', href: '/cases' },
    ],
  },
  general: {
    hero: {
      title: '让法律工作更高效、更智能',
      subtitle: '为法律工作者提供智能化工具，提升工作效率',
      cta: '立即体验',
    },
    features: [
      {
        title: '案件管理',
        description: '专业的案件管理工具',
        icon: 'folder',
        link: '/cases',
      },
      {
        title: 'AI 辅助',
        description: '智能法律分析与辅助',
        icon: 'brain',
        link: '/debates',
      },
      {
        title: '文档管理',
        description: '高效的文档组织与检索',
        icon: 'file',
        link: '/documents',
      },
      {
        title: '协作工具',
        description: '团队协作，信息共享',
        icon: 'users',
        link: '/teams',
      },
    ],
    navigation: [
      { label: '案件', href: '/cases' },
      { label: 'AI 辅助', href: '/debates' },
      { label: '文档', href: '/documents' },
      { label: '团队', href: '/teams' },
    ],
  },
};
```

#### Task 6.2: 检测用户角色
**新建文件**: `src/lib/user/role-detector.ts`

```typescript
import { User } from '@prisma/client';

export function detectUserRole(user: User | null): UserRole {
  if (!user) {
    return 'general';
  }

  // 检查用户资质或企业认证
  if (user.qualificationStatus === 'APPROVED') {
    // 如果是律师资质
    return 'lawyer';
  }

  // 检查是否是企业法务（通过企业认证或角色）
  if (user.enterpriseId || user.role === 'LEGAL_DEPT') {
    return 'legal_dept';
  }

  return 'general';
}
```

#### Task 6.3: 重构首页组件
**更新文件**: [src/app/page.tsx](src/app/page.tsx)

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { detectUserRole } from '@/lib/user/role-detector';
import { HOMEPAGE_MODES } from '@/config/homepage-modes';
import { DynamicHomepage } from '@/components/homepage/DynamicHomepage';

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  let user = null;
  if (session?.user?.id) {
    user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
  }

  const role = detectUserRole(user);
  const config = HOMEPAGE_MODES[role];

  return <DynamicHomepage config={config} user={user} />;
}
```

#### Task 6.4: 创建动态首页组件
**新建文件**: `src/components/homepage/DynamicHomepage.tsx`

```typescript
'use client';

import { HomepageMode } from '@/config/homepage-modes';
import { User } from '@prisma/client';

interface DynamicHomepageProps {
  config: HomepageMode;
  user: User | null;
}

export function DynamicHomepage({ config, user }: DynamicHomepageProps) {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-purple-50 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-6">
              {config.hero.title}
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              {config.hero.subtitle}
            </p>
            <button className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition">
              {config.hero.cta}
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            核心功能
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {config.features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!user && (
        <section className="bg-blue-600 text-white py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">
              立即开始使用
            </h2>
            <p className="text-xl mb-8">
              免费注册，每天 1 次 AI 使用额度
            </p>
            <button className="bg-white text-blue-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-100 transition">
              免费注册
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
```

**交付物**:
- ✅ 三种角色配置（律师、企业法务、通用）
- ✅ 自动角色检测
- ✅ 动态首页渲染
- ✅ 响应式设计

**工作量**: 3 天

---

### Day 15-16: UI 优化与功能完善

#### Task 7.1: 案件列表 - 辩论创建跳转
**更新文件**: [src/app/cases/components/case-list.tsx:47](src/app/cases/components/case-list.tsx#L47)

```typescript
const handleCreateDebate = (caseId: string) => {
  router.push(`/debates/create?caseId=${caseId}`);
};

// 在案件卡片中添加按钮
<button
  onClick={() => handleCreateDebate(case.id)}
  className="text-blue-600 hover:text-blue-800"
>
  创建辩论
</button>
```

#### Task 7.2: 案件列表 - 筛选抽屉
**更新文件**: [src/app/cases/components/case-list.tsx:225](src/app/cases/components/case-list.tsx#L225)

```typescript
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const [filterOpen, setFilterOpen] = useState(false);

// 筛选按钮
<button onClick={() => setFilterOpen(true)}>
  筛选
</button>

// 筛选抽屉
<Sheet open={filterOpen} onOpenChange={setFilterOpen}>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>筛选案件</SheetTitle>
    </SheetHeader>
    <div className="mt-4 space-y-4">
      {/* 案件类型筛选 */}
      <div>
        <label>案件类型</label>
        <select>
          <option value="">全部</option>
          <option value="CIVIL">民事</option>
          <option value="CRIMINAL">刑事</option>
          <option value="ADMINISTRATIVE">行政</option>
        </select>
      </div>

      {/* 状态筛选 */}
      <div>
        <label>案件状态</label>
        <select>
          <option value="">全部</option>
          <option value="OPEN">进行中</option>
          <option value="CLOSED">已结案</option>
        </select>
      </div>

      <button onClick={handleApplyFilter}>
        应用筛选
      </button>
    </div>
  </SheetContent>
</Sheet>
```

#### Task 7.3: 法条分析器优化
**更新文件**: [src/lib/agent/legal-agent/applicability-analyzer.ts:155](src/lib/agent/legal-agent/applicability-analyzer.ts#L155)

```typescript
// 替换硬编码，从 caseInfo 中提取
private extractFactsFromCase(caseInfo: CaseInfo): string[] {
  if (!caseInfo) {
    return ['案件事实信息缺失'];
  }

  const facts: string[] = [];

  // 从案件描述中提取
  if (caseInfo.description) {
    facts.push(caseInfo.description);
  }

  // 从争议焦点中提取
  if (caseInfo.disputeFocus) {
    facts.push(...caseInfo.disputeFocus);
  }

  // 从证据中提取
  if (caseInfo.evidences) {
    facts.push(...caseInfo.evidences.map(e => e.summary));
  }

  return facts;
}
```

#### Task 7.4: 案件共享团队验证
**更新文件**: [src/lib/case/share-permission-validator.ts:318](src/lib/case/share-permission-validator.ts#L318)

```typescript
// 实现团队共享验证逻辑
if (teamId) {
  // 检查团队是否存在
  const team = await prisma.team.findUnique({
    where: { id: teamId },
  });

  if (!team) {
    errors.push('指定的团队不存在');
  }

  // 检查用户是否有权限将案件共享给该团队
  const teamMember = await prisma.teamMember.findFirst({
    where: {
      teamId,
      userId,
      status: 'ACTIVE',
    },
  });

  if (!teamMember) {
    errors.push('您不是该团队成员，无法共享到该团队');
  }

  // 检查团队权限配置
  const hasSharePermission = teamMember?.permissions?.includes('CASE_SHARE');
  if (!hasSharePermission) {
    errors.push('您在该团队中没有共享案件的权限');
  }
}
```

**交付物**:
- ✅ 案件列表 UI 优化
- ✅ 筛选功能完整
- ✅ 法条分析逻辑优化
- ✅ 团队共享验证完整

**工作量**: 2 天

---

### Day 17-18: 管理后台功能完善

#### Task 8.1: 导出任务列表 API
**新建文件**: `src/app/api/admin/export/tasks/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db/prisma';
import { successResponse, errorResponse } from '@/lib/api/responses';

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return errorResponse('无权限', 403);
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');

  const tasks = await prisma.exportTask.findMany({
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const total = await prisma.exportTask.count();

  return successResponse({
    tasks,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
```

#### Task 8.2: 更新导出页面
**更新文件**: [src/app/admin/export/page.tsx:42](src/app/admin/export/page.tsx#L42)

```typescript
useEffect(() => {
  const fetchTasks = async () => {
    const res = await fetch('/api/admin/export/tasks?page=1&pageSize=20');
    const data = await res.json();
    if (data.success) {
      setTasks(data.data.tasks);
      setPagination(data.data.pagination);
    }
  };

  fetchTasks();
}, []);
```

#### Task 8.3: 会员导出历史
**新建文件**: `src/app/api/admin/memberships/export/history/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return errorResponse('无权限', 403);
  }

  const exports = await prisma.membershipExport.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
  });

  return successResponse({ exports });
}
```

**更新文件**: [src/app/admin/memberships/export/page.tsx:57](src/app/admin/memberships/export/page.tsx#L57)

```typescript
const fetchHistory = async () => {
  const res = await fetch('/api/admin/memberships/export/history');
  const data = await res.json();
  if (data.success) {
    setExportHistory(data.data.exports);
  }
};
```

**交付物**:
- ✅ 导出任务列表 API
- ✅ 会员导出历史 API
- ✅ 管理后台 UI 完整

**工作量**: 2 天

---

### Day 19-21: 低优先级任务与测试

#### Task 9.1: 性能监控上报
**更新文件**: [src/lib/performance/metrics.ts:114](src/lib/performance/metrics.ts#L114)

```typescript
// TODO: 实现发送到分析服务
private async sendToAnalytics(metric: PerformanceMetric): Promise<void> {
  // 简单实现：发送到日志系统
  logger.info('Performance Metric', {
    ...metric,
    timestamp: new Date().toISOString(),
  });

  // 可选：发送到外部分析平台（如果配置）
  if (process.env.ANALYTICS_ENDPOINT) {
    try {
      await fetch(process.env.ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric),
      });
    } catch (error) {
      logger.error('发送性能指标失败', error);
    }
  }
}
```

#### Task 9.2: 数据库监控 Webhook
**更新文件**: [scripts/monitor-database-prod.ts:529](scripts/monitor-database-prod.ts#L529)

```typescript
private async sendWebhook(alert: Alert): Promise<boolean> {
  const webhookUrl = process.env.MONITOR_WEBHOOK_URL;
  if (!webhookUrl) {
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        timestamp: alert.createdAt,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('发送 Webhook 失败', error);
    return false;
  }
}
```

#### Task 9.3: 数据库备份云存储
**更新文件**: [scripts/backup-database-prod.ts:310](scripts/backup-database-prod.ts#L310)

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';

private async uploadToCloud(localPath: string): Promise<string> {
  // 如果配置了云存储，上传
  if (process.env.AWS_S3_BUCKET) {
    const s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const fileContent = fs.readFileSync(localPath);
    const fileName = path.basename(localPath);

    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `backups/${fileName}`,
      Body: fileContent,
    }));

    return `s3://${process.env.AWS_S3_BUCKET}/backups/${fileName}`;
  }

  // 否则返回本地路径
  return localPath;
}
```

#### Task 9.4: 清理过期 TODO 注释
**删除已完成的 TODO**:
- `src/lib/auth/auth-options.ts:4` - NextAuth 已集成完成

#### Task 9.5: 全面测试
- [ ] 运行所有单元测试: `npm test`
- [ ] 运行 E2E 测试: `npm run test:e2e`
- [ ] 手动测试所有修复功能
- [ ] 性能测试（关键 API 响应时间 < 500ms）
- [ ] 安全测试（SQL 注入、XSS 等）

**交付物**:
- ✅ 所有低优先级 TODO 完成
- ✅ 测试覆盖率 > 80%
- ✅ 所有关键功能验证通过

**工作量**: 3 天

---

## 📊 总体进度追踪

### Critical Priority (Week 1)
- [ ] Day 1-2: AI 增量分析器修复（3 个 TODO）
- [ ] Day 3-5: 外部法条 API 集成（1 个 TODO）

### High Priority (Week 2)
- [ ] Day 6-7: 邮件服务集成（3 个 TODO）
- [ ] Day 8-9: 站内提醒系统（3 个 TODO）
- [ ] Day 10-11: PDF 生成功能（2 个 TODO）

### Medium Priority (Week 3)
- [ ] Day 12-14: 首页双模式（新功能）
- [ ] Day 15-16: UI 优化（4 个 TODO）
- [ ] Day 17-18: 管理后台（2 个 TODO）

### Low Priority (Week 3)
- [ ] Day 19-21: 低优先级任务（4 个 TODO）+ 测试

---

## 🎯 成功标准

### 功能完整性
- ✅ 所有 Critical TODO 已修复
- ✅ 所有 High Priority TODO 已修复
- ✅ 80% Medium Priority TODO 已修复
- ✅ 首页双模式已实现

### 代码质量
- ✅ 测试覆盖率 > 80%
- ✅ 无 ESLint 错误
- ✅ 无 TypeScript 类型错误
- ✅ 代码注释完整

### 性能指标
- ✅ 页面加载时间 < 2s
- ✅ API 响应时间 < 500ms
- ✅ 数据库查询优化

### 用户体验
- ✅ 响应式设计完整
- ✅ 错误提示友好
- ✅ 加载状态清晰
- ✅ 通知系统有效

---

## 📝 每日报告模板

### 日报格式
```
# Day X 工作报告
日期: YYYY-MM-DD
任务: [任务名称]

## 完成情况
- ✅ 已完成项 1
- ✅ 已完成项 2
- ⏳ 进行中项

## 代码变更
- 新增文件: X 个
- 修改文件: Y 个
- 删除代码: Z 行

## 测试结果
- 单元测试: X/Y 通过
- 集成测试: 通过/失败
- 手动测试: 验证通过

## 遇到的问题
[如有问题，记录在此]

## 明日计划
[下一步工作]
```

---

## 🚀 执行启动

**当前状态**: 路线图已完成，准备开始执行

**下一步**: 开始 Week 1 Day 1 - 检查现有服务状态

**执行模式**: AI 自主推进，每完成一个任务自动进入下一个

**技术决策**: 已全部完成，无需等待用户输入

---

**创建者**: Claude Sonnet 4.5
**最后更新**: 2026-01-28
**预计完成**: 2026-02-18（3 周后）
