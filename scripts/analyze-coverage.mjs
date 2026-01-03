import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const coveragePath = path.join(
  __dirname,
  "..",
  "coverage",
  "coverage-final.json",
);

if (fs.existsSync(coveragePath)) {
  const coverage = JSON.parse(fs.readFileSync(coveragePath, "utf8"));

  console.log("覆盖率文件中的所有路径：\n");
  const paths = Object.keys(coverage);

  // 查找memory-agent相关路径
  const memoryAgentPaths = paths.filter((p) =>
    p.toLowerCase().includes("memory"),
  );

  console.log(`总共 ${paths.length} 个文件`);
  console.log(`包含memory的文件: ${memoryAgentPaths.length} 个\n`);

  if (memoryAgentPaths.length > 0) {
    console.log("Memory相关文件：");
    memoryAgentPaths.forEach((p, i) => {
      console.log(`${i + 1}. ${p}`);
    });
  } else {
    // 显示前10个文件作为示例
    console.log("前10个文件（用于调试）：");
    paths.slice(0, 10).forEach((p, i) => {
      console.log(`${i + 1}. ${p}`);
    });
  }

  // 检查第一个文件的数据结构
  if (paths.length > 0) {
    const firstFile = paths[0];
    console.log("\n第一个文件的数据结构示例：");
    console.log(`路径: ${firstFile}`);
    console.log("数据键:", Object.keys(coverage[firstFile]));
  }
} else {
  console.log("覆盖率文件不存在");
}
