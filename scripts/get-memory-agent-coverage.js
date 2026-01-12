import fs from 'fs';
import path from 'path';

// 读取覆盖率摘要文件
const coverageSummaryPath = path.join(
  __dirname,
  '..',
  'coverage',
  'coverage-summary.json'
);

if (fs.existsSync(coverageSummaryPath)) {
  const summary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));

  console.log('=== MemoryAgent 覆盖率摘要 ===\n');

  // 打印总覆盖率
  if (summary.total) {
    console.log('总计:');
    console.log(`  语句覆盖率: ${summary.total.statements.pct.toFixed(2)}%`);
    console.log(`  分支覆盖率: ${summary.total.branches.pct.toFixed(2)}%`);
    console.log(`  函数覆盖率: ${summary.total.functions.pct.toFixed(2)}%`);
    console.log(`  行覆盖率: ${summary.total.lines.pct.toFixed(2)}%`);
  }

  // 打印各文件覆盖率
  console.log('\n各文件覆盖率:');
  for (const [filePath, fileData] of Object.entries(summary)) {
    if (filePath === 'total') continue;

    // 只显示memory-agent相关文件
    if (filePath.includes('memory-agent')) {
      console.log(`\n${filePath}:`);
      console.log(
        `  语句: ${fileData.statements.pct.toFixed(2)}% (${fileData.statements.covered}/${fileData.statements.total})`
      );
      console.log(
        `  分支: ${fileData.branches.pct.toFixed(2)}% (${fileData.branches.covered}/${fileData.branches.total})`
      );
      console.log(
        `  函数: ${fileData.functions.pct.toFixed(2)}% (${fileData.functions.covered}/${fileData.functions.total})`
      );
      console.log(
        `  行: ${fileData.lines.pct.toFixed(2)}% (${fileData.lines.covered}/${fileData.lines.total})`
      );
    }
  }
} else {
  console.log(
    '覆盖率摘要文件不存在，请先运行: npm test -- src/__tests__/unit/agent/memory-agent/ --coverage'
  );
}
