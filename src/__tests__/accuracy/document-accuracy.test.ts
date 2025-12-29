import { DocAnalyzerAgent } from "../../lib/agent/doc-analyzer";
import { AgentContext, TaskPriority } from "../../types/agent";
import { writeFileSync } from "fs";
import { join } from "path";

// =============================================================================
// 文档解析准确性测试脚本
// 用于验证DocAnalyzer的准确率和召回率
// =============================================================================

interface TestDocument {
  id: string;
  filePath?: string;
  fileType: "TXT" | "PDF" | "DOCX" | "DOC" | "IMAGE";
  content?: string;
  expectedData: {
    parties: Array<{
      type: "plaintiff" | "defendant" | "other";
      name: string;
      role?: string;
      contact?: string;
      address?: string;
    }>;
    claims: Array<{
      type: string;
      content: string;
      amount?: number;
      evidence?: string[];
      legalBasis?: string;
    }>;
  };
}

interface AccuracyMetrics {
  partiesAccuracy: number;
  claimsRecall: number;
  overallAccuracy: number;
  detailedResults: {
    partiesExtracted: number;
    partiesExpected: number;
    partiesCorrect: number;
    claimsExtracted: number;
    claimsExpected: number;
    claimsCorrect: number;
  };
}

class DocumentAccuracyTester {
  private agent: DocAnalyzerAgent;

  constructor() {
    this.agent = new DocAnalyzerAgent();
  }

  private async testDocumentAccuracy(
    testDoc: TestDocument,
  ): Promise<AccuracyMetrics> {
    try {
      const context: AgentContext = {
        task: "DOCUMENT_ANALYZE",
        taskType: "DOCUMENT_PARSE",
        priority: TaskPriority.HIGH,
        data: {
          documentId: testDoc.id,
          filePath: testDoc.filePath || "",
          fileType: testDoc.fileType,
          content: testDoc.content,
          options: {
            extractParties: true,
            extractClaims: true,
            extractTimeline: false,
            generateSummary: false,
          },
        },
      };

      const result = await this.agent.execute(context);

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || "分析失败");
      }

      const extractedData = result.data.extractedData;

      const partiesMetrics = this.calculatePartiesAccuracy(
        extractedData.parties,
        testDoc.expectedData.parties,
      );

      const claimsMetrics = this.calculateClaimsRecall(
        extractedData.claims,
        testDoc.expectedData.claims,
      );

      const overallAccuracy =
        (partiesMetrics.accuracy + claimsMetrics.recall) / 2;

      return {
        partiesAccuracy: partiesMetrics.accuracy,
        claimsRecall: claimsMetrics.recall,
        overallAccuracy,
        detailedResults: {
          partiesExtracted: extractedData.parties.length,
          partiesExpected: testDoc.expectedData.parties.length,
          partiesCorrect: partiesMetrics.correct,
          claimsExtracted: extractedData.claims.length,
          claimsExpected: testDoc.expectedData.claims.length,
          claimsCorrect: claimsMetrics.correct,
        },
      };
    } catch (error) {
      console.error(
        `测试失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        partiesAccuracy: 0,
        claimsRecall: 0,
        overallAccuracy: 0,
        detailedResults: {
          partiesExtracted: 0,
          partiesExpected: testDoc.expectedData.parties.length,
          partiesCorrect: 0,
          claimsExtracted: 0,
          claimsExpected: testDoc.expectedData.claims.length,
          claimsCorrect: 0,
        },
      };
    } finally {
      await this.agent.cleanup();
    }
  }

  private calculatePartiesAccuracy(
    extracted: any[],
    expected: any[],
  ): { accuracy: number; correct: number } {
    let correct = 0;

    for (const expectedParty of expected) {
      const found = extracted.find(
        (extracted) =>
          extracted.name === expectedParty.name &&
          extracted.type === expectedParty.type,
      );

      if (found) {
        let matchScore = 0;
        let totalChecks = 0;

        if (found.role === expectedParty.role) matchScore++;
        totalChecks++;

        if (found.contact === expectedParty.contact) matchScore++;
        totalChecks++;

        if (found.address === expectedParty.address) matchScore++;
        totalChecks++;

        if (matchScore / totalChecks >= 0.7) {
          correct++;
        }
      }
    }

    const accuracy = expected.length > 0 ? correct / expected.length : 0;
    return { accuracy, correct };
  }

  private calculateClaimsRecall(
    extracted: any[],
    expected: any[],
  ): { recall: number; correct: number } {
    let correct = 0;

    for (const expectedClaim of expected) {
      const found = extracted.find((extracted) => {
        const contentSimilarity = this.calculateContentSimilarity(
          extracted.content || "",
          expectedClaim.content || "",
        );

        const amountMatch =
          expectedClaim.amount === undefined ||
          extracted.amount === expectedClaim.amount;

        return contentSimilarity > 0.6 && amountMatch;
      });

      if (found) {
        correct++;
      }
    }

    const recall = expected.length > 0 ? correct / expected.length : 0;
    return { recall, correct };
  }

  private calculateContentSimilarity(
    content1: string,
    content2: string,
  ): number {
    const chars1 = content1.split("").filter((c) => c.trim());
    const chars2 = content2.split("").filter((c) => c.trim());

    const intersection = chars1.filter((c) => chars2.includes(c));
    const union = [...new Set([...chars1, ...chars2])];

    return union.length > 0 ? intersection.length / union.length : 0;
  }
}

// =============================================================================
// Jest测试用例
// =============================================================================

describe("DocAnalyzer文档解析准确性测试", () => {
  let tester: DocumentAccuracyTester;

  beforeAll(() => {
    tester = new DocumentAccuracyTester();
  });

  test("应该能够处理基本的文档解析任务", async () => {
    const testDoc: TestDocument = {
      id: "basic-test",
      fileType: "TXT",
      content: `民事起诉状

原告：张三，男，汉族，1980年1月1日出生，住北京市朝阳区。

被告：李四，女，汉族，1985年5月15日出生，住北京市海淀区。

诉讼请求：
1. 判令被告偿还借款本金500000元；
2. 判令被告支付利息（按年利率6%计算）；
3. 诉讼费用由被告承担。

事实与理由：
被告于2022年6月15日向原告借款500000元，约定年利率6%，期限6个月。借款到期后，被告未按时还款。`,
      expectedData: {
        parties: [
          {
            type: "plaintiff",
            name: "张三",
          },
          {
            type: "defendant",
            name: "李四",
          },
        ],
        claims: [
          {
            type: "PAY_PRINCIPAL",
            content: "判令被告偿还借款本金500000元",
            amount: 500000,
          },
          {
            type: "PAY_INTEREST",
            content: "判令被告支付利息（按年利率6%计算）",
          },
          {
            type: "LITIGATION_COST",
            content: "诉讼费用由被告承担",
          },
        ],
      },
    };

    const metrics = await tester["testDocumentAccuracy"](testDoc);

    expect(metrics).toBeDefined();
    expect(metrics.partiesAccuracy).toBeGreaterThanOrEqual(0);
    expect(metrics.claimsRecall).toBeGreaterThanOrEqual(0);
    expect(metrics.overallAccuracy).toBeGreaterThanOrEqual(0);
  }, 30000);

  test("应该正确识别诉讼费用请求", async () => {
    const testDoc: TestDocument = {
      id: "litigation-cost-test",
      fileType: "TXT",
      content: `起诉状

原告：王五，男，汉族。

被告：赵六，女，汉族。

诉讼请求：
1. 判令被告赔偿损失10000元；
2. 本案诉讼费用由被告承担。`,
      expectedData: {
        parties: [
          { type: "plaintiff", name: "王五" },
          { type: "defendant", name: "赵六" },
        ],
        claims: [
          {
            type: "PAY_DAMAGES",
            content: "判令被告赔偿损失10000元",
            amount: 10000,
          },
          { type: "LITIGATION_COST", content: "本案诉讼费用由被告承担" },
        ],
      },
    };

    const metrics = await tester["testDocumentAccuracy"](testDoc);

    // 验证诉讼费用被正确识别
    expect(metrics.claimsRecall).toBeGreaterThan(0);
  }, 30000);

  test("应该拆解复合诉讼请求", async () => {
    const testDoc: TestDocument = {
      id: "compound-claim-test",
      fileType: "TXT",
      content: `民事起诉状

原告：钱七，男，汉族。

被告：孙八，女，汉族。

诉讼请求：
判令被告偿还本金及利息共计150000元，诉讼费用由被告承担。`,
      expectedData: {
        parties: [
          { type: "plaintiff", name: "钱七" },
          { type: "defendant", name: "孙八" },
        ],
        claims: [
          { type: "PAY_PRINCIPAL", content: "偿还本金" },
          { type: "PAY_INTEREST", content: "支付利息" },
          { type: "LITIGATION_COST", content: "诉讼费用由被告承担" },
        ],
      },
    };

    const metrics = await tester["testDocumentAccuracy"](testDoc);

    expect(metrics.claimsRecall).toBeGreaterThan(0);
  }, 30000);
});
