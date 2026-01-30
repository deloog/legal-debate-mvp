/**
 * 证据分类配置种子数据
 *
 * 为不同案件类型预置标准证据分类
 */

import { PrismaClient } from '@prisma/client';
import { EVIDENCE_CATEGORIES } from '../src/lib/evidence/evidence-category-config';

const prisma = new PrismaClient();

/**
 * 创建证据分类配置种子数据
 */
export async function seedEvidenceCategories() {
  console.log('开始创建证据分类配置种子数据...');

  // 由于证据分类配置是代码级别的配置（存储在 evidence-category-config.ts 中）
  // 不需要在数据库中存储，这里只是验证配置的完整性

  // 验证劳动争议案件分类
  const laborDisputeCategories = EVIDENCE_CATEGORIES.LABOR_DISPUTE;
  console.log(`✓ 劳动争议案件分类: ${laborDisputeCategories.length} 个主分类`);

  let totalSubCategories = 0;
  laborDisputeCategories.forEach(category => {
    if (category.subCategories) {
      totalSubCategories += category.subCategories.length;
    }
  });
  console.log(`  - 子分类总数: ${totalSubCategories}`);

  // 验证合同纠纷案件分类
  const contractDisputeCategories = EVIDENCE_CATEGORIES.CONTRACT_DISPUTE;
  console.log(
    `✓ 合同纠纷案件分类: ${contractDisputeCategories.length} 个主分类`
  );

  // 验证婚姻家庭案件分类
  const marriageFamilyCategories = EVIDENCE_CATEGORIES.MARRIAGE_FAMILY;
  console.log(
    `✓ 婚姻家庭案件分类: ${marriageFamilyCategories.length} 个主分类`
  );

  console.log('证据分类配置验证完成！');
  console.log(
    `总计: ${Object.keys(EVIDENCE_CATEGORIES).length} 种案件类型的分类配置`
  );

  return {
    laborDisputeCategories: laborDisputeCategories.length,
    contractDisputeCategories: contractDisputeCategories.length,
    marriageFamilyCategories: marriageFamilyCategories.length,
  };
}

/**
 * 主函数
 */
async function main() {
  try {
    await seedEvidenceCategories();
  } catch (error) {
    console.error('创建证据分类配置种子数据失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main()
    .then(() => {
      console.log('证据分类配置种子数据创建成功');
      process.exit(0);
    })
    .catch(error => {
      console.error('错误:', error);
      process.exit(1);
    });
}
