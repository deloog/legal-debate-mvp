#!/usr/bin/env ts-node
/**
 * TypeScript strict mode修复脚本 - 修复undefined/null错误
 *
 * 自动修复以下错误类型：
 * - TS2532: Object is possibly 'undefined'
 * - TS18048: 'x' is possibly 'undefined'
 * - TS18047: 'x' is possibly 'null'
 */

import * as fs from 'fs';
import * as path from 'path';

interface FileErrors {
  file: string;
  errors: ErrorDetail[];
}

interface ErrorDetail {
  line: number;
  col: number;
  errorType: string;
  variable?: string;
  description: string;
}

// 读取TypeScript编译输出
function readTscOutput(): FileErrors[] {
  const errorsFile = path.join(__dirname, '..', 'tsc-errors-strict.txt');
  if (!fs.existsSync(errorsFile)) {
    console.error('错误文件不存在，请先运行: npx tsc --noEmit -p tsconfig.strict.json > tsc-errors-strict.txt 2>&1');
    process.exit(1);
  }

  const content = fs.readFileSync(errorsFile, 'utf-8');
  const lines = content.split('\n');
  const fileErrors: Map<string, FileErrors> = new Map();

  for (const line of lines) {
    // 匹配错误格式：file.ts(line,col): error TSXXXX: description
    const match = line.match(/^(.+)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
    if (!match) continue;

    const [, file, lineNum, colNum, errorType, description] = match;
    
    // 只处理TS2532、TS18048、TS18047错误
    if (
!['TS2532', 'TS18048', 'TS18047'].includes(errorType)
) {
      continue;
    }

    // 只处理src/和prisma/目录
    if (!file.startsWith('src/') && !file.startsWith('prisma/')) {
      continue;
    }

    if (!fileErrors.has(file)) {
      fileErrors.set(file, { file, errors: [] });
    }

    // 提取变量名
    const variableMatch = description.match(/'(.+?)' is possibly/);
    const variable = variableMatch ? variableMatch[1] : undefined;

    fileErrors.get(file)!.errors.push({
      line: parseInt(lineNum, 10),
      col: parseInt(colNum, 10),
      errorType,
      variable,
      description,
    });
  }

  return Array.from(fileErrors.values());
}

// 修复单个文件
function fixFile(fileErrors: FileErrors): { fixed: number; skipped: number } {
  const filePath = path.join(__dirname, '..', fileErrors.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`文件不存在: ${filePath}`);
    return { fixed: 0, skipped: 0 };
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const sortedErrors = [...fileErrors.errors].sort((a, b) => b.line - a.line);

  let fixed = 0;
  let skipped = 0;

  for (const error of sortedErrors) {
    const lineIndex = error.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) {
      skipped++;
      continue;
    }

    const line = lines[lineIndex];
    const beforeFix = line;

    // 尝试修复
    const fixedLine = fixLine(line, error);

    if (fixedLine !== line) {
      lines[lineIndex] = fixedLine;
      fixed++;
    } else {
      skipped++;
    }
  }

  if (fixed > 0) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    console.log(`✓ ${fileErrors.file}: 修复${fixed}个，跳过${skipped}个`);
  }

  return { fixed, skipped };
}

// 修复单行
function fixLine(line: string, error: ErrorDetail): string {
  const { errorType, variable, col } = error;

  // 策略1：添加可选链操作符
  if (variable && (errorType === 'TS2532' || errorType === 'TS18048')) {
    // 匹配模式: object.property
    const propertyPattern = new RegExp(`(^|\\s)${variable}\\.(\\w+)`, 'g');
    if (propertyPattern.test(line)) {
      return line.replace(propertyPattern, `$1${variable}?.$2`);
    }

    // 匹配模式: object.property.property
    const nestedPropertyPattern = new RegExp(`(^|\\s)${variable}\\.(\\w+)\\.(\\w+)`, 'g');
    if (nestedPropertyPattern.test(line)) {
      return line.replace(nestedPropertyPattern, `$1${variable}.$2?.$3`);
    }

    // 匹配模式: object.property()
    const methodPattern = new RegExp(`(^|\\s)${variable}\\.(\\w+)\\(`, 'g');
    if (methodPattern.test(line)) {
      return line.replace(methodPattern, `$1${variable}?.$2(`);
    }

    // 匹配模式: 变量直接使用
    const directUsagePattern = new RegExp(`(^|[^\\w$])${variable}([^\\w$])`, 'g');
    // 只在某些上下文中添加?，避免过度修复
    const safeDirectPatterns = [
      new RegExp(`\\[\\s*${variable}\\s*\\]`), // [variable]
      new RegExp(`,\\s*${variable}\\s*[,\\)]`), // ,variable,) 或 ,variable,)
    ];

    for (const pattern of safeDirectPatterns) {
      if (pattern.test(line)) {
        return line.replace(new RegExp(variable, 'g'), `${variable}?`);
      }
    }
  }

  // 策略2：TS18047 - 处理null检查
  if (errorType === 'TS18047') {
    // 对于redis等对象，添加非空断言
    if (variable && (variable === 'redis' || variable === 'client')) {
      const pattern = new RegExp(`(^|\\s)${variable}\\.`, 'g');
      return line.replace(pattern, `$1${variable}!.`);
    }
  }

  // 策略3：简单对象访问 - 添加可选链
  if (errorType === 'TS2532' && line.includes('[')) {
    // 处理数组/对象访问
    const bracketPattern = new RegExp(/(\w+)\[(.+?)\]/g);
    return line.replace(bracketPattern, '$1?.[$2]');
  }

  // 无法自动修复，返回原行
  return line;
}

// 主函数
function main() {
  console.log('开始修复undefined/null错误...\n');

  const fileErrors = readTscOutput();
  console.log(`找到${fileErrors.length}个文件需要修复\n`);

  let totalFixed = 0;
  let totalSkipped = 0;

  // 按错误数量排序，先修复错误多的文件
  fileErrors.sort((a, b) => b.errors.length - a.errors.length);

  // 只修复错误数量少于100的文件，避免大文件被破坏
  const filesToFix = fileErrors.filter(f => f.errors.length < 100);
  const filesToSkip = fileErrors.filter(f => f.errors.length >= 100);

  console.log(`计划修复${filesToFix.length}个文件（错误数<100）`);
  console.log(`跳过${filesToSkip.length}个文件（错误数>=100，需要人工修复）\n`);

  for (const fe of filesToFix) {
    const result = fixFile(fe);
    totalFixed += result.fixed;
    totalSkipped += result.skipped;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`修复完成！`);
  console.log(`  总共修复: ${totalFixed}个错误`);
  console.log(`  跳过修复: ${totalSkipped}个错误`);
  console.log(`  需要人工修复的文件: ${filesToSkip.length}个`);
  console.log('='.repeat(60));

  if (filesToSkip.length > 0) {
    console.log('\n需要人工修复的文件：');
    for (const file of filesToSkip) {
      console.log(`  ${file.file} (${file.errors.length}个错误)`);
    }
  }
}

if (require.main === module) {
  main();
}
