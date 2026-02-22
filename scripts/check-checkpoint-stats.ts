import fs from 'fs';
import path from 'path';

const checkpointPath = path.join(
  process.cwd(),
  'data',
  'crawled',
  'flk',
  'checkpoint.json'
);

try {
  const content = fs.readFileSync(checkpointPath, 'utf-8');
  const checkpoint = JSON.parse(content);

  console.log('=== Checkpoint 统计信息 ===\n');
  console.log(`状态: ${checkpoint.status}`);
  console.log(`开始时间: ${checkpoint.startedAt}`);
  console.log(`最后更新: ${checkpoint.lastUpdatedAt}`);
  console.log(`版本: ${checkpoint.version}\n`);

  // 统计下载的文件
  const downloadedFiles = checkpoint.downloadedFiles || [];
  console.log(`已下载文件总数: ${downloadedFiles.length}`);

  // 按类型统计
  const typeStats: Record<string, number> = {};
  downloadedFiles.forEach((file: any) => {
    const type = file.flxz || 'unknown';
    typeStats[type] = (typeStats[type] || 0) + 1;
  });

  console.log('\n按类型统计:');
  Object.entries(typeStats)
    .sort(([, a], [, b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count} 个`);
    });

  // 检查是否有未完成的类型
  console.log('\n各类型下载进度:');
  Object.entries(checkpoint.types || {}).forEach(
    ([type, info]: [string, any]) => {
      const status = info.completed
        ? '✅ 完成'
        : `⏳ ${info.page}/${info.totalPages}页`;
      console.log(`  ${type}: ${info.downloaded}个 (${status})`);
    }
  );

  // 文件大小
  const stats = fs.statSync(checkpointPath);
  console.log(
    `\nCheckpoint文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`
  );
} catch (error) {
  console.error('读取checkpoint失败:', error);
}
