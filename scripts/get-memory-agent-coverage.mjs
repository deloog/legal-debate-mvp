import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取覆盖率摘要文件
const coverageSummaryPath = path.join(
  __dirname,
  "..",
  "coverage",
  "coverage-final.json",
);

if (fs.existsSync(coverageSummaryPath)) {
  const summary = JSON.parse(fs.readFileSync(coverageSummaryPath, "utf8"));

  let report = "=== MemoryAgent 覆盖率摘要 ===\n\n";

  // 计算memory-agent的总覆盖率
  let memoryAgentFiles = [];
  for (const [filePath, fileData] of Object.entries(summary)) {
    if (filePath.includes("memory-agent") && !filePath.includes("test")) {
      memoryAgentFiles.push({ path: filePath, data: fileData });
    }
  }

  if (memoryAgentFiles.length === 0) {
    console.log("未找到memory-agent相关文件");
    process.exit(1);
  }

  // 计算总覆盖率
  let totalStatements = { covered: 0, total: 0 };
  let totalBranches = { covered: 0, total: 0 };
  let totalFunctions = { covered: 0, total: 0 };
  let totalLines = { covered: 0, total: 0 };

  memoryAgentFiles.forEach((file) => {
    totalStatements.covered += file.data.s.covered;
    totalStatements.total += file.data.s.total;
    totalBranches.covered += file.data.b.covered;
    totalBranches.total += file.data.b.total;
    totalFunctions.covered += file.data.f.covered;
    totalFunctions.total += file.data.f.total;
    totalLines.covered += file.data.l.covered;
    totalLines.total += file.data.l.total;
  });

  const calcPct = (covered, total) =>
    total > 0 ? ((covered / total) * 100).toFixed(2) : "0.00";

  // 打印总覆盖率
  report += "总计 (MemoryAgent 模块):\n";
  report += `  语句覆盖率: ${calcPct(totalStatements.covered, totalStatements.total)}% (${totalStatements.covered}/${totalStatements.total})\n`;
  report += `  分支覆盖率: ${calcPct(totalBranches.covered, totalBranches.total)}% (${totalBranches.covered}/${totalBranches.total})\n`;
  report += `  函数覆盖率: ${calcPct(totalFunctions.covered, totalFunctions.total)}% (${totalFunctions.covered}/${totalFunctions.total})\n`;
  report += `  行覆盖率: ${calcPct(totalLines.covered, totalLines.total)}% (${totalLines.covered}/${totalLines.total})\n`;

  // 打印各文件覆盖率
  report += "\n各文件覆盖率:\n";
  memoryAgentFiles.forEach((file) => {
    const shortPath = file.path.replace(/^.*src\//, "src/");
    report += `\n${shortPath}:\n`;
    report += `  语句: ${calcPct(file.data.s.covered, file.data.s.total)}% (${file.data.s.covered}/${file.data.s.total})\n`;
    report += `  分支: ${calcPct(file.data.b.covered, file.data.b.total)}% (${file.data.b.covered}/${file.data.b.total})\n`;
    report += `  函数: ${calcPct(file.data.f.covered, file.data.f.total)}% (${file.data.f.covered}/${file.data.f.total})\n`;
    report += `  行: ${calcPct(file.data.l.covered, file.data.l.total)}% (${file.data.l.covered}/${file.data.l.total})\n`;
  });

  console.log(report);

  // 保存到docs目录
  const docsReportPath = path.join(
    __dirname,
    "..",
    "docs",
    "MEMORY_AGENT_COVERAGE_REPORT.md",
  );
  const markdownReport = `# MemoryAgent 覆盖率报告\n\n生成时间: ${new Date().toLocaleString("zh-CN")}\n\n${report.replace(/\n/g, "\n\n")}`;
  fs.writeFileSync(docsReportPath, markdownReport, "utf8");
  console.log(`\n覆盖率报告已保存到: ${docsReportPath}`);
} else {
  console.log(
    "覆盖率摘要文件不存在，请先运行: npm test -- src/__tests__/unit/agent/memory-agent/ --coverage",
  );
}
