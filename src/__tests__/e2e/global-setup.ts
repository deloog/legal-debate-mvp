import type { FullConfig } from '@playwright/test';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// 固定的 E2E 测试专用账号凭证（仅供测试环境使用）
export const E2E_ADMIN_EMAIL = 'e2e-admin@test-internal.local';
export const E2E_ADMIN_PASSWORD = 'AdminE2E@Test2024';
export const E2E_LAWYER_EMAIL = 'e2e-lawyer@test-internal.local';
export const E2E_LAWYER_PASSWORD = 'LawyerE2E@Test2024';
const E2E_LAWYER_LICENSE = 'E2ETESTLICENSE001';
const SALT_ROUNDS = 10;

// E2E 法条测试数据（固定ID，供数据一致性测试使用）
export const E2E_LAW_ARTICLE_1_ID = 'e2e-law-article-001';
export const E2E_LAW_ARTICLE_2_ID = 'e2e-law-article-002';

// 测试状态文件路径（由 global-setup 写入，供测试文件读取）
export const TEST_STATE_FILE = resolve(__dirname, '.e2e-test-state.json');

async function globalSetup(_config: FullConfig): Promise<void> {
  console.log('🚀 Starting E2E test global setup...');

  const prisma = new PrismaClient();

  try {
    // -------------------------------------------------------------------------
    // 1. 创建或更新 E2E 测试管理员账号
    // -------------------------------------------------------------------------
    const adminHashedPwd = await bcrypt.hash(E2E_ADMIN_PASSWORD, SALT_ROUNDS);

    const adminUser = await prisma.user.upsert({
      where: { email: E2E_ADMIN_EMAIL },
      update: {
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        password: adminHashedPwd,
      },
      create: {
        email: E2E_ADMIN_EMAIL,
        username: 'e2e-admin',
        name: 'E2E Test Admin',
        password: adminHashedPwd,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });

    console.log(
      `✅ Admin user ready: ${adminUser.email} (id: ${adminUser.id})`
    );

    // -------------------------------------------------------------------------
    // 2. 创建或更新 E2E 测试律师账号（普通用户，用于提交资格申请）
    // -------------------------------------------------------------------------
    const lawyerHashedPwd = await bcrypt.hash(E2E_LAWYER_PASSWORD, SALT_ROUNDS);

    const lawyerUser = await prisma.user.upsert({
      where: { email: E2E_LAWYER_EMAIL },
      update: { status: 'ACTIVE', role: 'USER', password: lawyerHashedPwd },
      create: {
        email: E2E_LAWYER_EMAIL,
        username: 'e2e-lawyer',
        name: 'E2E Test Lawyer',
        password: lawyerHashedPwd,
        role: 'USER',
        status: 'ACTIVE',
      },
    });

    console.log(
      `✅ Lawyer user ready: ${lawyerUser.email} (id: ${lawyerUser.id})`
    );

    // -------------------------------------------------------------------------
    // 3. 确保该律师账号下有一条 PENDING 状态的资格申请记录
    //    （资格申请 upload API 需要调用第三方验证，不适合在 E2E 中直接调用，
    //     因此由 global-setup 直接写库来准备测试数据）
    // -------------------------------------------------------------------------
    // 使用 upsert 避免并发执行时的唯一键冲突
    const qualification = await prisma.lawyerQualification.upsert({
      where: { licenseNumber: E2E_LAWYER_LICENSE },
      update: {
        status: 'PENDING',
        reviewedAt: null,
        reviewNotes: null,
        userId: lawyerUser.id,
      },
      create: {
        userId: lawyerUser.id,
        licenseNumber: E2E_LAWYER_LICENSE,
        fullName: 'E2E Test Lawyer',
        idCardNumber: '110101199001011234',
        lawFirm: 'E2E Test Law Firm Co.',
        status: 'PENDING',
      },
    });

    const qualificationId = qualification.id;
    console.log(
      `✅ Qualification upserted to PENDING (id: ${qualificationId})`
    );

    // -------------------------------------------------------------------------
    // 4. 创建 ADMIN 角色 + 权限（供 permission-api.spec.ts 和 admin.spec.ts 使用）
    // -------------------------------------------------------------------------
    const permissionDefs = [
      { name: 'user:read', resource: 'user', action: 'read' },
      { name: 'user:update', resource: 'user', action: 'update' },
      { name: 'user:delete', resource: 'user', action: 'delete' },
      { name: 'case:delete', resource: 'case', action: 'delete' },
    ];

    // 创建/更新 ADMIN 角色
    const adminRole = await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: { description: 'E2E Test Admin Role' },
      create: {
        name: 'ADMIN',
        description: 'E2E Test Admin Role',
        isDefault: false,
      },
    });
    console.log(`✅ Role ADMIN ready (id: ${adminRole.id})`);

    // 创建权限并关联到 ADMIN 角色
    for (const pDef of permissionDefs) {
      const perm = await prisma.permission.upsert({
        where: { name: pDef.name },
        update: { resource: pDef.resource, action: pDef.action },
        create: {
          name: pDef.name,
          resource: pDef.resource,
          action: pDef.action,
        },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id },
        },
        update: {},
        create: { roleId: adminRole.id, permissionId: perm.id },
      });
    }
    console.log(`✅ ADMIN role permissions seeded`);

    // -------------------------------------------------------------------------
    // 5. 创建 E2E 测试法条（供数据一致性测试使用）
    // -------------------------------------------------------------------------
    const now = new Date();
    await prisma.lawArticle.upsert({
      where: { id: E2E_LAW_ARTICLE_1_ID },
      update: {},
      create: {
        id: E2E_LAW_ARTICLE_1_ID,
        lawName: '中华人民共和国合同法',
        articleNumber: '第一条',
        fullText:
          'E2E测试法条一：合同法基本原则，当事人订立、履行合同，应当遵守法律、行政法规。',
        lawType: 'LAW',
        category: 'CIVIL',
        issuingAuthority: '全国人民代表大会',
        searchableText: '合同法 基本原则 当事人',
        effectiveDate: now,
        tags: ['合同', '基本原则'],
        keywords: ['合同法', '当事人'],
      },
    });
    await prisma.lawArticle.upsert({
      where: { id: E2E_LAW_ARTICLE_2_ID },
      update: {},
      create: {
        id: E2E_LAW_ARTICLE_2_ID,
        lawName: '中华人民共和国合同法',
        articleNumber: '第二条',
        fullText:
          'E2E测试法条二：本法所称合同是平等主体的自然人、法人、其他组织之间设立、变更、终止民事权利义务关系的协议。',
        lawType: 'LAW',
        category: 'CIVIL',
        issuingAuthority: '全国人民代表大会',
        searchableText: '合同 平等主体 自然人 法人',
        effectiveDate: now,
        tags: ['合同', '主体'],
        keywords: ['合同', '主体'],
      },
    });

    // 补充更多法条供分页、搜索测试使用（需要至少 10 条以支持两页各 5 条）
    const extraArticles = [
      {
        id: 'e2e-law-article-003',
        lawName: '中华人民共和国劳动合同法',
        articleNumber: '第一条',
        fullText:
          'E2E测试法条三：为了完善劳动合同制度，明确劳动合同双方当事人的权利和义务，保护劳动者的合法权益，构建和发展和谐稳定的劳动关系，制定本法。',
        lawType: 'LAW',
        category: 'LABOR',
        issuingAuthority: '全国人民代表大会',
        searchableText: '劳动合同 劳动者 权益 和谐',
        tags: ['劳动', '合同'],
        keywords: ['劳动合同', '劳动者'],
      },
      {
        id: 'e2e-law-article-004',
        lawName: '中华人民共和国侵权责任法',
        articleNumber: '第一条',
        fullText:
          'E2E测试法条四：为保护民事主体的合法权益，明确侵权责任，预防并制裁侵权行为，促进社会和谐稳定，制定本法。',
        lawType: 'LAW',
        category: 'CIVIL',
        issuingAuthority: '全国人民代表大会',
        searchableText: '侵权 责任 民事主体 权益',
        tags: ['侵权', '责任'],
        keywords: ['侵权责任', '民事主体'],
      },
      {
        id: 'e2e-law-article-005',
        lawName: '中华人民共和国民法典',
        articleNumber: '第一条',
        fullText:
          'E2E测试法条五：为了保护民事主体的合法权益，调整民事关系，维护社会和经济秩序，弘扬社会主义核心价值观，根据宪法，制定本法。',
        lawType: 'LAW',
        category: 'CIVIL',
        issuingAuthority: '全国人民代表大会',
        searchableText: '民法典 民事主体 法律 社会秩序',
        tags: ['民法', '法律'],
        keywords: ['民法典', '法律'],
      },
      {
        id: 'e2e-law-article-006',
        lawName: '中华人民共和国刑法',
        articleNumber: '第一条',
        fullText:
          'E2E测试法条六：为了惩罚犯罪，保护人民，根据宪法，结合我国同犯罪作斗争的具体经验及实际情况，制定本法。',
        lawType: 'LAW',
        category: 'CRIMINAL',
        issuingAuthority: '全国人民代表大会',
        searchableText: '刑法 犯罪 惩罚 保护',
        tags: ['刑法', '犯罪'],
        keywords: ['刑法', '犯罪'],
      },
      {
        id: 'e2e-law-article-007',
        lawName: '中华人民共和国公司法',
        articleNumber: '第一条',
        fullText:
          'E2E测试法条七：为了规范公司的组织和行为，保护公司、股东和债权人的合法权益，维护社会经济秩序，促进社会主义市场经济的发展，制定本法。',
        lawType: 'LAW',
        category: 'COMMERCIAL',
        issuingAuthority: '全国人民代表大会',
        searchableText: '公司法 股东 债权人 市场经济',
        tags: ['公司', '法律'],
        keywords: ['公司法', '股东'],
      },
      {
        id: 'e2e-law-article-008',
        lawName: '中华人民共和国知识产权法',
        articleNumber: '第一条',
        fullText:
          'E2E测试法条八：为保护知识产权，鼓励创新，促进社会主义现代化建设，根据宪法，制定本法。',
        lawType: 'LAW',
        category: 'CIVIL',
        issuingAuthority: '全国人民代表大会',
        searchableText: '知识产权 创新 保护',
        tags: ['知识产权', '创新'],
        keywords: ['知识产权', '保护'],
      },
      {
        id: 'e2e-law-article-009',
        lawName: '中华人民共和国行政法',
        articleNumber: '第一条',
        fullText:
          'E2E测试法条九：为了保障公民、法人和其他组织的合法权益，规范行政机关依法行政，制定本法。',
        lawType: 'LAW',
        category: 'ADMINISTRATIVE',
        issuingAuthority: '全国人民代表大会',
        searchableText: '行政法 公民 法人 依法行政',
        tags: ['行政法', '依法行政'],
        keywords: ['行政法', '公民'],
      },
      {
        id: 'e2e-law-article-010',
        lawName: '中华人民共和国消费者权益保护法',
        articleNumber: '第一条',
        fullText:
          'E2E测试法条十：为保护消费者的合法权益，维护社会经济秩序，促进社会主义市场经济健康发展，制定本法。',
        lawType: 'LAW',
        category: 'CIVIL',
        issuingAuthority: '全国人民代表大会',
        searchableText: '消费者 权益保护 市场经济',
        tags: ['消费者', '权益'],
        keywords: ['消费者权益', '保护法'],
      },
    ];

    for (const article of extraArticles) {
      await prisma.lawArticle.upsert({
        where: { id: article.id },
        update: {},
        create: {
          ...article,
          effectiveDate: now,
        },
      });
    }

    console.log(
      `✅ E2E law articles seeded (${2 + extraArticles.length} total)`
    );

    // -------------------------------------------------------------------------
    // 6. 创建通用测试账号（供 contract-workflow 等测试使用）
    // -------------------------------------------------------------------------
    const testUserHashedPwd = await bcrypt.hash('password123', SALT_ROUNDS);
    await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: { status: 'ACTIVE', role: 'USER', password: testUserHashedPwd },
      create: {
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
        password: testUserHashedPwd,
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    console.log('✅ General test user ready: test@example.com');

    // -------------------------------------------------------------------------
    // 7. 将测试状态写入文件，供各测试文件读取
    // -------------------------------------------------------------------------
    const testState = {
      adminEmail: E2E_ADMIN_EMAIL,
      adminPassword: E2E_ADMIN_PASSWORD,
      lawyerEmail: E2E_LAWYER_EMAIL,
      lawyerPassword: E2E_LAWYER_PASSWORD,
      qualificationId,
      lawArticle1Id: E2E_LAW_ARTICLE_1_ID,
      lawArticle2Id: E2E_LAW_ARTICLE_2_ID,
    };

    writeFileSync(TEST_STATE_FILE, JSON.stringify(testState, null, 2), 'utf-8');
    console.log(`✅ Test state written to ${TEST_STATE_FILE}`);

    console.log('✅ E2E test global setup completed');
  } finally {
    await prisma.$disconnect();
  }
}

export default globalSetup;
