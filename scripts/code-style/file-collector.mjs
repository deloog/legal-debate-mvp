/**
 * 文件收集模块
 * 负责递归收集需要检查的文件
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { config } from './config.mjs';

/**
 * 异步递归获取所有目标文件
 */
export async function getAllFiles(dir) {
  const files = [];

  async function traverse(currentDir) {
    try {
      const items = await fs.readdir(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          // 跳过排除的目录
          if (!config.excludePatterns.some(pattern => item.includes(pattern))) {
            await traverse(fullPath);
          }
        } else {
          // 检查文件扩展名
          const ext = path.extname(item);
          if (config.fileExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`警告: 无法读取目录 ${currentDir}: ${error.message}`);
    }
  }

  await traverse(dir);
  return files;
}

/**
 * 收集所有需要检查的文件
 */
export async function collectFiles() {
  const allFiles = [];
  const currentScript = process.argv[1] || 'scripts/check-code-style.mjs';

  for (const dir of config.targetDirectories) {
    try {
      const exists = fsSync.existsSync(dir);
      if (!exists) {
        console.warn(`⚠️  目录 ${dir} 不存在，跳过`);
        continue;
      }

      const files = await getAllFiles(dir);
      allFiles.push(...files);
    } catch (error) {
      console.error(`❌ 无法遍历目录 ${dir}: ${error.message}`);
      // 继续处理其他目录而不是直接失败
    }
  }

  // 排除当前脚本文件，避免自我检查
  const filteredFiles = allFiles.filter(
    file => path.resolve(file) !== path.resolve(currentScript)
  );

  return filteredFiles;
}
