/**
 * 发票服务
 * 提供发票申请、查询、验证等功能
 */

import { prisma } from '@/lib/db/prisma';
import { Invoice, InvoiceType, InvoiceStatus } from '@/types/payment';
import { validateInvoiceFields } from './invoice-utils';
import { generateInvoicePDF } from './generate-pdf';
import { OrderStatus } from '@/types/payment';

/**
 * 将 Prisma Decimal 转换为 number
 */
function toNumber(value: { toNumber: () => number }): number {
  return value.toNumber();
}

/**
 * 创建发票对象辅助函数
 */
function createInvoiceObject(prismaInvoice: Record<string, unknown>): Invoice {
  return {
    ...prismaInvoice,
    amount: toNumber(prismaInvoice.amount as { toNumber: () => number }),
  } as Invoice;
}

/**
 * 申请发票请求接口
 */
export interface ApplyInvoiceRequestInternal {
  userId: string;
  orderId: string;
  type: InvoiceType;
  title?: string;
  taxNumber?: string;
  email?: string;
}

/**
 * 申请发票
 * @param request 发票申请请求
 * @returns 发票申请响应
 * @throws Error 如果申请失败
 */
export async function applyInvoice(
  request: ApplyInvoiceRequestInternal
): Promise<Invoice> {
  try {
    const { userId, orderId, type, title, taxNumber, email } = request;

    // 查询订单信息
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        membershipTier: true,
        invoices: true,
      },
    });

    if (!order) {
      throw new Error('订单不存在');
    }

    // 验证订单所有权
    if (order.userId !== userId) {
      throw new Error('无权申请该订单的发票');
    }

    // 验证订单状态
    if (order.status !== OrderStatus.PAID) {
      throw new Error('订单未支付，无法开具发票');
    }

    // 检查是否已申请发票
    const existingInvoice = order.invoices.find(
      inv => inv.status !== InvoiceStatus.CANCELLED
    );

    if (existingInvoice) {
      throw new Error('该订单已申请过发票');
    }

    // 验证发票字段
    const validation = validateInvoiceFields(type, title, taxNumber, email);

    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    // 创建发票记录
    const invoice = await prisma.invoice.create({
      data: {
        orderId,
        userId,
        type,
        status: 'PENDING',
        amount: order.amount,
        currency: order.currency,
        title: type === InvoiceType.ENTERPRISE ? title : null,
        taxNumber: type === InvoiceType.ENTERPRISE ? taxNumber : null,
        email,
      },
      include: {
        order: {
          include: {
            membershipTier: true,
          },
        },
        user: true,
      },
    });

    console.log('[InvoiceService] 申请发票成功:', {
      invoiceId: invoice.id,
      userId,
      orderId,
      type,
    });

    // 异步生成PDF（不阻塞响应）
    generateInvoicePDF(invoice.id).catch(error => {
      console.error('[InvoiceService] 生成发票PDF失败:', error);
      // 更新发票状态为失败
      prisma.invoice
        .update({
          where: { id: invoice.id },
          data: { status: 'FAILED' },
        })
        .catch(err => console.error('[InvoiceService] 更新发票状态失败:', err));
    });

    return createInvoiceObject(invoice);
  } catch (error) {
    console.error('[InvoiceService] 申请发票失败:', error);
    throw error;
  }
}

/**
 * 查询发票
 * @param invoiceId 发票ID
 * @returns 发票信息或null
 */
export async function getInvoice(invoiceId: string): Promise<Invoice | null> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        order: {
          include: {
            membershipTier: true,
          },
        },
        user: true,
      },
    });

    if (!invoice) {
      return null;
    }

    return createInvoiceObject(invoice);
  } catch (error) {
    console.error('[InvoiceService] 查询发票失败:', error);
    throw error;
  }
}

/**
 * 根据订单号查询发票
 * @param orderNo 订单号
 * @returns 发票信息或null
 */
export async function getInvoiceByOrderNo(
  orderNo: string
): Promise<Invoice | null> {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { order: { orderNo } },
      include: {
        order: {
          include: {
            membershipTier: true,
          },
        },
        user: true,
      },
    });

    if (!invoice) {
      return null;
    }

    return createInvoiceObject(invoice);
  } catch (error) {
    console.error('[InvoiceService] 查询发票失败:', error);
    throw error;
  }
}

/**
 * 查询用户发票列表
 * @param userId 用户ID
 * @param params 查询参数
 * @returns 发票列表和总数
 */
export async function getUserInvoices(
  userId: string,
  params: {
    orderId?: string;
    status?: InvoiceStatus;
    type?: InvoiceType;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
): Promise<{ invoices: Invoice[]; total: number }> {
  try {
    const {
      orderId,
      status,
      type,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    // 构建查询条件
    const where: Record<string, unknown> = { userId };
    if (orderId) {
      where.orderId = orderId;
    }
    if (status) {
      where.status = status;
    }
    if (type) {
      where.type = type;
    }

    // 验证排序字段
    const allowedSortFields = ['createdAt', 'updatedAt', 'amount', 'issuedAt'];
    const validSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    // 验证排序方向
    const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          order: {
            include: {
              membershipTier: true,
            },
          },
        },
        orderBy: { [validSortBy]: validSortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      invoices: invoices.map(createInvoiceObject),
      total,
    };
  } catch (error) {
    console.error('[InvoiceService] 查询用户发票失败:', error);
    throw error;
  }
}

/**
 * 更新发票状态
 * @param invoiceId 发票ID
 * @param status 发票状态
 * @param filePath PDF文件路径
 * @returns 更新后的发票信息
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
  filePath?: string
): Promise<Invoice> {
  try {
    const data: Record<string, unknown> = { status };
    if (filePath) {
      data.filePath = filePath;
    }

    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data,
      include: {
        order: {
          include: {
            membershipTier: true,
          },
        },
        user: true,
      },
    });

    console.log('[InvoiceService] 更新发票状态:', {
      invoiceId,
      status,
    });

    return createInvoiceObject(invoice);
  } catch (error) {
    console.error('[InvoiceService] 更新发票状态失败:', error);
    throw error;
  }
}

/**
 * 取消发票
 * @param invoiceId 发票ID
 * @param userId 用户ID
 * @param reason 取消原因
 * @returns 更新后的发票信息
 * @throws Error 如果取消失败
 */
export async function cancelInvoice(
  invoiceId: string,
  userId: string,
  reason?: string
): Promise<Invoice> {
  try {
    // 查询发票信息
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        order: {
          include: {
            membershipTier: true,
          },
        },
        user: true,
      },
    });

    if (!invoice) {
      throw new Error('发票不存在');
    }

    // 验证所有权
    if (invoice.userId !== userId) {
      throw new Error('无权取消该发票');
    }

    // 检查发票状态
    if (invoice.status === InvoiceStatus.COMPLETED) {
      throw new Error('发票已开具，无法取消');
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new Error('发票已取消');
    }

    // 更新发票状态
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'CANCELLED',
        metadata: {
          cancelledReason: reason || '用户取消',
          cancelledAt: new Date().toISOString(),
        },
      },
      include: {
        order: {
          include: {
            membershipTier: true,
          },
        },
        user: true,
      },
    });

    console.log('[InvoiceService] 取消发票:', {
      invoiceId,
      userId,
      reason,
    });

    return createInvoiceObject(updatedInvoice);
  } catch (error) {
    console.error('[InvoiceService] 取消发票失败:', error);
    throw error;
  }
}

/**
 * 重新生成发票PDF
 * @param invoiceId 发票ID
 * @param userId 用户ID
 * @returns PDF文件路径
 * @throws Error 如果重新生成失败
 */
export async function regenerateInvoicePDF(
  invoiceId: string,
  userId: string
): Promise<string> {
  try {
    // 查询发票信息
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error('发票不存在');
    }

    // 验证所有权
    if (invoice.userId !== userId) {
      throw new Error('无权操作该发票');
    }

    // 检查发票状态
    if (invoice.status !== InvoiceStatus.COMPLETED) {
      throw new Error('发票状态不允许重新生成');
    }

    // 重新生成PDF
    const filePath = await generateInvoicePDF(invoiceId);

    console.log('[InvoiceService] 重新生成发票PDF:', {
      invoiceId,
      filePath,
    });

    return filePath;
  } catch (error) {
    console.error('[InvoiceService] 重新生成发票PDF失败:', error);
    throw error;
  }
}

/**
 * 获取发票统计信息
 * @param userId 用户ID
 * @returns 发票统计信息
 */
export async function getInvoiceStats(userId: string): Promise<{
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}> {
  try {
    const [total, pending, processing, completed, failed, cancelled] =
      await Promise.all([
        prisma.invoice.count({ where: { userId } }),
        prisma.invoice.count({ where: { userId, status: 'PENDING' } }),
        prisma.invoice.count({ where: { userId, status: 'PROCESSING' } }),
        prisma.invoice.count({ where: { userId, status: 'COMPLETED' } }),
        prisma.invoice.count({ where: { userId, status: 'FAILED' } }),
        prisma.invoice.count({ where: { userId, status: 'CANCELLED' } }),
      ]);

    return {
      total,
      pending,
      processing,
      completed,
      failed,
      cancelled,
    };
  } catch (error) {
    console.error('[InvoiceService] 获取发票统计失败:', error);
    throw error;
  }
}
