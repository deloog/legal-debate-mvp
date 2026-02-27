/**
 * 审批工作流服务测试
 * TDD: 先写测试，后写实现
 *
 * 覆盖功能：
 * 1. 工作流定义验证（含条件分支、并行审批）
 * 2. 将可视化工作流转换为执行步骤
 * 3. 工作流模板的创建、查询、更新
 */

import {
  ApprovalWorkflowService,
  WorkflowNodeType,
  type WorkflowDefinition,
  type WorkflowNode,
  type CreateWorkflowTemplateInput,
} from '@/lib/contract/approval-workflow-service';

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    approvalTemplate: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('ApprovalWorkflowService', () => {
  let service: ApprovalWorkflowService;

  beforeEach(() => {
    service = new ApprovalWorkflowService();
    jest.clearAllMocks();
  });

  // ==================== 工作流定义验证 ====================

  describe('validateWorkflowDefinition', () => {
    it('应该验证合法的线性工作流', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-approval-1'],
          },
          {
            id: 'node-approval-1',
            type: WorkflowNodeType.APPROVAL,
            label: '部门审批',
            position: { x: 200, y: 0 },
            approverRole: '部门主管',
            nextNodeIds: ['node-end'],
          },
          {
            id: 'node-end',
            type: WorkflowNodeType.END,
            label: '结束',
            position: { x: 400, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      const result = service.validateWorkflowDefinition(definition);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该验证含条件分支的工作流', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-condition'],
          },
          {
            id: 'node-condition',
            type: WorkflowNodeType.CONDITION,
            label: '金额判断',
            position: { x: 200, y: 0 },
            conditions: [
              {
                field: 'totalAmount',
                operator: 'gt',
                value: 100000,
                label: '金额>10万',
                targetNodeId: 'node-approval-senior',
              },
              {
                field: 'totalAmount',
                operator: 'lte',
                value: 100000,
                label: '金额≤10万',
                targetNodeId: 'node-approval-manager',
              },
            ],
            nextNodeIds: ['node-approval-senior', 'node-approval-manager'],
          },
          {
            id: 'node-approval-senior',
            type: WorkflowNodeType.APPROVAL,
            label: '高级审批',
            position: { x: 400, y: -100 },
            approverRole: '总经理',
            nextNodeIds: ['node-end'],
          },
          {
            id: 'node-approval-manager',
            type: WorkflowNodeType.APPROVAL,
            label: '经理审批',
            position: { x: 400, y: 100 },
            approverRole: '部门经理',
            nextNodeIds: ['node-end'],
          },
          {
            id: 'node-end',
            type: WorkflowNodeType.END,
            label: '结束',
            position: { x: 600, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      const result = service.validateWorkflowDefinition(definition);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该验证含并行审批的工作流', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-parallel-fork'],
          },
          {
            id: 'node-parallel-fork',
            type: WorkflowNodeType.PARALLEL_GATEWAY,
            label: '并行开始',
            position: { x: 200, y: 0 },
            parallelType: 'fork',
            nextNodeIds: ['node-approval-finance', 'node-approval-legal'],
          },
          {
            id: 'node-approval-finance',
            type: WorkflowNodeType.APPROVAL,
            label: '财务审批',
            position: { x: 400, y: -100 },
            approverRole: '财务部',
            parallelGroup: 'parallel-1',
            nextNodeIds: ['node-parallel-join'],
          },
          {
            id: 'node-approval-legal',
            type: WorkflowNodeType.APPROVAL,
            label: '法务审批',
            position: { x: 400, y: 100 },
            approverRole: '法务部',
            parallelGroup: 'parallel-1',
            nextNodeIds: ['node-parallel-join'],
          },
          {
            id: 'node-parallel-join',
            type: WorkflowNodeType.PARALLEL_GATEWAY,
            label: '并行结束',
            position: { x: 600, y: 0 },
            parallelType: 'join',
            nextNodeIds: ['node-end'],
          },
          {
            id: 'node-end',
            type: WorkflowNodeType.END,
            label: '结束',
            position: { x: 800, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      const result = service.validateWorkflowDefinition(definition);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝缺少开始节点的工作流', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'non-existent',
        nodes: [
          {
            id: 'node-approval',
            type: WorkflowNodeType.APPROVAL,
            label: '审批',
            position: { x: 0, y: 0 },
            approverRole: '部门主管',
            nextNodeIds: [],
          },
        ],
      };

      const result = service.validateWorkflowDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('开始节点'))).toBe(true);
    });

    it('应该拒绝缺少结束节点的工作流', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-approval'],
          },
          {
            id: 'node-approval',
            type: WorkflowNodeType.APPROVAL,
            label: '审批',
            position: { x: 200, y: 0 },
            approverRole: '部门主管',
            nextNodeIds: [],
          },
        ],
      };

      const result = service.validateWorkflowDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('结束节点'))).toBe(true);
    });

    it('应该拒绝审批节点缺少approverRole的工作流', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-approval'],
          },
          {
            id: 'node-approval',
            type: WorkflowNodeType.APPROVAL,
            label: '审批',
            position: { x: 200, y: 0 },
            // 缺少 approverRole
            nextNodeIds: ['node-end'],
          },
          {
            id: 'node-end',
            type: WorkflowNodeType.END,
            label: '结束',
            position: { x: 400, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      const result = service.validateWorkflowDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('approverRole'))).toBe(true);
    });

    it('应该拒绝引用不存在节点的工作流', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['non-existent-node'],
          },
          {
            id: 'node-end',
            type: WorkflowNodeType.END,
            label: '结束',
            position: { x: 400, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      const result = service.validateWorkflowDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('non-existent-node'))).toBe(
        true
      );
    });

    it('应该拒绝空节点列表的工作流', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [],
      };

      const result = service.validateWorkflowDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ==================== 转换工作流为执行步骤 ====================

  describe('convertDefinitionToSteps', () => {
    it('应该将线性工作流转换为顺序步骤', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-approval-1'],
          },
          {
            id: 'node-approval-1',
            type: WorkflowNodeType.APPROVAL,
            label: '部门审批',
            position: { x: 200, y: 0 },
            approverRole: '部门主管',
            nextNodeIds: ['node-approval-2'],
          },
          {
            id: 'node-approval-2',
            type: WorkflowNodeType.APPROVAL,
            label: '总经理审批',
            position: { x: 400, y: 0 },
            approverRole: '总经理',
            nextNodeIds: ['node-end'],
          },
          {
            id: 'node-end',
            type: WorkflowNodeType.END,
            label: '结束',
            position: { x: 600, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      const steps = service.convertDefinitionToSteps(definition);

      expect(steps).toHaveLength(2);
      expect(steps[0].stepNumber).toBe(1);
      expect(steps[0].approverRole).toBe('部门主管');
      expect(steps[0].nodeId).toBe('node-approval-1');
      expect(steps[1].stepNumber).toBe(2);
      expect(steps[1].approverRole).toBe('总经理');
      expect(steps[1].nodeId).toBe('node-approval-2');
    });

    it('应该将并行审批节点转换为同组步骤', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-parallel-fork'],
          },
          {
            id: 'node-parallel-fork',
            type: WorkflowNodeType.PARALLEL_GATEWAY,
            label: '并行开始',
            position: { x: 200, y: 0 },
            parallelType: 'fork',
            nextNodeIds: ['node-finance', 'node-legal'],
          },
          {
            id: 'node-finance',
            type: WorkflowNodeType.APPROVAL,
            label: '财务审批',
            position: { x: 400, y: -100 },
            approverRole: '财务部',
            parallelGroup: 'pg-1',
            nextNodeIds: ['node-parallel-join'],
          },
          {
            id: 'node-legal',
            type: WorkflowNodeType.APPROVAL,
            label: '法务审批',
            position: { x: 400, y: 100 },
            approverRole: '法务部',
            parallelGroup: 'pg-1',
            nextNodeIds: ['node-parallel-join'],
          },
          {
            id: 'node-parallel-join',
            type: WorkflowNodeType.PARALLEL_GATEWAY,
            label: '并行结束',
            position: { x: 600, y: 0 },
            parallelType: 'join',
            nextNodeIds: ['node-end'],
          },
          {
            id: 'node-end',
            type: WorkflowNodeType.END,
            label: '结束',
            position: { x: 800, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      const steps = service.convertDefinitionToSteps(definition);

      // 并行步骤应该有相同的stepNumber（因为同时执行）
      expect(steps).toHaveLength(2);
      expect(steps[0].stepNumber).toBe(steps[1].stepNumber); // 同级步骤
      expect(steps[0].parallelGroup).toBe('pg-1');
      expect(steps[1].parallelGroup).toBe('pg-1');
    });

    it('应该将条件分支工作流转换为包含条件信息的步骤', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-condition'],
          },
          {
            id: 'node-condition',
            type: WorkflowNodeType.CONDITION,
            label: '金额判断',
            position: { x: 200, y: 0 },
            conditions: [
              {
                field: 'totalAmount',
                operator: 'gt',
                value: 50000,
                label: '金额>5万',
                targetNodeId: 'node-senior',
              },
              {
                field: 'totalAmount',
                operator: 'lte',
                value: 50000,
                label: '金额≤5万',
                targetNodeId: 'node-manager',
              },
            ],
            nextNodeIds: ['node-senior', 'node-manager'],
          },
          {
            id: 'node-senior',
            type: WorkflowNodeType.APPROVAL,
            label: '高管审批',
            position: { x: 400, y: -100 },
            approverRole: '总经理',
            nextNodeIds: ['node-end'],
          },
          {
            id: 'node-manager',
            type: WorkflowNodeType.APPROVAL,
            label: '经理审批',
            position: { x: 400, y: 100 },
            approverRole: '部门经理',
            nextNodeIds: ['node-end'],
          },
          {
            id: 'node-end',
            type: WorkflowNodeType.END,
            label: '结束',
            position: { x: 600, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      // 对于条件分支，默认返回所有可能的路径（实际执行时根据条件选择）
      const steps = service.convertDefinitionToSteps(definition);

      expect(steps.length).toBeGreaterThan(0);
      // 条件节点的条件信息应该附加到步骤上
      const seniorStep = steps.find(s => s.approverRole === '总经理');
      const managerStep = steps.find(s => s.approverRole === '部门经理');
      expect(seniorStep).toBeDefined();
      expect(managerStep).toBeDefined();
    });
  });

  // ==================== 工作流模板管理 ====================

  describe('createWorkflowTemplate', () => {
    it('应该成功创建包含流程定义的模板', async () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-approval'],
          },
          {
            id: 'node-approval',
            type: WorkflowNodeType.APPROVAL,
            label: '审批',
            position: { x: 200, y: 0 },
            approverRole: '部门主管',
            nextNodeIds: ['node-end'],
          },
          {
            id: 'node-end',
            type: WorkflowNodeType.END,
            label: '结束',
            position: { x: 400, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      const input: CreateWorkflowTemplateInput = {
        name: '标准审批流程',
        description: '适用于一般合同的审批流程',
        category: '合同审批',
        flowDefinition: definition,
      };

      const mockTemplate = {
        id: 'template-1',
        name: input.name,
        description: input.description,
        category: input.category,
        steps: [{ stepNumber: 1, approverRole: '部门主管' }],
        flowDefinition: definition,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.approvalTemplate.create as jest.Mock).mockResolvedValue(
        mockTemplate
      );

      const result = await service.createWorkflowTemplate(input);

      expect(result.id).toBe('template-1');
      expect(result.name).toBe('标准审批流程');
      expect(mockPrisma.approvalTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: '标准审批流程',
            category: '合同审批',
          }),
        })
      );
    });

    it('应该拒绝创建无效的工作流定义', async () => {
      const invalidDefinition: WorkflowDefinition = {
        startNodeId: 'non-existent',
        nodes: [],
      };

      const input: CreateWorkflowTemplateInput = {
        name: '无效流程',
        flowDefinition: invalidDefinition,
      };

      await expect(service.createWorkflowTemplate(input)).rejects.toThrow();
    });
  });

  describe('getWorkflowTemplate', () => {
    it('应该返回指定ID的模板详情', async () => {
      const mockTemplate = {
        id: 'template-1',
        name: '标准审批流程',
        description: '测试模板',
        category: '合同审批',
        steps: [],
        flowDefinition: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.approvalTemplate.findUnique as jest.Mock).mockResolvedValue(
        mockTemplate
      );

      const result = await service.getWorkflowTemplate('template-1');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('template-1');
      expect(result?.name).toBe('标准审批流程');
    });

    it('应该在模板不存在时返回null', async () => {
      (mockPrisma.approvalTemplate.findUnique as jest.Mock).mockResolvedValue(
        null
      );

      const result = await service.getWorkflowTemplate('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('listWorkflowTemplates', () => {
    it('应该返回所有激活的模板', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          name: '合同审批',
          category: '合同审批',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          steps: [],
          flowDefinition: null,
          description: null,
        },
        {
          id: 'template-2',
          name: '费用报销审批',
          category: '费用报销',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          steps: [],
          flowDefinition: null,
          description: null,
        },
      ];

      (mockPrisma.approvalTemplate.findMany as jest.Mock).mockResolvedValue(
        mockTemplates
      );

      const result = await service.listWorkflowTemplates({ isActive: true });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('合同审批');
    });

    it('应该支持按分类过滤', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          name: '合同审批',
          category: '合同审批',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          steps: [],
          flowDefinition: null,
          description: null,
        },
      ];

      (mockPrisma.approvalTemplate.findMany as jest.Mock).mockResolvedValue(
        mockTemplates
      );

      const result = await service.listWorkflowTemplates({
        category: '合同审批',
      });
      expect(
        mockPrisma.approvalTemplate.findMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: '合同审批' }),
        })
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('updateWorkflowTemplate', () => {
    it('应该成功更新模板', async () => {
      const updatedTemplate = {
        id: 'template-1',
        name: '更新后的审批流程',
        description: '已更新',
        category: '合同审批',
        steps: [],
        flowDefinition: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.approvalTemplate.update as jest.Mock).mockResolvedValue(
        updatedTemplate
      );

      const result = await service.updateWorkflowTemplate('template-1', {
        name: '更新后的审批流程',
        description: '已更新',
      });

      expect(result.name).toBe('更新后的审批流程');
      expect(mockPrisma.approvalTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'template-1' },
        })
      );
    });

    it('应该在更新时验证工作流定义', async () => {
      const invalidDefinition: WorkflowDefinition = {
        startNodeId: 'non-existent',
        nodes: [],
      };

      await expect(
        service.updateWorkflowTemplate('template-1', {
          flowDefinition: invalidDefinition,
        })
      ).rejects.toThrow();
    });
  });

  // ==================== 工作流节点辅助方法 ====================

  describe('getNodeById', () => {
    it('应该根据ID找到节点', () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'node-1',
          type: WorkflowNodeType.START,
          label: '开始',
          position: { x: 0, y: 0 },
          nextNodeIds: [],
        },
        {
          id: 'node-2',
          type: WorkflowNodeType.APPROVAL,
          label: '审批',
          position: { x: 200, y: 0 },
          approverRole: '主管',
          nextNodeIds: [],
        },
      ];

      const node = service.getNodeById(nodes, 'node-2');
      expect(node).not.toBeNull();
      expect(node?.label).toBe('审批');
    });

    it('应该在节点不存在时返回null', () => {
      const nodes: WorkflowNode[] = [];
      const node = service.getNodeById(nodes, 'non-existent');
      expect(node).toBeNull();
    });
  });

  describe('isParallelWorkflow', () => {
    it('应该识别含并行网关的工作流', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-fork'],
          },
          {
            id: 'node-fork',
            type: WorkflowNodeType.PARALLEL_GATEWAY,
            label: '并行网关',
            position: { x: 200, y: 0 },
            parallelType: 'fork',
            nextNodeIds: [],
          },
        ],
      };

      expect(service.isParallelWorkflow(definition)).toBe(true);
    });

    it('应该识别不含并行网关的线性工作流', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-end'],
          },
          {
            id: 'node-end',
            type: WorkflowNodeType.END,
            label: '结束',
            position: { x: 200, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      expect(service.isParallelWorkflow(definition)).toBe(false);
    });
  });

  describe('hasConditionalBranch', () => {
    it('应该识别含条件节点的工作流', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-condition'],
          },
          {
            id: 'node-condition',
            type: WorkflowNodeType.CONDITION,
            label: '条件判断',
            position: { x: 200, y: 0 },
            conditions: [],
            nextNodeIds: [],
          },
        ],
      };

      expect(service.hasConditionalBranch(definition)).toBe(true);
    });

    it('应该识别不含条件节点的工作流', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      expect(service.hasConditionalBranch(definition)).toBe(false);
    });
  });

  // ==================== 边界情况补充测试（提升分支覆盖率） ====================

  describe('validateWorkflowDefinition - 额外边界情况', () => {
    it('应该拒绝startNodeId对应节点不是START类型的工作流', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-approval',
        nodes: [
          {
            id: 'node-approval',
            type: WorkflowNodeType.APPROVAL, // 不是START类型
            label: '审批',
            position: { x: 0, y: 0 },
            approverRole: '主管',
            nextNodeIds: ['node-end'],
          },
          {
            id: 'node-end',
            type: WorkflowNodeType.END,
            label: '结束',
            position: { x: 200, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      const result = service.validateWorkflowDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('START 类型'))).toBe(true);
    });

    it('应该对空conditions的条件节点产生警告', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-condition'],
          },
          {
            id: 'node-condition',
            type: WorkflowNodeType.CONDITION,
            label: '条件',
            position: { x: 200, y: 0 },
            conditions: [], // 空条件
            nextNodeIds: ['node-end'],
          },
          {
            id: 'node-end',
            type: WorkflowNodeType.END,
            label: '结束',
            position: { x: 400, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      const result = service.validateWorkflowDefinition(definition);
      // 应该有警告（条件为空）
      expect(result.warnings.some(w => w.includes('node-condition'))).toBe(true);
    });

    it('应该拒绝条件节点中引用不存在目标节点的工作流', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-condition'],
          },
          {
            id: 'node-condition',
            type: WorkflowNodeType.CONDITION,
            label: '条件',
            position: { x: 200, y: 0 },
            conditions: [
              {
                field: 'amount',
                operator: 'gt',
                value: 1000,
                label: '大额',
                targetNodeId: 'non-existent-target', // 不存在
              },
            ],
            nextNodeIds: ['node-end'],
          },
          {
            id: 'node-end',
            type: WorkflowNodeType.END,
            label: '结束',
            position: { x: 400, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      const result = service.validateWorkflowDefinition(definition);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.includes('non-existent-target'))
      ).toBe(true);
    });

    it('应该对缺少parallelType的并行网关产生警告', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-gateway'],
          },
          {
            id: 'node-gateway',
            type: WorkflowNodeType.PARALLEL_GATEWAY,
            label: '并行网关',
            position: { x: 200, y: 0 },
            // 没有 parallelType
            nextNodeIds: ['node-end'],
          },
          {
            id: 'node-end',
            type: WorkflowNodeType.END,
            label: '结束',
            position: { x: 400, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      const result = service.validateWorkflowDefinition(definition);
      // 应该有警告
      expect(result.warnings.some(w => w.includes('node-gateway'))).toBe(true);
    });
  });

  describe('convertDefinitionToSteps - 并行分叉无汇聚节点', () => {
    it('当并行分支没有join节点时应该仍然返回并行步骤', () => {
      // 并行fork分支各自直接通往END，没有parallel join节点
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-fork'],
          },
          {
            id: 'node-fork',
            type: WorkflowNodeType.PARALLEL_GATEWAY,
            label: '并行开始',
            position: { x: 200, y: 0 },
            parallelType: 'fork',
            nextNodeIds: ['node-finance', 'node-legal'],
          },
          {
            id: 'node-finance',
            type: WorkflowNodeType.APPROVAL,
            label: '财务审批',
            position: { x: 400, y: -100 },
            approverRole: '财务部',
            parallelGroup: 'pg-nojoin',
            nextNodeIds: ['node-end'], // 直接到 END，无 join 网关
          },
          {
            id: 'node-legal',
            type: WorkflowNodeType.APPROVAL,
            label: '法务审批',
            position: { x: 400, y: 100 },
            approverRole: '法务部',
            parallelGroup: 'pg-nojoin',
            nextNodeIds: ['node-end'], // 直接到 END，无 join 网关
          },
          {
            id: 'node-end',
            type: WorkflowNodeType.END,
            label: '结束',
            position: { x: 600, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      const steps = service.convertDefinitionToSteps(definition);

      // 无论有没有join，并行步骤都应被收集
      expect(steps.length).toBeGreaterThanOrEqual(2);
      const financeStep = steps.find(s => s.approverRole === '财务部');
      const legalStep = steps.find(s => s.approverRole === '法务部');
      expect(financeStep).toBeDefined();
      expect(legalStep).toBeDefined();
    });
  });

  describe('listWorkflowTemplates - 无参数调用', () => {
    it('应该在无参数时返回所有模板', async () => {
      (mockPrisma.approvalTemplate.findMany as jest.Mock).mockResolvedValue([]);

      // 不传参数，使用默认空 filter
      const result = await service.listWorkflowTemplates();

      expect(mockPrisma.approvalTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
      expect(result).toHaveLength(0);
    });
  });

  describe('updateWorkflowTemplate - 更新category和isActive', () => {
    it('应该能更新模板的category和isActive字段', async () => {
      const updatedTemplate = {
        id: 'template-1',
        name: '模板',
        description: null,
        category: '新分类',
        steps: [],
        flowDefinition: null,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.approvalTemplate.update as jest.Mock).mockResolvedValue(
        updatedTemplate
      );

      const result = await service.updateWorkflowTemplate('template-1', {
        category: '新分类',
        isActive: false,
      });

      expect(result.isActive).toBe(false);
      expect(mockPrisma.approvalTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: '新分类',
            isActive: false,
          }),
        })
      );
    });
  });

  describe('convertDefinitionToSteps - APPROVAL节点缺少approverRole', () => {
    it('缺少approverRole的审批节点应使用空字符串', () => {
      const definition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-approval'],
          },
          {
            id: 'node-approval',
            type: WorkflowNodeType.APPROVAL,
            label: '审批（无角色）',
            position: { x: 200, y: 0 },
            // 没有 approverRole
            nextNodeIds: ['node-end'],
          },
          {
            id: 'node-end',
            type: WorkflowNodeType.END,
            label: '结束',
            position: { x: 400, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      // 直接调用转换（跳过验证），验证 ?? '' 的回退逻辑
      const steps = service.convertDefinitionToSteps(definition);

      expect(steps).toHaveLength(1);
      expect(steps[0].approverRole).toBe('');
    });
  });

  describe('updateWorkflowTemplate - 额外测试', () => {
    it('应该能更新包含有效工作流定义的模板', async () => {
      const validDefinition: WorkflowDefinition = {
        startNodeId: 'node-start',
        nodes: [
          {
            id: 'node-start',
            type: WorkflowNodeType.START,
            label: '开始',
            position: { x: 0, y: 0 },
            nextNodeIds: ['node-approval'],
          },
          {
            id: 'node-approval',
            type: WorkflowNodeType.APPROVAL,
            label: '审批',
            position: { x: 200, y: 0 },
            approverRole: '总经理',
            nextNodeIds: ['node-end'],
          },
          {
            id: 'node-end',
            type: WorkflowNodeType.END,
            label: '结束',
            position: { x: 400, y: 0 },
            nextNodeIds: [],
          },
        ],
      };

      const updatedTemplate = {
        id: 'template-1',
        name: '已更新流程',
        description: null,
        category: null,
        steps: [{ stepNumber: 1, approverRole: '总经理', nodeId: 'node-approval' }],
        flowDefinition: validDefinition,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.approvalTemplate.update as jest.Mock).mockResolvedValue(
        updatedTemplate
      );

      const result = await service.updateWorkflowTemplate('template-1', {
        flowDefinition: validDefinition,
      });

      expect(result.flowDefinition).toBeDefined();
      expect(mockPrisma.approvalTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            flowDefinition: expect.anything(),
            steps: expect.any(Array),
          }),
        })
      );
    });
  });
});
