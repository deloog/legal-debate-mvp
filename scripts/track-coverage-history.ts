#!/usr/bin/env tsx

/**
 * 测试覆盖率历史追踪工具
 *
 * 用途：
 * - 记录每次测试的覆盖率数据
 * - 对比历史覆盖率变化趋势
 * - 生成覆盖率历史报告
 *
 * 使用方式：
 * node scripts/track-coverage-history.ts
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

interface CoverageData {
  statements: { pct: number; total: number; covered: number };
  branches: { pct: number; total: number; covered: number };
  functions: { pct: number; total: number; covered: number };
  lines: { pct: number; total: number; covered: number };
}

interface CoverageRecord {
  timestamp: string;
  commit: string;
  branch: string;
  total: CoverageData;
  modules: Record<string, CoverageData>;
}

interface CoverageHistory {
  records: CoverageRecord[];
}

// 覆盖率历史文件路径
const HISTORY_FILE = path.join(process.cwd(), "docs", "coverage-history.json");

// 覆盖率报告路径
const COVERAGE_REPORT_PATH = path.join(
  process.cwd(),
  "coverage-final",
  "coverage-final.json",
);

/**
 * 读取覆盖率历史
 */
function readCoverageHistory(): CoverageHistory {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const content = fs.readFileSync(HISTORY_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch {
    console.warn("⚠️  无法读取历史文件，将创建新文件");
  }
  return { records: [] };
}

/**
 * 写入覆盖率历史
 */
function writeCoverageHistory(history: CoverageHistory): void {
  try {
    // 确保目录存在
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 保留最近50条记录
    history.records = history.records.slice(-50);

    // 写入文件
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
    console.log(`✅  覆盖率历史已保存: ${HISTORY_FILE}`);
  } catch (error) {
    console.error(`❌ 无法写入历史文件: ${error}`);
  }
}

/**
 * 读取当前覆盖率数据
 */
interface FileCoverage {
  s?: Record<string, number>;
  b?: Record<string, number | number[]>;
  f?: Record<string, number>;
  l?: Record<string, number>;
}

function readCurrentCoverage(): Record<string, FileCoverage> | null {
  try {
    if (!fs.existsSync(COVERAGE_REPORT_PATH)) {
      console.error(`❌ 覆盖率报告不存在: ${COVERAGE_REPORT_PATH}`);
      return null;
    }

    const content = fs.readFileSync(COVERAGE_REPORT_PATH, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ 无法读取覆盖率报告: ${error}`);
    return null;
  }
}

/**
 * 计算总体覆盖率
 */
function calculateTotalCoverage(
  coverageData: Record<string, FileCoverage>,
): CoverageData {
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
    statements: {
      total: totalStatements,
      covered: coveredStatements,
      pct:
        totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0,
    },
    branches: {
      total: totalBranches,
      covered: coveredBranches,
      pct: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
    },
    functions: {
      total: totalFunctions,
      covered: coveredFunctions,
      pct: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
    },
    lines: {
      total: totalLines,
      covered: coveredLines,
      pct: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
    },
  };
}

/**
 * 按模块分类覆盖率
 */
function categorizeModules(
  coverageData: Record<string, FileCoverage>,
): Record<string, CoverageData> {
  const modules: Record<string, CoverageData> = {
    API: {
      statements: { pct: 0, total: 0, covered: 0 },
      branches: { pct: 0, total: 0, covered: 0 },
      functions: { pct: 0, total: 0, covered: 0 },
      lines: { pct: 0, total: 0, covered: 0 },
    },
    Debate: {
      statements: { pct: 0, total: 0, covered: 0 },
      branches: { pct: 0, total: 0, covered: 0 },
      functions: { pct: 0, total: 0, covered: 0 },
      lines: { pct: 0, total: 0, covered: 0 },
    },
    Middleware: {
      statements: { pct: 0, total: 0, covered: 0 },
      branches: { pct: 0, total: 0, covered: 0 },
      functions: { pct: 0, total: 0, covered: 0 },
      lines: { pct: 0, total: 0, covered: 0 },
    },
    Agent: {
      statements: { pct: 0, total: 0, covered: 0 },
      branches: { pct: 0, total: 0, covered: 0 },
      functions: { pct: 0, total: 0, covered: 0 },
      lines: { pct: 0, total: 0, covered: 0 },
    },
    Cache: {
      statements: { pct: 0, total: 0, covered: 0 },
      branches: { pct: 0, total: 0, covered: 0 },
      functions: { pct: 0, total: 0, covered: 0 },
      lines: { pct: 0, total: 0, covered: 0 },
    },
  };

  for (const filePath of Object.keys(coverageData)) {
    const fileCoverage = coverageData[filePath];

    if (filePath.includes("/api/")) {
      addToModule(modules.API, fileCoverage);
    } else if (filePath.includes("/debate/")) {
      addToModule(modules.Debate, fileCoverage);
    } else if (filePath.includes("/middleware/")) {
      addToModule(modules.Middleware, fileCoverage);
    } else if (filePath.includes("/agent/")) {
      addToModule(modules.Agent, fileCoverage);
    } else if (filePath.includes("/cache/")) {
      addToModule(modules.Cache, fileCoverage);
    }
  }

  // 计算百分比
  for (const moduleName of Object.keys(modules)) {
    const mod = modules[moduleName];
    mod.statements.pct =
      mod.statements.total > 0
        ? (mod.statements.covered / mod.statements.total) * 100
        : 0;
    mod.branches.pct =
      mod.branches.total > 0
        ? (mod.branches.covered / mod.branches.total) * 100
        : 0;
    mod.functions.pct =
      mod.functions.total > 0
        ? (mod.functions.covered / mod.functions.total) * 100
        : 0;
    mod.lines.pct =
      mod.lines.total > 0 ? (mod.lines.covered / mod.lines.total) * 100 : 0;
  }

  return modules;
}

/**
 * 添加到模块统计
 */
function addToModule(mod: CoverageData, fileCoverage: FileCoverage): void {
  if (fileCoverage.s) {
    for (const count of Object.values(fileCoverage.s)) {
      const countValue = Number(count);
      mod.statements.total++;
      if (countValue > 0) mod.statements.covered++;
    }
  }

  if (fileCoverage.b) {
    for (const branch of Object.values(fileCoverage.b)) {
      mod.branches.total += Array.isArray(branch) ? branch.length : 1;
      if (Array.isArray(branch)) {
        const covered = branch.filter((b: number) => b > 0).length;
        mod.branches.covered += covered;
      } else if (Number(branch) > 0) {
        mod.branches.covered++;
      }
    }
  }

  if (fileCoverage.f) {
    for (const count of Object.values(fileCoverage.f)) {
      const countValue = Number(count);
      mod.functions.total++;
      if (countValue > 0) mod.functions.covered++;
    }
  }

  if (fileCoverage.l) {
    for (const count of Object.values(fileCoverage.l)) {
      const countValue = Number(count);
      mod.lines.total++;
      if (countValue > 0) mod.lines.covered++;
    }
  }
}

/**
 * 获取Git提交信息
 */
function getGitInfo(): { commit: string; branch: string } {
  try {
    let commit = process.env.GITHUB_SHA || "unknown";
    let branch =
      process.env.GITHUB_REF?.replace("refs/heads/", "") || "unknown";

    // 尝试从Git获取信息
    try {
      if (commit === "unknown") {
        commit = execSync("git rev-parse HEAD").toString().trim();
      }
      if (branch === "unknown") {
        branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
      }
    } catch {
      // Git命令失败，使用默认值
    }

    return { commit, branch };
  } catch {
    console.warn("⚠️  无法获取Git信息");
    return { commit: "unknown", branch: "unknown" };
  }
}

/**
 * 生成覆盖率历史报告
 */
function generateHistoryReport(history: CoverageHistory): void {
  console.log("\n📊 覆盖率历史报告\n");
  console.log("━".repeat(80));

  if (history.records.length === 0) {
    console.log("暂无历史记录\n");
    return;
  }

  // 显示最近5次记录
  const recentRecords = history.records.slice(-5);
  console.log("\n📈 最近5次覆盖率记录:\n");

  recentRecords.forEach((record, index) => {
    const date = new Date(record.timestamp).toLocaleString("zh-CN");
    const total = record.total;

    console.log(`${index + 1}. ${date} (${record.branch.substring(0, 10)}...)`);
    console.log(`   Statements: ${total.statements.pct.toFixed(2)}%`);
    console.log(`   Branches:   ${total.branches.pct.toFixed(2)}%`);
    console.log(`   Functions:  ${total.functions.pct.toFixed(2)}%`);
    console.log(`   Lines:      ${total.lines.pct.toFixed(2)}%`);
    console.log("");
  });

  // 计算趋势
  if (history.records.length >= 2) {
    const latest = history.records[history.records.length - 1];
    const previous = history.records[history.records.length - 2];

    console.log("📊 覆盖率趋势对比:\n");
    console.log("指标         最新      上一次    变化");
    console.log("─".repeat(40));

    const metrics = [
      { name: "Statements", key: "statements" },
      { name: "Branches", key: "branches" },
      { name: "Functions", key: "functions" },
      { name: "Lines", key: "lines" },
    ];

    metrics.forEach((metric) => {
      const latestPct = latest.total[metric.key].pct;
      const previousPct = previous.total[metric.key].pct;
      const change = latestPct - previousPct;
      const arrow = change > 0 ? "↑" : change < 0 ? "↓" : "→";
      const color = change > 0 ? "🟢" : change < 0 ? "🔴" : "⚪";

      console.log(
        `${metric.name.padEnd(10)} ${latestPct
          .toFixed(2)
          .padStart(7)}% ${previousPct
          .toFixed(2)
          .padStart(7)}% ${color} ${arrow} ${Math.abs(change).toFixed(2)}%`,
      );
    });

    console.log("");
  }

  console.log("━".repeat(80));
}

/**
 * 主函数
 */
function main(): void {
  console.log("🚀 开始追踪覆盖率历史...\n");

  // 读取当前覆盖率
  const currentCoverage = readCurrentCoverage();
  if (!currentCoverage) {
    console.error("❌ 无法读取覆盖率数据");
    process.exit(1);
  }

  // 计算总体覆盖率
  const totalCoverage = calculateTotalCoverage(currentCoverage);

  // 分类模块覆盖率
  const modulesCoverage = categorizeModules(currentCoverage);

  // 获取Git信息
  const gitInfo = getGitInfo();

  // 创建覆盖率记录
  const record: CoverageRecord = {
    timestamp: new Date().toISOString(),
    commit: gitInfo.commit,
    branch: gitInfo.branch,
    total: totalCoverage,
    modules: modulesCoverage,
  };

  // 读取历史记录
  const history = readCoverageHistory();

  // 添加新记录
  history.records.push(record);

  // 写入历史
  writeCoverageHistory(history);

  // 生成报告
  generateHistoryReport(history);

  console.log("\n✅ 覆盖率历史追踪完成！");
  console.log(`📁 历史文件: ${HISTORY_FILE}`);
}

// 运行主函数
main();
