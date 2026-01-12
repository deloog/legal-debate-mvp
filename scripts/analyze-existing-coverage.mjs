#!/usr/bin/env node
/**
 * 分析现有覆盖率数据
 * 直接读取coverage/coverage-final.json进行分析，不重新运行测试
 */

import fs from 'fs';
import path from 'path';

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

function printInfo(text) {
  log(`ℹ ${text}`, colors.cyan);
}

// Jest配置的覆盖率阈值
const coverageThresholds = {
  './src/app/api/': {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90,
    priority: 'high',
    name: 'API层',
  },
  './src/lib/cache/': {
    statements: 85,
    branches: 80,
    functions: 85,
    lines: 85,
    priority: 'medium',
    name: '缓存层',
  },
  './src/lib/db/': {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80,
    priority: 'low',
    name: '数据库层',
  },
  './src/lib/ai/': {
    statements: 60,
    branches: 50,
    functions: 60,
    lines: 60,
    priority: 'low',
    name: 'AI服务层',
  },
  './src/lib/debate/': {
    statements: 85,
    branches: 80,
    functions: 85,
    lines: 85,
    priority: 'medium',
    name: '辩论功能层',
  },
  './src/lib/agent/planning-agent/': {
    statements: 85,
    branches: 75,
    functions: 85,
    lines: 85,
    priority: 'medium',
    name: 'Planning Agent',
  },
  './src/lib/law-article/': {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90,
    priority: 'high',
    name: '法条检索层',
  },
  './src/lib/monitoring/': {
    statements: 75,
    branches: 70,
    functions: 75,
    lines: 75,
    priority: 'low',
    name: '监控层',
  },
};

function parseCoverageData() {
  const coverageFile = path.join(
    process.cwd(),
    'coverage',
    'coverage-final.json'
  );

  if (!fs.existsSync(coverageFile)) {
    printError('未找到覆盖率数据文件');
    printInfo('请先运行: npm run test:coverage');
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

function groupFilesByModule(coverageData) {
  const modules = {};

  for (const [modulePath, config] of Object.entries(coverageThresholds)) {
    modules[modulePath] = {
      config,
      files: [],
      summary: {
        statements: { total: 0, covered: 0, threshold: config.statements },
        branches: { total: 0, covered: 0, threshold: config.branches },
        functions: { total: 0, covered: 0, threshold: config.functions },
        lines: { total: 0, covered: 0, threshold: config.lines },
      },
    };

    for (const [filePath, data] of Object.entries(coverageData)) {
      const normalizedPath = filePath.replace(/\\/g, '/');

      if (
        normalizedPath.includes(modulePath.replace('./', '')) &&
        !normalizedPath.includes('.test.') &&
        !normalizedPath.includes('.spec.')
      ) {
        modules[modulePath].files.push({
          path: filePath,
          name: path.basename(filePath),
          data,
        });

        if (data.s) {
          const totalLines = Object.keys(data.s).length;
          const coveredLines = Object.values(data.s).filter(v => v > 0).length;
          modules[modulePath].summary.lines.total += totalLines;
          modules[modulePath].summary.lines.covered += coveredLines;
          modules[modulePath].summary.statements.total += totalLines;
          modules[modulePath].summary.statements.covered += coveredLines;
        }

        if (data.b) {
          const totalBranches = Object.values(data.b).reduce(
            (sum, arr) => sum + arr.length,
            0
          );
          const coveredBranches = Object.values(data.b).reduce(
            (sum, arr) => sum + arr.filter(v => v > 0).length,
            0
          );
          modules[modulePath].summary.branches.total += totalBranches;
          modules[modulePath].summary.branches.covered += coveredBranches;
        }

        if (data.f) {
          const totalFuncs = Object.keys(data.f).length;
          const coveredFuncs = Object.values(data.f).filter(v => v > 0).length;
          modules[modulePath].summary.functions.total += totalFuncs;
          modules[modulePath].summary.functions.covered += coveredFuncs;
        }
      }
    }
  }

  return modules;
}

function calculateCoverage(total, covered) {
  return total > 0 ? (covered / total) * 100 : 0;
}

function isMet(coverage, threshold) {
  return coverage >= threshold;
}

function getGap(coverage, threshold) {
  return Math.max(0, threshold - coverage);
}

function getStatus(coverage, threshold) {
  if (coverage >= threshold) return '✓ 达标';
  if (coverage >= threshold - 10) return '⚠ 接近';
  return '✗ 未达标';
}

function displayDiagnosisResults(modules) {
  printHeader('全模块覆盖率诊断结果');

  const results = [];

  for (const [modulePath, module] of Object.entries(modules)) {
    const { config, summary, files } = module;

    const stmtCoverage = calculateCoverage(
      summary.statements.total,
      summary.statements.covered
    );
    const branchCoverage = calculateCoverage(
      summary.branches.total,
      summary.branches.covered
    );
    const funcCoverage = calculateCoverage(
      summary.functions.total,
      summary.functions.covered
    );
    const lineCoverage = calculateCoverage(
      summary.lines.total,
      summary.lines.covered
    );

    const stmtMet = isMet(stmtCoverage, summary.statements.threshold);
    const branchMet = isMet(branchCoverage, summary.branches.threshold);
    const funcMet = isMet(funcCoverage, summary.functions.threshold);
    const lineMet = isMet(lineCoverage, summary.lines.threshold);

    const gaps = {
      statements: getGap(stmtCoverage, summary.statements.threshold),
      branches: getGap(branchCoverage, summary.branches.threshold),
      functions: getGap(funcCoverage, summary.functions.threshold),
      lines: getGap(lineCoverage, summary.lines.threshold),
    };

    const maxGap = Math.max(...Object.values(gaps));
    const overallStatus = stmtMet && branchMet && funcMet && lineMet;

    results.push({
      module: modulePath,
      name: config.name,
      priority: config.priority,
      summary,
      actualCoverage: {
        statements: stmtCoverage,
        branches: branchCoverage,
        functions: funcCoverage,
        lines: lineCoverage,
      },
      thresholds: {
        statements: summary.statements.threshold,
        branches: summary.branches.threshold,
        functions: summary.functions.threshold,
        lines: summary.lines.threshold,
      },
      gaps,
      maxGap,
      overallStatus,
      fileCount: files.length,
      uncoveredLines: files.reduce((sum, f) => {
        if (f.data.s) {
          return sum + Object.values(f.data.s).filter(v => v === 0).length;
        }
        return sum;
      }, 0),
    });

    log(`模块: ${config.name} (${modulePath})`, colors.bright);
    const priorityColor =
      config.priority === 'high'
        ? colors.red
        : config.priority === 'medium'
          ? colors.yellow
          : colors.green;
    log(
      `优先级: ${config.priority === 'high' ? '🔴 高' : config.priority === 'medium' ? '🟡 中' : '🟢 低'}`,
      priorityColor
    );

    if (files.length === 0) {
      printWarning('未找到任何文件');
    } else {
      console.log('\n覆盖率详情:');
      console.log(
        `  语句: ${stmtCoverage.toFixed(2)}% / ${summary.statements.threshold}% ${getStatus(stmtCoverage, summary.statements.threshold)}`
      );
      console.log(
        `  分支: ${branchCoverage.toFixed(2)}% / ${summary.branches.threshold}% ${getStatus(branchCoverage, summary.branches.threshold)}`
      );
      console.log(
        `  函数: ${funcCoverage.toFixed(2)}% / ${summary.functions.threshold}% ${getStatus(funcCoverage, summary.functions.threshold)}`
      );
      console.log(
        `  行数: ${lineCoverage.toFixed(2)}% / ${summary.lines.threshold}% ${getStatus(lineCoverage, summary.lines.threshold)}`
      );

      console.log(`\n文件数量: ${files.length}`);
      console.log(`未覆盖行数: ${results[results.length - 1].uncoveredLines}`);

      if (!overallStatus) {
        log(`\n最大差距: ${maxGap.toFixed(2)}%`, colors.red);
        printInfo('需要补充测试用例');
      } else {
        printSuccess('覆盖率达标');
      }
    }

    console.log('\n' + '-'.repeat(60) + '\n');
  }

  return results;
}

function generateMarkdownReport(results) {
  printHeader('生成Markdown报告');

  let markdown = '# 全模块覆盖率诊断报告\n\n';
  markdown += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

  const total = results.length;
  const met = results.filter(r => r.overallStatus).length;
  const notMet = results.filter(r => !r.overallStatus).length;

  markdown += '## 执行摘要\n\n';
  markdown += `- **总模块数**: ${total}\n`;
  markdown += `- **达标模块**: ${met} (${((met / total) * 100).toFixed(1)}%)\n`;
  markdown += `- **未达标模块**: ${notMet} (${((notMet / total) * 100).toFixed(1)}%)\n\n`;

  markdown += '## 详细结果\n\n';

  for (const result of results) {
    if (result.fileCount === 0) continue;

    markdown += `### ${result.name} \`${result.module}\`\n\n`;

    const status = result.overallStatus ? '✅ 达标' : '❌ 未达标';
    const priority =
      result.priority === 'high'
        ? '🔴 高'
        : result.priority === 'medium'
          ? '🟡 中'
          : '🟢 低';

    markdown += `**状态**: ${status}\n`;
    markdown += `**优先级**: ${priority}\n\n`;

    markdown += '| 指标 | 阈值 | 实际 | 差距 |\n';
    markdown += '|------|------|------|------|\n';
    markdown += `| 语句 | ${result.thresholds.statements}% | ${result.actualCoverage.statements.toFixed(2)}% | ${result.gaps.statements.toFixed(2)}% |\n`;
    markdown += `| 分支 | ${result.thresholds.branches}% | ${result.actualCoverage.branches.toFixed(2)}% | ${result.gaps.branches.toFixed(2)}% |\n`;
    markdown += `| 函数 | ${result.thresholds.functions}% | ${result.actualCoverage.functions.toFixed(2)}% | ${result.gaps.functions.toFixed(2)}% |\n`;
    markdown += `| 行数 | ${result.thresholds.lines}% | ${result.actualCoverage.lines.toFixed(2)}% | ${result.gaps.lines.toFixed(2)}% |\n\n`;

    markdown += `**文件数**: ${result.fileCount}\n`;
    markdown += `**未覆盖行数**: ${result.uncoveredLines}\n\n`;

    if (!result.overallStatus) {
      markdown += `#### 🚨 需要改进\n\n`;
      markdown += `最大差距: **${result.maxGap.toFixed(2)}%**\n\n`;
    }
  }

  // 总结
  markdown += '## 总结\n\n';

  if (notMet === 0) {
    markdown +=
      '✅ 所有模块的测试覆盖率均已达到预设阈值，测试工作处于良好状态。\n\n';
  } else {
    markdown += `⚠️ 共有 **${notMet}** 个模块未达到覆盖率阈值，需要补充测试用例。\n\n`;
    markdown += '### 建议执行顺序\n\n';
    markdown += '1. 优先处理高优先级模块（API层、法条检索层）\n';
    markdown +=
      '2. 次要处理中优先级模块（缓存层、辩论功能层、Planning Agent）\n';
    markdown += '3. 最后处理低优先级模块（数据库层、监控层、AI服务层）\n\n';
    markdown += '### 补充测试的重点\n\n';
    markdown += '1. **错误处理**: 测试各种异常场景和错误分支\n';
    markdown += '2. **边界条件**: 测试输入的边界值、空值、undefined等\n';
    markdown += '3. **业务逻辑**: 测试核心业务流程的各种分支\n';
    markdown += '4. **集成测试**: 测试模块间的交互和数据流转\n\n';
  }

  const reportPath = path.join(
    process.cwd(),
    'docs',
    'reports',
    'ALL_MODULES_COVERAGE_DIAGNOSIS.md'
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, markdown, 'utf-8');

  printSuccess(`诊断报告已生成: ${reportPath}`);
}

async function main() {
  printHeader('现有覆盖率数据分析工具');

  const coverageData = parseCoverageData();
  if (!coverageData) {
    process.exit(1);
  }

  const modules = groupFilesByModule(coverageData);
  const results = displayDiagnosisResults(modules);
  generateMarkdownReport(results);

  printSuccess('分析完成！');
  console.log('');
  log('下一步:', colors.bright);
  log('1. 查看生成的诊断报告了解详细情况', colors.cyan);
  log('2. 根据优先级和差距补充测试用例', colors.cyan);
  log('3. 运行 `npm run test:coverage` 验证改进效果', colors.cyan);
}

main().catch(error => {
  printError('执行失败');
  console.error(error);
  process.exit(1);
});
