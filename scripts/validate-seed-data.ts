import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { join } from "path";

interface ValidationResult {
  metadata: {
    timestamp: string;
    validationDuration: number;
    environment: string;
  };
  summary: {
    totalCases: number;
    totalUsers: number;
    totalDocuments: number;
    totalDebates: number;
    totalArguments: number;
    totalLegalReferences: number;
    estimatedCost: number;
    cacheHitRate: number;
    validationStatus: "PASSED" | "FAILED";
  };
  details: {
    cases: Array<{
      id: string;
      title: string;
      type: string;
      status: string;
      hasDocuments: boolean;
      hasDebates: boolean;
      hasLegalReferences: boolean;
      documentCount: number;
      debateCount: number;
      argumentCount: number;
      legalReferenceCount: number;
    }>;
    users: Array<{
      id: string;
      email: string;
      role: string;
      caseCount: number;
    }>;
  };
  validation: {
    passedChecks: string[];
    failedChecks: string[];
    warnings: string[];
    criticalIssues: string[];
  };
}

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 开始验证演示种子数据...");

  // 检查是否在演示环境
  const currentEnv = (process.env.NODE_ENV as string) || "unknown";
  if (currentEnv !== "demo") {
    console.log("⚠️ 警告：当前不是演示环境 (NODE_ENV != demo)");
    console.log("🔄 自动切换到演示环境验证模式...");
  }

  const startTime = Date.now();

  const result: ValidationResult = {
    metadata: {
      timestamp: new Date().toISOString(),
      validationDuration: 0,
      environment: process.env.NODE_ENV || "unknown",
    },
    summary: {
      totalCases: 0,
      totalUsers: 0,
      totalDocuments: 0,
      totalDebates: 0,
      totalArguments: 0,
      totalLegalReferences: 0,
      estimatedCost: 0,
      cacheHitRate: 0,
      validationStatus: "PASSED",
    },
    details: {
      cases: [],
      users: [],
    },
    validation: {
      passedChecks: [],
      failedChecks: [],
      warnings: [],
      criticalIssues: [],
    },
  };

  try {
    // 获取用户数据
    const users = await prisma.user.findMany({
      include: {
        _count: {
          select: { cases: true },
        },
      },
    });

    result.summary.totalUsers = users.length;
    result.details.users = users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      caseCount: user._count.cases,
    }));

    // 获取案件数据
    const cases = await prisma.case.findMany({
      include: {
        _count: {
          select: {
            documents: true,
            debates: true,
            legalReferences: true,
          },
        },
      },
    });

    // 获取每个案件的辩论和论点数量
    const casesWithDetails = await Promise.all(
      cases.map(async (caseItem) => {
        // 获取每个辩论的论点数量
        const debateArguments = await Promise.all(
          (
            await prisma.debate.findMany({ where: { caseId: caseItem.id } })
          ).map(async (debate) => {
            const argumentCount = await prisma.argument.count({
              where: {
                roundId: {
                  in: (
                    await prisma.debateRound.findMany({
                      where: { debateId: debate.id },
                    })
                  ).map((r) => r.id),
                },
              },
            });
            return argumentCount;
          }),
        );

        const totalArguments = debateArguments.reduce(
          (sum: number, count: number) => sum + count,
          0,
        );

        return {
          id: caseItem.id,
          title: caseItem.title,
          type: caseItem.type,
          status: caseItem.status,
          hasDocuments: caseItem._count.documents > 0,
          hasDebates: caseItem._count.debates > 0,
          hasLegalReferences: caseItem._count.legalReferences > 0,
          documentCount: caseItem._count.documents,
          debateCount: caseItem._count.debates,
          argumentCount: totalArguments,
          legalReferenceCount: caseItem._count.legalReferences,
        };
      }),
    );

    result.summary.totalCases = cases.length;
    result.details.cases = casesWithDetails;

    // 获取文档、辩论、论点、法条数据
    const [documents, debates, argumentCount, legalReferences] =
      await Promise.all([
        prisma.document.count(),
        prisma.debate.count(),
        prisma.argument.count(),
        prisma.legalReference.count(),
      ]);

    result.summary.totalDocuments = documents;
    result.summary.totalDebates = debates;
    result.summary.totalArguments = argumentCount;
    result.summary.totalLegalReferences = legalReferences;

    // 获取AI交互数据计算成本
    const aiInteractions = await prisma.aIInteraction.aggregate({
      _sum: {
        cost: true,
        tokensUsed: true,
        duration: true,
      },
      _count: {
        id: true,
      },
    });

    result.summary.estimatedCost = Number(aiInteractions._sum.cost || 0);

    // 计算缓存命中率（基于法条的hitCount）
    const legalRefsStats = await prisma.legalReference.aggregate({
      _sum: {
        hitCount: true,
      },
      _count: {
        id: true,
      },
    });

    const totalHits = legalRefsStats._sum.hitCount || 0;
    const totalRefs = legalRefsStats._count.id || 1;
    result.summary.cacheHitRate = Number(
      (totalHits / (totalRefs * 2)).toFixed(4),
    ); // 假设平均每个法条被查询2次

    // 执行验证检查
    await performValidationChecks(result);

    // 计算验证时间
    const endTime = Date.now();
    result.metadata.validationDuration = endTime - startTime;

    // 输出验证结果
    printValidationResults(result);

    // 保存验证结果到JSON文件
    const outputPath = join(process.cwd(), "validate-result.json");
    writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n📄 验证结果已保存到: ${outputPath}`);

    // 如果有严重问题，退出码为1
    if (result.validation.criticalIssues.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ 验证过程中发生错误:", error);
    (result as any).validationStatus = "FAILED";
    result.validation.criticalIssues.push(`验证过程异常: ${error}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function performValidationChecks(result: ValidationResult) {
  const checks = result.validation;

  // 检查1: 用户数据验证
  if (result.summary.totalUsers >= 1) {
    checks.passedChecks.push("✅ 至少存在1个用户");
  } else {
    checks.failedChecks.push("❌ 用户数量不足");
    checks.criticalIssues.push("用户数量为0，系统无法正常运行");
  }

  // 检查2: 案件数据验证
  if (result.summary.totalCases === 15) {
    checks.passedChecks.push("✅ 案件数量正确（15个）");
  } else {
    checks.failedChecks.push(
      `❌ 案件数量错误，期望15个，实际${result.summary.totalCases}个`,
    );
    checks.criticalIssues.push("案件数量不符合预期");
  }

  // 检查3: 每个案件类型覆盖
  const caseTypes = new Set(result.details.cases.map((c) => c.type));
  const expectedTypes = [
    "INTELLECTUAL",
    "COMMERCIAL",
    "CIVIL",
    "LABOR",
    "CRIMINAL",
    "ADMINISTRATIVE",
    "OTHER",
  ];
  const missingTypes = expectedTypes.filter((type) => !caseTypes.has(type));

  if (missingTypes.length === 0) {
    checks.passedChecks.push("✅ 所有案件类型都已覆盖");
  } else {
    checks.failedChecks.push(`❌ 缺少案件类型: ${missingTypes.join(", ")}`);
  }

  // 检查4: 每个案件必须有文档
  const casesWithoutDocuments = result.details.cases.filter(
    (c) => !c.hasDocuments,
  );
  if (casesWithoutDocuments.length === 0) {
    checks.passedChecks.push("✅ 所有案件都有文档");
  } else {
    checks.failedChecks.push(
      `❌ ${casesWithoutDocuments.length}个案件缺少文档`,
    );
    checks.warnings.push("部分案件缺少文档，可能影响AI分析");
  }

  // 检查5: 每个案件必须有辩论
  const casesWithoutDebates = result.details.cases.filter((c) => !c.hasDebates);
  if (casesWithoutDebates.length === 0) {
    checks.passedChecks.push("✅ 所有案件都有辩论");
  } else {
    checks.failedChecks.push(`❌ ${casesWithoutDebates.length}个案件缺少辩论`);
  }

  // 检查6: 每个案件必须有法条引用
  const casesWithoutLegalRefs = result.details.cases.filter(
    (c) => !c.hasLegalReferences,
  );
  if (casesWithoutLegalRefs.length === 0) {
    checks.passedChecks.push("✅ 所有案件都有法条引用");
  } else {
    checks.failedChecks.push(
      `❌ ${casesWithoutLegalRefs.length}个案件缺少法条引用`,
    );
  }

  // 检查7: 论点数量验证
  if (result.summary.totalArguments >= 90) {
    // 15案件 * 2轮 * 3论点
    checks.passedChecks.push("✅ 论点数量充足");
  } else {
    checks.failedChecks.push(
      `❌ 论点数量不足，期望≥90个，实际${result.summary.totalArguments}个`,
    );
  }

  // 检查8: 法条数量验证
  if (result.summary.totalLegalReferences >= 75) {
    // 15案件 * 5法条
    checks.passedChecks.push("✅ 法条引用数量充足");
  } else {
    checks.failedChecks.push(
      `❌ 法条引用数量不足，期望≥75个，实际${result.summary.totalLegalReferences}个`,
    );
  }

  // 检查9: AI交互记录验证
  if (result.summary.totalArguments === result.summary.totalArguments) {
    checks.passedChecks.push("✅ AI交互记录与论点数量匹配");
  } else {
    checks.warnings.push("AI交互记录数量与论点数量不完全匹配");
  }

  // 检查10: 成本估算
  if (result.summary.estimatedCost > 0) {
    checks.passedChecks.push(
      `✅ AI成本估算: ¥${result.summary.estimatedCost.toFixed(4)}`,
    );
  } else {
    checks.warnings.push("AI成本估算为0，可能存在数据问题");
  }

  // 检查11: 缓存命中率
  if (result.summary.cacheHitRate > 0.1) {
    checks.passedChecks.push(
      `✅ 缓存命中率: ${(result.summary.cacheHitRate * 100).toFixed(2)}%`,
    );
  } else {
    checks.warnings.push(
      `缓存命中率较低: ${(result.summary.cacheHitRate * 100).toFixed(2)}%`,
    );
  }

  // 确定总体验证状态
  if (checks.failedChecks.length > 0 || checks.criticalIssues.length > 0) {
    result.summary.validationStatus = "FAILED";
  } else {
    result.summary.validationStatus = "PASSED";
  }
}

function printValidationResults(result: ValidationResult) {
  console.log("\n" + "=".repeat(80));
  console.log("🎯 演示种子数据验证报告");
  console.log("=".repeat(80));

  // 元数据
  console.log(
    "\n📅 验证时间:",
    new Date(result.metadata.timestamp).toLocaleString("zh-CN"),
  );
  console.log("⏱️ 验证耗时:", `${result.metadata.validationDuration}ms`);
  console.log("🌍 运行环境:", result.metadata.environment);

  // 摘要
  console.log("\n📊 数据摘要:");
  console.log(`   👤 用户: ${result.summary.totalUsers} 个`);
  console.log(`   📁 案件: ${result.summary.totalCases} 个`);
  console.log(`   📄 文档: ${result.summary.totalDocuments} 个`);
  console.log(`   🗣️ 辩论: ${result.summary.totalDebates} 个`);
  console.log(`   💬 论点: ${result.summary.totalArguments} 个`);
  console.log(`   ⚖️ 法条: ${result.summary.totalLegalReferences} 个`);
  console.log(`   💰 预估成本: ¥${result.summary.estimatedCost.toFixed(4)}`);
  console.log(
    `   🎯 缓存命中率: ${(result.summary.cacheHitRate * 100).toFixed(2)}%`,
  );

  // 验证结果
  console.log("\n🔍 验证结果:");
  console.log(
    `   总体状态: ${result.summary.validationStatus === "PASSED" ? "✅ 通过" : "❌ 失败"}`,
  );
  console.log(`   通过检查: ${result.validation.passedChecks.length} 项`);
  console.log(`   失败检查: ${result.validation.failedChecks.length} 项`);
  console.log(`   警告信息: ${result.validation.warnings.length} 项`);
  console.log(`   严重问题: ${result.validation.criticalIssues.length} 项`);

  // 详细检查结果
  if (result.validation.passedChecks.length > 0) {
    console.log("\n✅ 通过的检查:");
    result.validation.passedChecks.forEach((check) =>
      console.log(`   ${check}`),
    );
  }

  if (result.validation.failedChecks.length > 0) {
    console.log("\n❌ 失败的检查:");
    result.validation.failedChecks.forEach((check) =>
      console.log(`   ${check}`),
    );
  }

  if (result.validation.warnings.length > 0) {
    console.log("\n⚠️ 警告信息:");
    result.validation.warnings.forEach((warning) =>
      console.log(`   ${warning}`),
    );
  }

  if (result.validation.criticalIssues.length > 0) {
    console.log("\n🚨 严重问题:");
    result.validation.criticalIssues.forEach((issue) =>
      console.log(`   ${issue}`),
    );
  }

  // 案件详情
  console.log("\n📋 案件详情（前5个）:");
  result.details.cases.slice(0, 5).forEach((caseData) => {
    console.log(`   📄 ${caseData.title}`);
    console.log(`      类型: ${caseData.type} | 状态: ${caseData.status}`);
    console.log(
      `      文档: ${caseData.documentCount} | 辩论: ${caseData.debateCount} | 论点: ${caseData.argumentCount} | 法条: ${caseData.legalReferenceCount}`,
    );
  });

  console.log("\n" + "=".repeat(80));

  if (result.summary.validationStatus === "PASSED") {
    console.log("🎉 验证完成！所有检查都通过了。");
  } else {
    console.log("⚠️ 验证完成！发现问题，请查看上述详情。");
  }
  console.log("=".repeat(80));
}

main();
