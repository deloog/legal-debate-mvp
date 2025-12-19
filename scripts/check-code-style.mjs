#!/usr/bin/env node

/**
 * 代码风格检查脚本
 * 检查代码是否符合.clinerules中定义的代码风格要求
 */

import { validateConfig } from './code-style/config.mjs';
import { collectFiles } from './code-style/file-collector.mjs';
import { batchCheckFiles, setupErrorHandling } from './code-style/batch-processor.mjs';
import { displayResults, displayFileList } from './code-style/reporter.mjs';

/**
 * 主函数
 */
async function main() {
  console.log('🔍 开始代码风格检查...\n');
  
  setupErrorHandling();
  
  try {
    // 验证配置
    validateConfig();
    
    console.log('📂 正在收集文件...');
    const allFiles = await collectFiles();
    
    if (allFiles.length === 0) {
      console.log('⚠️  未找到需要检查的文件');
      process.exit(0);
    }
    
    displayFileList(allFiles);
    
    const { results, passedCount, checkedCount } = await batchCheckFiles(allFiles);
    const allPassed = displayResults(results, passedCount, checkedCount);
    
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('检查过程中发生错误:', error.message);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// 导出主要函数以供测试使用
export { main };
