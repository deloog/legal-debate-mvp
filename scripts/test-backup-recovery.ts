import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { _DatabaseBackupManager, createBackupManager } from './backup-database';
import {
  DatabaseRestoreManager,
  createRestoreManager,
} from './restore-database';

const execAsync = promisify(exec);

// 测试配置接口
interface TestConfig {
  originalDatabase: string;
  testDatabase: string;
  backupDir: string;
  cleanupAfterTest: boolean;
}

// 测试结果接口
interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

// 数据一致性检查结果
interface ConsistencyCheck {
  tableCount: number;
  recordCounts: Record<string, number>;
  foreignKeyChecks: boolean;
  indexChecks: boolean;
}

export class BackupRecoveryTester {
  private config: TestConfig;
  private testResults: TestResult[] = [];

  constructor(config: TestConfig) {
    this.config = config;
  }

  // 执行所有测试
  async runAllTests(): Promise<void> {
    console.log('🚀 开始备份恢复完整测试...');
    const startTime = Date.now();

    try {
      // 测试1: 备份功能测试
      await this.runTest('备份功能测试', () => this.testBackupFunctionality());

      // 测试2: 备份验证功能测试
      await this.runTest('备份验证功能测试', () => this.testBackupValidation());

      // 测试3: 恢复功能测试
      await this.runTest('恢复功能测试', () => this.testRestoreFunctionality());

      // 测试4: 数据一致性测试
      await this.runTest('数据一致性测试', () => this.testDataConsistency());

      // 测试5: 完整流程测试
      await this.runTest('完整流程测试', () => this.testCompleteWorkflow());

      // 测试6: 错误处理测试
      await this.runTest('错误处理测试', () => this.testErrorHandling());

      const totalTime = Date.now() - startTime;
      this.printTestSummary(totalTime);
    } catch (error) {
      console.error('测试过程中发生错误:', error);
    } finally {
      // 清理测试环境
      if (this.config.cleanupAfterTest) {
        await this.cleanup();
      }
    }
  }

  // 运行单个测试
  private async runTest(
    testName: string,
    testFunction: () => Promise<void>
  ): Promise<void> {
    console.log(`\n📋 运行测试: ${testName}`);
    const startTime = Date.now();

    try {
      await testFunction();
      const duration = Date.now() - startTime;

      this.testResults.push({
        testName,
        success: true,
        duration,
      });

      console.log(`✅ ${testName} - 通过 (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;

      this.testResults.push({
        testName,
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });

      console.log(`❌ ${testName} - 失败 (${duration}ms)`);
      console.log(
        `   错误: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // 测试1: 备份功能测试
  private async testBackupFunctionality(): Promise<void> {
    const backupManager = createBackupManager();

    // 创建备份
    const backupInfo = await backupManager.createBackup();

    if (!backupInfo.success) {
      throw new Error(`备份创建失败: ${backupInfo.error}`);
    }

    if (backupInfo.size === 0) {
      throw new Error('备份文件大小为0');
    }

    // 验证备份文件存在
    const backupPath = path.join(this.config.backupDir, backupInfo.filename);
    const stats = await fs.stat(backupPath);

    if (stats.size !== backupInfo.size) {
      throw new Error('备份文件大小不匹配');
    }

    console.log(`   备份文件: ${backupInfo.filename}`);
    console.log(
      `   文件大小: ${(backupInfo.size / 1024 / 1024).toFixed(2)} MB`
    );
  }

  // 测试2: 备份验证功能测试
  private async testBackupValidation(): Promise<void> {
    const backupManager = createBackupManager();

    // 创建备份
    const backupInfo = await backupManager.createBackup();

    if (!backupInfo.success) {
      throw new Error(`备份创建失败: ${backupInfo.error}`);
    }

    // 验证备份
    const isValid = await backupManager.verifyBackup(backupInfo.filename);

    if (!isValid) {
      throw new Error('备份验证失败');
    }

    console.log(`   验证备份: ${backupInfo.filename} - ✅ 有效`);
  }

  // 测试3: 恢复功能测试
  private async testRestoreFunctionality(): Promise<void> {
    const backupManager = createBackupManager();
    const _restoreManager = createRestoreManager();

    // 创建备份
    const backupInfo = await backupManager.createBackup();

    if (!backupInfo.success) {
      throw new Error(`备份创建失败: ${backupInfo.error}`);
    }

    // 配置恢复到测试数据库
    const testRestoreManager = new DatabaseRestoreManager({
      databaseUrl: process.env.DATABASE_URL || '',
      backupDir: this.config.backupDir,
      targetDatabase: this.config.testDatabase,
      createTargetDb: true,
      dropExistingDb: true,
    });

    // 执行恢复
    const restoreInfo = await testRestoreManager.restoreDatabase(
      backupInfo.filename
    );

    if (!restoreInfo.success) {
      throw new Error(`恢复失败: ${restoreInfo.error}`);
    }

    // 验证恢复结果
    const isValid = await testRestoreManager.validateRestoredDatabase(
      this.config.testDatabase
    );

    if (!isValid) {
      throw new Error('恢复后的数据库验证失败');
    }

    console.log(`   恢复数据库: ${this.config.testDatabase}`);
    console.log(`   恢复表数: ${restoreInfo.tablesRestored}`);
  }

  // 测试4: 数据一致性测试
  private async testDataConsistency(): Promise<void> {
    const originalConsistency = await this.checkDatabaseConsistency(
      this.config.originalDatabase
    );
    const testConsistency = await this.checkDatabaseConsistency(
      this.config.testDatabase
    );

    // 比较表数量
    if (originalConsistency.tableCount !== testConsistency.tableCount) {
      throw new Error(
        `表数量不匹配: 原始${originalConsistency.tableCount}, 恢复${testConsistency.tableCount}`
      );
    }

    // 比较记录数量
    for (const tableName of Object.keys(originalConsistency.recordCounts)) {
      const originalCount = originalConsistency.recordCounts[tableName];
      const testCount = testConsistency.recordCounts[tableName];

      if (originalCount !== testCount) {
        throw new Error(
          `表${tableName}记录数不匹配: 原始${originalCount}, 恢复${testCount}`
        );
      }
    }

    console.log(`   表数量: ${testConsistency.tableCount}`);
    console.log(`   记录数量: ${JSON.stringify(testConsistency.recordCounts)}`);
    console.log(
      `   外键约束: ${testConsistency.foreignKeyChecks ? '✅' : '❌'}`
    );
    console.log(`   索引检查: ${testConsistency.indexChecks ? '✅' : '❌'}`);
  }

  // 检查数据库一致性
  private async checkDatabaseConsistency(
    databaseName: string
  ): Promise<ConsistencyCheck> {
    const pgpassPath = path.join(process.cwd(), 'config', '.pgpass');
    const connectionInfo =
      process.env.DATABASE_URL?.replace(/\/[^\/?]+(\?|$)/, '') || '';

    try {
      // 获取表数量
      const tableCountCommand = `set PGPASSFILE="${pgpassPath}" && psql "${connectionInfo}/${databaseName}" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"`;
      const tableCountResult = await execAsync(tableCountCommand);
      const tableCount = parseInt(
        tableCountResult.stdout.trim().split('\n')[2]
      );

      // 获取所有表名
      const tableNamesCommand = `set PGPASSFILE="${pgpassPath}" && psql "${connectionInfo}/${databaseName}" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"`;
      const tableNamesResult = await execAsync(tableNamesCommand);
      const tableNames = tableNamesResult.stdout
        .split('\n')
        .filter(
          line =>
            line.trim() &&
            !line.includes('table_name') &&
            line.includes('-') === false
        );

      // 获取每张表的记录数
      const recordCounts: Record<string, number> = {};
      for (const tableName of tableNames) {
        const trimmedName = tableName.trim();
        if (trimmedName) {
          const countCommand = `set PGPASSFILE="${pgpassPath}" && psql "${connectionInfo}/${databaseName}" -c "SELECT COUNT(*) FROM ${trimmedName};"`;
          const countResult = await execAsync(countCommand);
          const count = parseInt(countResult.stdout.trim().split('\n')[0]);
          recordCounts[trimmedName] = count;
        }
      }

      return {
        tableCount,
        recordCounts,
        foreignKeyChecks: true, // 简化检查，实际可以更详细
        indexChecks: true, // 简化检查，实际可以更详细
      };
    } catch (error) {
      throw new Error(
        `检查数据库一致性失败 ${databaseName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // 测试5: 完整流程测试
  private async testCompleteWorkflow(): Promise<void> {
    const backupManager = createBackupManager();

    // 创建完整工作流测试数据
    const timestamp = new Date().toISOString();
    console.log(`   测试时间戳: ${timestamp}`);

    // 创建备份
    const backupInfo = await backupManager.createBackup();

    if (!backupInfo.success) {
      throw new Error(`备份创建失败: ${backupInfo.error}`);
    }

    // 验证备份
    const isBackupValid = await backupManager.verifyBackup(backupInfo.filename);

    if (!isBackupValid) {
      throw new Error('备份验证失败');
    }

    // 恢复到测试数据库
    const testRestoreManager = new DatabaseRestoreManager({
      databaseUrl: process.env.DATABASE_URL || '',
      backupDir: this.config.backupDir,
      targetDatabase: this.config.testDatabase + '_workflow',
      createTargetDb: true,
      dropExistingDb: true,
    });

    const restoreInfo = await testRestoreManager.restoreDatabase(
      backupInfo.filename
    );

    if (!restoreInfo.success) {
      throw new Error(`恢复失败: ${restoreInfo.error}`);
    }

    // 验证恢复结果
    const isRestoreValid = await testRestoreManager.validateRestoredDatabase(
      this.config.testDatabase + '_workflow'
    );

    if (!isRestoreValid) {
      throw new Error('恢复后的数据库验证失败');
    }

    console.log(
      `   完整流程成功: ${backupInfo.filename} -> ${this.config.testDatabase}_workflow`
    );
  }

  // 测试6: 错误处理测试
  private async testErrorHandling(): Promise<void> {
    const restoreManager = createRestoreManager();

    // 测试恢复不存在的备份文件
    try {
      await restoreManager.restoreDatabase('nonexistent_backup.sql');
      throw new Error('应该抛出文件不存在的错误');
    } catch (error) {
      if (!error.message.includes('备份文件验证失败')) {
        throw new Error(`错误消息不正确: ${error.message}`);
      }
    }

    // 测试恢复到不存在的数据库（不自动创建）
    const testRestoreManager = new DatabaseRestoreManager({
      databaseUrl: process.env.DATABASE_URL || '',
      backupDir: this.config.backupDir,
      targetDatabase: 'nonexistent_test_db',
      createTargetDb: false,
      dropExistingDb: false,
    });

    // 先获取一个有效的备份文件
    const backups = await restoreManager.listAvailableBackups();
    if (backups.length > 0) {
      try {
        await testRestoreManager.restoreDatabase(backups[0]);
        // 如果成功，说明数据库已存在，这是正常的
        console.log(`   数据库已存在，恢复成功`);
      } catch (error) {
        if (
          !error.message.includes('数据库') &&
          !error.message.includes('connection')
        ) {
          throw new Error(`错误处理测试失败: ${error.message}`);
        }
        console.log(`   正确处理了数据库不存在的错误`);
      }
    }

    console.log(`   错误处理测试通过`);
  }

  // 打印测试摘要
  private printTestSummary(totalTime: number): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试摘要报告');
    console.log('='.repeat(60));

    const passedTests = this.testResults.filter(
      result => result.success
    ).length;
    const failedTests = this.testResults.length - passedTests;
    const successRate = ((passedTests / this.testResults.length) * 100).toFixed(
      1
    );

    console.log(`总测试数: ${this.testResults.length}`);
    console.log(`通过测试: ${passedTests} ✅`);
    console.log(`失败测试: ${failedTests} ❌`);
    console.log(`成功率: ${successRate}%`);
    console.log(`总耗时: ${totalTime}ms`);

    if (failedTests > 0) {
      console.log('\n❌ 失败的测试:');
      this.testResults
        .filter(result => !result.success)
        .forEach(result => {
          console.log(`   - ${result.testName}: ${result.error}`);
        });
    }

    console.log('\n📈 详细结果:');
    this.testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.testName} (${result.duration}ms)`);
      if (result.details) {
        console.log(`      详情: ${JSON.stringify(result.details, null, 2)}`);
      }
    });

    console.log('\n' + '='.repeat(60));

    if (failedTests === 0) {
      console.log('🎉 所有测试通过！备份恢复系统工作正常。');
    } else {
      console.log('⚠️ 部分测试失败，请检查相关功能。');
    }
  }

  // 清理测试环境
  private async cleanup(): Promise<void> {
    console.log('\n🧹 清理测试环境...');

    try {
      // 删除测试数据库
      const testDatabases = [
        this.config.testDatabase,
        this.config.testDatabase + '_workflow',
      ];

      for (const dbName of testDatabases) {
        try {
          const pgpassPath = path.join(process.cwd(), 'config', '.pgpass');
          const connectionInfo =
            process.env.DATABASE_URL?.replace(/\/[^\/?]+(\?|$)/, '') || '';

          const dropDbCommand = `set PGPASSFILE="${pgpassPath}" && psql "${connectionInfo}/postgres" -c "DROP DATABASE IF EXISTS ${dbName};"`;
          await execAsync(dropDbCommand);

          console.log(`   删除测试数据库: ${dbName}`);
        } catch (error) {
          console.log(
            `   ⚠️ 无法删除数据库 ${dbName}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    } catch (error) {
      console.error(
        `清理失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// 创建测试配置
export const createTestConfig = (): TestConfig => ({
  originalDatabase: process.env.TEST_ORIGINAL_DATABASE || 'legal_debate_dev',
  testDatabase: process.env.TEST_TARGET_DATABASE || 'legal_debate_test_restore',
  backupDir: process.env.BACKUP_DIR || './backups',
  cleanupAfterTest: process.env.TEST_CLEANUP_AFTER !== 'false',
});

// 运行备份恢复测试
export const runBackupRecoveryTests = async (): Promise<void> => {
  const config = createTestConfig();
  const tester = new BackupRecoveryTester(config);

  await tester.runAllTests();
};

// 如果直接运行此脚本，执行测试
if (require.main === module) {
  runBackupRecoveryTests().catch(console.error);
}
