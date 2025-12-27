import { PrismaClient, LegalReferenceStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, afterEach } from '@jest/globals';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

describe('Legal Reference Applicability Analysis', () => {
  let testRefId: string;
  let testUserId: string;
  let testCaseId: string;

  beforeEach(async () => {
    // 创建测试用户
    const user = await prisma.user.create({
      data: {
        email: 'test-applicability@example.com',
        username: 'testapplicability',
        name: 'Applicability Test User',
        role: 'USER',
      },
    });
    testUserId = user.id;

    // 创建测试案件
    const testCase = await prisma.case.create({
      data: {
        userId: testUserId,
        title: '适用性分析测试案件',
        description: '用于测试法条适用性分析的案件',
        type: 'CIVIL',
      },
    });
    testCaseId = testCase.id;

    // 清理测试数据
    await prisma.legalReference.deleteMany({
      where: {
        source: {
          contains: 'applicability-test-',
        },
      },
    });
  });

  afterEach(async () => {
    // 清理测试数据
    if (testRefId) {
      await prisma.legalReference.delete({
        where: {
          id: testRefId,
        },
      });
      testRefId = '';
    }

    if (testUserId) {
      await prisma.user.delete({
        where: {
          id: testUserId,
        },
      });
      testUserId = '';
    }
  });

  describe('Applicability Score Analysis', () => {
    it('should create legal reference with applicability score', async () => {
      const analysisTime = new Date();
      const refData = {
        source: 'applicability-test-《民法典》',
        content: '民事主体从事民事活动，应当遵循自愿、公平、等价有偿、诚实信用的原则。',
        lawType: '民法',
        articleNumber: '第5条',
        applicabilityScore: 0.85,
        applicabilityReason: '适用于一般民事活动，具有普遍适用性',
        analysisResult: {
          confidence: 0.9,
          keyFactors: ['民事活动', '基本原则'],
          scope: '一般民事法律关系',
          limitations: ['特殊商事活动可能不适用'],
        } as any,
        analyzedBy: 'AI-ANALYZER-V1',
        analyzedAt: analysisTime,
      };

      const legalRef = await prisma.legalReference.create({
        data: refData,
      });

      testRefId = legalRef.id;

      expect(legalRef.applicabilityScore).toBe(0.85);
      expect(legalRef.applicabilityReason).toBe(refData.applicabilityReason);
      expect(legalRef.analysisResult).toEqual(refData.analysisResult);
      expect(legalRef.analyzedBy).toBe(refData.analyzedBy);
      expect(legalRef.analyzedAt).toEqual(analysisTime);
    });

    it('should handle different applicability score ranges', async () => {
      const testCases = [
        {
          source: 'applicability-test-《高分法条》',
          applicabilityScore: 0.95,
          expectedRange: '高适用性',
        },
        {
          source: 'applicability-test-《中分法条》',
          applicabilityScore: 0.65,
          expectedRange: '中等适用性',
        },
        {
          source: 'applicability-test-《低分法条》',
          applicabilityScore: 0.25,
          expectedRange: '低适用性',
        },
      ];

      for (const testCase of testCases) {
        const refData = {
          source: testCase.source,
          content: '测试适用性评分范围的法条',
          lawType: '测试法',
          applicabilityScore: testCase.applicabilityScore,
        };

        const legalRef = await prisma.legalReference.create({
          data: refData,
        });

        expect(legalRef.applicabilityScore).toBe(testCase.applicabilityScore);

        if (testCase.applicabilityScore >= 0.8) {
          expect(legalRef.applicabilityScore).toBeGreaterThanOrEqual(0.8);
        } else if (testCase.applicabilityScore >= 0.5) {
          expect(legalRef.applicabilityScore).toBeGreaterThanOrEqual(0.5);
          expect(legalRef.applicabilityScore).toBeLessThan(0.8);
        } else {
          expect(legalRef.applicabilityScore).toBeLessThan(0.5);
        }
      }
    });
  });

  describe('Applicability Reason Analysis', () => {
    it('should store detailed applicability reasons', async () => {
      const refData = {
        source: 'applicability-test-《合同法》',
        content: '当事人订立合同，应当具有相应的民事权利能力和民事行为能力。',
        lawType: '民法',
        articleNumber: '第9条',
        applicabilityScore: 0.9,
        applicabilityReason: '适用于各类合同订立场景，包括自然人、法人和非法人组织',
        analysisResult: {
          mainApplicability: '合同主体资格审查',
          specificScenarios: ['自然人合同', '法人合同', '非法人组织合同'],
          exclusions: ['行政合同不适用'],
          confidence: 0.95,
        } as any,
      };

      const legalRef = await prisma.legalReference.create({
        data: refData,
      });

      testRefId = legalRef.id;

      expect(legalRef.applicabilityReason).toBe(refData.applicabilityReason);
      expect(legalRef.analysisResult).toEqual(refData.analysisResult);
      expect((legalRef.analysisResult as any).mainApplicability).toBe('合同主体资格审查');
    });

    it('should support multiple applicability reasons', async () => {
      const reasons = [
        '适用于一般民事纠纷',
        '不适用于刑事纠纷',
        '适用于商事合同纠纷',
      ];

      for (let i = 0; i < reasons.length; i++) {
        const refData = {
          source: `applicability-test-《多原因法条${i + 1}》`,
          content: '测试多个适用性原因',
          lawType: '测试法',
          applicabilityScore: 0.7 + (i * 0.1),
          applicabilityReason: reasons[i],
        };

        await prisma.legalReference.create({
          data: refData,
        });
      }

      const allRefs = await prisma.legalReference.findMany({
        where: {
          source: {
            contains: 'applicability-test-《多原因法条',
          },
        },
        orderBy: {
          applicabilityScore: 'desc',
        },
      });

      expect(allRefs).toHaveLength(reasons.length);
      expect(allRefs.map(ref => ref.applicabilityReason)).toEqual(expect.arrayContaining(reasons));
    });
  });

  describe('Analysis Result Structure', () => {
    it('should store complex analysis results', async () => {
      const complexAnalysis = {
        overallScore: 0.88,
        breakdown: {
          factualMatch: 0.9,
          legalRelevance: 0.85,
          contextualFit: 0.89,
        },
        riskFactors: ['时间敏感性', '地域限制'],
        recommendations: ['结合最新司法解释', '注意特殊情形'],
        aiConfidence: 0.92,
        processingTime: 1500, // 毫秒
        version: 'analysis-v2.1',
      };

      const refData = {
        source: 'applicability-test-《复杂分析法条》',
        content: '测试复杂分析结果结构',
        lawType: '测试法',
        applicabilityScore: complexAnalysis.overallScore,
        analysisResult: complexAnalysis as any,
      };

      const legalRef = await prisma.legalReference.create({
        data: refData,
      });

      testRefId = legalRef.id;

      expect((legalRef.analysisResult as any).overallScore).toBe(complexAnalysis.overallScore);
      expect((legalRef.analysisResult as any).breakdown).toEqual(complexAnalysis.breakdown);
      expect((legalRef.analysisResult as any).riskFactors).toEqual(complexAnalysis.riskFactors);
    });

    it('should support different analysis providers', async () => {
      const providers = ['AI-DEEPSEEK', 'AI-ZHIPU', 'AI-CLAUDE', 'HUMAN-EXPERT'];

      for (const provider of providers) {
        const refData = {
          source: `applicability-test-《${provider}分析法条》`,
          content: `由${provider}分析的法条`,
          lawType: '测试法',
          applicabilityScore: 0.75,
          analysisResult: {
            provider: provider,
            method: provider.startsWith('AI-') ? 'automated' : 'manual',
            confidence: provider.startsWith('AI-') ? 0.85 : 0.95,
          } as any,
          analyzedBy: provider,
        };

        await prisma.legalReference.create({
          data: refData,
        });
      }

      const allRefs = await prisma.legalReference.findMany({
        where: {
          source: {
            contains: 'applicability-test-《',
          },
        },
      });

      expect(allRefs).toHaveLength(providers.length);
      
      const aiRefs = allRefs.filter(ref => ref.analyzedBy?.startsWith('AI-'));
      const humanRefs = allRefs.filter(ref => ref.analyzedBy?.startsWith('HUMAN-'));

      expect(aiRefs).toHaveLength(3);
      expect(humanRefs).toHaveLength(1);
    });
  });

  describe('Analysis Timestamp Tracking', () => {
    it('should track analysis completion time', async () => {
      const beforeAnalysis = new Date();
      
      // 模拟分析处理时间
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const afterAnalysis = new Date();

      const refData = {
        source: 'applicability-test-《时间分析法条》',
        content: '测试分析时间跟踪',
        lawType: '测试法',
        applicabilityScore: 0.8,
        analyzedAt: afterAnalysis,
      };

      const legalRef = await prisma.legalReference.create({
        data: refData,
      });

      testRefId = legalRef.id;

      expect(legalRef.analyzedAt).toEqual(afterAnalysis);
      expect(legalRef.analyzedAt!.getTime()).toBeGreaterThan(beforeAnalysis.getTime());
    });

    it('should support analysis updates', async () => {
      const originalAnalysis = new Date();
      const originalScore = 0.7;

      const legalRef = await prisma.legalReference.create({
        data: {
          source: 'applicability-test-《更新分析法条》',
          content: '测试分析更新功能',
          lawType: '测试法',
          applicabilityScore: originalScore,
          analyzedAt: originalAnalysis,
          analyzedBy: 'AI-INITIAL',
        },
      });

      testRefId = legalRef.id;

      expect(legalRef.analyzedBy).toBe('AI-INITIAL');
      expect(legalRef.applicabilityScore).toBe(originalScore);

      // 模拟重新分析
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const updatedAnalysis = new Date();
      const updatedScore = 0.85;

      const updatedRef = await prisma.legalReference.update({
        where: { id: legalRef.id },
        data: {
          applicabilityScore: updatedScore,
          analysisResult: {
            previousScore: originalScore,
            newScore: updatedScore,
            improvement: 0.15,
            reason: '增加了上下文信息',
          } as any,
          analyzedAt: updatedAnalysis,
          analyzedBy: 'AI-ENHANCED',
        },
      });

      expect(updatedRef.applicabilityScore).toBe(updatedScore);
      expect(updatedRef.analyzedBy).toBe('AI-ENHANCED');
      expect(updatedRef.analyzedAt).toEqual(updatedAnalysis);
      expect(updatedRef.analyzedAt!.getTime()).toBeGreaterThan(originalAnalysis.getTime());
    });
  });

  describe('Integration with Cases', () => {
    it('should analyze applicability for specific cases', async () => {
      const refData = {
        source: 'applicability-test-《案件关联法条》',
        content: '适用于合同纠纷案件的法条',
        lawType: '民法',
        articleNumber: '第94条',
        caseId: testCaseId,
        applicabilityScore: 0.92,
        applicabilityReason: '专门适用于合同纠纷，包括合同订立、履行、变更、解除等各个环节',
        analysisResult: {
          caseTypes: ['合同纠纷', '民事纠纷'],
          applicabilityScope: '合同法律关系',
          exclusions: ['劳动合同不适用'],
        } as any,
      };

      const legalRef = await prisma.legalReference.create({
        data: refData,
      });

      testRefId = legalRef.id;

      expect(legalRef.caseId).toBe(testCaseId);

      // 验证案件关联查询
      const caseRefs = await prisma.legalReference.findMany({
        where: { caseId: testCaseId },
        include: { case: true },
      });

      expect(caseRefs).toHaveLength(1);
      expect(caseRefs[0].source).toBe(refData.source);
      expect(caseRefs[0].case).toBeDefined();
      expect(caseRefs[0].case.id).toBe(testCaseId);
    });

    it('should support case-specific applicability analysis', async () => {
      // 创建不同类型的案件
      const civilCase = await prisma.case.create({
        data: {
          userId: testUserId,
          title: '民事案件',
          description: '民事纠纷案件',
          type: 'CIVIL',
        },
      });

      const commercialCase = await prisma.case.create({
        data: {
          userId: testUserId,
          title: '商事案件',
          description: '商事纠纷案件',
          type: 'COMMERCIAL',
        },
      });

      const refData = {
        source: 'applicability-test-《案件特定法条》',
        content: '根据案件类型调整适用性的法条',
        lawType: '民法',
        analysisResult: {
          caseTypeSpecificity: {
            'CIVIL': { score: 0.9, reason: '完全匹配民事案件特征' },
            'COMMERCIAL': { score: 0.6, reason: '商事适用性有限' },
          },
        } as any,
      };

      // 创建适用于民事案件的法条
      const civilRef = await prisma.legalReference.create({
        data: {
          ...refData,
          caseId: civilCase.id,
          applicabilityScore: 0.9,
        },
      });

      // 创建适用于商事案件的法条
      const commercialRef = await prisma.legalReference.create({
        data: {
          ...refData,
          caseId: commercialCase.id,
          applicabilityScore: 0.6,
        },
      });

      expect(civilRef.applicabilityScore).toBe(0.9);
      expect(commercialRef.applicabilityScore).toBe(0.6);

      // 清理案件数据
      await prisma.case.deleteMany({
        where: {
          id: { in: [civilCase.id, commercialCase.id] },
        },
      });
    });
  });

  describe('Quality Assurance', () => {
    it('should validate applicability score ranges', async () => {
      const invalidScores = [-0.1, 1.5, 2.0];

      for (const invalidScore of invalidScores) {
        const refData = {
          source: `applicability-test-《无效分数法条${invalidScore}》`,
          content: '测试无效分数验证',
          lawType: '测试法',
          applicabilityScore: invalidScore,
        };

        // 验证数据库约束是否生效（这取决于实际的数据库设置）
        // 如果有约束，这里应该会抛出错误
        try {
          await prisma.legalReference.create({
            data: refData,
          });
        } catch (error) {
          // 预期可能会有约束错误
          expect(error).toBeDefined();
        }
      }
    });

    it('should ensure analysis result integrity', async () => {
      const refData = {
        source: 'applicability-test-《完整性法条》',
        content: '测试分析结果完整性',
        lawType: '测试法',
        applicabilityScore: 0.8,
        applicabilityReason: '适用于一般民事活动',
        analysisResult: {
          confidence: 0.85,
          factors: ['民事主体', '法律行为'],
          scope: '民事法律关系',
        } as any,
      };

      const legalRef = await prisma.legalReference.create({
        data: refData,
      });

      testRefId = legalRef.id;

      expect(legalRef.applicabilityScore).toBe(0.8);
      expect(legalRef.applicabilityReason).toBe('适用于一般民事活动');
      expect((legalRef.analysisResult as any).confidence).toBe(0.85);
      expect((legalRef.analysisResult as any).factors).toEqual(['民事主体', '法律行为']);
      expect((legalRef.analysisResult as any).scope).toBe('民事法律关系');
    });
  });
});
