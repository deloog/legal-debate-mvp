/**
 * 批处理检查模块
 * 负责批量处理文件检查
 */

import { BATCH_SIZE } from './config.mjs';
import { checkFile } from './checkers/index.mjs';
import { displayFileIssue, showProgress } from './reporter.mjs';

/**
 * 批量检查文件
 */
export async function batchCheckFiles(files, batchSize = BATCH_SIZE) {
  const results = [];
  let passedCount = 0;
  let checkedCount = 0;

  console.log('🚀 开始异步批量检查...\n');

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchPromises = batch.map(async file => {
      checkedCount++;

      // 显示进度
      showProgress(checkedCount, files.length);

      return await checkFile(file);
    });

    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      results.push(result);

      if (result.passed) {
        passedCount++;
      } else {
        // 只显示有问题的文件，减少输出
        displayFileIssue(result);
      }
    }
  }

  return { results, passedCount, checkedCount };
}

/**
 * 设置全局错误处理
 */
export function setupErrorHandling() {
  process.on('uncaughtException', error => {
    console.error('未捕获的异常:', error.message);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
    process.exit(1);
  });
}
