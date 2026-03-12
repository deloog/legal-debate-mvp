#!/usr/bin/env ts-node
/**
 * 批量修复未使用变量（TS6133）错误
 * 使用下划线前缀标记未使用的变量
 */

import * as fs from 'fs';
import * as path from 'path';

interface ErrorInfo {
  file: string;
  line: number;
  column: number;
  variable: string;
}

// 从ts6133-errors.txt读取错误信息
const errorFile = path.join(process.cwd(), 'ts6133-errors.txt');
const content = fs.readFileSync(errorFile, 'utf-8');

// 解析错误信息
const errors: ErrorInfo[] = content
  .split('\n')
  .filter(line => line.trim())
  .map(line => {
    const match = line.match(
      /^(.+)\((\d+),(\d+)\): error TS6133: '(.+)' is declared but its value is never read\.$/
    );
    if (!match) {
      throw new Error(`无法解析错误行: ${line}`);
    }
    return {
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      variable: match[4],
    };
  });

console.log(`找到 ${errors.length} 个TS6133错误`);

// 按文件分组错误
const errorsByFile = new Map<string, ErrorInfo[]>();
errors.forEach(error => {
  if (!errorsByFile.has(error.file)) {
    errorsByFile.set(error.file, []);
  }
  errorsByFile.get(error.file)!.push(error);
});

// 修复每个文件
let totalFixed = 0;
for (const [filePath, fileErrors] of errorsByFile.entries()) {
  console.log(`\n处理文件: ${filePath} (${fileErrors.length} 个错误)`);

  // 读取文件
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n');

  // 按行号排序（从大到小，避免行号变化影响后续修复）
  fileErrors.sort((a, b) => b.line - a.line);

  // 修复错误
  let fileFixed = 0;
  for (const error of fileErrors) {
    const lineIndex = error.line - 1; // 转换为0-based索引
    if (lineIndex < 0 || lineIndex >= lines.length) {
      console.warn(`  跳过: 行号 ${error.line} 超出范围`);
      continue;
    }

    let line = lines[lineIndex];
    const variable = error.variable;

    // 尝试不同的修复模式
    let fixed = false;

    // 模式1: 函数参数 - function foo(param) -> function foo(_param)
    if (
      line.includes(`function ${variable}(`) ||
      line.includes(` ${variable}:`)
    ) {
      // 在参数定义中添加下划线前缀
      if (line.includes(` ${variable}:`)) {
        line = line.replace(` ${variable}:`, ` _${variable}:`);
        fixed = true;
      } else if (line.includes(` ${variable},`)) {
        line = line.replace(` ${variable},`, ` _${variable},`);
        fixed = true;
      } else if (line.includes(` ${variable})`)) {
        line = line.replace(` ${variable})`, ` _${variable})`);
        fixed = true;
      } else if (line.includes(`(${variable},`)) {
        line = line.replace(`(${variable},`, `(_${variable},`);
        fixed = true;
      } else if (line.includes(`(${variable})`)) {
        line = line.replace(`(${variable})`, `(_${variable})`);
        fixed = true;
      }
    }

    // 模式2: const/let/var声明 - const x = ... -> const _x = ...
    if (!fixed) {
      const patterns = [
        `const ${variable} =`,
        `let ${variable} =`,
        `var ${variable} =`,
        `const ${variable}:`,
        `let ${variable}:`,
        `var ${variable}:`,
      ];

      for (const pattern of patterns) {
        if (line.includes(pattern)) {
          line = line.replace(
            pattern,
            pattern.replace(variable, `_${variable}`)
          );
          fixed = true;
          break;
        }
      }
    }

    // 模式3: 导入语句 - import { x } from ... -> import { _x } from ...
    if (!fixed && line.includes('import')) {
      if (line.includes(` ${variable},`)) {
        line = line.replace(` ${variable},`, ` _${variable},`);
        fixed = true;
      } else if (line.includes(` ${variable} }`)) {
        line = line.replace(` ${variable} }`, ` _${variable} }`);
        fixed = true;
      } else if (line.includes(`{${variable},`)) {
        line = line.replace(`{${variable},`, `{ _${variable},`);
        fixed = true;
      } else if (line.includes(`{${variable}}`)) {
        line = line.replace(`{${variable}}`, `{ _${variable}}`);
        fixed = true;
      }
    }

    if (fixed) {
      lines[lineIndex] = line;
      fileFixed++;
      console.log(`  ✓ 修复第 ${error.line} 行: ${variable}`);
    } else {
      console.warn(`  ✗ 无法自动修复第 ${error.line} 行: ${variable}`);
      console.warn(`    内容: ${line.trim()}`);
    }
  }

  // 写回文件
  if (fileFixed > 0) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    console.log(`  已修复 ${fileFixed}/${fileErrors.length} 个错误`);
    totalFixed += fileFixed;
  }
}

console.log(`\n总计: 已修复 ${totalFixed}/${errors.length} 个错误`);

// 输出未修复的错误
const remaining = errors.length - totalFixed;
if (remaining > 0) {
  console.log(`\n警告: ${remaining} 个错误需要手动修复`);
  console.log('请查看上述警告信息');
  process.exit(1);
}
