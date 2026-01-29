/**
 * 合同API测试
 * 测试合同相关的API接口
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '@/lib/db/prisma';

describe('Contract API Tests', () => {
  let testUserId: string;
  let testContractId: string;

  beforeEach(async () => {
    // 创建测试用户
    const testUser = await prisma.user.create({
      data: {
        email: 'contract-test@example.com',
        name: '合同测试用户',
      },
    });
    testUserId = testUser.id;
  });

  afterEach(async () => {
    // 清理测试数据
    if (testContractId) {
      await prisma.contract.delete({
        where: { id: testContractId },
      });
    }
    await prisma.user.delete({
      where: { id: testUserId },
    });
  });

  describe('POST /api/contracts', () => {
    it('should create a new contract', async () => {
      const contractData = {
        clientType: 'INDIVIDUAL',
        clientName: '张三',
        clientIdNumber: '110101199001011234',
        clientContact: '13800138000',
        lawFirmName: '律伴律师事务所',
        lawyerName: '李律师',
        lawyerId: testUserId,
        caseType: '劳动争议',
        caseSummary: '劳动合同纠纷案件',
        scope: '代理一审',
        feeType: 'FIXED',
        totalFee: 10000,
        payments: [
          { paymentType: '首付款', amount: 5000 },
          { paymentType: '尾款', amount: 5000 },
        ],
      };

      const response = await fetch('http://localhost:3000/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contractData),
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data.clientName).toBe('张三');
      expect(result.data.contractNumber).toMatch(/^HT\d{14}$/);

      testContractId = result.data.id;
    });

    it('should validate required fields', async () => {
      const invalidData = {
        clientType: 'INDIVIDUAL',
        // Missing required fields
      };

      const response = await fetch('http://localhost:3000/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
    });
  });

  describe('GET /api/contracts', () => {
    beforeEach(async () => {
      // 创建测试合同
      const contract = await prisma.contract.create({
        data: {
          contractNumber: 'HT20260129000001',
          clientType: 'INDIVIDUAL',
          clientName: '测试客户',
          lawFirmName: '律伴律师事务所',
          lawyerName: '测试律师',
          lawyerId: testUserId,
          caseType: '合同纠纷',
          caseSummary: '测试案情',
          scope: '代理一审',
          feeType: 'FIXED',
          totalFee: 10000,
          status: 'DRAFT',
        },
      });
      testContractId = contract.id;
    });

    it('should get contracts list', async () => {
      const response = await fetch('http://localhost:3000/api/contracts');
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('items');
      expect(result.data).toHaveProperty('total');
      expect(Array.isArray(result.data.items)).toBe(true);
    });

    it('should filter contracts by status', async () => {
      const response = await fetch(
        'http://localhost:3000/api/contracts?status=DRAFT'
      );
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.items.every((c: any) => c.status === 'DRAFT')).toBe(
        true
      );
    });

    it('should search contracts by client name', async () => {
      const response = await fetch(
        'http://localhost:3000/api/contracts?search=测试客户'
      );
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.items.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/contracts/[id]', () => {
    beforeEach(async () => {
      const contract = await prisma.contract.create({
        data: {
          contractNumber: 'HT20260129000002',
          clientType: 'INDIVIDUAL',
          clientName: '测试客户2',
          lawFirmName: '律伴律师事务所',
          lawyerName: '测试律师',
          lawyerId: testUserId,
          caseType: '合同纠纷',
          caseSummary: '测试案情',
          scope: '代理一审',
          feeType: 'FIXED',
          totalFee: 10000,
          status: 'DRAFT',
        },
      });
      testContractId = contract.id;
    });

    it('should get contract details', async () => {
      const response = await fetch(
        `http://localhost:3000/api/contracts/${testContractId}`
      );
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(testContractId);
      expect(result.data.clientName).toBe('测试客户2');
    });

    it('should return 404 for non-existent contract', async () => {
      const response = await fetch(
        'http://localhost:3000/api/contracts/non-existent-id'
      );
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
    });
  });

  describe('PUT /api/contracts/[id]', () => {
    beforeEach(async () => {
      const contract = await prisma.contract.create({
        data: {
          contractNumber: 'HT20260129000003',
          clientType: 'INDIVIDUAL',
          clientName: '测试客户3',
          lawFirmName: '律伴律师事务所',
          lawyerName: '测试律师',
          lawyerId: testUserId,
          caseType: '合同纠纷',
          caseSummary: '测试案情',
          scope: '代理一审',
          feeType: 'FIXED',
          totalFee: 10000,
          status: 'DRAFT',
        },
      });
      testContractId = contract.id;
    });

    it('should update contract', async () => {
      const updateData = {
        clientName: '更新后的客户名',
        totalFee: 15000,
      };

      const response = await fetch(
        `http://localhost:3000/api/contracts/${testContractId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        }
      );

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.clientName).toBe('更新后的客户名');
      expect(Number(result.data.totalFee)).toBe(15000);
    });
  });

  describe('GET/POST /api/contracts/[id]/payments', () => {
    beforeEach(async () => {
      const contract = await prisma.contract.create({
        data: {
          contractNumber: 'HT20260129000004',
          clientType: 'INDIVIDUAL',
          clientName: '测试客户4',
          lawFirmName: '律伴律师事务所',
          lawyerName: '测试律师',
          lawyerId: testUserId,
          caseType: '合同纠纷',
          caseSummary: '测试案情',
          scope: '代理一审',
          feeType: 'FIXED',
          totalFee: 10000,
          paidAmount: 0,
          status: 'DRAFT',
        },
      });
      testContractId = contract.id;
    });

    it('should get payment records', async () => {
      const response = await fetch(
        `http://localhost:3000/api/contracts/${testContractId}/payments`
      );
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should create payment record', async () => {
      const paymentData = {
        paymentType: '首付款',
        amount: 5000,
        paymentMethod: '转账',
        status: 'PAID',
        paidAt: new Date().toISOString(),
      };

      const response = await fetch(
        `http://localhost:3000/api/contracts/${testContractId}/payments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentData),
        }
      );

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data.paymentType).toBe('首付款');
      expect(Number(result.data.amount)).toBe(5000);

      // 验证合同已付金额已更新
      const contract = await prisma.contract.findUnique({
        where: { id: testContractId },
      });
      expect(Number(contract?.paidAmount)).toBe(5000);
    });
  });
});
