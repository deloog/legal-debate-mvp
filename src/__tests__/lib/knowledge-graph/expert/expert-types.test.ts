import {
  ExpertiseArea,
  ExpertContributions,
  ExpertAccuracyRate,
  AccuracyLevel,
  ExpertDetail,
  CreateExpertApplicationInput,
  UpdateExpertInput,
  ExpertApplicationStatus,
  CertifyExpertRequest,
  PromoteExpertRequest,
  ExpertQueryParams,
  ExpertStats,
} from '@/lib/knowledge-graph/expert/types';

describe('Expert Types', () => {
  describe('ExpertiseArea', () => {
    it('应该包含所有预定义的专业领域', () => {
      const validAreas: ExpertiseArea[] = [
        '民事',
        '刑事',
        '劳动法',
        '合同法',
        '公司法',
        '知识产权',
        '行政法',
        '经济法',
        '刑法',
        '商法',
        '民事诉讼法',
        '刑事诉讼法',
        '行政诉讼法',
        '其他',
      ];
      
      expect(validAreas).toHaveLength(14);
    });

    it('应该包含法律体系的核心领域', () => {
      const coreAreas: ExpertiseArea[] = ['民事', '刑事', '行政法'];
      expect(coreAreas).toBeDefined();
    });
  });

  describe('ExpertContributions', () => {
    it('应该正确构建贡献统计', () => {
      const contributions: ExpertContributions = {
        added: 100,
        verified: 80,
        accurateFeedbacks: 70,
        inaccurateFeedbacks: 10,
        total: 100,
      };

      expect(contributions.added).toBe(100);
      expect(contributions.verified).toBe(80);
      expect(contributions.accurateFeedbacks).toBe(70);
      expect(contributions.inaccurateFeedbacks).toBe(10);
      expect(contributions.total).toBe(100);
    });

    it('应该允许部分字段为可选', () => {
      const contributions: Partial<ExpertContributions> = {
        added: 50,
        verified: 30,
      };

      expect(contributions.added).toBe(50);
      expect(contributions.verified).toBe(30);
    });
  });

  describe('ExpertAccuracyRate', () => {
    it('应该正确构建准确率结果', () => {
      const accuracyRate: ExpertAccuracyRate = {
        userId: 'user-1',
        totalVerified: 100,
        correctCount: 85,
        accuracyRate: 0.85,
        confidenceLevel: 'HIGH',
        lastUpdated: new Date(),
      };

      expect(accuracyRate.accuracyRate).toBe(0.85);
      expect(accuracyRate.confidenceLevel).toBe('HIGH');
      expect(accuracyRate.lastUpdated).toBeInstanceOf(Date);
      expect(accuracyRate.totalVerified).toBe(100);
    });

    it('应该支持所有置信度等级', () => {
      const levels: ExpertAccuracyRate['confidenceLevel'][] = [
        'LOW',
        'MEDIUM',
        'HIGH',
      ];

      expect(levels).toHaveLength(3);
    });

    it('应该处理未验证的情况', () => {
      const accuracyRate: ExpertAccuracyRate = {
        userId: 'user-2',
        totalVerified: 0,
        correctCount: 0,
        accuracyRate: 0,
        confidenceLevel: 'LOW',
        lastUpdated: new Date(),
      };

      expect(accuracyRate.totalVerified).toBe(0);
      expect(accuracyRate.accuracyRate).toBe(0);
      expect(accuracyRate.confidenceLevel).toBe('LOW');
    });
  });

  describe('ExpertDetail', () => {
    it('应该正确构建专家详情', () => {
      const detail: ExpertDetail = {
        id: 'expert-1',
        userId: 'user-1',
        username: '张律师',
        email: 'zhang@example.com',
        expertiseAreas: ['民事', '刑法'],
        expertLevel: 'SENIOR',
        relationsAdded: 150,
        relationsVerified: 120,
        accuracyRate: 0.88,
        certifiedBy: 'admin-1',
        certifiedAt: new Date(),
        notes: '认证通过',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(detail.id).toBe('expert-1');
      expect(detail.expertiseAreas).toContain('民事');
      expect(detail.accuracyRate).toBe(0.88);
    });

    it('应该允许认证信息为空', () => {
      const detail: ExpertDetail = {
        id: 'expert-2',
        userId: 'user-2',
        username: '李律师',
        email: 'li@example.com',
        expertiseAreas: ['劳动法'],
        expertLevel: 'JUNIOR',
        relationsAdded: 50,
        relationsVerified: 30,
        accuracyRate: null,
        certifiedBy: null,
        certifiedAt: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(detail.certifiedBy).toBeNull();
      expect(detail.certifiedAt).toBeNull();
      expect(detail.accuracyRate).toBeNull();
    });
  });

  describe('CreateExpertApplicationInput', () => {
    it('应该正确构建专家申请', () => {
      const input: CreateExpertApplicationInput = {
        userId: 'user-1',
        expertiseAreas: ['民事', '合同法'],
        expertLevel: 'JUNIOR',
        notes: '申请成为专家',
      };

      expect(input.userId).toBe('user-1');
      expect(input.expertiseAreas).toHaveLength(2);
      expect(input.notes).toBe('申请成为专家');
    });

    it('应该允许expertLevel为可选', () => {
      const input: CreateExpertApplicationInput = {
        userId: 'user-1',
        expertiseAreas: ['刑事'],
      };

      expect(input.expertLevel).toBeUndefined();
    });
  });

  describe('UpdateExpertInput', () => {
    it('应该正确构建更新请求', () => {
      const input: UpdateExpertInput = {
        expertiseAreas: ['行政法', '公司法'],
        expertLevel: 'SENIOR',
        notes: '更新信息',
      };

      expect(input.expertiseAreas).toHaveLength(2);
      expect(input.expertLevel).toBe('SENIOR');
    });

    it('应该允许所有字段为可选', () => {
      const input: UpdateExpertInput = {};

      expect(Object.keys(input)).toHaveLength(0);
    });

    it('应该允许只更新部分字段', () => {
      const input: UpdateExpertInput = {
        notes: '只更新备注',
      };

      expect(input.notes).toBe('只更新备注');
      expect(input.expertiseAreas).toBeUndefined();
    });
  });

  describe('ExpertApplicationStatus', () => {
    it('应该正确构建申请状态', () => {
      const status: ExpertApplicationStatus = {
        userId: 'user-1',
        status: 'PENDING',
        createdAt: new Date(),
      };

      expect(status.userId).toBe('user-1');
      expect(status.status).toBe('PENDING');
    });

    it('应该支持所有申请状态', () => {
      const statuses: ExpertApplicationStatus['status'][] = [
        'PENDING',
        'APPROVED',
        'REJECTED',
      ];

      expect(statuses).toHaveLength(3);
    });

    it('应该支持审核详情', () => {
      const status: ExpertApplicationStatus = {
        userId: 'user-1',
        status: 'REJECTED',
        createdAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: 'admin-1',
        rejectionReason: '资料不全',
      };

      expect(status.reviewedBy).toBe('admin-1');
      expect(status.rejectionReason).toBe('资料不全');
    });
  });

  describe('CertifyExpertRequest', () => {
    it('应该正确构建认证请求', () => {
      const request: CertifyExpertRequest = {
        expertId: 'expert-1',
        adminId: 'admin-1',
        notes: '认证通过',
      };

      expect(request.expertId).toBe('expert-1');
      expect(request.adminId).toBe('admin-1');
      expect(request.notes).toBe('认证通过');
    });

    it('应该允许notes为可选', () => {
      const request: CertifyExpertRequest = {
        expertId: 'expert-1',
        adminId: 'admin-1',
      };

      expect(request.notes).toBeUndefined();
    });
  });

  describe('PromoteExpertRequest', () => {
    it('应该正确构建升级请求', () => {
      const request: PromoteExpertRequest = {
        expertId: 'expert-1',
        newLevel: 'MASTER',
        reason: '准确率和贡献量达到晋升标准',
      };

      expect(request.expertId).toBe('expert-1');
      expect(request.newLevel).toBe('MASTER');
      expect(request.reason).toContain('晋升标准');
    });

    it('应该支持所有等级', () => {
      const levels: PromoteExpertRequest['newLevel'][] = [
        'JUNIOR',
        'SENIOR',
        'MASTER',
      ];

      expect(levels).toHaveLength(3);
    });
  });

  describe('ExpertQueryParams', () => {
    it('应该正确构建查询参数', () => {
      const params: ExpertQueryParams = {
        expertiseArea: '民事',
        expertLevel: 'SENIOR',
        minAccuracyRate: 0.8,
        sortBy: 'accuracyRate',
        order: 'desc',
        limit: 20,
        offset: 0,
      };

      expect(params.expertiseArea).toBe('民事');
      expect(params.minAccuracyRate).toBe(0.8);
      expect(params.limit).toBe(20);
    });

    it('应该允许所有参数为可选', () => {
      const params: ExpertQueryParams = {};

      expect(Object.keys(params)).toHaveLength(0);
    });

    it('应该支持不同的排序选项', () => {
      const sortOptions: ExpertQueryParams['sortBy'][] = [
        'accuracyRate',
        'contributions',
        'createdAt',
      ];

      expect(sortOptions).toHaveLength(3);
    });
  });

  describe('ExpertStats', () => {
    it('应该正确构建统计信息', () => {
      const stats: ExpertStats = {
        totalExperts: 100,
        byLevel: {
          JUNIOR: 50,
          SENIOR: 35,
          MASTER: 15,
        },
        averageAccuracyRate: 0.82,
        topContributors: [],
      };

      expect(stats.totalExperts).toBe(100);
      expect(stats.byLevel['JUNIOR']).toBe(50);
      expect(stats.averageAccuracyRate).toBe(0.82);
    });

    it('应该允许topContributors为空数组', () => {
      const stats: ExpertStats = {
        totalExperts: 10,
        byLevel: { JUNIOR: 10 },
        averageAccuracyRate: 0.75,
        topContributors: [],
      };

      expect(stats.topContributors).toHaveLength(0);
    });
  });
});
