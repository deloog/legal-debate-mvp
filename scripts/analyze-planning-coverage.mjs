#!/usr/bin/env node
/**
 * Planning Agent覆盖率分析脚本
 * 深入分析覆盖率数据，生成详细的改进建议
 */

import fs from "fs";
import path from "path";

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function printHeader(text) {
  console.log("\n" + "=".repeat(80));
  log(text, colors.bright + colors.cyan);
  console.log("=".repeat(80) + "\n");
}

function printSubHeader(text) {
  console.log("\n" + "-".repeat(60));
  log(text, colors.bright + colors.yellow);
  console.log("-".repeat(60) + "\n");
}

function printSuccess(text) {
  log(`✓ ${text}`, colors.green);
}

function printWarning(text) {
  log(`⚠ ${text}`, colors.yellow);
}

function printError(text) {
  log(`✗ ${text}`, colors.red);
}

function printInfo(text) {
  log(`ℹ ${text}`, colors.cyan);
}

/**
 * 读取覆盖率数据
 */
function readCoverageData() {
  const coverageFile = path.join(
    process.cwd(),
    "coverage",
    "coverage-final.json",
  );

  if (!fs.existsSync(coverageFile)) {
    printError("未找到覆盖率数据文件");
    printInfo("请先运行: npm run coverage:planning-agent");
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(coverageFile, "utf-8"));
    return data;
  } catch (error) {
    printError("解析覆盖率数据失败");
    console.error(error.message);
    return null;
  }
}

/**
 * 过滤planning-agent文件
 */
function filterPlanningAgentFiles(coverageData) {
  const files = {};

  for (const [filePath, data] of Object.entries(coverageData)) {
    if (
      filePath.includes("src/lib/agent/planning-agent") &&
      !filePath.includes(".test.") &&
      !filePath.includes(".spec.")
    ) {
      files[filePath] = data;
    }
  }

  return files;
}

/**
 * 读取源文件内容
 */
function readSourceFile(filePath) {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf-8");
  }
  return "";
}

/**
 * 分析函数覆盖率
 */
function analyzeFunctions(data) {
  const functions = [];

  if (data.f) {
    for (const [funcName, count] of Object.entries(data.f)) {
      functions.push({
        name: funcName,
        covered: count > 0,
        count,
      });
    }
  }

  return functions;
}

/**
 * 分析分支覆盖率
 */
function analyzeBranches(data) {
  const branches = [];

  if (data.b) {
    for (const [branchKey, counts] of Object.entries(data.b)) {
      const total = counts.length;
      const covered = counts.filter((c) => c > 0).length;
      branches.push({
        key: branchKey,
        total,
        covered,
        percentage: (covered / total) * 100,
      });
    }
  }

  return branches;
}

/**
 * 分析未覆盖的行
 */
function analyzeUncoveredLines(data, sourceCode) {
  const uncoveredLines = [];

  if (data.s) {
    const lines = sourceCode.split("\n");
    for (const [lineNumber, count] of Object.entries(data.s)) {
      const lineIndex = parseInt(lineNumber) - 1;
      if (count === 0 && lineIndex < lines.length) {
        uncoveredLines.push({
          line: parseInt(lineNumber),
          code: lines[lineIndex].trim(),
        });
      }
    }
  }

  return uncoveredLines;
}

/**
 * 生成改进建议
 */
function generateRecommendations(files) {
  const recommendations = [];

  for (const [filePath, data] of Object.entries(files)) {
    const fileName = path.basename(filePath);
    const sourceCode = readSourceFile(filePath);

    // 计算各项覆盖率
    const lineCoverage = calculateLineCoverage(data);
    const functions = analyzeFunctions(data);
    const branches = analyzeBranches(data);
    const uncoveredLines = analyzeUncoveredLines(data, sourceCode);

    // 分析建议
    if (lineCoverage < 80) {
      recommendations.push({
        file: fileName,
        type: "line_coverage",
        severity: "high",
        message: `行覆盖率低于80% (${lineCoverage.toFixed(2)}%)，需要添加更多测试用例`,
      });
    }

    // 未覆盖函数
    const uncoveredFunctions = functions.filter((f) => !f.covered);
    if (uncoveredFunctions.length > 0) {
      recommendations.push({
        file: fileName,
        type: "function_coverage",
        severity: "medium",
        message: `有${uncoveredFunctions.length}个函数未覆盖: ${uncoveredFunctions.map((f) => f.name).join(", ")}`,
      });
    }

    // 低覆盖率分支
    const lowCoverageBranches = branches.filter((b) => b.percentage < 50);
    if (lowCoverageBranches.length > 0) {
      recommendations.push({
        file: fileName,
        type: "branch_coverage",
        severity: "medium",
        message: `有${lowCoverageBranches.length}个分支覆盖率低于50%，需要测试不同的条件分支`,
      });
    }

    // 未覆盖的代码行分析
    const errorHandlingLines = uncoveredLines.filter((l) =>
      /catch|throw|error|Error/i.test(l.code),
    );
    if (errorHandlingLines.length > 0) {
      recommendations.push({
        file: fileName,
        type: "error_handling",
        severity: "high",
        message: `有${errorHandlingLines.length}行错误处理代码未覆盖 (行: ${errorHandlingLines.map((l) => l.line).join(", ")})，需要测试错误场景`,
      });
    }

    const validationLines = uncoveredLines.filter((l) =>
      /validate|check|assert|if\s*\(/i.test(l.code),
    );
    if (validationLines.length > 0) {
      recommendations.push({
        file: fileName,
        type: "validation",
        severity: "medium",
        message: `有${validationLines.length}行验证代码未覆盖，需要测试边界条件和无效输入`,
      });
    }

    const edgeCaseLines = uncoveredLines.filter((l) =>
      /else|switch|case|default/i.test(l.code),
    );
    if (edgeCaseLines.length > 0) {
      recommendations.push({
        file: fileName,
        type: "edge_case",
        severity: "low",
        message: `有${edgeCaseLines.length}行边界情况代码未覆盖，建议补充测试`,
      });
    }
  }

  return recommendations;
}

/**
 * 计算行覆盖率
 */
function calculateLineCoverage(data) {
  const total = Object.keys(data.s || {}).length;
  const covered = Object.values(data.s || {}).filter((v) => v > 0).length;
  return total > 0 ? (covered / total) * 100 : 0;
}

/**
 * 显示详细分析报告
 */
function displayAnalysisReport(files) {
  printHeader("Planning Agent 覆盖率深度分析报告");

  // 生成改进建议
  const recommendations = generateRecommendations(files);

  if (recommendations.length === 0) {
    printSuccess("所有文件覆盖率良好，无需改进！");
    return;
  }

  // 按严重程度分组
  const highSeverity = recommendations.filter((r) => r.severity === "high");
  const mediumSeverity = recommendations.filter((r) => r.severity === "medium");
  const lowSeverity = recommendations.filter((r) => r.severity === "low");

  // 显示高优先级建议
  if (highSeverity.length > 0) {
    printSubHeader("🔴 高优先级改进项");
    for (const rec of highSeverity) {
      log(`文件: ${rec.file}`, colors.bright);
      log(`  类型: ${rec.type}`, colors.red);
      log(`  建议: ${rec.message}`, colors.reset);
      console.log("");
    }
  }

  // 显示中优先级建议
  if (mediumSeverity.length > 0) {
    printSubHeader("🟡 中优先级改进项");
    for (const rec of mediumSeverity) {
      log(`文件: ${rec.file}`, colors.bright);
      log(`  类型: ${rec.type}`, colors.yellow);
      log(`  建议: ${rec.message}`, colors.reset);
      console.log("");
    }
  }

  // 显示低优先级建议
  if (lowSeverity.length > 0) {
    printSubHeader("🟢 低优先级改进项");
    for (const rec of lowSeverity) {
      log(`文件: ${rec.file}`, colors.bright);
      log(`  类型: ${rec.type}`, colors.green);
      log(`  建议: ${rec.message}`, colors.reset);
      console.log("");
    }
  }

  // 汇总统计
  printSubHeader("改进建议汇总");
  log(`高优先级: ${highSeverity.length} 项`, colors.red);
  log(`中优先级: ${mediumSeverity.length} 项`, colors.yellow);
  log(`低优先级: ${lowSeverity.length} 项`, colors.green);
  log(`总计: ${recommendations.length} 项`, colors.bright);
}

/**
 * 生成测试用例建议
 */
function generateTestCaseSuggestions(files) {
  printSubHeader("💡 测试用例建议");

  const suggestions = [];

  for (const [filePath, data] of Object.entries(files)) {
    const fileName = path.basename(filePath);
    const sourceCode = readSourceFile(filePath);
    const uncoveredLines = analyzeUncoveredLines(data, sourceCode);

    // 分析错误处理
    const errorHandlingLines = uncoveredLines.filter((l) =>
      /catch|throw|error|Error/i.test(l.code),
    );
    if (errorHandlingLines.length > 0) {
      suggestions.push({
        file: fileName,
        description: "添加错误场景测试",
        details: `测试文件: ${fileName} 中的错误处理逻辑`,
        example:
          'it("should handle error cases properly", async () => { ... })',
      });
    }

    // 分析边界条件
    const validationLines = uncoveredLines.filter((l) =>
      /validate|check|assert|if\s*\(/i.test(l.code),
    );
    if (validationLines.length > 0) {
      suggestions.push({
        file: fileName,
        description: "添加边界条件测试",
        details: `测试文件: ${fileName} 中的验证逻辑`,
        example: 'it("should handle edge cases", () => { ... })',
      });
    }

    // 分析复杂函数
    const functions = analyzeFunctions(data);
    const uncoveredFunctions = functions.filter((f) => !f.covered);
    if (uncoveredFunctions.length > 0) {
      suggestions.push({
        file: fileName,
        description: "为未覆盖函数添加测试",
        details: `函数: ${uncoveredFunctions.map((f) => f.name).join(", ")}`,
        example: 'it("should test function_name", () => { ... })',
      });
    }
  }

  if (suggestions.length === 0) {
    printSuccess("没有明显的测试用例缺失");
    return;
  }

  for (const suggestion of suggestions) {
    log(`📌 ${suggestion.description}`, colors.bright);
    console.log(`   文件: ${suggestion.file}`);
    console.log(`   详情: ${suggestion.details}`);
    console.log(`   示例: ${suggestion.example}`);
    console.log("");
  }
}

/**
 * 生成Markdown报告
 */
function generateMarkdownAnalysisReport(files) {
  printSubHeader("生成分析报告");

  const recommendations = generateRecommendations(files);

  let markdown = "# Planning Agent 覆盖率深度分析报告\n\n";
  markdown += `生成时间: ${new Date().toLocaleString("zh-CN")}\n\n`;

  // 改进建议
  markdown += "## 改进建议\n\n";

  const highSeverity = recommendations.filter((r) => r.severity === "high");
  const mediumSeverity = recommendations.filter((r) => r.severity === "medium");
  const lowSeverity = recommendations.filter((r) => r.severity === "low");

  if (highSeverity.length > 0) {
    markdown += "### 🔴 高优先级\n\n";
    for (const rec of highSeverity) {
      markdown += `#### ${rec.file}\n\n`;
      markdown += `- **类型**: ${rec.type}\n`;
      markdown += `- **建议**: ${rec.message}\n\n`;
    }
  }

  if (mediumSeverity.length > 0) {
    markdown += "### 🟡 中优先级\n\n";
    for (const rec of mediumSeverity) {
      markdown += `#### ${rec.file}\n\n`;
      markdown += `- **类型**: ${rec.type}\n`;
      markdown += `- **建议**: ${rec.message}\n\n`;
    }
  }

  if (lowSeverity.length > 0) {
    markdown += "### 🟢 低优先级\n\n";
    for (const rec of lowSeverity) {
      markdown += `#### ${rec.file}\n\n`;
      markdown += `- **类型**: ${rec.type}\n`;
      markdown += `- **建议**: ${rec.message}\n\n`;
    }
  }

  markdown += `## 汇总统计\n\n`;
  markdown += `- 高优先级: ${highSeverity.length} 项\n`;
  markdown += `- 中优先级: ${mediumSeverity.length} 项\n`;
  markdown += `- 低优先级: ${lowSeverity.length} 项\n`;
  markdown += `- 总计: ${recommendations.length} 项\n`;

  const reportPath = path.join(
    process.cwd(),
    "docs",
    "reports",
    "PLANNING_AGENT_COVERAGE_ANALYSIS.md",
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, markdown, "utf-8");

  printSuccess(`分析报告已生成: ${reportPath}`);
}

/**
 * 主函数
 */
async function main() {
  printHeader("Planning Agent 覆盖率深度分析工具");

  // 读取覆盖率数据
  const coverageData = readCoverageData();
  if (!coverageData) {
    process.exit(1);
  }

  // 过滤planning-agent文件
  const planningAgentFiles = filterPlanningAgentFiles(coverageData);

  if (Object.keys(planningAgentFiles).length === 0) {
    printWarning("未找到planning-agent相关的覆盖率数据");
    printInfo("请先运行: npm run coverage:planning-agent");
    process.exit(1);
  }

  // 显示详细分析报告
  displayAnalysisReport(planningAgentFiles);

  // 生成测试用例建议
  generateTestCaseSuggestions(planningAgentFiles);

  // 生成Markdown报告
  generateMarkdownAnalysisReport(planningAgentFiles);

  printSuccess("分析完成！");
}

// 执行主函数
main().catch((error) => {
  printError("执行失败");
  console.error(error);
  process.exit(1);
});
