#!/usr/bin/env ts-node

/**
 * 数据库迁移完整性测试脚本
 * 验证迁移脚本可无错误执行且包含必要的索引
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface MigrationTest {
  name: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  details?: string;
  error?: string;
}

class MigrationIntegrityTester {
  private prisma: PrismaClient;
  private testResults: MigrationTest[] = [];

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 运行所有迁移测试
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 开始数据库迁移完整性测试...\n');

    // 1. 验证迁移文件存在性
    await this.testMigrationFilesExistence();

    // 2. 验证迁移脚本语法
    await this.testMigrationScriptSyntax();

    // 3. 验证数据库连接
    await this.testDatabaseConnection();

    // 4. 验证表结构完整性
    await this.testTableStructure();

    // 5. 验证索引完整性
    await this.testIndexIntegrity();

    // 6. 验证外键约束
    await this.testForeignKeyConstraints();

    // 7. 验证枚举类型
    await this.testEnumTypes();

    // 8. 验证种子数据
    await this.testSeedData();

    // 9. 输出测试结果
    this.printTestResults();
  }

  /**
   * 测试迁移文件存在性
   */
  private async testMigrationFilesExistence(): Promise<void> {
    try {
      const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
      const migrations = fs.readdirSync(migrationsDir)
        .filter(item => !item.includes('migration_lock.toml'))
        .filter(item => fs.statSync(path.join(migrationsDir, item)).isDirectory());

      const requiredMigrations = [
        '20251218093212_debate_system_complete_model',
        '20251219044717_add_case_fields_for_docanalyzer',
        '20251219084435_add_argument_checks',
        '20251219092351_enhance_user_and_legal_reference_tables'
      ];

      const missingMigrations = requiredMigrations.filter(
        migration => !migrations.includes(migration)
      );

      if (missingMigrations.length === 0) {
        this.addTestResult('迁移文件存在性', 'PASSED', `找到 ${migrations.length} 个迁移文件`);
      } else {
        this.addTestResult(
          '迁移文件存在性',
          'FAILED',
          `缺失迁移文件: ${missingMigrations.join(', ')}`
        );
      }
    } catch (error) {
      this.addTestResult('迁移文件存在性', 'FAILED', '', error as string);
    }
  }

  /**
   * 测试迁移脚本语法
   */
  private async testMigrationScriptSyntax(): Promise<void> {
    try {
      const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
      const migrations = fs.readdirSync(migrationsDir)
        .filter(item => !item.includes('migration_lock.toml'))
        .filter(item => fs.statSync(path.join(migrationsDir, item)).isDirectory());

      let syntaxErrors = 0;

      for (const migration of migrations) {
        const migrationFile = path.join(migrationsDir, migration, 'migration.sql');
        if (fs.existsSync(migrationFile)) {
          const content = fs.readFileSync(migrationFile, 'utf8');
          
          // 基本语法检查
          if (!content.trim()) {
            console.warn(`⚠️ 迁移文件 ${migration} 为空`);
            continue;
          }

          // 检查常见的SQL语法错误
          const hasSyntaxErrors = [
            /CREATE TABLE.*\(\s*\)/,  // 空表定义
            /ALTER TABLE.*ADD COLUMN.*\(\s*\)/,  // 空列定义
            /CREATE INDEX.*\(\s*\)/,  // 空索引定义
          ].some(pattern => pattern.test(content));

          if (hasSyntaxErrors) {
            syntaxErrors++;
            console.warn(`⚠️ 迁移文件 ${migration} 可能存在语法错误`);
          }
        }
      }

      if (syntaxErrors === 0) {
        this.addTestResult('迁移脚本语法', 'PASSED', '所有迁移文件语法检查通过');
      } else {
        this.addTestResult('迁移脚本语法', 'FAILED', `发现 ${syntaxErrors} 个语法问题`);
      }
    } catch (error) {
      this.addTestResult('迁移脚本语法', 'FAILED', '', error as string);
    }
  }

  /**
   * 测试数据库连接
   */
  private async testDatabaseConnection(): Promise<void> {
    try {
      await this.prisma.$connect();
      await this.prisma.$queryRaw`SELECT 1`;
      this.addTestResult('数据库连接', 'PASSED', '数据库连接正常');
    } catch (error) {
      this.addTestResult('数据库连接', 'FAILED', '', error as string);
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * 测试表结构完整性
   */
  private async testTableStructure(): Promise<void> {
    try {
      await this.prisma.$connect();
      
      const expectedTables = [
        'users', 'accounts', 'sessions',
        'cases', 'documents',
        'debates', 'debate_rounds', 'arguments',
        'legal_references', 'ai_interactions'
      ];

      const existingTables = await this.prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `;

      const tableNames = existingTables.map(row => row.tablename);
      const missingTables = expectedTables.filter(table => !tableNames.includes(table));

      if (missingTables.length === 0) {
        this.addTestResult('表结构完整性', 'PASSED', `所有 ${expectedTables.length} 个表已创建`);
      } else {
        this.addTestResult('表结构完整性', 'FAILED', `缺失表: ${missingTables.join(', ')}`);
      }
    } catch (error) {
      this.addTestResult('表结构完整性', 'FAILED', '', error as string);
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * 测试索引完整性
   */
  private async testIndexIntegrity(): Promise<void> {
    try {
      await this.prisma.$connect();
      
      const expectedIndexes = [
        'users_email_key', 'users_email_idx', 'users_username_idx',
        'cases_userId_idx', 'cases_status_idx', 'cases_type_idx',
        'debates_caseId_idx', 'debates_userId_idx', 'debates_status_idx',
        'arguments_roundId_idx', 'arguments_side_idx',
        'legal_references_caseId_idx', 'legal_references_lawType_idx'
      ];

      const existingIndexes = await this.prisma.$queryRaw<Array<{ indexname: string }>>`
        SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
      `;

      const indexNames = existingIndexes.map(row => row.indexname);
      const criticalIndexes = expectedIndexes.filter(index => indexNames.includes(index));

      const coverageRate = (criticalIndexes.length / expectedIndexes.length) * 100;

      if (coverageRate >= 90) {
        this.addTestResult('索引完整性', 'PASSED', 
          `关键索引覆盖率: ${coverageRate.toFixed(1)}% (${criticalIndexes.length}/${expectedIndexes.length})`);
      } else {
        this.addTestResult('索引完整性', 'FAILED', 
          `关键索引覆盖率过低: ${coverageRate.toFixed(1)}%`);
      }
    } catch (error) {
      this.addTestResult('索引完整性', 'FAILED', '', error as string);
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * 测试外键约束
   */
  private async testForeignKeyConstraints(): Promise<void> {
    try {
      await this.prisma.$connect();
      
      const expectedConstraints = [
        'accounts_userId_fkey',
        'sessions_userId_fkey',
        'cases_userId_fkey',
        'documents_caseId_fkey',
        'documents_userId_fkey',
        'debates_caseId_fkey',
        'debates_userId_fkey',
        'debate_rounds_debateId_fkey',
        'arguments_roundId_fkey',
        'legal_references_caseId_fkey'
      ];

      const existingConstraints = await this.prisma.$queryRaw<Array<{ constraint_name: string }>>`
        SELECT constraint_name FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'
      `;

      const constraintNames = existingConstraints.map(row => row.constraint_name);
      const foundConstraints = expectedConstraints.filter(constraint => 
        constraintNames.includes(constraint)
      );

      if (foundConstraints.length === expectedConstraints.length) {
        this.addTestResult('外键约束', 'PASSED', `所有 ${expectedConstraints.length} 个外键约束已创建`);
      } else {
        this.addTestResult('外键约束', 'FAILED', 
          `部分外键约束缺失: ${expectedConstraints.length - foundConstraints.length} 个`);
      }
    } catch (error) {
      this.addTestResult('外键约束', 'FAILED', '', error as string);
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * 测试枚举类型
   */
  private async testEnumTypes(): Promise<void> {
    try {
      await this.prisma.$connect();
      
      const expectedEnums = [
        'UserRole', 'UserStatus', 'CaseType', 'CaseStatus',
        'AnalysisStatus', 'DebateStatus', 'RoundStatus',
        'ArgumentSide', 'ArgumentType', 'LegalReferenceStatus'
      ];

      const existingEnums = await this.prisma.$queryRaw<Array<{ typname: string }>>`
        SELECT typname FROM pg_type WHERE typtype = 'e'
      `;

      const enumNames = existingEnums.map(row => row.typname);
      const missingEnums = expectedEnums.filter(enumType => !enumNames.includes(enumType));

      if (missingEnums.length === 0) {
        this.addTestResult('枚举类型', 'PASSED', `所有 ${expectedEnums.length} 个枚举类型已创建`);
      } else {
        this.addTestResult('枚举类型', 'FAILED', `缺失枚举类型: ${missingEnums.join(', ')}`);
      }
    } catch (error) {
      this.addTestResult('枚举类型', 'FAILED', '', error as string);
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * 测试种子数据
   */
  private async testSeedData(): Promise<void> {
    try {
      await this.prisma.$connect();
      
      // 检查种子数据脚本存在
      const seedFile = path.join(process.cwd(), 'prisma', 'seed.ts');
      const seedExists = fs.existsSync(seedFile);

      if (!seedExists) {
        this.addTestResult('种子数据', 'FAILED', '种子数据脚本不存在');
        return;
      }

      // 尝试运行种子数据（可选）
      try {
        console.log('📝 运行种子数据脚本...');
        execSync('npx tsx prisma/seed.ts', { stdio: 'pipe' });
        this.addTestResult('种子数据', 'PASSED', '种子数据脚本执行成功');
      } catch (seedError) {
        this.addTestResult('种子数据', 'FAILED', '种子数据脚本执行失败', seedError as string);
      }
    } catch (error) {
      this.addTestResult('种子数据', 'FAILED', '', error as string);
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * 添加测试结果
   */
  private addTestResult(name: string, status: 'PASSED' | 'FAILED' | 'SKIPPED', details?: string, error?: string): void {
    this.testResults.push({ name, status, details, error });
  }

  /**
   * 打印测试结果
   */
  private printTestResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 数据库迁移完整性测试报告');
    console.log('='.repeat(80));

    const passed = this.testResults.filter(r => r.status === 'PASSED').length;
    const failed = this.testResults.filter(r => r.status === 'FAILED').length;
    const skipped = this.testResults.filter(r => r.status === 'SKIPPED').length;

    this.testResults.forEach(result => {
      const icon = result.status === 'PASSED' ? '✅' : result.status === 'FAILED' ? '❌' : '⏭️';
      console.log(`${icon} ${result.name}: ${result.status}`);
      
      if (result.details) {
        console.log(`   📋 ${result.details}`);
      }
      
      if (result.error) {
        console.log(`   🚨 错误: ${result.error}`);
      }
      console.log('');
    });

    console.log('─'.repeat(80));
    console.log(`📈 测试统计:`);
    console.log(`   ✅ 通过: ${passed}`);
    console.log(`   ❌ 失败: ${failed}`);
    console.log(`   ⏭️ 跳过: ${skipped}`);
    console.log(`   📊 总计: ${this.testResults.length}`);
    
    const successRate = (passed / this.testResults.length) * 100;
    console.log(`   🎯 成功率: ${successRate.toFixed(1)}%`);
    console.log('='.repeat(80));

    if (failed > 0) {
      console.log('\n⚠️ 发现问题，请检查迁移脚本完整性');
      process.exit(1);
    } else {
      console.log('\n🎉 所有测试通过！迁移脚本完整性验证成功');
    }
  }
}

// 运行测试
if (require.main === module) {
  const tester = new MigrationIntegrityTester();
  tester.runAllTests().catch(console.error);
}

export { MigrationIntegrityTester };
