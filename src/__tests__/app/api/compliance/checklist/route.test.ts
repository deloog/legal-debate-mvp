/**
 * 合规检查清单API测试
 */

import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/compliance/checklist/route';
import {
  ComplianceCategory,
  ComplianceCheckStatus,
  CompliancePriority,
} from '@/types/compliance';

// Mock合规服务
jest.mock('@/lib/compliance/compliance-service', () => ({
  ComplianceService: {
    getChecklists: jest.fn(),
    updateCheckItem: jest.fn(),
  },
}));

describe('合规检查清单API测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/compliance/checklist', () => {
    it('应该成功获取检查清单', async () => {
      const { ComplianceService } =
        await import('@/lib/compliance/compliance-service');

      const mockChecklists = [
        {
          id: 'checklist-001',
          name: '法律合规检查',
          description: '年度法律合规检查清单',
          category: ComplianceCategory.LEGAL,
          items: [
            {
              id: 'item-001',
              category: ComplianceCategory.LEGAL,
              title: '合同审查',
              description: '审查所有合同是否符合法律要求',
              status: ComplianceCheckStatus.PASSED,
              priority: CompliancePriority.HIGH,
              dueDate: new Date('2024-12-31'),
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          completionRate: 50,
        },
      ];

      (ComplianceService.getChecklists as jest.Mock).mockResolvedValue(
        mockChecklists
      );

      const request = new NextRequest(
        'http://localhost:3000/api/compliance/checklist'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].id).toBe('checklist-001');
    });

    it('应该支持按类别筛选', async () => {
      const { ComplianceService } =
        await import('@/lib/compliance/compliance-service');

      (ComplianceService.getChecklists as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/compliance/checklist?category=legal'
      );

      const response = await GET(request);
      const __data = await response.json();

      expect(response.status).toBe(200);
      expect(ComplianceService.getChecklists).toHaveBeenCalledWith({
        category: ComplianceCategory.LEGAL,
      });
    });

    it('应该处理服务错误', async () => {
      const { ComplianceService } =
        await import('@/lib/compliance/compliance-service');

      (ComplianceService.getChecklists as jest.Mock).mockRejectedValue(
        new Error('服务错误')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/compliance/checklist'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('SERVICE_ERROR');
    });
  });

  describe('PUT /api/compliance/checklist', () => {
    it('应该成功更新检查项', async () => {
      const { ComplianceService } =
        await import('@/lib/compliance/compliance-service');

      const mockUpdatedItem = {
        id: 'item-001',
        category: ComplianceCategory.LEGAL,
        title: '合同审查',
        description: '审查所有合同是否符合法律要求',
        status: ComplianceCheckStatus.PASSED,
        priority: CompliancePriority.HIGH,
        notes: '已完成审查',
      };

      (ComplianceService.updateCheckItem as jest.Mock).mockResolvedValue(
        mockUpdatedItem
      );

      const request = new NextRequest(
        'http://localhost:3000/api/compliance/checklist',
        {
          method: 'PUT',
          body: JSON.stringify({
            checklistId: 'checklist-001',
            itemId: 'item-001',
            status: ComplianceCheckStatus.PASSED,
            notes: '已完成审查',
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe(ComplianceCheckStatus.PASSED);
    });

    it('应该处理缺少必填字段', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/compliance/checklist',
        {
          method: 'PUT',
          body: JSON.stringify({
            checklistId: 'checklist-001',
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_INPUT');
    });

    it('应该处理无效的JSON', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/compliance/checklist',
        {
          method: 'PUT',
          body: 'invalid json',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_JSON');
    });
  });
});
