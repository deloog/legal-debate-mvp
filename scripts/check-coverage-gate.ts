#!/usr/bin/env tsx

/**
 * 覆盖率门禁检查脚本
 *
 * 用途：
 * - 验证测试覆盖率是否达到预设阈值
 * - 阻止低于阈值的代码合并
 * - 生成详细的覆盖率报告
 *
 * 使用方式：
 * node scripts/check-coverage-gate.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ___dirname = path.dirname(__filename);

interface CoverageData {
  total: {
    lines: { pct: number; total: number; covered: number };
    statements: { pct: number; total: number; covered: number };
    functions: { pct: number; total: number; covered: number };
    branches: { pct: number; total: number; covered: number };
  };
  [key: string]: any;
}

interface ThresholdConfig {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

// 覆盖率阈值配置
const THRESHOLDS: Record<string, ThresholdConfig> = {
  // 全局最低要求
  global: {
    statements: 70,
    branches: 70,
    functions: 70,
    lines: 70,
  },
  // API层 - 关键业务逻辑
  'src/app/api/': {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90,
  },
  // 缓存层 - 基础设施
  'src/lib/cache/': {
    statements: 85,
    branches: 80,
    functions: 85,
    lines: 85,
  },
  // 数据库层 - 基础设施
  'src/lib/db/': {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80,
  },
  // AI服务层 - 外部依赖
  'src/lib/ai/': {
    statements: 60,
    branches: 50,
    functions: 60,
    lines: 60,
  },
  // 辩论功能层 - 核心业务
  'src/lib/debate/': {
    statements: 85,
    branches: 80,
    functions: 85,
    lines: 85,
  },
  // 法条检索层 - 核心业务
  'src/lib/law-article/': {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90,
  },
  // 监控层 - 基础设施
  'src/lib/monitoring/': {
    statements: 75,
    branches: 70,
    functions: 75,
    lines: 75,
  },
};

/**
 * 读取覆盖率数据
 */
function readCoverageData(coveragePath: string): CoverageData | null {
  try {
    const jsonContent = fs.readFileSync(coveragePath, 'utf-8');
    const data = JSON.parse(jsonContent);

    // 如果数据已经是汇总格式，直接返回
    if (data.total) {
      return data;
    }

    // 如果是Jest原始格式，计算总体覆盖率
    const total = calculateTotalCoverage(data);
    return { ...data, total };
  } catch (error) {
    console.error(`❌ 无法读取覆盖率文件: ${coveragePath}`);
    console.error(
      `   错误: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * 计算总体覆盖率
 */
function calculateTotalCoverage(
  coverageData: Record<string, any>
): CoverageData['total'] {
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
 * 查找匹配的阈值配置
 */
function findMatchingThreshold(filePath: string): ThresholdConfig | null {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const [pattern, threshold] of Object.entries(THRESHOLDS)) {
    if (pattern === 'global') continue;
    if (normalizedPath.includes(pattern.replace('./', ''))) {
      return threshold;
    }
  }

  return THRESHOLDS.global;
}

/**
 * 检查覆盖率是否达标
 */
function checkThreshold(
  actual: number,
  threshold: number,
  metricName: string,
  filePath?: string
): boolean {
  const passed = actual >= threshold;

  if (!passed) {
    const filePrefix = filePath ? `${path.basename(filePath)} - ` : '';
    console.error(
      `   ❌ ${filePrefix}${metricName}: ${actual.toFixed(2)}% (阈值: ${threshold}%)`
    );
  }

  return passed;
}

/**
 * 格式化覆盖率报告
 */
function formatCoverageReport(
  coverageData: CoverageData,
  failures: string[]
): void {
  console.log('\n📊 覆盖率报告\n');
  console.log('━'.repeat(60));

  const total = coverageData.total;
  console.log('\n📈 总体覆盖率:');
  console.log(`   Statements: ${total.statements.pct.toFixed(2)}%`);
  console.log(`   Branches:   ${total.branches.pct.toFixed(2)}%`);
  console.log(`   Functions:  ${total.functions.pct.toFixed(2)}%`);
  console.log(`   Lines:      ${total.lines.pct.toFixed(2)}%`);

  console.log('\n━'.repeat(60));

  if (failures.length > 0) {
    console.log('\n❌ 未达标的模块:\n');
    failures.forEach((failure, index) => {
      console.log(`   ${index + 1}. ${failure}`);
    });
  }

  console.log('\n━'.repeat(60));
}

/**
 * 检查整体覆盖率
 */
function checkGlobalCoverage(coverageData: CoverageData): boolean {
  const global = THRESHOLDS.global;
  const total = coverageData.total;

  console.log('\n🔍 检查整体覆盖率:');

  const passed = [
    checkThreshold(total.statements.pct, global.statements, 'Statements'),
    checkThreshold(total.branches.pct, global.branches, 'Branches'),
    checkThreshold(total.functions.pct, global.functions, 'Functions'),
    checkThreshold(total.lines.pct, global.lines, 'Lines'),
  ].every(Boolean);

  return passed;
}

/**
 * 计算文件覆盖率百分比
 */
function calculateFileCoverage(fileCoverage: any): {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
} {
  let totalLines = 0;
  let coveredLines = 0;
  let totalStatements = 0;
  let coveredStatements = 0;
  let totalFunctions = 0;
  let coveredFunctions = 0;
  let totalBranches = 0;
  let coveredBranches = 0;

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

  return {
    lines: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
    statements:
      totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0,
    functions:
      totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
    branches: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
  };
}

/**
 * 检查各模块覆盖率
 */
function checkModuleCoverage(coverageData: CoverageData): string[] {
  const failures: string[] = [];

  console.log('\n🔍 检查各模块覆盖率:');

  for (const filePath of Object.keys(coverageData)) {
    if (filePath === 'total') continue;

    const threshold = findMatchingThreshold(filePath);
    if (!threshold) continue;

    const fileCoverage = coverageData[filePath];
    if (!fileCoverage) continue;

    // 计算文件覆盖率百分比
    const filePct = calculateFileCoverage(fileCoverage);

    const fileName = path.basename(filePath);
    const passed = [
      checkThreshold(filePct.lines, threshold.lines, 'Lines', fileName),
      checkThreshold(
        filePct.statements,
        threshold.statements,
        'Statements',
        fileName
      ),
      checkThreshold(
        filePct.functions,
        threshold.functions,
        'Functions',
        fileName
      ),
      checkThreshold(
        filePct.branches,
        threshold.branches,
        'Branches',
        fileName
      ),
    ].every(Boolean);

    if (!passed) {
      failures.push(`${fileName} (路径: ${filePath})`);
    }
  }

  return failures;
}

/**
 * 主函数
 */
function main(): void {
  console.log('🚀 开始检查覆盖率门禁...\n');

  // 覆盖率报告路径
  const coveragePath = path.resolve(
    process.cwd(),
    'coverage-final',
    'coverage-final.json'
  );

  // 读取覆盖率数据
  const coverageData = readCoverageData(coveragePath);
  if (!coverageData) {
    console.error('\n❌ 覆盖率门禁检查失败：无法读取覆盖率数据');
    console.error('   请先运行测试: npm run test:coverage\n');
    process.exit(1);
  }

  // 检查整体覆盖率
  const globalPassed = checkGlobalCoverage(coverageData);

  // 检查各模块覆盖率
  const moduleFailures = checkModuleCoverage(coverageData);
  const modulesPassed = moduleFailures.length === 0;

  // 格式化报告
  formatCoverageReport(coverageData, moduleFailures);

  // 最终结果
  console.log('\n🎯 检查结果:');

  if (globalPassed && modulesPassed) {
    console.log('   ✅ 所有覆盖率检查通过！');
    console.log('\n💡 建议:');
    console.log('   - 定期运行覆盖率检查');
    console.log('   - 关注边缘情况的测试覆盖');
    console.log('   - 保持测试质量和可维护性\n');
    process.exit(0);
  } else {
    console.log('   ❌ 覆盖率门禁检查失败！');

    if (!globalPassed) {
      console.log('\n⚠️  整体覆盖率未达标');
      console.log('   请参考 docs/TEST_COVERAGE_GUIDE.md 了解详细信息');
    }

    if (!modulesPassed) {
      console.log('\n⚠️  部分模块覆盖率未达标');
      console.log('   请补充测试用例以提高覆盖率');
    }

    console.log('\n📚 相关文档:');
    console.log('   - 测试覆盖率指南: docs/TEST_COVERAGE_GUIDE.md');
    console.log('   - 测试策略: docs/TEST_STRATEGY.md\n');

    process.exit(1);
  }
}

// 运行主函数
main();
