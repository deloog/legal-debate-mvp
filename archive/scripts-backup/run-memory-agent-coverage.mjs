import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('正在运行MemoryAgent测试并收集覆盖率...\n');

let testOutput = '';
try {
  // 运行测试，并捕获输出（包括错误输出）
  testOutput = execSync(
    'npx jest src/__tests__/unit/agent/memory-agent/ --coverage --silent',
    {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: 'pipe',
    }
  );
  console.log(testOutput);
} catch (error) {
  // 如果测试失败，仍然尝试处理覆盖率
  testOutput = error.stdout || error.stderr || '';
  console.log(testOutput);
}

// 读取coverage-final.json
const coverageJsonPath = path.join(
  __dirname,
  '..',
  'coverage',
  'coverage-final.json'
);

if (fs.existsSync(coverageJsonPath)) {
  const coverage = JSON.parse(fs.readFileSync(coverageJsonPath, 'utf8'));

  // 查找所有包含memory-agent的文件
  const agentFiles = Object.keys(coverage).filter(
    p => p.includes('memory-agent') && !p.includes('test')
  );

  if (agentFiles.length > 0) {
    console.log('\n\n=== MemoryAgent模块覆盖率摘要 ===\n');

    let totalStatements = { covered: 0, total: 0 };
    let totalBranches = { covered: 0, total: 0 };
    let totalFunctions = { covered: 0, total: 0 };
    let totalLines = { covered: 0, total: 0 };

    agentFiles.forEach(filePath => {
      const fileData = coverage[filePath];
      totalStatements.covered += fileData.s.covered;
      totalStatements.total += fileData.s.total;
      totalBranches.covered += fileData.b.covered;
      totalBranches.total += fileData.b.total;
      totalFunctions.covered += fileData.f.covered;
      totalFunctions.total += fileData.f.total;
      totalLines.covered += fileData.l.covered;
      totalLines.total += fileData.l.total;
    });

    const calcPct = (covered, total) =>
      total > 0 ? ((covered / total) * 100).toFixed(2) : '0.00';

    console.log(`总计 (${agentFiles.length}个文件):`);
    console.log(
      `  语句覆盖率: ${calcPct(totalStatements.covered, totalStatements.total)}%`
    );
    console.log(
      `  分支覆盖率: ${calcPct(totalBranches.covered, totalBranches.total)}%`
    );
    console.log(
      `  函数覆盖率: ${calcPct(totalFunctions.covered, totalFunctions.total)}%`
    );
    console.log(
      `  行覆盖率: ${calcPct(totalLines.covered, totalLines.total)}%\n`
    );

    // 保存到docs
    const reportPath = path.join(
      __dirname,
      '..',
      'docs',
      'MEMORY_AGENT_COVERAGE_REPORT.md'
    );
    const report = `# MemoryAgent 覆盖率报告

生成时间: ${new Date().toLocaleString('zh-CN')}

## 总体覆盖率

- **语句覆盖率**: ${calcPct(totalStatements.covered, totalStatements.total)}% (${totalStatements.covered}/${totalStatements.total})
- **分支覆盖率**: ${calcPct(totalBranches.covered, totalBranches.total)}% (${totalBranches.covered}/${totalBranches.total})
- **函数覆盖率**: ${calcPct(totalFunctions.covered, totalFunctions.total)}% (${totalFunctions.covered}/${totalFunctions.total})
- **行覆盖率**: ${calcPct(totalLines.covered, totalLines.total)}% (${totalLines.covered}/${totalLines.total})

## 测试结果

${testOutput}

详细覆盖率报告请查看: [coverage/lcov-report/index.html](../../coverage/lcov-report/index.html)`;

    fs.writeFileSync(reportPath, report, 'utf8');
    console.log(`覆盖率报告已保存到: ${reportPath}`);
  } else {
    console.log('\n未找到memory-agent相关的覆盖率数据');
  }
} else {
  console.log('\n覆盖率文件不存在');
}
