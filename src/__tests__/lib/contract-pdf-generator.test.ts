/**
 * 合同PDF生成服务测试
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '@/lib/db/prisma';
import {
  generateContractPDF,
  contractFileExists,
  deleteContractFile,
} from '@/lib/contract/contract-pdf-generator';
import * as fs from 'fs';
import * as path from 'path';

describe('Contract PDF Generator Tests', () => {
  let testUserId: string;
  let testContractId: string;

  beforeEach(async () => {
    // 创建测试用户
    const testUser = await prisma.user.create({
      data: {
        email: 'pdf-test@example.com',
        name: 'PDF测试用户',
      },
    });
    testUserId = testUser.id;

    // 创建测试合同
    const contract = await prisma.contract.create({
      data: {
        contractNumber: 'HT20260129999999',
        clientType: 'INDIVIDUAL',
        clientName: '张三',
        clientIdNumber: '110101199001011234',
        clientAddress: '北京市朝阳区',
        clientContact: '13800138000',
        lawFirmName: '律伴律师事务所',
        lawyerName: '李律师',
        lawyerId: testUserId,
        caseType: '劳动争议',
        caseSummary: '劳动合同纠纷案件，涉及工资支付问题',
        scope: '代理一审诉讼',
        feeType: 'FIXED',
        totalFee: 10000,
        specialTerms: '特别约定：如胜诉，额外支付成功费用',
        status: 'DRAFT',
      },
    });
    testContractId = contract.id;
  });

  afterEach(async () => {
    // 清理测试数据
    const contract = await prisma.contract.findUnique({
      where: { id: testContractId },
    });

    if (contract?.filePath) {
      await deleteContractFile(contract.filePath);
    }

    await prisma.contract.delete({
      where: { id: testContractId },
    });

    await prisma.user.delete({
      where: { id: testUserId },
    });
  });

  describe('generateContractPDF', () => {
    it('should generate PDF file successfully', async () => {
      const filePath = await generateContractPDF(testContractId);

      expect(filePath).toBeTruthy();
      expect(filePath).toMatch(/^\/uploads\/contracts\/\d{4}\/\d{2}\/\d{2}\/.+\.pdf$/);

      // 验证文件是否存在
      const exists = await contractFileExists(filePath);
      expect(exists).toBe(true);

      // 验证合同记录已更新
      const contract = await prisma.contract.findUnique({
        where: { id: testContractId },
      });
      expect(contract?.filePath).toBe(filePath);
    });

    it('should throw error for non-existent contract', async () => {
      await expect(
        generateContractPDF('non-existent-id')
      ).rejects.toThrow('合同不存在');
    });

    it('should generate valid PDF file', async () => {
      const filePath = await generateContractPDF(testContractId);
      const absolutePath = path.join(process.cwd(), 'public', filePath);

      // 验证文件大小
      const stats = await fs.promises.stat(absolutePath);
      expect(stats.size).toBeGreaterThan(0);

      // 验证文件是PDF格式（检查文件头）
      const buffer = await fs.promises.readFile(absolutePath);
      const header = buffer.toString('utf-8', 0, 4);
      expect(header).toBe('%PDF');
    });
  });

  describe('contractFileExists', () => {
    it('should return true for existing file', async () => {
      const filePath = await generateContractPDF(testContractId);
      const exists = await contractFileExists(filePath);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const exists = await contractFileExists('/non-existent/path.pdf');
      expect(exists).toBe(false);
    });
  });

  describe('deleteContractFile', () => {
    it('should delete PDF file successfully', async () => {
      const filePath = await generateContractPDF(testContractId);

      // 验证文件存在
      let exists = await contractFileExists(filePath);
      expect(exists).toBe(true);

      // 删除文件
      await deleteContractFile(filePath);

      // 验证文件已删除
      exists = await contractFileExists(filePath);
      expect(exists).toBe(false);
    });

    it('should not throw error for non-existent file', async () => {
      await expect(
        deleteContractFile('/non-existent/path.pdf')
      ).resolves.not.toThrow();
    });
  });
});
