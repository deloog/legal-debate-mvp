import { prisma } from '../src/lib/db/prisma';

async function verifyDatabaseStructure() {
  try {
    console.log('🔍 开始验证数据库结构...\n');

    // 1. 检查所有表是否存在
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;
    
    console.log('=== 数据库表列表 ===');
    console.log(`表数量: ${(tables as any[]).length}`);
    
    const expectedTables = [
      'accounts', 'ai_interactions', 'arguments', 'cases', 
      'debate_rounds', 'debates', 'documents', 'legal_references', 
      'sessions', 'users'
    ];
    
    const actualTables = (tables as any[]).map(t => t.tablename);
    
    console.log('\n✅ 表存在性检查:');
    expectedTables.forEach(table => {
      const exists = actualTables.includes(table);
      console.log(`  ${exists ? '✅' : '❌'} ${table}`);
    });

    // 2. 检查索引
    const indexes = await prisma.$queryRaw`
      SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname
    `;
    
    console.log(`\n=== 数据库索引列表 ===`);
    console.log(`索引数量: ${(indexes as any[]).length}`);
    
    // 3. 检查外键约束
    const constraints = await prisma.$queryRaw`
      SELECT constraint_name, table_name FROM information_schema.table_constraints 
      WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public' ORDER BY table_name
    `;
    
    console.log(`\n=== 外键约束列表 ===`);
    console.log(`外键数量: ${(constraints as any[]).length}`);
    
    // 4. 检查数据
    console.log('\n=== 数据验证 ===');
    const userCount = await prisma.user.count();
    const caseCount = await prisma.case.count();
    const documentCount = await prisma.document.count();
    const debateCount = await prisma.debate.count();
    const argumentCount = await prisma.argument.count();
    const legalReferenceCount = await prisma.legalReference.count();
    
    console.log(`用户数量: ${userCount}`);
    console.log(`案例数量: ${caseCount}`);
    console.log(`文档数量: ${documentCount}`);
    console.log(`辩论数量: ${debateCount}`);
    console.log(`论点数量: ${argumentCount}`);
    console.log(`法律依据数量: ${legalReferenceCount}`);

    // 5. 验证验收标准
    console.log('\n=== 验收标准验证 ===');
    
    const allTablesExist = expectedTables.every(table => actualTables.includes(table));
    const hasData = userCount > 0 && caseCount > 0 && documentCount > 0;
    const hasIndexes = (indexes as any[]).length > 0;
    const hasConstraints = (constraints as any[]).length > 0;
    
    console.log(`✅ 所有表创建成功: ${allTablesExist ? '通过' : '失败'}`);
    console.log(`✅ 索引和约束正确: ${hasIndexes && hasConstraints ? '通过' : '失败'}`);
    console.log(`✅ 种子数据创建: ${hasData ? '通过' : '失败'}`);
    
    const allChecksPass = allTablesExist && hasIndexes && hasConstraints && hasData;
    console.log(`\n🎯 总体验证结果: ${allChecksPass ? '✅ 全部通过' : '❌ 存在问题'}`);

    await prisma.$disconnect();
    return allChecksPass;
  } catch (error) {
    console.error('❌ 验证数据库结构时出错:', error);
    await prisma.$disconnect();
    return false;
  }
}

// 执行验证
verifyDatabaseStructure()
  .then((success: boolean) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error: Error) => {
    console.error('验证脚本执行失败:', error);
    process.exit(1);
  });
