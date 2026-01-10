import { DocAnalyzerAgent } from "../src/lib/agent/doc-analyzer";
import { AIVerificationService } from "../src/lib/ai/ai-verification-service";
import { AgentContext, TaskPriority } from "../src/types/agent";
import {
  Party,
  Claim,
  DocumentAnalysisOutput,
  ClaimType,
} from "../src/lib/agent/doc-analyzer/core/types";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { TestDocument } from "./accuracy-test-data-manager";

// =============================================================================
// 批量准确性测试脚本
// 支持50个测试文档的批量测试和报告生成
// =============================================================================

interface BatchAccuracyMetrics {
  documentId: string;
  caseType: string;
  overallAccuracy: number;
  partiesAccuracy: {
    score: number;
    issues: string[];
    correctCount: number;
    totalCount: number;
    duplicates: Array<{
      name: string;
      occurrences: number;
      roles: string[];
    }>;
  };
  claimsAccuracy: {
    score: number;
    issues: string[];
    correctCount: number;
    totalCount: number;
    missingClaims: string[];
  };
  qualityAssessment: {
    completeness: number;
    consistency: number;
    clarity: number;
  };
  detailedAnalysis: string;
  confidence: number;
  processingTime: number;
}

interface BatchReport {
  testType: string;
  testDate: string;
  totalDocuments: number;
  averageMetrics: {
    overallAccuracy: number;
    partiesAccuracy: number;
    claimsAccuracy: number;
    confidence: number;
    qualityAssessment: {
      completeness: number;
      consistency: number;
      clarity: number;
    };
  };
  byCaseType: Record<
    string,
    {
      count: number;
      avgOverallAccuracy: number;
      avgPartiesAccuracy: number;
      avgClaimsAccuracy: number;
    }
  >;
  individualResults: Array<{
    documentId: string;
    caseType: string;
    overallAccuracy: number;
    partiesAccuracy: number;
    claimsAccuracy: number;
    confidence: number;
    processingTime: number;
    issues: string[];
  }>;
  summary: {
    partiesAccuracyMet: boolean;
    claimsAccuracyMet: boolean;
    overallAccuracyMet: boolean;
    verificationReliable: boolean;
  };
  recommendations: string[];
}

class BatchAccuracyTester {
  private agent: DocAnalyzerAgent;
  private verificationService: AIVerificationService;

  constructor() {
    this.agent = new DocAnalyzerAgent();
    this.verificationService = new AIVerificationService();
  }

  /**
   * 运行批量测试
   */
  async runBatchTest(limit: number = 50): Promise<void> {
    console.log("🚀 开始批量准确性测试...\n");

    // 加载测试数据集
    const testSetFile = join(__dirname, "../test-data/accuracy-test-set.json");
    if (!existsSync(testSetFile)) {
      console.error(
        "❌ 测试数据集不存在，请先运行：npx tsx scripts/accuracy-test-data-manager.ts create",
      );
      return;
    }

    const testSet = JSON.parse(readFileSync(testSetFile, "utf-8"));
    const testDocuments: TestDocument[] = testSet.documents || [];

    const testDocs = testDocuments.slice(0, limit);

    console.log(`📊 测试配置：`);
    console.log(`  总文档数: ${testDocs.length}`);
    console.log(`  案件类型: 民事、刑事、行政、商事、其他\n`);

    const results: BatchAccuracyMetrics[] = [];
    let successCount = 0;
    let failureCount = 0;

    // 对每个文档进行测试
    for (const testDoc of testDocs) {
      console.log(`📄 测试文档: ${testDoc.id} (${testDoc.caseType})`);

      const metrics = await this.testDocument(testDoc);

      if (metrics.overallAccuracy > 0) {
        results.push(metrics);
        successCount++;
        console.log(`  ✅ 准确率: ${metrics.overallAccuracy.toFixed(1)}%`);
      } else {
        failureCount++;
        console.log(`  ❌ 测试失败`);
      }

      console.log("---");
    }

    console.log(`\n📊 测试完成统计：`);
    console.log(`  成功: ${successCount}/${testDocs.length}`);
    console.log(`  失败: ${failureCount}/${testDocs.length}\n`);

    // 生成报告
    await this.generateBatchReport(results);
  }

  /**
   * 测试单个文档
   */
  private async testDocument(
    testDoc: TestDocument,
  ): Promise<BatchAccuracyMetrics> {
    const startTime = Date.now();

    try {
      await this.agent.initialize();

      // 禁用缓存以确保使用最新的提示词逻辑
      this.agent.disableCache();

      const context: AgentContext = {
        task: "document_analysis",
        taskType: "document_parse",
        priority: TaskPriority.HIGH,
        data: {
          documentId: testDoc.id,
          filePath: testDoc.filePath,
          fileType: testDoc.fileType,
          options: {
            extractParties: true,
            extractClaims: true,
            extractTimeline: true,
            generateSummary: true,
          },
        },
        metadata: {
          documentId: testDoc.id,
          fileType: testDoc.fileType,
          timestamp: new Date().toISOString(),
        },
      };

      const analysisResult = await this.agent.execute(context);

      if (!analysisResult.success) {
        throw new Error(analysisResult.error?.message || "分析失败");
      }

      const extractedData = (analysisResult.data as DocumentAnalysisOutput)
        .extractedData;
      const originalText = readFileSync(testDoc.filePath, "utf-8");

      const verificationResult =
        await this.verificationService.verifyExtraction({
          originalText,
          extractedData: {
            parties: extractedData.parties,
            claims: extractedData.claims,
          },
          goldStandard: {
            parties: testDoc.goldStandard.parties as Party[],
            claims: testDoc.goldStandard.claims.map(
              (c) =>
                ({
                  ...c,
                  type: c.type as ClaimType,
                  currency: (c as Claim).currency || "CNY",
                }) as Claim,
            ),
          },
        });

      const processingTime = Date.now() - startTime;

      return {
        documentId: testDoc.id,
        caseType: testDoc.caseType,
        overallAccuracy: verificationResult.overallAccuracy,
        partiesAccuracy: verificationResult.partiesAccuracy,
        claimsAccuracy: verificationResult.claimsAccuracy,
        qualityAssessment: verificationResult.qualityAssessment,
        detailedAnalysis: verificationResult.detailedAnalysis,
        confidence: verificationResult.confidence,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(
        `  ❌ 错误: ${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        documentId: testDoc.id,
        caseType: testDoc.caseType,
        overallAccuracy: 0,
        partiesAccuracy: {
          score: 0,
          issues: ["测试失败"],
          correctCount: 0,
          totalCount: 0,
          duplicates: [],
        },
        claimsAccuracy: {
          score: 0,
          issues: ["测试失败"],
          correctCount: 0,
          totalCount: 0,
          missingClaims: [],
        },
        qualityAssessment: {
          completeness: 0,
          consistency: 0,
          clarity: 0,
        },
        detailedAnalysis: "测试失败",
        confidence: 0,
        processingTime,
      };
    } finally {
      await this.agent.cleanup();
    }
  }

  /**
   * 生成批量测试报告
   */
  private async generateBatchReport(
    results: BatchAccuracyMetrics[],
  ): Promise<void> {
    const avgOverallAccuracy =
      results.reduce((sum, r) => sum + r.overallAccuracy, 0) / results.length;
    const avgPartiesAccuracy =
      results.reduce((sum, r) => sum + r.partiesAccuracy.score, 0) /
      results.length;
    const avgClaimsAccuracy =
      results.reduce((sum, r) => sum + r.claimsAccuracy.score, 0) /
      results.length;
    const avgConfidence =
      results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    const avgCompleteness =
      results.reduce((sum, r) => sum + r.qualityAssessment.completeness, 0) /
      results.length;
    const avgConsistency =
      results.reduce((sum, r) => sum + r.qualityAssessment.consistency, 0) /
      results.length;
    const avgClarity =
      results.reduce((sum, r) => sum + r.qualityAssessment.clarity, 0) /
      results.length;

    // 按案件类型分组统计
    const byCaseType: BatchReport["byCaseType"] = {};
    results.forEach((r) => {
      if (!byCaseType[r.caseType]) {
        byCaseType[r.caseType] = {
          count: 0,
          avgOverallAccuracy: 0,
          avgPartiesAccuracy: 0,
          avgClaimsAccuracy: 0,
        };
      }
      byCaseType[r.caseType].count++;
      byCaseType[r.caseType].avgOverallAccuracy += r.overallAccuracy;
      byCaseType[r.caseType].avgPartiesAccuracy += r.partiesAccuracy.score;
      byCaseType[r.caseType].avgClaimsAccuracy += r.claimsAccuracy.score;
    });

    Object.keys(byCaseType).forEach((caseType) => {
      const stats = byCaseType[caseType];
      stats.avgOverallAccuracy /= stats.count;
      stats.avgPartiesAccuracy /= stats.count;
      stats.avgClaimsAccuracy /= stats.count;
    });

    // 生成建议
    const recommendations = this.generateRecommendations(
      avgOverallAccuracy,
      avgPartiesAccuracy,
      avgClaimsAccuracy,
      byCaseType,
    );

    const report: BatchReport = {
      testType: "PHASE3-ACCURACY-VERIFICATION",
      testDate: new Date().toISOString(),
      totalDocuments: results.length,
      averageMetrics: {
        overallAccuracy: avgOverallAccuracy,
        partiesAccuracy: avgPartiesAccuracy,
        claimsAccuracy: avgClaimsAccuracy,
        confidence: avgConfidence,
        qualityAssessment: {
          completeness: avgCompleteness,
          consistency: avgConsistency,
          clarity: avgClarity,
        },
      },
      byCaseType,
      individualResults: results.map((r) => ({
        documentId: r.documentId,
        caseType: r.caseType,
        overallAccuracy: r.overallAccuracy,
        partiesAccuracy: r.partiesAccuracy.score,
        claimsAccuracy: r.claimsAccuracy.score,
        confidence: r.confidence,
        processingTime: r.processingTime,
        issues: [...r.partiesAccuracy.issues, ...r.claimsAccuracy.issues],
      })),
      summary: {
        partiesAccuracyMet: avgPartiesAccuracy >= 95,
        claimsAccuracyMet: avgClaimsAccuracy >= 95,
        overallAccuracyMet: avgOverallAccuracy >= 95,
        verificationReliable: avgConfidence >= 0.8,
      },
      recommendations,
    };

    // 保存报告
    const reportPath = join(
      __dirname,
      "../test-results/accuracy-batch-report.json",
    );
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log("\n" + "=".repeat(70));
    console.log("🎯 批量准确性测试报告");
    console.log("=".repeat(70));

    console.log("\n📊 总体结果：");
    console.log(`  测试文档数: ${results.length}`);
    console.log(`  综合准确率: ${avgOverallAccuracy.toFixed(2)}%`);
    console.log(
      `  当事人准确率: ${avgPartiesAccuracy.toFixed(2)}% (目标: ≥95%)`,
    );
    console.log(
      `  诉讼请求准确率: ${avgClaimsAccuracy.toFixed(2)}% (目标: ≥95%)`,
    );
    console.log(`  AI验证置信度: ${(avgConfidence * 100).toFixed(2)}%`);

    console.log("\n📈 质量评估：");
    console.log(`  完整性: ${avgCompleteness.toFixed(2)}%`);
    console.log(`  一致性: ${avgConsistency.toFixed(2)}%`);
    console.log(`  清晰度: ${avgClarity.toFixed(2)}%`);

    console.log("\n📋 按案件类型统计：");
    Object.entries(byCaseType).forEach(([caseType, stats]) => {
      console.log(`\n  ${caseType} (${stats.count}个文档)：`);
      console.log(`    综合准确率: ${stats.avgOverallAccuracy.toFixed(2)}%`);
      console.log(`    当事人准确率: ${stats.avgPartiesAccuracy.toFixed(2)}%`);
      console.log(`    诉讼请求准确率: ${stats.avgClaimsAccuracy.toFixed(2)}%`);
    });

    console.log("\n✅ 验收标准：");
    console.log(
      `  当事人信息: ${
        report.summary.partiesAccuracyMet
          ? "✅ 通过 (≥95%)"
          : `❌ 未通过 (${avgPartiesAccuracy.toFixed(2)}%)`
      }`,
    );
    console.log(
      `  诉讼请求: ${
        report.summary.claimsAccuracyMet
          ? "✅ 通过 (≥95%)"
          : `❌ 未通过 (${avgClaimsAccuracy.toFixed(2)}%)`
      }`,
    );
    console.log(
      `  综合评分: ${
        report.summary.overallAccuracyMet
          ? "✅ 通过 (≥95%)"
          : `❌ 未通过 (${avgOverallAccuracy.toFixed(2)}%)`
      }`,
    );
    console.log(
      `  验证可靠性: ${report.summary.verificationReliable ? "✅ 可靠" : "⚠️ 需要复核"}`,
    );

    console.log("\n💡 改进建议：");
    recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });

    console.log(`\n📄 详细报告已保存至: ${reportPath}`);
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(
    overallAccuracy: number,
    partiesAccuracy: number,
    claimsAccuracy: number,
    byCaseType: BatchReport["byCaseType"],
  ): string[] {
    const recommendations: string[] = [];

    if (overallAccuracy >= 95) {
      recommendations.push("🎉 综合准确率已达标（≥95%），文档解析质量优秀");
    } else {
      recommendations.push(
        `⚠️ 综合准确率为${overallAccuracy.toFixed(2)}%，需进一步提升`,
      );
    }

    if (partiesAccuracy < 95) {
      recommendations.push("📌 当事人识别准确率低于目标，建议优化实体识别逻辑");
    }

    if (claimsAccuracy < 95) {
      recommendations.push("📌 诉讼请求提取准确率低于目标，建议改进语义理解");
    }

    // 分析案件类型差异
    const caseTypeAccuracies = Object.entries(byCaseType).map(
      ([caseType, stats]) => ({
        caseType,
        accuracy: stats.avgOverallAccuracy,
      }),
    );

    const maxAccuracy = Math.max(...caseTypeAccuracies.map((c) => c.accuracy));
    const minAccuracy = Math.min(...caseTypeAccuracies.map((c) => c.accuracy));

    if (maxAccuracy - minAccuracy > 10) {
      recommendations.push(
        `📊 不同案件类型间准确率差异较大（${maxAccuracy.toFixed(2)}% vs ${minAccuracy.toFixed(2)}%），建议针对低准确率类型进行优化`,
      );
    }

    recommendations.push("💡 持续监控准确率指标，定期进行准确性验证测试");

    return recommendations;
  }
}

// =============================================================================
// 主执行函数
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const limit = args[0] ? parseInt(args[0]) : 50;

  const tester = new BatchAccuracyTester();

  try {
    console.log("📋 任务6.4.2：准确性提升验证\n");
    console.log("📄 测试配置：");
    console.log(`  测试文档数: ${limit}`);
    console.log(`  目标准确率: ≥95%\n`);

    await tester.runBatchTest(limit);

    console.log("\n✅ 批量准确性测试完成");
  } catch (error) {
    console.error("\n❌ 测试过程中发生错误:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export type { BatchReport, BatchAccuracyMetrics };
export { BatchAccuracyTester };
