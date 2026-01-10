import { DocAnalyzerAgent } from "../src/lib/agent/doc-analyzer";
import { AgentContext, TaskPriority } from "../src/types/agent";
import {
  DocumentAnalysisOutput,
  Party,
  Claim,
} from "../src/lib/agent/doc-analyzer/core/types";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  console.log("🔍 诊断准确率问题\n");

  const agent = new DocAnalyzerAgent();
  await agent.initialize();
  agent.forceUseRealAI();
  agent.disableCache();

  // 加载测试数据集
  const testSetFile = join(__dirname, "../test-data/accuracy-test-set.json");
  const testSet = JSON.parse(readFileSync(testSetFile, "utf-8"));
  const testDocs = testSet.documents.slice(0, 3);

  for (const testDoc of testDocs) {
    console.log("\n" + "=".repeat(70));
    console.log(`📄 测试文档: ${testDoc.id} (${testDoc.caseType})`);
    console.log("=".repeat(70));

    const context: AgentContext = {
      task: "document_analysis",
      taskType: "document_parse",
      priority: TaskPriority.HIGH,
      data: {
        documentId: testDoc.id,
        filePath: testDoc.filePath,
        fileType: testDoc.fileType,
      },
      metadata: {
        documentId: testDoc.id,
        fileType: testDoc.fileType,
        timestamp: new Date().toISOString(),
      },
    };

    const result = await agent.execute(context);

    if (result.success) {
      const extractedData = (result.data as DocumentAnalysisOutput)
        .extractedData;
      const goldStandard = testDoc.goldStandard;

      console.log("\n📊 提取结果对比：");
      console.log("\n👥 当事人信息：");
      console.log("  提取数量:", extractedData.parties?.length || 0);
      console.log("  黄金标准:", goldStandard.parties?.length || 0);

      if (extractedData.parties?.length > 0) {
        console.log("\n  提取的当事人：");
        extractedData.parties.forEach((p: Party, i: number) => {
          console.log(
            `    ${i + 1}. ${p.name} (${p.type}) - ${p.role || "无角色"}`,
          );
        });
      }

      if (goldStandard.parties?.length > 0) {
        console.log("\n  黄金标准：");
        goldStandard.parties.forEach((p: Party, i: number) => {
          console.log(
            `    ${i + 1}. ${p.name} (${p.type}) - ${p.role || "无角色"}`,
          );
        });
      }

      console.log("\n⚖️  诉讼请求：");
      console.log("  提取数量:", extractedData.claims?.length || 0);
      console.log("  黄金标准:", goldStandard.claims?.length || 0);

      if (extractedData.claims?.length > 0) {
        console.log("\n  提取的诉讼请求：");
        extractedData.claims.forEach((c: Claim, i: number) => {
          console.log(
            `    ${i + 1}. [${c.type}] ${c.content} ${c.amount ? `(${c.amount}元)` : ""}`,
          );
        });
      }

      if (goldStandard.claims?.length > 0) {
        console.log("\n  黄金标准：");
        goldStandard.claims.forEach((c: Claim, i: number) => {
          console.log(
            `    ${i + 1}. [${c.type}] ${c.content} ${c.amount ? `(${c.amount}元)` : ""}`,
          );
        });
      }

      console.log("\n🔍 详细分析：");
      console.log(
        "  置信度:",
        (result.data as DocumentAnalysisOutput)?.confidence,
      );
      console.log(
        "  处理时间:",
        (result.data as DocumentAnalysisOutput)?.processingTime || 0,
        "ms",
      );
    } else {
      console.log("\n❌ 分析失败:", result.error?.message);
    }

    await agent.cleanup();
  }

  console.log("\n" + "=".repeat(70));
  console.log("✅ 诊断完成");
}

main().catch(console.error);
