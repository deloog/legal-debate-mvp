/**
 * 代码风格检查配置
 * 集中管理所有配置选项和常量
 */

// 常量定义
export const PROGRESS_INTERVAL = 5;
export const MAX_FILE_LINES = 200;
export const MAX_ISSUES_TO_SHOW = 3;
export const BATCH_SIZE = 10;

// 配置选项
export const config = {
  targetDirectories: ['src', 'scripts'],
  fileExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
  excludePatterns: ['node_modules', '.next', 'dist', 'build'],
  rules: {
    checkDefaultExports: true,
    checkNamingConventions: true,
    checkHardcodedValues: true,
    checkFileLength: true,
    maxFileLines: MAX_FILE_LINES,
  },
};

/**
 * 验证配置的有效性
 */
export function validateConfig() {
  if (MAX_FILE_LINES > 200) {
    console.warn('⚠️  警告：MAX_FILE_LINES 超过了项目规范的200行限制');
  }

  if (config.targetDirectories.length === 0) {
    throw new Error('至少需要指定一个目标目录');
  }

  if (config.fileExtensions.length === 0) {
    throw new Error('至少需要指定一个文件扩展名');
  }

  return true;
}
