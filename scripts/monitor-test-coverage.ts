#!/usr/bin/env tsx

/**
 * 覆盖率监控脚本
 *
 * 用途：
 * - 实时监控覆盖率变化
 * - 生成覆盖率趋势报告
 * - 检测覆盖率下降
 * - 发送告警通知
 *
 * 使用方式：
 * node scripts/monitor-test-coverage.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CoverageHistory {
  timestamp: string;
  total: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  modules: Record<string, number>;
}

interface CoverageData {
  total: {
    lines: { pct: number; total: number; covered: number };
    statements: { pct: number; total: number; covered: number };
    functions: { pct: number; total: number; covered: number };
    branches: { pct: number; total: number; covered: number };
  };
  [key: string]: any;
}

interface CoverageComparison {
  statementChange: number;
  branchChange: number;
  functionChange: number;
  lineChange: number;
  moduleChanges: Array<{
    module: string;
    oldCoverage: number;
    newCoverage: number;
    change: number;
  }>;
}

// 配置
const CONFIG = {
  historyFile: path.resolve(process.cwd(), "docs/coverage-history.json"),
  warningThreshold: -2, // 覆盖率下降超过2%发出警告
  errorThreshold: -5, // 覆盖率下降超过5%发出错误
  keepHistoryDays: 30, // 保留30天历史记录
};

/**
 * 运行测试并获取覆盖率
 */
async function runCoverageTests(): Promise<any> {
  try {
    console.log("🧪 运行测试...\n");
    const { stdout, stderr } = await execAsync(
      "npm run test:coverage -- --json --outputFile=coverage-final/coverage-final.json",
    );

    if (stderr && !stderr.includes("Jest did not exit")) {
      console.error(`⚠️  测试警告: ${stderr}`);
    }

    console.log("✅ 测试完成\n");

    // 读取覆盖率数据
    const coveragePath = path.resolve(
      process.cwd(),
      "coverage-final",
      "coverage-final.json",
    );
    const coverageData = JSON.parse(fs.readFileSync(coveragePath, "utf-8"));

    return coverageData;
  } catch (error) {
    console.error(
      "❌ 测试运行失败:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

/**
 * 提取总体覆盖率
 */
function extractTotalCoverage(coverageData: any): CoverageHistory["total"] {
  // 如果数据已经是汇总格式
  if (coverageData.total) {
    return {
      statements: coverageData.total.statements.pct || 0,
      branches: coverageData.total.branches.pct || 0,
      functions: coverageData.total.functions.pct || 0,
      lines: coverageData.total.lines.pct || 0,
    };
  }

  // 否则从Jest原始格式计算
  let totalStatements = 0;
  let coveredStatements = 0;
  let totalBranches = 0;
  let coveredBranches = 0;
  let totalFunctions = 0;
  let coveredFunctions = 0;
  let totalLines = 0;
  let coveredLines = 0;

  for (const filePath of Object.keys(coverageData)) {
    const fileCoverage = coverageData[filePath];

    if (fileCoverage.s) {
      for (const count of Object.values(fileCoverage.s)) {
        const countValue = Number(count);
        totalStatements++;
        if (countValue > 0) coveredStatements++;
      }
    }

    if (fileCoverage.b) {
      for (const branch of Object.values(fileCoverage.b)) {
        totalBranches += Array.isArray(branch) ? branch.length : 1;
        if (Array.isArray(branch)) {
          const covered = branch.filter((b: number) => b > 0).length;
          coveredBranches += covered;
        } else if (Number(branch) > 0) {
          coveredBranches++;
        }
      }
    }

    if (fileCoverage.f) {
      for (const count of Object.values(fileCoverage.f)) {
        const countValue = Number(count);
        totalFunctions++;
        if (countValue > 0) coveredFunctions++;
      }
    }

    if (fileCoverage.l) {
      for (const count of Object.values(fileCoverage.l)) {
        const countValue = Number(count);
        totalLines++;
        if (countValue > 0) coveredLines++;
      }
    }
  }

  return {
    statements:
      totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0,
    branches: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
    functions:
      totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
    lines: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
  };
}

/**
 * 提取模块覆盖率
 */
function extractModuleCoverage(coverageData: any): Record<string, number> {
  const modules: Record<string, number> = {};

  for (const filePath of Object.keys(coverageData)) {
    if (filePath === "total") continue;

    const fileName = path.basename(filePath);
    const coverage = coverageData[filePath]?.lines?.pct || 0;
    modules[fileName] = coverage;
  }

  return modules;
}

/**
 * 读取历史覆盖率记录
 */
function readHistory(): CoverageHistory[] {
  try {
    if (!fs.existsSync(CONFIG.historyFile)) {
      return [];
    }

    const content = fs.readFileSync(CONFIG.historyFile, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(
      "⚠️  无法读取历史记录:",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

/**
 * 保存历史覆盖率记录
 */
function saveHistory(history: CoverageHistory[]): void {
  try {
    fs.writeFileSync(
      CONFIG.historyFile,
      JSON.stringify(history, null, 2),
      "utf-8",
    );
    console.log("✅ 历史记录已保存\n");
  } catch (error) {
    console.error(
      "❌ 保存历史记录失败:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * 清理过期历史记录
 */
function cleanupHistory(history: CoverageHistory[]): CoverageHistory[] {
  const now = new Date();
  const cutoffDate = new Date(
    now.getTime() - CONFIG.keepHistoryDays * 24 * 60 * 60 * 1000,
  );

  return history.filter((record) => {
    const recordDate = new Date(record.timestamp);
    return recordDate > cutoffDate;
  });
}

/**
 * 比较覆盖率变化
 */
function compareCoverage(
  oldHistory: CoverageHistory[],
  newRecord: CoverageHistory,
): CoverageComparison | null {
  if (oldHistory.length === 0) {
    return null;
  }

  const lastRecord = oldHistory[oldHistory.length - 1];
  const total = newRecord.total;
  const lastTotal = lastRecord.total;

  const comparison: CoverageComparison = {
    statementChange: total.statements - lastTotal.statements,
    branchChange: total.branches - lastTotal.branches,
    functionChange: total.functions - lastTotal.functions,
    lineChange: total.lines - lastTotal.lines,
    moduleChanges: [],
  };

  // 比较各模块
  for (const [module, newCoverage] of Object.entries(newRecord.modules)) {
    const oldCoverage = lastRecord.modules[module] || 0;
    const change = newCoverage - oldCoverage;

    if (Math.abs(change) >= 1) {
      comparison.moduleChanges.push({
        module,
        oldCoverage,
        newCoverage,
        change,
      });
    }
  }

  return comparison;
}

/**
 * 格式化百分比变化
 */
function formatChange(change: number): string {
  const arrow = change > 0 ? "↑" : "↓";
  const color =
    change > 0 ? "green" : change < CONFIG.warningThreshold ? "red" : "yellow";
  return `${change > 0 ? "+" : ""}${change.toFixed(2)}% ${arrow}`;
}

/**
 * 生成覆盖率报告
 */
function generateReport(
  newRecord: CoverageHistory,
  comparison: CoverageComparison | null,
): void {
  console.log("\n📊 覆盖率监控报告\n");
  console.log("━".repeat(70));

  // 总体覆盖率
  console.log("\n📈 总体覆盖率:");
  console.log(`   Statements: ${newRecord.total.statements.toFixed(2)}%`);
  console.log(`   Branches:   ${newRecord.total.branches.toFixed(2)}%`);
  console.log(`   Functions:  ${newRecord.total.functions.toFixed(2)}%`);
  console.log(`   Lines:      ${newRecord.total.lines.toFixed(2)}%`);

  if (comparison) {
    console.log("\n📊 变化趋势:");
    console.log(`   Statements: ${formatChange(comparison.statementChange)}`);
    console.log(`   Branches:   ${formatChange(comparison.branchChange)}`);
    console.log(`   Functions:  ${formatChange(comparison.functionChange)}`);
    console.log(`   Lines:      ${formatChange(comparison.lineChange)}`);

    // 模块变化
    if (comparison.moduleChanges.length > 0) {
      console.log("\n📦 模块变化:");
      comparison.moduleChanges.forEach((change) => {
        const arrow = change.change > 0 ? "↑" : "↓";
        console.log(
          `   ${change.module}: ${change.newCoverage.toFixed(2)}% (${formatChange(change.change)})`,
        );
      });
    }

    // 告警
    const hasWarning =
      comparison.statementChange < CONFIG.warningThreshold ||
      comparison.branchChange < CONFIG.warningThreshold ||
      comparison.functionChange < CONFIG.warningThreshold ||
      comparison.lineChange < CONFIG.warningThreshold;

    const hasError =
      comparison.statementChange < CONFIG.errorThreshold ||
      comparison.branchChange < CONFIG.errorThreshold ||
      comparison.functionChange < CONFIG.errorThreshold ||
      comparison.lineChange < CONFIG.errorThreshold;

    if (hasError) {
      console.log("\n⚠️  警告: 覆盖率显著下降！");
      console.log("   请检查最近的代码变更，确保测试质量。");
    } else if (hasWarning) {
      console.log("\n📝 提示: 覆盖率有所下降，请关注。");
    }
  } else {
    console.log("\n📝 提示: 这是首次覆盖率记录，已建立基线。");
  }

  console.log("\n━".repeat(70));
}

/**
 * 生成趋势报告
 */
function generateTrendReport(history: CoverageHistory[]): void {
  if (history.length < 2) {
    console.log("\n📝 趋势分析: 需要更多历史数据\n");
    return;
  }

  console.log("\n📈 覆盖率趋势（最近5次记录）\n");
  console.log("━".repeat(70));

  const recentHistory = history.slice(-5);

  console.log(
    "时间                | Statements | Branches | Functions | Lines",
  );
  console.log("─".repeat(70));

  recentHistory.forEach((record) => {
    const timestamp = new Date(record.timestamp).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    console.log(
      `${timestamp} | ${record.total.statements.toFixed(2).padStart(10)}% | ` +
        `${record.total.branches.toFixed(2).padStart(8)}% | ` +
        `${record.total.functions.toFixed(2).padStart(9)}% | ` +
        `${record.total.lines.toFixed(2).padStart(5)}%`,
    );
  });

  console.log("━".repeat(70) + "\n");
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("🚀 开始监控覆盖率...\n");

  // 读取历史记录
  const history = readHistory();
  console.log(`📚 已加载 ${history.length} 条历史记录\n`);

  // 运行测试
  const coverageData = await runCoverageTests();

  // 提取覆盖率数据
  const newRecord: CoverageHistory = {
    timestamp: new Date().toISOString(),
    total: extractTotalCoverage(coverageData),
    modules: extractModuleCoverage(coverageData),
  };

  // 比较覆盖率变化
  const comparison = compareCoverage(history, newRecord);

  // 生成报告
  generateReport(newRecord, comparison);

  // 生成趋势报告
  generateTrendReport(history);

  // 更新历史记录
  const updatedHistory = cleanupHistory([...history, newRecord]);
  saveHistory(updatedHistory);

  // 统计信息
  console.log("📊 统计信息:");
  console.log(`   历史记录数: ${updatedHistory.length}`);
  console.log(`   记录保留: ${CONFIG.keepHistoryDays} 天\n`);

  console.log("✅ 监控完成\n");
  console.log("💡 建议:");
  console.log("   - 定期运行此脚本监控覆盖率趋势");
  console.log("   - 在PR前检查覆盖率变化");
  console.log("   - 关注显著下降的模块\n");
}

// 运行主函数
main().catch((error) => {
  console.error(
    "❌ 监控失败:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
