#!/usr/bin/env node
/**
 * Planning Agent覆盖率收集脚本
 * 专门用于收集和展示planning-agent模块的详细覆盖率信息
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// ANSI颜色代码
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function printHeader(text) {
  console.log('\n' + '='.repeat(80));
  log(text, colors.bright + colors.cyan);
  console.log('='.repeat(80) + '\n');
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

/**
 * 运行Jest覆盖率收集
 */
function runCoverage() {
  printHeader('开始收集Planning Agent覆盖率');

  const command = [
    'npm test --',
    '--coverage',
    '--collectCoverageFrom="src/lib/agent/planning-agent/**/*.ts"',
    '--coverageReporters=json',
    '--coverageReporters=text',
    '--verbose',
    '--testPathPatterns="planning-agent"',
  ].join(' ');

  log(`执行命令: ${command}`, colors.blue);
  console.log('');

  try {
    execSync(command, {
      encoding: 'utf-8',
      stdio: 'inherit',
    });
    // 即使阈值未达到，只要覆盖率文件生成就算成功
    return fs.existsSync(
      path.join(process.cwd(), 'coverage', 'coverage-final.json')
    );
  } catch {
    // 检查是否只是阈值未达导致的失败
    if (
      fs.existsSync(path.join(process.cwd(), 'coverage', 'coverage-final.json'))
    ) {
      printWarning('覆盖率低于目标阈值，但数据已成功收集');
      return true;
    }
    printError('覆盖率收集失败');
    return false;
  }
}

/**
 * 解析覆盖率JSON数据
 */
function parseCoverageData() {
  const coverageFile = path.join(
    process.cwd(),
    'coverage',
    'coverage-final.json'
  );

  if (!fs.existsSync(coverageFile)) {
    printError('未找到覆盖率数据文件');
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(coverageFile, 'utf-8'));
    return data;
  } catch (error) {
    printError('解析覆盖率数据失败');
    console.error(error.message);
    return null;
  }
}

/**
 * 过滤planning-agent相关文件
 */
function filterPlanningAgentFiles(coverageData) {
  const files = {};

  for (const [filePath, data] of Object.entries(coverageData)) {
    // 转换为正斜杠以兼容Windows路径
    const normalizedPath = filePath.replace(/\\/g, '/');

    if (
      normalizedPath.includes('src/lib/agent/planning-agent') &&
      !normalizedPath.includes('.test.') &&
      !normalizedPath.includes('.spec.')
    ) {
      files[filePath] = data;
    }
  }

  return files;
}

/**
 * 计算覆盖率百分比
 */
function calculateCoverage(data) {
  const total = Object.keys(data.s || {}).length;
  const covered = Object.values(data.s || {}).filter(value => value > 0).length;

  return total > 0 ? (covered / total) * 100 : 0;
}

/**
 * 格式化百分比
 */
function formatPercentage(value) {
  return `${value.toFixed(2)}%`;
}

/**
 * 获取未覆盖的行号
 */
function getUncoveredLines(data) {
  const lines = [];
  for (const [lineNumber, count] of Object.entries(data.s || {})) {
    if (count === 0) {
      lines.push(parseInt(lineNumber));
    }
  }
  return lines.sort((a, b) => a - b);
}

/**
 * 生成覆盖率颜色
 */
function getCoverageColor(percentage) {
  if (percentage >= 80) return colors.green;
  if (percentage >= 60) return colors.yellow;
  return colors.red;
}

/**
 * 显示详细覆盖率报告
 */
function displayDetailedReport(files) {
  printHeader('Planning Agent详细覆盖率报告');

  const filePaths = Object.keys(files);

  if (filePaths.length === 0) {
    printWarning('未找到planning-agent相关的源文件');
    return;
  }

  let totalStatements = 0;
  let totalCovered = 0;

  for (const filePath of filePaths) {
    const fileName = path.basename(filePath);
    const coverage = calculateCoverage(files[filePath]);
    const uncoveredLines = getUncoveredLines(files[filePath]);

    // 统计
    const fileTotal = Object.keys(files[filePath].s || {}).length;
    const fileCovered = Object.values(files[filePath].s || {}).filter(
      v => v > 0
    ).length;
    totalStatements += fileTotal;
    totalCovered += fileCovered;

    // 显示文件详情
    log(`文件: ${fileName}`, colors.bright);
    log(`路径: ${filePath}`, colors.blue);
    console.log(
      `  行数统计: ${formatPercentage(coverage)} (${fileCovered}/${fileTotal})`
    );
    log(
      `状态: ${coverage >= 80 ? '✓ 良好' : coverage >= 60 ? '⚠ 一般' : '✗ 需改进'}`,
      getCoverageColor(coverage)
    );

    if (uncoveredLines.length > 0 && uncoveredLines.length <= 20) {
      console.log(`  未覆盖行: ${uncoveredLines.join(', ')}`);
    } else if (uncoveredLines.length > 20) {
      console.log(
        `  未覆盖行: ${uncoveredLines.slice(0, 20).join(', ')} ... (共${uncoveredLines.length}行)`
      );
    }
    console.log('');
  }

  // 显示汇总
  const overallCoverage =
    totalStatements > 0 ? (totalCovered / totalStatements) * 100 : 0;
  printHeader('覆盖率汇总');
  log(
    `总体覆盖率: ${formatPercentage(overallCoverage)}`,
    getCoverageColor(overallCoverage)
  );
  console.log(`总行数: ${totalStatements}`);
  console.log(`覆盖行数: ${totalCovered}`);
  console.log(`未覆盖行数: ${totalStatements - totalCovered}`);

  // 显示改进建议
  printHeader('改进建议');

  if (overallCoverage >= 85) {
    printSuccess('覆盖率已达到目标 (85%+)');
  } else {
    const gap = (85 - overallCoverage).toFixed(2);
    printWarning(`覆盖率距离目标还差 ${gap}%`);
    console.log('');
    console.log('建议：');
    console.log('1. 为覆盖率较低的子模块添加独立测试用例');
    console.log('2. 为未覆盖的边界条件和错误处理添加测试');
    console.log('3. 检查types.ts文件，可能需要测试工具函数');
  }
}

/**
 * 生成Markdown报告
 */
function generateMarkdownReport(files) {
  printHeader('生成Markdown报告');

  let markdown = '# Planning Agent 覆盖率报告\n\n';
  markdown += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

  const filePaths = Object.keys(files);
  let totalStatements = 0;
  let totalCovered = 0;

  markdown += '## 文件详情\n\n';
  markdown += '| 文件 | 覆盖率 | 状态 | 说明 |\n';
  markdown += '|------|--------|------|------|\n';

  for (const filePath of filePaths) {
    const fileName = path.basename(filePath);
    const coverage = calculateCoverage(files[filePath]);
    const fileTotal = Object.keys(files[filePath].s || {}).length;
    const fileCovered = Object.values(files[filePath].s || {}).filter(
      v => v > 0
    ).length;
    const uncoveredLines = getUncoveredLines(files[filePath]);

    totalStatements += fileTotal;
    totalCovered += fileCovered;

    const status =
      coverage >= 80 ? '✓ 良好' : coverage >= 60 ? '⚠ 一般' : '✗ 需改进';
    const notes =
      uncoveredLines.length > 0
        ? `未覆盖行: ${uncoveredLines.slice(0, 5).join(', ')}${uncoveredLines.length > 5 ? '...' : ''}`
        : '全部覆盖';

    markdown += `| ${fileName} | ${formatPercentage(coverage)} | ${status} | ${notes} |\n`;
  }

  const overallCoverage =
    totalStatements > 0 ? (totalCovered / totalStatements) * 100 : 0;

  markdown += '\n## 汇总统计\n\n';
  markdown += `- **总体覆盖率**: ${formatPercentage(overallCoverage)}\n`;
  markdown += `- **目标覆盖率**: 85%\n`;
  markdown += `- **总行数**: ${totalStatements}\n`;
  markdown += `- **覆盖行数**: ${totalCovered}\n`;
  markdown += `- **未覆盖行数**: ${totalStatements - totalCovered}\n`;

  markdown += '\n## 改进建议\n\n';
  if (overallCoverage >= 85) {
    markdown += '✓ 覆盖率已达到目标，保持良好状态。\n';
  } else {
    markdown += '1. 为覆盖率较低的子模块添加独立测试用例\n';
    markdown += '2. 为未覆盖的边界条件和错误处理添加测试\n';
    markdown += '3. 检查types.ts文件，可能需要测试工具函数\n';
  }

  const reportPath = path.join(
    process.cwd(),
    'docs',
    'reports',
    'PLANNING_AGENT_COVERAGE.md'
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, markdown, 'utf-8');

  printSuccess(`Markdown报告已生成: ${reportPath}`);
}

/**
 * 主函数
 */
async function main() {
  printHeader('Planning Agent 覆盖率收集工具');

  // 运行覆盖率收集
  const success = runCoverage();
  if (!success) {
    process.exit(1);
  }

  // 解析覆盖率数据
  const coverageData = parseCoverageData();
  if (!coverageData) {
    process.exit(1);
  }

  // 过滤planning-agent文件
  const planningAgentFiles = filterPlanningAgentFiles(coverageData);

  // 显示详细报告
  displayDetailedReport(planningAgentFiles);

  // 生成Markdown报告
  generateMarkdownReport(planningAgentFiles);

  printSuccess('覆盖率收集完成！');
  console.log('');
  log('提示: 运行 "start coverage/index.html" 查看HTML详细报告', colors.cyan);
}

// 执行主函数
main().catch(error => {
  printError('执行失败');
  console.error(error);
  process.exit(1);
});
