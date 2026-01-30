import fs from 'fs/promises';
import path from 'path';
import {
  ensureDirectory,
  execAsync,
  generateBackupFilename,
  getFileSize,
  logMigration,
  MigrationError,
  validateBackupFile,
  type OrphanRecord,
  type TableValidation,
} from './migration-utils';

/**
 * 迁移结果接口
 */
export interface MigrationResult {
  success: boolean;
  error?: string;
  appliedMigrations: number;
  backupFile?: string;
  size: number;
  duration: number;
}

/**
 * Schema验证结果接口
 */
export interface SchemaValidation {
  valid: boolean;
  missingTables: string[];
  tableValidation: TableValidation[];
  error?: string;
}

/**
 * 数据完整性检查结果接口
 */
export interface DataIntegrityCheck {
  valid: boolean;
  orphanRecords: OrphanRecord[];
  error?: string;
}

/**
 * 回滚结果接口
 */
export interface RollbackResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 迁移配置接口
 */
export interface MigrationConfig {
  createBackupBefore?: boolean;
  backupDir?: string;
  maxRetries?: number;
}

// 默认配置
const DEFAULT_CONFIG: Required<MigrationConfig> = {
  createBackupBefore: true,
  backupDir: process.env.BACKUP_DIR || './backups',
  maxRetries: 3,
};

// 关键表列表
const CRITICAL_TABLES = [
  'User',
  'Case',
  'Evidence',
  'Document',
  'Membership',
  'UserRole',
];

/**
 * 创建数据库备份
 */
export async function createBackup(
  config?: Partial<MigrationConfig>
): Promise<MigrationResult> {
  const startTime = Date.now();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  logMigration('Starting database backup...');

  try {
    // 确保备份目录存在
    await ensureDirectory(mergedConfig.backupDir);

    // 生成备份文件名
    const timestamp = new Date();
    const filename = generateBackupFilename(timestamp);
    const filepath = path.join(mergedConfig.backupDir, filename);

    // 执行pg_dump命令
    const databaseUrl = process.env.DATABASE_URL || '';

    logMigration(`Creating backup: ${filename}`);

    try {
      await execAsync(
        `pg_dump "${databaseUrl}" --format=plain --no-owner --no-acl > "${filepath}"`
      );
    } catch (error) {
      throw new MigrationError('Backup creation failed', 'BACKUP_FAILED', {
        error: String(error),
      });
    }

    // 获取文件大小
    const size = await getFileSize(filepath);

    // 验证备份文件
    const isValid = await validateBackupFile(filepath, execAsync);
    if (!isValid) {
      throw new MigrationError(
        'Backup file validation failed',
        'BACKUP_VALIDATION_FAILED'
      );
    }

    const duration = Date.now() - startTime;
    logMigration(`Backup completed: ${filename} (${size} bytes)`);

    return {
      success: true,
      appliedMigrations: 0,
      backupFile: filepath,
      size,
      duration,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logMigration(`Backup failed: ${errorMessage}`, 'error');
    return {
      success: false,
      error: errorMessage,
      appliedMigrations: 0,
      size: 0,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * 运行Prisma迁移
 */
export async function runMigration(
  config?: Partial<MigrationConfig>
): Promise<MigrationResult> {
  const startTime = Date.now();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  logMigration('Starting database migration...');

  // 可选：在迁移前创建备份
  let backupResult: MigrationResult | undefined;
  if (mergedConfig.createBackupBefore) {
    logMigration('Creating pre-migration backup...');
    backupResult = await createBackup(config);
    if (!backupResult.success) {
      return {
        success: false,
        error: 'Pre-migration backup failed',
        appliedMigrations: 0,
        size: 0,
        duration: Date.now() - startTime,
      };
    }
  }

  try {
    // 执行prisma migrate deploy
    logMigration('Running prisma migrate deploy...');
    const { stdout } = await execAsync('npx prisma migrate deploy');

    // 解析应用的迁移数量
    const appliedCountMatch = stdout.match(/(\d+) migration/);
    const appliedMigrations = appliedCountMatch
      ? parseInt(appliedCountMatch[1], 10)
      : 0;

    logMigration(
      `Migration completed successfully: ${appliedMigrations} migrations`
    );

    return {
      success: true,
      appliedMigrations,
      backupFile: backupResult?.backupFile,
      size: backupResult?.size || 0,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logMigration(`Migration failed: ${errorMessage}`, 'error');
    return {
      success: false,
      error: errorMessage,
      appliedMigrations: 0,
      backupFile: backupResult?.backupFile,
      size: backupResult?.size || 0,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * 验证Schema
 */
export async function validateSchema(
  tablesToCheck: string[] = CRITICAL_TABLES
): Promise<SchemaValidation> {
  logMigration('Validating database schema...');

  try {
    // 获取所有表名
    const { stdout } = await execAsync(`
      psql "${process.env.DATABASE_URL}" -t -c "
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename;
      "
    `);

    const existingTables = stdout
      .trim()
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    // 检查缺失的表
    const missingTables = tablesToCheck.filter(
      table => !existingTables.includes(table)
    );

    // 检查表记录数
    const tableValidation: TableValidation[] = [];
    for (const table of existingTables) {
      if (tablesToCheck.length === 0 || tablesToCheck.includes(table)) {
        const { stdout: countOutput } = await execAsync(`
          psql "${process.env.DATABASE_URL}" -t -c "SELECT COUNT(*) FROM ${table};"
        `);
        const count = parseInt(countOutput.trim(), 10);
        tableValidation.push({
          tableName: table,
          exists: true,
          recordCount: isNaN(count) ? 0 : count,
        });
      }
    }

    const isValid = missingTables.length === 0;

    if (isValid) {
      logMigration('Schema validation passed');
    } else {
      logMigration(
        `Schema validation failed: missing tables ${missingTables.join(', ')}`,
        'warn'
      );
    }

    return {
      valid: isValid,
      missingTables,
      tableValidation,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logMigration(`Schema validation failed: ${errorMessage}`, 'error');
    return {
      valid: false,
      missingTables: [],
      tableValidation: [],
      error: errorMessage,
    };
  }
}

/**
 * 检查数据完整性
 */
export async function checkDataIntegrity(): Promise<DataIntegrityCheck> {
  logMigration('Checking data integrity...');

  try {
    // 检查外键约束和孤立记录
    const orphanRecords: OrphanRecord[] = [];

    // 检查Case表中的孤立记录（没有对应的User）
    const { stdout: orphanCases } = await execAsync(`
      psql "${process.env.DATABASE_URL}" -t -c "
        SELECT COUNT(*) FROM "Case" c 
        WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = c.userId);
      "
    `);
    const orphanCaseCount = parseInt(orphanCases.trim(), 10);
    if (orphanCaseCount > 0) {
      orphanRecords.push({
        tableName: 'Case',
        foreignKeyColumn: 'userId',
        count: orphanCaseCount,
      });
    }

    // 检查Evidence表中的孤立记录（没有对应的Case）
    const { stdout: orphanEvidence } = await execAsync(`
      psql "${process.env.DATABASE_URL}" -t -c "
        SELECT COUNT(*) FROM "Evidence" e 
        WHERE NOT EXISTS (SELECT 1 FROM "Case" c WHERE c.id = e.caseId);
      "
    `);
    const orphanEvidenceCount = parseInt(orphanEvidence.trim(), 10);
    if (orphanEvidenceCount > 0) {
      orphanRecords.push({
        tableName: 'Evidence',
        foreignKeyColumn: 'caseId',
        count: orphanEvidenceCount,
      });
    }

    const isValid = orphanRecords.length === 0;

    if (isValid) {
      logMigration('Data integrity check passed');
    } else {
      logMigration(
        `Data integrity check failed: ${orphanRecords.length} orphan records found`,
        'warn'
      );
    }

    return {
      valid: isValid,
      orphanRecords,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logMigration(`Data integrity check failed: ${errorMessage}`, 'error');
    return {
      valid: false,
      orphanRecords: [],
      error: errorMessage,
    };
  }
}

/**
 * 回滚迁移
 */
export async function rollbackMigration(
  backupFilename: string,
  config?: Partial<MigrationConfig>
): Promise<RollbackResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const filepath = path.join(mergedConfig.backupDir, backupFilename);

  logMigration(`Rollback request: ${backupFilename}`);

  try {
    // 验证备份文件存在
    const stats = await fs.stat(filepath);

    // 验证备份文件完整性
    const isValid = await validateBackupFile(filepath, execAsync);
    if (!isValid) {
      throw new MigrationError(
        'Backup file validation failed',
        'BACKUP_VALIDATION_FAILED'
      );
    }

    // 注意：这里只记录回滚请求，不实际执行
    // 实际回滚应由运维人员手动执行以确保数据安全
    logMigration(
      `Rollback request logged: ${backupFilename} (size: ${stats.size} bytes)`,
      'warn'
    );

    return {
      success: true,
      message: `Rollback request logged for ${backupFilename}. Manual intervention required.`,
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      logMigration(`Backup file not found: ${backupFilename}`, 'error');
      return {
        success: false,
        error: `Backup file not found: ${backupFilename}`,
      };
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logMigration(`Rollback failed: ${errorMessage}`, 'error');
    return {
      success: false,
      error: errorMessage,
    };
  }
}
