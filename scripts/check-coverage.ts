// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");

const coverageFile = path.join(
  __dirname,
  "..",
  "coverage",
  "coverage-final.json",
);
const coverage = JSON.parse(fs.readFileSync(coverageFile, "utf-8"));

const targetFiles = [
  "src/lib/ai/debate-prompt-optimizer.ts",
  "src/lib/ai/enhanced-debate-generator.ts",
];

console.log("=== AI模块覆盖率报告 ===\n");

for (const targetPath of targetFiles) {
  const normalizedPath = path.resolve(targetPath);
  const coverageKey = Object.keys(coverage).find((k) => {
    const absPath = path.resolve(k);
    return (
      absPath === normalizedPath ||
      absPath.includes(targetPath.replace("src/", ""))
    );
  });

  if (coverageKey) {
    const file = coverage[coverageKey];
    const filename = path.basename(coverageKey);

    const lines = ((file.l.covered / file.l.total) * 100).toFixed(2);
    const statements = ((file.s.covered / file.s.total) * 100).toFixed(2);
    const branches = ((file.b.covered / file.b.total) * 100).toFixed(2);
    const functions = ((file.f.covered / file.f.total) * 100).toFixed(2);

    console.log(`文件: ${filename}`);
    console.log(`  行覆盖率: ${lines}%`);
    console.log(`  语句覆盖率: ${statements}%`);
    console.log(`  分支覆盖率: ${branches}%`);
    console.log(`  函数覆盖率: ${functions}%`);
    console.log("");
  } else {
    console.log(`未找到覆盖率数据: ${targetPath}\n`);
  }
}
