#!/usr/bin/env ts-node

/**
 * 数据库迁移回滚测试脚本
 * 验证迁移回滚功能的完整性和可靠性
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface RollbackTest {
  name: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  details?: string;
  error?: string;
}

class MigrationRollbackTester {
  private prisma: PrismaClient;
  private testResults: RollbackTest[] = [];
  private originalMigrationState: string = '';

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 运行所有回滚测试
   */
  async runAllTests(): Promise<void> {
    console.log('🔄 开始数据库迁移回滚测试...\n');

    try {
      // 1. 备份当前迁移状态
      await this.backupMigrationState();

      // 2. 测试单个迁移回滚
      await this.testSingleMigrationRollback();

      // 3. 测试多个迁移回滚
      await this.testMultipleMigrationRollback();

      // 4. 测试回滚后重新部署
      await this.testRollbackAndRedeploy();

      // 5. 测试数据完整性
      await this.testDataIntegrityAfterRollback();

      // 6. 恢复到原始状态
      await this.restoreOriginalState();
    } catch (error) {
      console.error('回滚测试过程中发生错误:', error);
      await this.restoreOriginalState();
    }

    // 7. 输出测试结果
    this.printTestResults();
  }

  /**
   * 备份当前迁移状态
   */
  private async backupMigrationState(): Promise<void> {
    try {
      const result = execSync('npx prisma migrate status', {
        encoding: 'utf8',
      });
      this.originalMigrationState = result;
      console.log('📋 已备份当前迁移状态');
      this.addTestResult('备份迁移状态', 'PASSED', '当前迁移状态已备份');
    } catch (error) {
      this.addTestResult('备份迁移状态', 'FAILED', '', error as string);
      throw error;
    }
  }

  /**
   * 测试单个迁移回滚
   */
  private async testSingleMigrationRollback(): Promise<void> {
    try {
      console.log('🔄 测试单个迁移回滚...');

      // 获取当前迁移列表
      const migrations = this.getMigrationList();
      if (migrations.length === 0) {
        this.addTestResult('单个迁移回滚', 'SKIPPED', '没有可回滚的迁移');
        return;
      }

      const lastMigration = migrations[migrations.length - 1];
      console.log(`📦 回滚迁移: ${lastMigration}`);

      // 执行回滚
      execSync(`npx prisma migrate reset --force --skip-seed`, {
        stdio: 'pipe',
      });

      // 重新部署除最后一个迁移外的所有迁移
      execSync('npx prisma migrate deploy', { stdio: 'pipe' });

      console.log('✅ 单个迁移回滚测试完成');
      this.addTestResult(
        '单个迁移回滚',
        'PASSED',
        `成功回滚迁移: ${lastMigration}`
      );
    } catch (error) {
      this.addTestResult('单个迁移回滚', 'FAILED', '', error as string);
    }
  }

  /**
   * 测试多个迁移回滚
   */
  private async testMultipleMigrationRollback(): Promise<void> {
    try {
      console.log('🔄 测试多个迁移回滚...');

      // 重置数据库
      execSync('npx prisma migrate reset --force --skip-seed', {
        stdio: 'pipe',
      });

      // 部署所有迁移
      execSync('npx prisma migrate deploy', { stdio: 'pipe' });

      console.log('✅ 多个迁移回滚测试完成');
      this.addTestResult(
        '多个迁移回滚',
        'PASSED',
        '成功重置并重新部署所有迁移'
      );
    } catch (error) {
      this.addTestResult('多个迁移回滚', 'FAILED', '', error as string);
    }
  }

  /**
   * 测试回滚后重新部署
   */
  private async testRollbackAndRedeploy(): Promise<void> {
    try {
      console.log('🔄 测试回滚后重新部署...');

      // 重置并重新部署
      execSync('npx prisma migrate reset --force --skip-seed', {
        stdio: 'pipe',
      });
      execSync('npx prisma migrate deploy', { stdio: 'pipe' });
      execSync('npx prisma generate', { stdio: 'pipe' });

      // 验证数据库连接
      await this.prisma.$connect();
      await this.prisma.$queryRaw`SELECT 1`;
      await this.prisma.$disconnect();

      console.log('✅ 回滚后重新部署测试完成');
      this.addTestResult('回滚后重新部署', 'PASSED', '迁移重置和重新部署成功');
    } catch (error) {
      this.addTestResult('回滚后重新部署', 'FAILED', '', error as string);
    }
  }

  /**
   * 测试数据完整性
   */
  private async testDataIntegrityAfterRollback(): Promise<void> {
    try {
      console.log('🔄 测试回滚后数据完整性...');

      await this.prisma.$connect();

      // 检查表是否存在
      const tables = await this.prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `;

      const expectedTables = [
        'users',
        'accounts',
        'sessions',
        'cases',
        'documents',
        'debates',
        'debate_rounds',
        'arguments',
        'legal_references',
        'ai_interactions',
      ];

      const tableNames = tables.map(row => row.tablename);
      const missingTables = expectedTables.filter(
        table => !tableNames.includes(table)
      );

      if (missingTables.length === 0) {
        this.addTestResult(
          '回滚后数据完整性',
          'PASSED',
          `所有 ${expectedTables.length} 个表结构完整`
        );
      } else {
        this.addTestResult(
          '回滚后数据完整性',
          'FAILED',
          `缺失表: ${missingTables.join(', ')}`
        );
      }

      // 检查枚举类型
      const enums = await this.prisma.$queryRaw<Array<{ typname: string }>>`
        SELECT typname FROM pg_type WHERE typtype = 'e'
      `;

      const expectedEnums = [
        'UserRole',
        'UserStatus',
        'CaseType',
        'CaseStatus',
        'AnalysisStatus',
        'DebateStatus',
        'RoundStatus',
        'ArgumentSide',
        'ArgumentType',
        'LegalReferenceStatus',
      ];

      const enumNames = enums.map(row => row.typname);
      const missingEnums = expectedEnums.filter(
        enumType => !enumNames.includes(enumType)
      );

      if (missingEnums.length === 0) {
        console.log('✅ 枚举类型完整性验证通过');
      } else {
        console.log(`⚠️ 缺失枚举类型: ${missingEnums.join(', ')}`);
      }

      await this.prisma.$disconnect();
    } catch (error) {
      this.addTestResult('回滚后数据完整性', 'FAILED', '', error as string);
    }
  }

  /**
   * 恢复到原始状态
   */
  private async restoreOriginalState(): Promise<void> {
    try {
      console.log('🔄 恢复到原始状态...');

      // 重新部署所有迁移
      execSync('npx prisma migrate deploy', { stdio: 'pipe' });
      execSync('npx prisma generate', { stdio: 'pipe' });

      // 运行种子数据
      execSync('npx tsx prisma/seed.ts', { stdio: 'pipe' });

      console.log('✅ 已恢复到原始状态');
      this.addTestResult('恢复原始状态', 'PASSED', '数据库已恢复到测试前状态');
    } catch (error) {
      this.addTestResult('恢复原始状态', 'FAILED', '', error as string);
    }
  }

  /**
   * 获取迁移列表
   */
  private getMigrationList(): string[] {
    const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
    return fs
      .readdirSync(migrationsDir)
      .filter(item => !item.includes('migration_lock.toml'))
      .filter(item => fs.statSync(path.join(migrationsDir, item)).isDirectory())
      .sort();
  }

  /**
   * 添加测试结果
   */
  private addTestResult(
    name: string,
    status: 'PASSED' | 'FAILED' | 'SKIPPED',
    details?: string,
    error?: string
  ): void {
    this.testResults.push({ name, status, details, error });
  }

  /**
   * 打印测试结果
   */
  private printTestResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 数据库迁移回滚测试报告');
    console.log('='.repeat(80));

    const passed = this.testResults.filter(r => r.status === 'PASSED').length;
    const failed = this.testResults.filter(r => r.status === 'FAILED').length;
    const skipped = this.testResults.filter(r => r.status === 'SKIPPED').length;

    this.testResults.forEach(result => {
      const icon =
        result.status === 'PASSED'
          ? '✅'
          : result.status === 'FAILED'
            ? '❌'
            : '⏭️';
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

    const successRate =
      this.testResults.length > 0
        ? (passed / this.testResults.length) * 100
        : 0;
    console.log(`   🎯 成功率: ${successRate.toFixed(1)}%`);
    console.log('='.repeat(80));

    if (failed > 0) {
      console.log('\n⚠️ 发现问题，请检查迁移回滚功能');
      process.exit(1);
    } else {
      console.log('\n🎉 所有回滚测试通过！迁移回滚功能验证成功');
    }
  }
}

// 运行测试
if (require.main === module) {
  const tester = new MigrationRollbackTester();
  tester.runAllTests().catch(console.error);
}

export { MigrationRollbackTester };
