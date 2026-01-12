/**
 * 默认导出检查器
 * 检查文件是否使用不当的默认导出
 */

/**
 * 检查文件是否使用默认导出
 */
export function checkDefaultExports(filePath, content) {
  // 跳过Next.js页面组件（app目录）
  if (filePath.includes('src/app/')) {
    return { passed: true, message: 'Next.js页面组件允许使用默认导出' };
  }

  // 跳过配置文件
  if (filePath.includes('config/') || filePath.endsWith('.json')) {
    return { passed: true, message: '配置文件允许使用默认导出' };
  }

  const defaultExportRegex =
    /export\s+default\s+(function|class|const|let|var|async\s+function)/g;
  const matches = content.match(defaultExportRegex);

  if (matches && matches.length > 0) {
    return {
      passed: false,
      message: `发现默认导出: ${matches.join(', ')}`,
    };
  }

  return { passed: true, message: '未发现不当的默认导出' };
}
