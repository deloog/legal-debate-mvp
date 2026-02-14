/**
 * 监控采集进度
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 分类配置
const TYPE_CONFIGS = [
  { code: 100, label: '宪法', category: 'OTHER' },
  { code: 120, label: '民法商法', category: 'CIVIL' },
  { code: 130, label: '行政法', category: 'ADMINISTRATIVE' },
  { code: 140, label: '经济法', category: 'ECONOMIC' },
  { code: 150, label: '社会法', category: 'OTHER' },
  { code: 160, label: '刑法', category: 'CRIMINAL' },
  { code: 170, label: '诉讼与非诉讼程序法', category: 'PROCEDURE' },
  { code: 201, label: '行政法规', category: 'ADMINISTRATIVE' },
  { code: 311, label: '司法解释', category: 'PROCEDURE' },
];

async function main() {
  console.log('='.repeat(70));
  console.log('采集进度监控');
  console.log('='.repeat(70));
  console.log();

  // 读取断点文件
  const checkpointPath = path.resolve('data/crawled/flk/checkpoint.json');
  let checkpoint: any = {};

  if (fs.existsSync(checkpointPath)) {
    checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
    console.log(`断点文件: ${checkpointPath}`);
    console.log(`版本: ${checkpoint.version}`);
    console.log(`最后更新: ${checkpoint.lastUpdatedAt || '未知'}`);
    console.log();
  } else {
    console.log('⚠️ 断点文件不存在');
    console.log();
  }

  // 数据库统计
  const dbStats = await prisma.lawArticle.groupBy({
    by: ['category'],
    where: { dataSource: 'flk' },
    _count: true,
  });

  const dbCountMap: Record<string, number> = {};
  dbStats.forEach(s => {
    dbCountMap[s.category] = s._count;
  });

  console.log('数据库记录数:');
  console.log('='.repeat(70));

  TYPE_CONFIGS.forEach(type => {
    const cpProgress = checkpoint.types[type.code];
    const dbCount = dbCountMap[type.category] || 0;
    const cpCount = cpProgress?.downloaded || 0;
    const status = cpProgress ? '✓' : ' ';

    console.log(`${status} ${type.label.padEnd(20)}  数据库: ${dbCount} 条,  断点: ${cpCount} 条`);
  });

  console.log('='.repeat(70));

  // 失败记录
  if (checkpoint.failedItems && checkpoint.failedItems.length > 0) {
    console.log(`\n⚠️ 失败记录: ${checkpoint.failedItems.length} 条`);
  } else {
    console.log('\n✅ 没有失败记录');
  }

  const total = dbStats.reduce((sum, s) => sum + s._count, 0);
  console.log(`\n数据库总计: ${total} 条`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
