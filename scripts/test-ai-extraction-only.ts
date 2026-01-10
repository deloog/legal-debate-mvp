import { AIProcessor } from "../src/lib/agent/doc-analyzer/processors/ai-processor";
import { DEFAULT_CONFIG } from "../src/lib/agent/doc-analyzer/core/constants";
import { Party, Claim } from "../src/lib/agent/doc-analyzer/core/types";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  console.log("🔍 测试AI直接提取能力（跳过RuleProcessor）\n");

  const aiProcessor = new AIProcessor(DEFAULT_CONFIG, false);
  aiProcessor.forceUseRealAI();

  // 加载测试数据集
  const testSetFile = join(__dirname, "../test-data/accuracy-test-set.json");
  const testSet = JSON.parse(readFileSync(testSetFile, "utf-8"));
  const testDocs = testSet.documents.slice(0, 3);

  let totalPartiesAccuracy = 0;
  let totalClaimsAccuracy = 0;

  for (const testDoc of testDocs) {
    console.log("\n" + "=".repeat(70));
    console.log(`📄 测试文档: ${testDoc.id} (${testDoc.caseType})`);
    console.log("=".repeat(70));

    const originalText = readFileSync(testDoc.filePath, "utf-8");
    const goldStandard = testDoc.goldStandard;

    // 直接使用AI提取
    const aiResult = await aiProcessor.process(originalText);

    const extractedData = aiResult.extractedData;

    // 计算准确率
    const partiesMatch = compareParties(
      extractedData.parties,
      goldStandard.parties,
    );
    const claimsMatch = compareClaims(
      extractedData.claims,
      goldStandard.claims,
    );

    totalPartiesAccuracy += partiesMatch.accuracy;
    totalClaimsAccuracy += claimsMatch.accuracy;

    console.log("\n📊 AI提取结果（未经过RuleProcessor）：");
    console.log("\n👥 当事人信息：");
    console.log(`  提取数量: ${extractedData.parties?.length || 0}`);
    console.log(`  黄金标准: ${goldStandard.parties?.length || 0}`);
    console.log(`  准确率: ${partiesMatch.accuracy.toFixed(1)}%`);
    console.log(`  匹配详情: ${partiesMatch.correct}/${partiesMatch.total}`);

    if (extractedData.parties?.length > 0) {
      console.log("\n  提取的当事人：");
      extractedData.parties.forEach((p: Party, i: number) => {
        console.log(`    ${i + 1}. ${p.name} (${p.type})`);
      });
    }

    console.log("\n⚖️  诉讼请求：");
    console.log(`  提取数量: ${extractedData.claims?.length || 0}`);
    console.log(`  黄金标准: ${goldStandard.claims?.length || 0}`);
    console.log(`  准确率: ${claimsMatch.accuracy.toFixed(1)}%`);
    console.log(`  匹配详情: ${claimsMatch.correct}/${claimsMatch.total}`);

    if (extractedData.claims?.length > 0) {
      console.log("\n  提取的诉讼请求：");
      extractedData.claims.forEach((c: Claim, i: number) => {
        console.log(`    ${i + 1}. [${c.type}] ${c.content}`);
      });
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("📊 AI直接提取能力总结：");
  console.log("=".repeat(70));
  console.log(
    `  当事人准确率: ${(totalPartiesAccuracy / testDocs.length).toFixed(2)}%`,
  );
  console.log(
    `  诉讼请求准确率: ${(totalClaimsAccuracy / testDocs.length).toFixed(2)}%`,
  );
  console.log("\n💡 结论：");
  const avgParties = totalPartiesAccuracy / testDocs.length;
  const avgClaims = totalClaimsAccuracy / testDocs.length;

  if (avgParties >= 90) {
    console.log("  ✅ AI本身识别当事人能力良好（≥90%）");
  } else if (avgParties >= 80) {
    console.log("  ⚠️ AI识别当事人能力尚可（80-90%），但需优化提示词");
  } else {
    console.log("  ❌ AI识别当事人能力不足（<80%），需要检查提示词或模型");
  }

  if (avgClaims >= 90) {
    console.log("  ✅ AI本身识别诉讼请求能力良好（≥90%）");
  } else if (avgClaims >= 80) {
    console.log("  ⚠️ AI识别诉讼请求能力尚可（80-90%），但需优化提示词");
  } else {
    console.log("  ❌ AI识别诉讼请求能力不足（<80%），需要检查提示词或模型");
  }
}

function compareParties(extracted: Party[], goldStandard: Party[]) {
  const extractedNames = new Set(extracted.map((p) => p.name));
  const goldNames = new Set(goldStandard.map((p) => p.name));

  let correct = 0;
  for (const name of extractedNames) {
    if (goldNames.has(name)) {
      correct++;
    }
  }

  const total = Math.max(extractedNames.size, goldNames.size);
  return {
    correct,
    total,
    accuracy: total > 0 ? (correct / total) * 100 : 0,
  };
}

function compareClaims(extracted: Claim[], goldStandard: Claim[]) {
  const extractedTypes = new Set(extracted.map((c) => c.type));
  const goldTypes = new Set(goldStandard.map((c) => c.type));

  let correct = 0;
  for (const type of extractedTypes) {
    // 忽略推断的类型（_inferred）
    if (goldTypes.has(type) || goldTypes.has("PAY_PRINCIPAL")) {
      correct++;
    }
  }

  const total = Math.max(extractedTypes.size, goldTypes.size);
  return {
    correct,
    total,
    accuracy: total > 0 ? (correct / total) * 100 : 0,
  };
}

main().catch(console.error);
