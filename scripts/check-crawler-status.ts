/**
 * 检查采集器运行状态
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('采集器运行状态检查');
  console.log('='.repeat(70));
  console.log();

  // 查询数据库记录数
  const totalRecords = await prisma.lawArticle.count({
    where: { dataSource: 'flk' }
  });

  console.log(`数据库当前记录数: ${totalRecords} 条`);
  console.log();

  // 查询最新记录
  const latestRecord = await prisma.lawArticle.findFirst({
    where: { dataSource: 'flk' },
    orderBy: { createdAt: 'desc' },
    select: {
      lawName: true,
      createdAt: true,
      effectiveDate: true,
      category: true,
    },
  });

  if (latestRecord) {
    console.log('最新采集记录:');
    console.log(`  法规名称: ${latestRecord.lawName}`);
    console.log(`  分类: ${latestRecord.category}`);
    console.log(`  创建时间: ${latestRecord.createdAt}`);
    console.log(`  生效日期: ${latestRecord.effectiveDate}`);
    console.log();
  }

  // 按分类统计
  const categoryStats = await prisma.lawArticle.groupBy({
    by: ['category'],
    where: { dataSource: 'flk' },
    _count: true,
  });

  console.log('按分类统计 (Top 10):');
  console.log();
  categoryStats
    .sort((a, b) => b._count - a._count)
    .slice(0, 10)
    .forEach(stat => {
      console.log(`  ${stat.category}: ${stat._count} 条`);
    });
  console.log();

  // 检查 checkpoint 文件
  const checkpointPath = join(process.cwd(), 'data', 'crawled', 'flk', 'checkpoint.json');
  
  if (existsSync(checkpointPath)) {
    try {
      const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf-8'));
      
      console.log('检查点状态:');
      console.log();
      
      if (checkpoint.lastUpdate) {
        const lastUpdate = new Date(checkpoint.lastUpdate);
        const now = new Date();
        const diffMinutes = Math.floor((now.getTime() - lastUpdate.getTime()) / 60000);
        
        console.log(`  最后更新: ${lastUpdate.toLocaleString('zh-CN')}`);
        console.log(`  距离现在: ${diffMinutes} 分钟前`);
        
        if (diffMinutes < 5) {
          console.log(`  状态: ✅ 正在运行`);
        } else if (diffMinutes < 30) {
          console.log(`  状态: ⚠️ 可能已停止`);
        } else {
          console.log(`  状态: ❌ 已停止`);
        }
      }
      
      if (checkpoint.downloadCheckpoint) {
        console.log(`  当前分类: ${checkpoint.downloadCheckpoint.category || '未知'}`);
        console.log(`  当前页码: ${checkpoint.downloadCheckpoint.page || 0}`);
        
        if (checkpoint.downloadCheckpoint.totalPages) {
          const progress = checkpoint.downloadCheckpoint.page;
          const total = checkpoint.downloadCheckpoint.totalPages;
          const percentage = ((progress / total) * 100).toFixed(2);
          console.log(`  总页数: ${total}`);
          console.log(`  进度: ${progress}/${total} (${percentage}%)`);
        }
      }
      
      console.log();
    } catch (error) {
      console.log('无法读取检查点文件:', error instanceof Error ? error.message : String(error));
      console.log();
    }
  } else {
    console.log('检查点文件不存在，可能尚未开始采集');
    console.log();
  }

  // 查询最近1小时的记录数
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentRecords = await prisma.lawArticle.count({
    where: {
      dataSource: 'flk',
      createdAt: { gte: oneHourAgo },
    },
  });

  console.log(`最近1小时新增: ${recentRecords} 条`);
  console.log();

  console.log('='.repeat(70));
  console.log('总结');
  console.log('='.repeat(70));
  console.log();
  
  if (recentRecords > 0) {
    console.log('✅ 采集器正在正常运行');
    console.log(`📊 采集速度: 约 ${recentRecords} 条/小时`);
  } else {
    console.log('⚠️ 采集器可能已停止或网络问题');
  }
  console.log();
  console.log(`🎯 目标记录数: 约 28,960 条`);
  console.log(`📈 完成进度: ${((totalRecords / 28960) * 100).toFixed(2)}%`);
  console.log(`⏱️ 预计剩余时间: ${Math.ceil((28960 - totalRecords) / (recentRecords || 1))} 小时`);
  console.log();

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('错误:', error);
  process.exit(1);
});
