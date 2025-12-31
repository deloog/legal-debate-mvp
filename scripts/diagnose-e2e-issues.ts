/**
 * E2E测试环境诊断脚本
 * 用于诊断E2E测试失败的根本原因
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

interface DiagnosticResult {
  name: string;
  status: "PASS" | "FAIL" | "WARN";
  details: string;
  duration?: number;
  error?: unknown;
}

const results: DiagnosticResult[] = [];

function recordResult(result: DiagnosticResult): void {
  results.push(result);
  const icon =
    result.status === "PASS" ? "✅" : result.status === "WARN" ? "⚠️" : "❌";
  console.log(`${icon} ${result.name}`);
  if (result.details) {
    console.log(`   ${result.details}`);
  }
  if (result.duration) {
    console.log(`   耗时: ${result.duration}ms`);
  }
}

/**
 * 检查1: 数据库连接
 */
async function checkDatabaseConnection(): Promise<void> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    recordResult({
      name: "数据库连接",
      status: "PASS",
      details: "数据库连接正常",
      duration: Date.now() - start,
    });
  } catch (error) {
    recordResult({
      name: "数据库连接",
      status: "FAIL",
      details: "无法连接数据库",
      error,
      duration: Date.now() - start,
    });
  }
}

/**
 * 检查2: 测试用户是否存在
 */
async function checkTestUsers(): Promise<void> {
  const start = Date.now();
  try {
    const users = await prisma.user.findMany({
      where: {
        username: {
          startsWith: "test-e2e-user",
        },
      },
    });

    if (users.length > 0) {
      recordResult({
        name: "测试用户",
        status: "PASS",
        details: `找到${users.length}个测试用户`,
        duration: Date.now() - start,
      });
    } else {
      recordResult({
        name: "测试用户",
        status: "FAIL",
        details: "没有找到测试用户，需要运行init-e2e-test-data.ts",
        duration: Date.now() - start,
      });
    }
  } catch (error) {
    recordResult({
      name: "测试用户",
      status: "FAIL",
      details: "查询测试用户失败",
      error,
      duration: Date.now() - start,
    });
  }
}

/**
 * 检查3: 法条数据
 */
async function checkLawArticles(): Promise<void> {
  const start = Date.now();
  try {
    const count = await prisma.lawArticle.count();
    recordResult({
      name: "法条数据",
      status: count >= 100 ? "PASS" : "WARN",
      details: `当前有${count}条法条数据`,
      duration: Date.now() - start,
    });
  } catch (error) {
    recordResult({
      name: "法条数据",
      status: "FAIL",
      details: "查询法条数据失败",
      error,
      duration: Date.now() - start,
    });
  }
}

/**
 * 检查4: 创建案件功能
 */
async function checkCreateCase(): Promise<void> {
  const start = Date.now();
  try {
    const user = await prisma.user.findFirst({
      where: { username: { startsWith: "test-e2e-user" } },
    });

    if (!user) {
      recordResult({
        name: "创建案件",
        status: "FAIL",
        details: "没有测试用户，无法创建案件",
        duration: Date.now() - start,
      });
      return;
    }

    const testCase = await prisma.case.create({
      data: {
        userId: user.id,
        title: `诊断测试案件_${Date.now()}`,
        description: "E2E诊断测试",
        type: "CIVIL",
        status: "ACTIVE",
      },
    });

    recordResult({
      name: "创建案件",
      status: "PASS",
      details: `成功创建案件 ID: ${testCase.id}`,
      duration: Date.now() - start,
    });

    // 清理测试数据
    await prisma.case.delete({ where: { id: testCase.id } });
  } catch (error) {
    recordResult({
      name: "创建案件",
      status: "FAIL",
      details: "创建案件失败",
      error,
      duration: Date.now() - start,
    });
  }
}

/**
 * 检查5: 法条检索功能
 */
async function checkLawArticleSearch(): Promise<void> {
  const start = Date.now();
  try {
    const results = await prisma.lawArticle.findMany({
      where: {
        OR: [
          { lawName: { contains: "违约", mode: "insensitive" } },
          { fullText: { contains: "违约", mode: "insensitive" } },
          { articleNumber: { contains: "违约", mode: "insensitive" } },
          { lawName: { contains: "合同", mode: "insensitive" } },
          { fullText: { contains: "合同", mode: "insensitive" } },
          { articleNumber: { contains: "合同", mode: "insensitive" } },
        ],
      },
      take: 10,
    });

    recordResult({
      name: "法条检索",
      status: results.length > 0 ? "PASS" : "WARN",
      details: `检索到${results.length}条法条`,
      duration: Date.now() - start,
    });
  } catch (error) {
    recordResult({
      name: "法条检索",
      status: "FAIL",
      details: "法条检索失败",
      error,
      duration: Date.now() - start,
    });
  }
}

/**
 * 检查6: 创建辩论功能
 */
async function checkCreateDebate(): Promise<void> {
  const start = Date.now();
  try {
    const user = await prisma.user.findFirst({
      where: { username: { startsWith: "test-e2e-user" } },
    });

    if (!user) {
      recordResult({
        name: "创建辩论",
        status: "FAIL",
        details: "没有测试用户，无法创建辩论",
        duration: Date.now() - start,
      });
      return;
    }

    const testCase = await prisma.case.create({
      data: {
        userId: user.id,
        title: `诊断测试辩论_${Date.now()}`,
        description: "E2E诊断测试",
        type: "CIVIL",
        status: "ACTIVE",
      },
    });

    const debate = await prisma.debate.create({
      data: {
        caseId: testCase.id,
        userId: user.id,
        title: "测试辩论",
        debateConfig: {
          debateMode: "standard",
          maxRounds: 3,
        },
        status: "IN_PROGRESS",
        currentRound: 0,
        rounds: {
          create: {
            roundNumber: 1,
            status: "PENDING",
          },
        },
      },
    });

    recordResult({
      name: "创建辩论",
      status: "PASS",
      details: `成功创建辩论 ID: ${debate.id}`,
      duration: Date.now() - start,
    });

    // 清理测试数据
    await prisma.debate.delete({ where: { id: debate.id } });
    await prisma.case.delete({ where: { id: testCase.id } });
  } catch (error) {
    recordResult({
      name: "创建辩论",
      status: "FAIL",
      details: "创建辩论失败",
      error,
      duration: Date.now() - start,
    });
  }
}

/**
 * 检查7: 文档上传功能
 */
async function checkDocumentUpload(): Promise<void> {
  const start = Date.now();
  try {
    const user = await prisma.user.findFirst({
      where: { username: { startsWith: "test-e2e-user" } },
    });

    if (!user) {
      recordResult({
        name: "文档上传",
        status: "FAIL",
        details: "没有测试用户，无法测试文档上传",
        duration: Date.now() - start,
      });
      return;
    }

    const testCase = await prisma.case.create({
      data: {
        userId: user.id,
        title: `诊断测试文档_${Date.now()}`,
        description: "E2E诊断测试",
        type: "CIVIL",
        status: "ACTIVE",
      },
    });

    // 创建测试文档记录（不测试实际的文件上传，只测试数据库记录）
    const document = await prisma.document.create({
      data: {
        caseId: testCase.id,
        userId: user.id,
        filename: "test.pdf",
        filePath: "/uploads/test.pdf",
        fileType: "PDF",
        fileSize: 1234,
        mimeType: "application/pdf",
        analysisStatus: "PENDING",
      },
    });

    recordResult({
      name: "文档上传",
      status: "PASS",
      details: `成功创建文档记录 ID: ${document.id}`,
      duration: Date.now() - start,
    });

    // 清理测试数据
    await prisma.document.delete({ where: { id: document.id } });
    await prisma.case.delete({ where: { id: testCase.id } });
  } catch (error) {
    recordResult({
      name: "文档上传",
      status: "FAIL",
      details: "文档上传失败",
      error,
      duration: Date.now() - start,
    });
  }
}

/**
 * 生成诊断报告
 */
function generateReport(): string {
  const passCount = results.filter((r) => r.status === "PASS").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  const warnCount = results.filter((r) => r.status === "WARN").length;

  let report = `# E2E测试环境诊断报告\n\n`;
  report += `## 执行时间\n${new Date().toLocaleString("zh-CN")}\n\n`;
  report += `## 摘要\n`;
  report += `- 总检查项: ${results.length}\n`;
  report += `- ✅ 通过: ${passCount}\n`;
  report += `- ⚠️ 警告: ${warnCount}\n`;
  report += `- ❌ 失败: ${failCount}\n\n`;

  if (failCount > 0) {
    report += `## 关键问题\n\n`;
    results
      .filter((r) => r.status === "FAIL")
      .forEach((r) => {
        report += `### ${r.name}\n`;
        report += `- 状态: 失败\n`;
        report += `- 详情: ${r.details}\n`;
        if (r.error) {
          report += `- 错误: ${JSON.stringify(r.error)}\n`;
        }
        report += `\n`;
      });
  }

  if (warnCount > 0) {
    report += `## 警告信息\n\n`;
    results
      .filter((r) => r.status === "WARN")
      .forEach((r) => {
        report += `### ${r.name}\n`;
        report += `- 状态: 警告\n`;
        report += `- 详情: ${r.details}\n\n`;
      });
  }

  report += `## 详细结果\n\n`;
  results.forEach((r) => {
    const icon = r.status === "PASS" ? "✅" : r.status === "WARN" ? "⚠️" : "❌";
    report += `${icon} **${r.name}** - ${r.details}`;
    if (r.duration) {
      report += ` (${r.duration}ms)`;
    }
    report += `\n`;
  });

  report += `\n## 建议修复措施\n\n`;

  if (failCount > 0) {
    report += `### 紧急修复（优先级P0）\n\n`;
    const failedUsers = results.find(
      (r) => r.name === "测试用户" && r.status === "FAIL",
    );
    if (failedUsers) {
      report += `1. 运行测试数据初始化脚本：\n   \`\`\`bash\n   npx ts-node scripts/init-e2e-test-data.ts\n   \`\`\`\n\n`;
    }

    const failedDb = results.find(
      (r) => r.name === "数据库连接" && r.status === "FAIL",
    );
    if (failedDb) {
      report += `1. 检查数据库配置和连接\n   - 确认.env文件中的DATABASE_URL正确\n   - 确保数据库服务正在运行\n\n`;
    }
  }

  if (warnCount > 0) {
    report += `### 建议优化（优先级P1）\n\n`;
    const warnArticles = results.find(
      (r) => r.name === "法条数据" && r.status === "WARN",
    );
    if (warnArticles) {
      report += `1. 导入更多法条数据：\n   \`\`\`bash\n   npx ts-node scripts/import-law-articles.ts\n   \`\`\`\n\n`;
    }
  }

  return report;
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("========================================");
  console.log("E2E测试环境诊断");
  console.log("========================================\n");

  // 执行所有检查
  await checkDatabaseConnection();
  await checkTestUsers();
  await checkLawArticles();
  await checkCreateCase();
  await checkLawArticleSearch();
  await checkCreateDebate();
  await checkDocumentUpload();

  console.log("\n========================================");
  console.log("诊断完成");
  console.log("========================================\n");

  // 生成报告
  const report = generateReport();
  console.log(report);

  // 保存报告到文件
  const fs = await import("fs");
  const path = await import("path");
  const reportPath = path.join(
    process.cwd(),
    "docs",
    "E2E_DIAGNOSIS_REPORT.md",
  );
  fs.writeFileSync(reportPath, report, "utf-8");
  console.log(`\n诊断报告已保存到: ${reportPath}`);

  // 退出码
  const failCount = results.filter((r) => r.status === "FAIL").length;
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("诊断脚本执行失败:", error);
  process.exit(1);
});
