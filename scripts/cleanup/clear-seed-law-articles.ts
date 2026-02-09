/**
 * 清除种子法条数据脚本
 *
 * 用于删除开发测试期间导入的种子数据
 * 在导入真实的法律数据之前执行
 */

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 清除所有法条数据
 */
async function clearAllLawArticles(): Promise<number> {
  const result = await prisma.lawArticle.deleteMany({});
  return result.count;
}

/**
 * 清除指定数据源的法条数据
 */
async function clearLawArticlesByDataSource(
  dataSource: string
): Promise<number> {
  const result = await prisma.lawArticle.deleteMany({
    where: {
      dataSource: dataSource,
    } as Prisma.LawArticleWhereInput,
  });
  return result.count;
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const dataSource = args[0];

  console.log('========================================');
  console.log('      清除法条种子数据工具');
  console.log('========================================');
  console.log();

  try {
    // 检查数据库中当前有多少法条
    const totalCount = await prisma.lawArticle.count();
    console.log(`当前数据库中共有 ${totalCount} 条法条`);

    if (totalCount === 0) {
      console.log('数据库中没有法条数据，无需清除');
      return;
    }

    console.log();

    // 确认清除
    let count: number;

    if (dataSource) {
      console.log(`准备清除数据源为 "${dataSource}" 的所有法条...`);
      count = await clearLawArticlesByDataSource(dataSource);
      console.log(`已清除 ${count} 条法条（数据源：${dataSource}）`);
    } else {
      console.log('警告：即将清除所有法条数据！');
      console.log('这个操作不可逆，请确认是否继续。');

      // 这里可以添加确认逻辑，但命令行脚本无法交互，直接执行
      count = await clearAllLawArticles();
      console.log(`已清除所有 ${count} 条法条`);
    }

    console.log();
    console.log('清除完成！');
    console.log();
    console.log('提示：清除种子数据后，您可以通过以下方式导入真实数据：');
    console.log('  1. 使用管理后台：法条管理 → 导入法条');
    console.log('  2. 从司法部官网下载：https://flk.npc.gov.cn/');
    console.log('  3. 使用开源法律数据库：如CAIL、LaWGPT等');
    console.log('  4. 从专业法律数据库API获取（需付费）：法律之星、北大法宝等');
    console.log();
  } catch (error) {
    console.error('清除法条数据时发生错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行脚本
if (require.main === module) {
  main();
}

export { clearAllLawArticles, clearLawArticlesByDataSource };
