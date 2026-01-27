/**
 * AI Interaction 数据迁移脚本
 * 将 userId 从 JSON 字段迁移到独立字段
 */

import { prisma } from '@/lib/db/prisma';

/**
 * 迁移 AI Interaction 数据
 */
async function migrateUserIdField(): Promise<void> {
  console.log('开始迁移 AI Interaction userId 字段...');

  try {
    // 获取所有需要迁移的记录
    const interactions = await prisma.aIInteraction.findMany({
      select: {
        id: true,
        request: true,
      },
    });

    console.log(`找到 ${interactions.length} 条记录`);

    if (interactions.length === 0) {
      console.log('没有记录需要处理');
      return;
    }

    // 批量更新
    let successCount = 0;
    let failCount = 0;

    for (const interaction of interactions) {
      try {
        const requestData = interaction.request as Record<string, unknown>;
        const userId = requestData.userId as string;

        if (userId) {
          await prisma.aIInteraction.update({
            where: { id: interaction.id },
            data: { userId } as unknown,
          });
          successCount++;
          console.log(`✅ 已迁移记录: ${interaction.id}`);
        }
      } catch (error) {
        failCount++;
        console.error(`❌ 迁移失败: ${interaction.id}`, error);
      }
    }

    console.log('\n迁移完成！');
    console.log(`成功: ${successCount} 条`);
    console.log(`失败: ${failCount} 条`);
  } catch (error) {
    console.error('迁移过程中发生错误:', error);
    throw error;
  }
}

/**
 * 验证迁移结果
 */
async function validateMigration(): Promise<void> {
  console.log('\n验证迁移结果...');

  // 检查总记录数
  const totalCount = await prisma.aIInteraction.count();
  console.log(`总记录数: ${totalCount}`);

  // 检查索引是否生效
  console.log('\n检查索引状态...');
  const result = await prisma.$queryRaw`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'ai_interactions'
    AND indexname LIKE '%user_id%'
  `;
  console.log('已创建的 userId 相关索引:', result);
}

// 执行迁移
async function main(): Promise<void> {
  try {
    await migrateUserIdField();
    await validateMigration();
    console.log('\n✅ 迁移成功完成！');
  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

export { migrateUserIdField, validateMigration };
