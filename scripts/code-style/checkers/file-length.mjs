/**
 * 文件长度检查器
 * 检查文件是否超过最大行数限制
 */

import { MAX_FILE_LINES } from '../config.mjs';

/**
 * 检查文件长度
 */
export function checkFileLength(filePath, content) {
  const lines = content.split('\n').length;

  if (lines > MAX_FILE_LINES) {
    return {
      passed: false,
      message: `文件过长 (${lines}行)，超过限制 (${MAX_FILE_LINES}行)，建议拆分`,
    };
  }

  return {
    passed: true,
    message: `文件长度检查通过 (${lines}行)`,
  };
}
