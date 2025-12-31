/**
 * E2E测试数据初始化脚本
 * 在运行E2E测试之前初始化必要的测试数据
 */

import {
  PrismaClient,
  UserRole,
  LawType,
  LawCategory,
  LawStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

// 测试法条数据
const TEST_LAW_ARTICLES = [
  {
    id: "mock-article-id-1",
    lawName: "中华人民共和国民法典",
    articleNumber: "第一百一十二条",
    fullText:
      "当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["违约", "合同", "责任", "赔偿"],
    tags: ["违约责任", "合同法"],
    searchableText:
      "当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。",
  },
  {
    id: "mock-article-id-2",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百零九条",
    fullText:
      "当事人一方未支付价款、报酬、租金、利息，或者不履行其他金钱债务的，对方可以请求其支付。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["支付", "价款", "报酬", "利息", "金钱债务"],
    tags: ["金钱债务", "支付义务"],
    searchableText:
      "当事人一方未支付价款、报酬、租金、利息，或者不履行其他金钱债务的，对方可以请求其支付。",
  },
  {
    id: "mock-article-id-3",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百六十六条",
    fullText:
      "定作人未向承揽人支付报酬或者材料费等价款的，承揽人对完成的工作成果享有留置权或者有权拒绝交付。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["定作人", "报酬", "材料费", "承揽人", "留置权"],
    tags: ["承揽合同", "留置权"],
    searchableText:
      "定作人未向承揽人支付报酬或者材料费等价款的，承揽人对完成的工作成果享有留置权或者有权拒绝交付。",
  },
  {
    id: "mock-article-id-4",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百七十七条",
    fullText:
      "定作人未向承揽人支付报酬或者材料费等价款的，承揽人对完成的工作成果享有留置权或者有权拒绝交付。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["定作人", "报酬", "材料费", "承揽人", "留置权"],
    tags: ["承揽合同", "留置权"],
    searchableText:
      "定作人未向承揽人支付报酬或者材料费等价款的，承揽人对完成的工作成果享有留置权或者有权拒绝交付。",
  },
  {
    id: "mock-article-id-5",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百七十八条",
    fullText:
      "承揽工作需要定作人协助的，定作人有协助的义务。定作人不履行协助义务致使承揽工作不能完成的，承揽可以催告定作人在合理期限内履行义务，并可以顺延履行期限；定作人在合理期限内未履行义务的，承揽可以解除合同。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["定作人", "协助", "承揽工作", "解除合同"],
    tags: ["承揽合同", "协助义务"],
    searchableText:
      "承揽工作需要定作人协助的，定作人有协助的义务。定作人不履行协助义务致使承揽工作不能完成的，承揽可以催告定作人在合理期限内履行义务，并可以顺延履行期限；定作人在合理期限内未履行义务的，承揽可以解除合同。",
  },
  {
    id: "mock-article-id-6",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百八十二条",
    fullText:
      "承揽人交付的工作成果不符合质量要求的，定作人可以合理选择请求承揽人承担修理、重作、减少报酬、赔偿损失等违约责任。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["承揽人", "质量", "修理", "重作", "减少报酬", "赔偿损失"],
    tags: ["承揽合同", "质量责任"],
    searchableText:
      "承揽人交付的工作成果不符合质量要求的，定作人可以合理选择请求承揽人承担修理、重作、减少报酬、赔偿损失等违约责任。",
  },
  {
    id: "mock-article-id-7",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百八十五条",
    fullText:
      "承揽人应当以自己的设备、技术和劳力，完成主要工作，但当事人另有约定的除外。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["承揽人", "设备", "技术", "劳力", "主要工作"],
    tags: ["承揽合同", "工作义务"],
    searchableText:
      "承揽人应当以自己的设备、技术和劳力，完成主要工作，但当事人另有约定的除外。",
  },
  {
    id: "mock-article-id-8",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百八十六条",
    fullText:
      "承揽人将其承揽的主要工作交由第三人完成的，应当就该第三人完成的工作成果向定作人负责；未经定作人同意的，定作人也可以解除合同。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["承揽人", "第三人", "主要工作", "责任", "解除合同"],
    tags: ["承揽合同", "转承揽"],
    searchableText:
      "承揽人将其承揽的主要工作交由第三人完成的，应当就该第三人完成的工作成果向定作人负责；未经定作人同意的，定作人也可以解除合同。",
  },
  {
    id: "mock-article-id-9",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百八十七条",
    fullText: "共同承揽人对定作人承担连带责任，但当事人另有约定的除外。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["共同承揽人", "连带责任"],
    tags: ["承揽合同", "连带责任"],
    searchableText: "共同承揽人对定作人承担连带责任，但当事人另有约定的除外。",
  },
  {
    id: "mock-article-id-10",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百八十八条",
    fullText: "定作人中途变更承揽工作的要求，造成承揽人损失的，应当赔偿损失。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["定作人", "变更", "要求", "损失", "赔偿"],
    tags: ["承揽合同", "变更损失"],
    searchableText:
      "定作人中途变更承揽工作的要求，造成承揽人损失的，应当赔偿损失。",
  },
  {
    id: "mock-article-id-11",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百八十九条",
    fullText:
      "定作人未向承揽人支付报酬或者材料费等价款的，承揽人对完成的工作成果享有留置权或者有权拒绝交付。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["定作人", "报酬", "材料费", "留置权"],
    tags: ["承揽合同", "留置权"],
    searchableText:
      "定作人未向承揽人支付报酬或者材料费等价款的，承揽人对完成的工作成果享有留置权或者有权拒绝交付。",
  },
  {
    id: "mock-article-id-12",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百九十条",
    fullText:
      "承揽人在交付工作成果前，应当通知定作人验收。定作人应当及时验收。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["承揽人", "交付", "通知", "验收"],
    tags: ["承揽合同", "验收"],
    searchableText:
      "承揽人在交付工作成果前，应当通知定作人验收。定作人应当及时验收。",
  },
  {
    id: "mock-article-id-13",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百九十一条",
    fullText:
      "承揽人交付的工作成果不符合质量要求的，定作人可以请求承揽人在合理期限内承担修理、重作、减少报酬、赔偿损失等违约责任。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["承揽人", "质量", "修理", "重作", "减少报酬", "赔偿损失"],
    tags: ["承揽合同", "质量责任"],
    searchableText:
      "承揽人交付的工作成果不符合质量要求的，定作人可以请求承揽人在合理期限内承担修理、重作、减少报酬、赔偿损失等违约责任。",
  },
  {
    id: "mock-article-id-14",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百九十二条",
    fullText:
      "定作人未按照约定支付报酬的，承揽人对完成的工作成果享有留置权或者有权拒绝交付。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["定作人", "报酬", "留置权", "拒绝交付"],
    tags: ["承揽合同", "留置权"],
    searchableText:
      "定作人未按照约定支付报酬的，承揽人对完成的工作成果享有留置权或者有权拒绝交付。",
  },
  {
    id: "mock-article-id-15",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百九十三条",
    fullText:
      "承揽人应当以自己的设备、技术和劳力，完成主要工作，但当事人另有约定的除外。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["承揽人", "设备", "技术", "劳力", "主要工作"],
    tags: ["承揽合同", "工作义务"],
    searchableText:
      "承揽人应当以自己的设备、技术和劳力，完成主要工作，但当事人另有约定的除外。",
  },
  {
    id: "mock-article-id-16",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百九十四条",
    fullText:
      "承揽人将其承揽的主要工作交由第三人完成的，应当就该第三人完成的工作成果向定作人负责；未经定作人同意的，定作人也可以解除合同。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["承揽人", "第三人", "主要工作", "责任", "解除合同"],
    tags: ["承揽合同", "转承揽"],
    searchableText:
      "承揽人将其承揽的主要工作交由第三人完成的，应当就该第三人完成的工作成果向定作人负责；未经定作人同意的，定作人也可以解除合同。",
  },
  {
    id: "mock-article-id-17",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百九十五条",
    fullText: "共同承揽人对定作人承担连带责任，但当事人另有约定的除外。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["共同承揽人", "连带责任"],
    tags: ["承揽合同", "连带责任"],
    searchableText: "共同承揽人对定作人承担连带责任，但当事人另有约定的除外。",
  },
  {
    id: "mock-article-id-18",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百九十六条",
    fullText: "定作人中途变更承揽工作的要求，造成承揽人损失的，应当赔偿损失。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["定作人", "变更", "要求", "损失", "赔偿"],
    tags: ["承揽合同", "变更损失"],
    searchableText:
      "定作人中途变更承揽工作的要求，造成承揽人损失的，应当赔偿损失。",
  },
  {
    id: "mock-article-id-19",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百九十七条",
    fullText:
      "承揽人在交付工作成果前，应当通知定作人验收。定作人应当及时验收。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["承揽人", "交付", "通知", "验收"],
    tags: ["承揽合同", "验收"],
    searchableText:
      "承揽人在交付工作成果前，应当通知定作人验收。定作人应当及时验收。",
  },
  {
    id: "mock-article-id-20",
    lawName: "中华人民共和国民法典",
    articleNumber: "第五百九十八条",
    fullText:
      "承揽人交付的工作成果不符合质量要求的，定作人可以请求承揽人在合理期限内承担修理、重作、减少报酬、赔偿损失等违约责任。",
    lawType: "LAW",
    category: "CIVIL",
    effectiveDate: new Date("2021-01-01"),
    status: "VALID",
    issuingAuthority: "全国人民代表大会",
    jurisdiction: "全国",
    keywords: ["承揽人", "质量", "修理", "重作", "减少报酬", "赔偿损失"],
    tags: ["承揽合同", "质量责任"],
    searchableText:
      "承揽人交付的工作成果不符合质量要求的，定作人可以请求承揽人在合理期限内承担修理、重作、减少报酬、赔偿损失等违约责任。",
  },
];

// 测试用户
const TEST_USERS: Array<{
  id: string;
  email: string;
  username: string;
  role: UserRole;
  name: string;
}> = [
  {
    id: "test-e2e-user-single-round",
    email: "e2e-single-round@test.com",
    username: "e2e-single-round",
    role: UserRole.LAWYER,
    name: "E2E Test User - Single Round",
  },
  {
    id: "test-e2e-user-multi-round",
    email: "e2e-multi-round@test.com",
    username: "e2e-multi-round",
    role: UserRole.LAWYER,
    name: "E2E Test User - Multi Round",
  },
  {
    id: "test-e2e-user-data-consistency",
    email: "e2e-data-consistency@test.com",
    username: "e2e-data-consistency",
    role: UserRole.LAWYER,
    name: "E2E Test User - Data Consistency",
  },
  {
    id: "test-e2e-user-error-handling",
    email: "e2e-error-handling@test.com",
    username: "e2e-error-handling",
    role: UserRole.LAWYER,
    name: "E2E Test User - Error Handling",
  },
  {
    id: "test-e2e-user-performance",
    email: "e2e-performance@test.com",
    username: "e2e-performance",
    role: UserRole.LAWYER,
    name: "E2E Test User - Performance",
  },
];

/**
 * 初始化测试数据
 */
async function initTestData(): Promise<void> {
  console.log("开始初始化E2E测试数据...");

  try {
    // 1. 创建或更新测试用户
    console.log("\n1. 创建测试用户...");
    for (const user of TEST_USERS) {
      await prisma.user.upsert({
        where: { id: user.id },
        update: {
          email: user.email,
          username: user.username,
          name: user.name,
          role: user.role,
          status: "ACTIVE",
        },
        create: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          role: user.role,
          status: "ACTIVE",
        },
      });
      console.log(`  ✓ 用户 ${user.username} 已创建`);
    }

    // 2. 创建测试法条
    console.log("\n2. 创建测试法条...");
    let createdCount = 0;
    let updatedCount = 0;

    for (const article of TEST_LAW_ARTICLES) {
      const existing = await prisma.lawArticle.findUnique({
        where: { id: article.id },
      });

      if (existing) {
        await prisma.lawArticle.update({
          where: { id: article.id },
          data: {
            fullText: article.fullText,
            keywords: article.keywords,
            tags: article.tags,
            searchableText: article.searchableText,
          },
        });
        updatedCount++;
      } else {
        await prisma.lawArticle.create({
          data: {
            ...article,
            lawType: LawType.LAW,
            category: LawCategory.CIVIL,
            status: LawStatus.VALID,
          },
        });
        createdCount++;
      }
    }

    console.log(`  ✓ 创建了 ${createdCount} 条新法条`);
    console.log(`  ✓ 更新了 ${updatedCount} 条现有法条`);
    console.log(`  ✓ 总法条数: ${TEST_LAW_ARTICLES.length}`);

    // 3. 验证数据
    console.log("\n3. 验证数据...");
    const userCount = await prisma.user.count({
      where: { username: { contains: "e2e-" } },
    });
    const articleCount = await prisma.lawArticle.count();
    console.log(`  ✓ E2E测试用户数: ${userCount}`);
    console.log(`  ✓ 法条总数: ${articleCount}`);

    console.log("\n✅ E2E测试数据初始化完成！");
  } catch (error) {
    console.error("❌ 初始化失败:", error);
    throw error;
  }
}

/**
 * 清理测试数据（可选）
 */
async function cleanupTestData(): Promise<void> {
  console.log("\n开始清理E2E测试数据...");

  try {
    // 删除测试用户相关的数据
    const userIds = TEST_USERS.map((u) => u.id);

    await prisma.case.deleteMany({
      where: { userId: { in: userIds } },
    });

    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });

    console.log("✅ 测试数据清理完成！");
  } catch (error) {
    console.error("❌ 清理失败:", error);
    throw error;
  }
}

// 主函数
async function main(): Promise<void> {
  const command = process.argv[2];

  if (command === "cleanup") {
    await cleanupTestData();
  } else {
    await initTestData();
  }

  await prisma.$disconnect();
}

// 执行脚本
main().catch((error) => {
  console.error("脚本执行失败:", error);
  process.exit(1);
});
