/**
 * PDF缓存清理脚本
 * 定期清理过期的PDF缓存文件
 *
 * 使用方法：
 * node scripts/cleanup-pdf-cache.js [days]
 *
 * 参数：
 * days - 文件保留天数，默认30天
 */

import { cleanupOldPDFCache } from '../src/lib/contract/contract-pdf-generator';

async function main() {
  const args = process.argv.slice(2);
  const daysOld = args[0] ? parseInt(args[0]) : 30;

  if (isNaN(daysOld) || daysOld < 1) {
    console.error('错误：天数必须是大于0的整数');
    process.exit(1);
  }

  console.log(`开始清理 ${daysOld} 天前的PDF缓存文件...`);

  try {
    const deletedCount = await cleanupOldPDFCache(daysOld);
    console.log(`清理完成！共删除 ${deletedCount} 个文件`);
    process.exit(0);
  } catch (error) {
    console.error('清理失败:', error);
    process.exit(1);
  }
}

main();
