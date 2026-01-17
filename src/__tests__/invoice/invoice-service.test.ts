/**
 * 发票服务单元测试
 * 测试发票服务的申请、查询、生成等功能
 */

import {
  applyInvoice,
  cancelInvoice,
  getInvoice,
  getInvoiceStats,
  getUserInvoices,
  regenerateInvoicePDF,
} from '@/lib/invoice/invoice-service';
import { InvoiceStatus, InvoiceType } from '@/types/payment';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    invoice: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/invoice/generate-pdf', () => ({
  generateInvoicePDF: jest.fn(),
}));

import { prisma } from '@/lib/db/prisma';
import { generateInvoicePDF } from '@/lib/invoice/generate-pdf';

describe('InvoiceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('applyInvoice', () => {
    it('应该成功申请个人发票', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'user-123',
        orderNo: 'ORD123456',
        amount: 99.99,
        currency: 'CNY',
        status: 'PAID',
        invoices: [],
        membershipTier: null,
      };

      const mockInvoice = {
        id: 'invoice-123',
        invoiceNo: 'INV-20250116-ABCD1234',
        userId: 'user-123',
        orderId: 'order-123',
        type: InvoiceType.PERSONAL,
        email: 'test@example.com',
        amount: { toNumber: () => 99.99 },
        currency: 'CNY',
        status: 'PENDING',
        title: null,
        taxNumber: null,
        order: mockOrder,
        user: { id: 'user-123' },
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.invoice.create as jest.Mock).mockResolvedValue(mockInvoice);
      (generateInvoicePDF as jest.Mock).mockResolvedValue(
        '/path/to/invoice.pdf'
      );

      const result = await applyInvoice({
        userId: 'user-123',
        orderId: 'order-123',
        type: InvoiceType.PERSONAL,
        email: 'test@example.com',
      });

      expect(result.amount).toBe(99.99);
      expect(prisma.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          type: InvoiceType.PERSONAL,
          email: 'test@example.com',
          status: 'PENDING',
        }),
        include: expect.any(Object),
      });
    });

    it('应该成功申请企业发票', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'user-123',
        orderNo: 'ORD123456',
        amount: 99.99,
        currency: 'CNY',
        status: 'PAID',
        invoices: [],
        membershipTier: null,
      };

      const mockInvoice = {
        id: 'invoice-123',
        invoiceNo: 'INV-20250116-ABCD1234',
        userId: 'user-123',
        orderId: 'order-123',
        type: InvoiceType.ENTERPRISE,
        companyTitle: '测试公司',
        taxNumber: '91110000MA00000000',
        email: 'company@example.com',
        amount: { toNumber: () => 99.99 },
        currency: 'CNY',
        status: 'PENDING',
        order: mockOrder,
        user: { id: 'user-123' },
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.invoice.create as jest.Mock).mockResolvedValue(mockInvoice);

      const result = await applyInvoice({
        userId: 'user-123',
        orderId: 'order-123',
        type: InvoiceType.ENTERPRISE,
        title: '测试公司',
        taxNumber: '91110000MA00000000',
        email: 'company@example.com',
      });

      expect(result.amount).toBe(99.99);
      expect(prisma.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          type: InvoiceType.ENTERPRISE,
          title: '测试公司',
          taxNumber: '91110000MA00000000',
          email: 'company@example.com',
          status: 'PENDING',
        }),
        include: expect.any(Object),
      });
    });

    it('应该拒绝未支付的订单', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'user-123',
        orderNo: 'ORD123456',
        amount: 99.99,
        currency: 'CNY',
        status: 'PENDING',
        invoices: [],
        membershipTier: null,
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      await expect(
        applyInvoice({
          userId: 'user-123',
          orderId: 'order-123',
          type: InvoiceType.PERSONAL,
          email: 'test@example.com',
        })
      ).rejects.toThrow('订单未支付，无法开具发票');
    });

    it('应该拒绝不存在的订单', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        applyInvoice({
          userId: 'user-123',
          orderId: 'order-123',
          type: InvoiceType.PERSONAL,
          email: 'test@example.com',
        })
      ).rejects.toThrow('订单不存在');
    });

    it('应该拒绝无效的企业发票信息', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'user-123',
        orderNo: 'ORD123456',
        amount: 99.99,
        currency: 'CNY',
        status: 'PAID',
        invoices: [],
        membershipTier: null,
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      await expect(
        applyInvoice({
          userId: 'user-123',
          orderId: 'order-123',
          type: InvoiceType.ENTERPRISE,
          title: '测试公司',
          taxNumber: 'invalid',
          email: 'company@example.com',
        })
      ).rejects.toThrow();
    });

    it('应该拒绝重复申请发票', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'user-123',
        orderNo: 'ORD123456',
        amount: 99.99,
        currency: 'CNY',
        status: 'PAID',
        invoices: [{ status: 'COMPLETED' }],
        membershipTier: null,
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      await expect(
        applyInvoice({
          userId: 'user-123',
          orderId: 'order-123',
          type: InvoiceType.PERSONAL,
          email: 'test@example.com',
        })
      ).rejects.toThrow('该订单已申请过发票');
    });
  });

  describe('getInvoice', () => {
    it('应该成功获取发票', async () => {
      const mockInvoice = {
        id: 'invoice-123',
        invoiceNo: 'INV-20250116-ABCD1234',
        userId: 'user-123',
        type: InvoiceType.PERSONAL,
        email: 'test@example.com',
        amount: { toNumber: () => 99.99 },
        status: InvoiceStatus.PENDING,
        order: { membershipTier: null },
        user: { id: 'user-123' },
      };

      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(mockInvoice);

      const result = await getInvoice('invoice-123');

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(99.99);
      expect(prisma.invoice.findUnique).toHaveBeenCalledWith({
        where: { id: 'invoice-123' },
        include: expect.any(Object),
      });
    });

    it('应该返回null当发票不存在', async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await getInvoice('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getUserInvoices', () => {
    it('应该成功获取用户发票列表', async () => {
      const mockInvoices = [
        {
          id: 'invoice-123',
          invoiceNo: 'INV-20250116-ABCD1234',
          userId: 'user-123',
          amount: { toNumber: () => 99.99 },
          order: { membershipTier: null },
          user: { id: 'user-123' },
        },
        {
          id: 'invoice-456',
          invoiceNo: 'INV-20250116-ABCD5678',
          userId: 'user-123',
          amount: { toNumber: () => 199.99 },
          order: { membershipTier: null },
          user: { id: 'user-123' },
        },
      ];

      (prisma.invoice.findMany as jest.Mock).mockResolvedValue(mockInvoices);
      (prisma.invoice.count as jest.Mock).mockResolvedValue(2);

      const result = await getUserInvoices('user-123', { page: 1, limit: 10 });

      expect(result.invoices).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123' },
          skip: 0,
          take: 10,
        })
      );
    });
  });

  describe('cancelInvoice', () => {
    it('应该成功取消发票', async () => {
      const mockInvoice = {
        id: 'invoice-123',
        userId: 'user-123',
        status: InvoiceStatus.PENDING,
        amount: { toNumber: () => 99.99 },
        currency: 'CNY',
        invoiceNo: 'INV-20250116-ABCD1234',
        type: InvoiceType.PERSONAL,
        email: 'test@example.com',
        title: null,
        taxNumber: null,
        order: { id: 'order-123', membershipTier: null },
      };

      const mockUpdatedInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.CANCELLED,
        metadata: {
          cancelledReason: '测试取消',
          cancelledAt: new Date().toISOString(),
        },
        user: { id: 'user-123' },
      };

      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(mockInvoice);
      (prisma.invoice.update as jest.Mock).mockResolvedValue(
        mockUpdatedInvoice
      );

      const result = await cancelInvoice('invoice-123', 'user-123', '测试取消');

      expect(result.status).toBe(InvoiceStatus.CANCELLED);
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-123' },
        data: expect.objectContaining({
          status: 'CANCELLED',
        }),
        include: expect.any(Object),
      });
    });

    it('应该拒绝取消不存在的发票', async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(cancelInvoice('nonexistent', 'user-123')).rejects.toThrow(
        '发票不存在'
      );
    });

    it('应该拒绝取消已完成的发票', async () => {
      const mockInvoice = {
        id: 'invoice-123',
        userId: 'user-123',
        status: InvoiceStatus.COMPLETED,
        order: { id: 'order-123' },
      };

      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(mockInvoice);

      await expect(cancelInvoice('invoice-123', 'user-123')).rejects.toThrow(
        '发票已开具，无法取消'
      );
    });
  });

  describe('regenerateInvoicePDF', () => {
    it('应该成功重新生成发票PDF', async () => {
      const mockInvoice = {
        id: 'invoice-123',
        userId: 'user-123',
        status: InvoiceStatus.COMPLETED,
      };

      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(mockInvoice);
      (generateInvoicePDF as jest.Mock).mockResolvedValue(
        '/new/path/to/invoice.pdf'
      );

      const result = await regenerateInvoicePDF('invoice-123', 'user-123');

      expect(result).toBe('/new/path/to/invoice.pdf');
      expect(generateInvoicePDF).toHaveBeenCalledWith('invoice-123');
    });

    it('应该拒绝重新生成不存在的发票', async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        regenerateInvoicePDF('nonexistent', 'user-123')
      ).rejects.toThrow('发票不存在');
    });

    it('应该拒绝重新生成非完成状态的发票', async () => {
      const mockInvoice = {
        id: 'invoice-123',
        userId: 'user-123',
        status: InvoiceStatus.PENDING,
      };

      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(mockInvoice);

      await expect(
        regenerateInvoicePDF('invoice-123', 'user-123')
      ).rejects.toThrow('发票状态不允许重新生成');
    });
  });

  describe('getInvoiceStats', () => {
    it('应该成功获取发票统计信息', async () => {
      (prisma.invoice.count as jest.Mock).mockResolvedValue(10);

      const result = await getInvoiceStats('user-123');

      expect(result).toEqual({
        total: 10,
        pending: 10,
        processing: 10,
        completed: 10,
        failed: 10,
        cancelled: 10,
      });
    });
  });
});
