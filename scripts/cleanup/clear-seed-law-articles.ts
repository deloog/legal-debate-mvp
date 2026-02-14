/**
 * 清理测试数据
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('正在清理测试数据...');

  // 清理 FLK 来源的法规数据
  const deleted = await prisma.lawArticle.deleteMany({
    where: {
      dataSource: 'flk',
    },
  });

  console.log(`已删除 ${deleted.count} 条 FLK 法规记录`);

  // 验证
  const count = await prisma.lawArticle.count({
    where: {
      dataSource: 'flk',
    },
  });

  console.log(`剩余 FLK 记录: ${count}`);

  // 重置断点文件
  const fs = await import('fs');
  const path = await import('path');

  const checkpointPath = path.resolve('data/crawled/flk/checkpoint.json');
  if (fs.existsSync(checkpointPath)) {
    fs.unlinkSync(checkpointPath);
    console.log('已删除断点文件');
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
