#!/usr/bin/env ts-node
/**
 * TypeScript Strict Mode - Type Mismatch Fixer
 *
 * 修复常见的类型不匹配错误：
 * - TS2322: 类型不匹配
 * - TS2345: 参数类型不匹配
 * - TS2564: 属性未初始化
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// 配置
const CONFIG = {
  include: ['src/**/*.{ts,tsx}', 'prisma/**/*.ts'],
  exclude: [
    '**/*.d.ts',
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/build/**',
  ],
  dryRun: false, // 设为true只显示不修改
};

// 修复规则
const FIX_RULES = [
  {
    name: 'TS2564 - 属性初始化',
    pattern: /(\w+):\s+(\w+)(?:<[^>]+>)?(?:\s*=\s*[\w\[\]{}"']|;)?;/gm,
    test: (match: string) => {
      // 匹配未初始化的属性（没有初始值）
      return !match.includes('=') && !match.includes('!');
    },
    fix: (match: string, className: string) => {
      // 尝试添加默认值或definite assignment
      if (match.match(/:\s*string\s*;$/)) {
        return match.replace(/(\w+):\s*string\s*;/, '$1: string = "";');
      } else if (match.match(/:\s*number\s*;$/)) {
        return match.replace(/(\w+):\s*number\s*;/, '$1: number = 0;');
      } else if (match.match(/:\s*boolean\s*;$/)) {
        return match.replace(/(\w+):\s*boolean\s*;/, '$1: boolean = false;');
      } else if (match.match(/:\s*\w+\[\]\s*;$/)) {
        return match.replace(/(\w+):\s*(\w+\[\])\s*;/, '$1: $2 = [];');
      } else {
        // 添加 definite assignment assertion
        return match.replace(/(\w+):\s*(\w+)/, '$1!: $2');
      }
    },
  },
  {
    name: 'TS2345 - 字符串|undefined -> 字符串',
    pattern: /\.(\w+)\([^)]*\)/g,
    test: (code: string, fileContent: string, matchStart: number) => {
      // 检查是否是可选链调用
      const before = fileContent.substring(matchStart - 10, matchStart);
      return before.includes('?');
    },
    fix: (match: string) => {
      // 移除可选链，因为后面会有非空断言
      return match;
    },
  },
];

interface FixResult {
  file: string;
  fixes: number;
  errors: string[];
}

/**
 * 修复单个文件
 */
function fixFile(filePath: string): FixResult {
  console.log(`\n处理文件: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let fixes = 0;
  const errors: string[] = [];
  
  // 应用所有修复规则
  for (const rule of FIX_RULES) {
    let match;
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    
    // 重置正则表达式状态
    rule.pattern.lastIndex = 0;
    
    while ((match = regex.exec(content)) !== null) {
      try {
        // 测试是否应该修复
        if (rule.test(match[0], content, match.index || 0)) {
          const original = match[0];
          let fixed: string;
          
          if (rule.name.includes('TS2564')) {
            // TS2564特殊处理
            fixed = rule.fix(match[0], match[1] || '');
          } else {
            fixed = rule.fix(match[0]);
          }
          
          if (fixed !== original) {
            if (CONFIG.dryRun) {
              console.log(`  [预览] ${rule.name}`);
              console.log(`    原始: ${original}`);
              console.log(`    修复: ${fixed}`);
            } else {
              content = content.substring(0, match.index) + fixed + content.substring(match.index + match[0].length);
              // 重新设置正则位置
              regex.lastIndex = match.index + fixed.length;
            }
            fixes++;
          }
        }
      } catch (error) {
        errors.push(`${rule.name}: ${error}`);
      }
    }
  }
  
  // 写回文件
  if (fixes > 0 && !CONFIG.dryRun) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`  ✅ 修复了 ${fixes} 处`);
  } else if (fixes > 0) {
    console.log(`  [预览] 将修复 ${fixes} 处`);
  }
  
  if (errors.length > 0) {
    console.log(`  ⚠️  ${errors.length} 个错误:`, errors);
  }
  
  return { file: filePath, fixes, errors };
}

/**
 * 主函数
 */
async function main() {
  console.log('=== TypeScript 类型不匹配修复工具 ===');
  console.log(`模式: ${CONFIG.dryRun ? '预览' : '修复'}\n`);
  
  // 获取所有文件
  const files = await glob(CONFIG.include, {
    ignore: CONFIG.exclude,
    cwd: process.cwd(),
  });
  
  console.log(`找到 ${files.length} 个文件\n`);
  
  // 统计
  let totalFixes = 0;
  let totalErrors = 0;
  const results: FixResult[] = [];
  
  // 处理每个文件
  for (const file of files) {
    try {
      const result = fixFile(file);
      results.push(result);
      totalFixes += result.fixes;
      totalErrors += result.errors.length;
    } catch (error) {
      console.error(`❌ 处理文件失败: ${file}`);
      console.error(error);
    }
  }
  
  // 输出统计
  console.log('\n=== 统计结果 ===');
  console.log(`处理文件数: ${files.length}`);
  console.log(`修复处数: ${totalFixes}`);
  console.log(`错误数: ${totalErrors}`);
  
  if (CONFIG.dryRun) {
    console.log('\n⚠️  这是预览模式，没有实际修改文件');
    console.log('   要实际修复，请将 CONFIG.dryRun 设为 false\n');
  } else {
    console.log('\n✅ 修复完成！建议运行测试验证\n');
  }
  
  return { totalFixes, totalErrors };
}

// 运行
main()
  .then(({ totalFixes, totalErrors }) => {
    process.exit(totalErrors > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
