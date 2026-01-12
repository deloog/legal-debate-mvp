import fs from 'fs';
import path from 'path';

// 读取覆盖率文件
const coveragePath = 'coverage/coverage-final.json';
const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));

// 查找所有memory-agent相关文件
const memoryFiles = Object.keys(coverageData).filter(file =>
  file.includes('memory-agent')
);

console.log('MemoryAgent 覆盖率报告：\n');

let totalStatements = 0;
let totalCovered = 0;

memoryFiles.forEach(file => {
  const data = coverageData[file];
  const s = data.s || {};
  const f = data.f || {};
  const b = data.b || {};

  const statements = Object.keys(s).length;
  const covered = Object.values(s).filter(v => v > 0).length;
  const stmtPercent =
    statements > 0 ? ((covered / statements) * 100).toFixed(2) : '0.00';

  const functions = Object.keys(f).length;
  const funcCovered = Object.values(f).filter(v => v > 0).length;
  const funcPercent =
    functions > 0 ? ((funcCovered / functions) * 100).toFixed(2) : '0.00';

  let branchCovered = 0;
  let branchTotal = 0;
  Object.values(b).forEach(v => {
    if (Array.isArray(v)) {
      branchTotal += v.length;
      branchCovered += v.filter(c => c > 0).length;
    }
  });
  const branchPercent =
    branchTotal > 0 ? ((branchCovered / branchTotal) * 100).toFixed(2) : '0.00';

  const fileName = path.basename(file);
  console.log(`${fileName}:`);
  console.log(`  语句覆盖率: ${covered}/${statements} (${stmtPercent}%)`);
  console.log(`  函数覆盖率: ${funcCovered}/${functions} (${funcPercent}%)`);
  console.log(
    `  分支覆盖率: ${branchCovered}/${branchTotal} (${branchPercent}%)`
  );
  console.log('');

  totalStatements += statements;
  totalCovered += covered;
});

const overallPercent =
  totalStatements > 0
    ? ((totalCovered / totalStatements) * 100).toFixed(2)
    : '0.00';
console.log('总计：');
console.log(
  `  语句覆盖率: ${totalCovered}/${totalStatements} (${overallPercent}%)`
);
console.log(`  目标: ≥90%`);
console.log(
  `  状态: ${parseFloat(overallPercent) >= 90 ? '✓ 达标' : '✗ 未达标'}`
);
