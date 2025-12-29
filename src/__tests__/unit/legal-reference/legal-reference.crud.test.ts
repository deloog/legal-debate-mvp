import { PrismaClient, LegalReferenceStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, afterEach } from "@jest/globals";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

describe("Legal Reference CRUD Operations", () => {
  let testRefId: string;
  let testUserId: string;

  beforeEach(async () => {
    // 创建测试用户
    const user = await prisma.user.create({
      data: {
        email: "test-user@example.com",
        username: "testuser",
        name: "Test User",
        role: "USER",
      },
    });
    testUserId = user.id;

    // 清理测试数据
    await prisma.legalReference.deleteMany({
      where: {
        source: {
          contains: "test-",
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
      testRefId = "";
    }

    if (testUserId) {
      await prisma.user.delete({
        where: {
          id: testUserId,
        },
      });
      testUserId = "";
    }
  });

  describe("Basic Legal Reference Creation", () => {
    it("should create a legal reference with basic fields", async () => {
      const refData = {
        source: "《中华人民共和国民法典》",
        content:
          "民事主体从事民事活动，应当遵循自愿、公平、等价有偿、诚实信用的原则。",
        lawType: "民法",
        articleNumber: "第5条",
      };

      const legalRef = await prisma.legalReference.create({
        data: refData,
      });

      testRefId = legalRef.id;

      expect(legalRef.id).toBeDefined();
      expect(legalRef.source).toBe(refData.source);
      expect(legalRef.content).toBe(refData.content);
      expect(legalRef.lawType).toBe(refData.lawType);
      expect(legalRef.articleNumber).toBe(refData.articleNumber);
      expect(legalRef.status).toBe("VALID");
      expect(legalRef.createdAt).toBeDefined();
      expect(legalRef.updatedAt).toBeDefined();
    });

    it("should create a legal reference with retrieval information", async () => {
      const refData = {
        source: "《中华人民共和国合同法》",
        content: "当事人订立合同，应当具有相应的民事权利能力和民事行为能力。",
        lawType: "民法",
        articleNumber: "第9条",
        retrievalQuery: "合同 订立 民事权利",
        relevanceScore: 0.95,
      };

      const legalRef = await prisma.legalReference.create({
        data: refData,
      });

      testRefId = legalRef.id;

      expect(legalRef.retrievalQuery).toBe(refData.retrievalQuery);
      expect(legalRef.relevanceScore).toBe(refData.relevanceScore);
    });

    it("should create a legal reference with applicability analysis", async () => {
      const analysisTime = new Date();
      const refData = {
        source: "《中华人民共和国侵权责任法》",
        content: "行为人因过错侵害他人民事权益，应当承担侵权责任。",
        lawType: "民法",
        articleNumber: "第6条",
        applicabilityScore: 0.88,
        applicabilityReason: "适用于一般侵权纠纷案件",
        analysisResult: {
          keywords: ["侵权", "过错", "民事权益"],
          applicableScenarios: ["人身损害", "财产损害"],
          limitations: ["不适用特殊侵权情形"],
        } as any,
        analyzedBy: "AI-ANALYZER",
        analyzedAt: analysisTime,
      };

      const legalRef = await prisma.legalReference.create({
        data: refData,
      });

      testRefId = legalRef.id;

      expect(legalRef.applicabilityScore).toBe(refData.applicabilityScore);
      expect(legalRef.applicabilityReason).toBe(refData.applicabilityReason);
      expect(legalRef.analysisResult).toEqual(refData.analysisResult);
      expect(legalRef.analyzedBy).toBe(refData.analyzedBy);
      expect(legalRef.analyzedAt).toEqual(analysisTime);
    });
  });

  describe("Cache Management", () => {
    it("should create a legal reference with cache information", async () => {
      const now = new Date();
      const expiryTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24小时后过期

      const refData = {
        source: "《中华人民共和国物权法》",
        content: "国家对不动产实行统一登记制度。",
        lawType: "民法",
        articleNumber: "第9条",
        cacheSource: "local",
        cacheExpiry: expiryTime,
        hitCount: 0,
        lastAccessed: now,
      };

      const legalRef = await prisma.legalReference.create({
        data: refData,
      });

      testRefId = legalRef.id;

      expect(legalRef.cacheSource).toBe(refData.cacheSource);
      expect(legalRef.cacheExpiry).toEqual(expiryTime);
      expect(legalRef.hitCount).toBe(0);
      expect(legalRef.lastAccessed).toEqual(now);
    });

    it("should update cache hit count and last accessed", async () => {
      const legalRef = await prisma.legalReference.create({
        data: {
          source: "《中华人民共和国担保法》",
          content: "担保方式包括保证、抵押、质押、留置和定金。",
          lawType: "民法",
          articleNumber: "第2条",
          hitCount: 5,
        },
      });

      testRefId = legalRef.id;

      expect(legalRef.hitCount).toBe(5);

      // 模拟访问
      const updatedRef = await prisma.legalReference.update({
        where: { id: legalRef.id },
        data: {
          hitCount: { increment: 1 },
          lastAccessed: new Date(),
        },
      });

      expect(updatedRef.hitCount).toBe(6);
      expect(updatedRef.lastAccessed).toBeDefined();
    });
  });

  describe("Classification and Tags", () => {
    it("should create a legal reference with category and tags", async () => {
      const refData = {
        source: "《中华人民共和国公司法》",
        content: "有限责任公司股东会是公司的权力机构，依照本法行使职权。",
        lawType: "商法",
        articleNumber: "第36条",
        category: "公司治理",
        tags: ["股东会", "权力机构", "职权"],
      };

      const legalRef = await prisma.legalReference.create({
        data: refData,
      });

      testRefId = legalRef.id;

      expect(legalRef.category).toBe(refData.category);
      expect(legalRef.tags).toEqual(expect.arrayContaining(refData.tags));
    });
  });

  describe("Version Management", () => {
    it("should create a legal reference with version information", async () => {
      const effectiveDate = new Date("2020-01-01");
      const expiryDate = new Date("2025-01-01");

      const refData = {
        source: "《中华人民共和国民法典》",
        content: "离婚后，不满两周岁的子女，由母亲直接抚养。",
        lawType: "民法",
        articleNumber: "第1084条",
        version: "2020版",
        effectiveDate: effectiveDate,
        expiryDate: expiryDate,
        amendmentHistory: {
          amendments: [
            {
              date: "2020-05-28",
              content: "新增条款关于子女抚养权的规定",
            },
          ],
        } as any,
      };

      const legalRef = await prisma.legalReference.create({
        data: refData,
      });

      testRefId = legalRef.id;

      expect(legalRef.version).toBe(refData.version);
      expect(legalRef.effectiveDate).toEqual(effectiveDate);
      expect(legalRef.expiryDate).toEqual(expiryDate);
      expect(legalRef.amendmentHistory).toEqual(refData.amendmentHistory);
    });
  });

  describe("Status Management", () => {
    it("should create legal reference with specific status", async () => {
      const refData = {
        source: "《中华人民共和国经济合同法》（已废止）",
        content: "本法已由民法典替代。",
        lawType: "商法",
        articleNumber: "第1条",
        status: LegalReferenceStatus.REPEALED,
      };

      const legalRef = await prisma.legalReference.create({
        data: refData,
      });

      testRefId = legalRef.id;

      expect(legalRef.status).toBe("REPEALED");
    });

    it("should update legal reference status", async () => {
      const legalRef = await prisma.legalReference.create({
        data: {
          source: "《中华人民共和国民事诉讼法》",
          content: "人民法院审理民事案件，应当以事实为根据，以法律为准绳。",
          lawType: "诉讼法",
          articleNumber: "第7条",
        },
      });

      testRefId = legalRef.id;

      const updatedRef = await prisma.legalReference.update({
        where: { id: legalRef.id },
        data: { status: LegalReferenceStatus.AMENDED },
      });

      expect(updatedRef.status).toBe("AMENDED");
    });
  });

  describe("Query Operations", () => {
    beforeEach(async () => {
      // 清理所有测试数据
      await prisma.legalReference.deleteMany({});

      // 创建测试数据
      await prisma.legalReference.createMany({
        data: [
          {
            source: "《中华人民共和国宪法》",
            content:
              "中华人民共和国是工人阶级领导的、以工农联盟为基础的人民民主专政的社会主义国家。",
            lawType: "宪法",
            status: LegalReferenceStatus.VALID,
            relevanceScore: 1.0,
          },
          {
            source: "《中华人民共和国刑法》",
            content: "法律明文规定为犯罪行为的，依照法律定罪处刑。",
            lawType: "刑法",
            status: LegalReferenceStatus.VALID,
            relevanceScore: 0.9,
          },
          {
            source: "《中华人民共和国民法通则》（已废止）",
            content: "本法通则已由民法典替代。",
            lawType: "民法",
            status: LegalReferenceStatus.REPEALED,
            relevanceScore: 0.3,
          },
        ],
      });
    });

    afterEach(async () => {
      await prisma.legalReference.deleteMany({
        where: {
          lawType: {
            in: ["宪法", "刑法", "民法"],
          },
        },
      });
    });

    it("should filter legal references by status", async () => {
      const validRefs = await prisma.legalReference.findMany({
        where: { status: LegalReferenceStatus.VALID },
      });

      expect(validRefs).toHaveLength(2);
      expect(validRefs.every((ref) => ref.status === "VALID")).toBe(true);
    });

    it("should filter legal references by law type", async () => {
      const criminalRefs = await prisma.legalReference.findMany({
        where: { lawType: "刑法" },
      });

      expect(criminalRefs).toHaveLength(1);
      expect(criminalRefs[0].lawType).toBe("刑法");
    });

    it("should filter by relevance score", async () => {
      const highRelevanceRefs = await prisma.legalReference.findMany({
        where: {
          relevanceScore: {
            gte: 0.8,
          },
        },
        orderBy: {
          relevanceScore: "desc",
        },
      });

      expect(highRelevanceRefs).toHaveLength(2);
      expect(highRelevanceRefs.every((ref) => ref.relevanceScore! >= 0.8)).toBe(
        true,
      );
    });

    it("should filter by applicability score", async () => {
      await prisma.legalReference.create({
        data: {
          source: "测试法条",
          content: "测试内容",
          lawType: "测试法",
          applicabilityScore: 0.75,
        },
      });

      const highApplicabilityRefs = await prisma.legalReference.findMany({
        where: {
          applicabilityScore: {
            gte: 0.7,
          },
        },
        orderBy: {
          applicabilityScore: "desc",
        },
      });

      expect(highApplicabilityRefs.length).toBeGreaterThanOrEqual(1);
      expect(
        highApplicabilityRefs.every((ref) => ref.applicabilityScore! >= 0.7),
      ).toBe(true);
    });
  });

  describe("Case Association", () => {
    it("should create legal reference associated with case", async () => {
      // 创建测试案件
      const testCase = await prisma.case.create({
        data: {
          userId: testUserId,
          title: "测试案件",
          description: "测试案件描述",
          type: "CIVIL",
        },
      });

      const refData = {
        source: "《中华人民共和国民法典》",
        content: "合同是民事主体之间设立、变更、终止民事法律关系的协议。",
        lawType: "民法",
        articleNumber: "第464条",
        caseId: testCase.id,
      };

      const legalRef = await prisma.legalReference.create({
        data: refData,
      });

      testRefId = legalRef.id;

      expect(legalRef.caseId).toBe(testCase.id);

      // 验证关联关系
      const refWithCase = await prisma.legalReference.findUnique({
        where: { id: legalRef.id },
        include: { case: true },
      });

      expect(refWithCase?.case).toBeDefined();
      expect(refWithCase?.case.id).toBe(testCase.id);
    });
  });
});
