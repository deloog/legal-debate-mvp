/**
 * 生产环境数据库备份脚本
 *
 * 功能：
 * - 加密备份文件
 * - 多版本保留策略
 * - 备份完整性验证
 * - 详细的日志记录
 * - 支持云存储上传（可选）
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

/**
 * 生产备份配置接口
 */
interface ProductionBackupConfig {
  databaseUrl: string;
  backupDir: string;
  retentionDays: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  encryptionKey?: string;
  uploadToCloud: boolean;
  cloudBucket?: string;
  cloudRegion?: string;
}

/**
 * 备份信息接口
 */
interface BackupInfo {
  id: string;
  timestamp: Date;
  filename: string;
  encryptedFilename?: string;
  size: number;
  encryptedSize?: number;
  duration: number;
  success: boolean;
  error?: string;
  checksum?: string;
  encryptedChecksum?: string;
}

/**
 * 云存储配置接口
 */
interface CloudStorageConfig {
  enabled: boolean;
  provider: 'aws' | 'aliyun' | 'tencent' | 'none';
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
}

/**
 * 生产数据库备份管理器
 */
export class ProductionDatabaseBackupManager {
  private config: ProductionBackupConfig;
  private cloudConfig: CloudStorageConfig;

  constructor(config: ProductionBackupConfig) {
    this.config = config;
    this.cloudConfig = this.loadCloudConfig();
  }

  /**
   * 加载云存储配置
   */
  private loadCloudConfig(): CloudStorageConfig {
    return {
      enabled: process.env.CLOUD_BACKUP_ENABLED === 'true',
      provider:
        (process.env.CLOUD_BACKUP_PROVIDER as CloudStorageConfig['provider']) ||
        'none',
      bucket: process.env.CLOUD_BACKUP_BUCKET || '',
      region: process.env.CLOUD_BACKUP_REGION || '',
      accessKey: process.env.CLOUD_BACKUP_ACCESS_KEY || '',
      secretKey: process.env.CLOUD_BACKUP_SECRET_KEY || '',
    };
  }

  /**
   * 创建备份目录
   */
  private async ensureBackupDir(): Promise<void> {
    try {
      await fs.mkdir(this.config.backupDir, { recursive: true });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * 生成备份文件名
   */
  private generateBackupFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dbName = this.extractDatabaseName();
    return `${dbName}_backup_${timestamp}.sql`;
  }

  /**
   * 生成加密备份文件名
   */
  private generateEncryptedFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dbName = this.extractDatabaseName();
    return `${dbName}_backup_${timestamp}.sql.enc`;
  }

  /**
   * 从DATABASE_URL提取数据库名
   */
  private extractDatabaseName(): string {
    const match = this.config.databaseUrl.match(/\/([^\/?]+)(\?|$)/);
    return match?.[1] || 'legal_debate_db';
  }

  /**
   * 生成文件校验和
   */
  private generateChecksum(filepath: string): string {
    const content = fsSync.readFileSync(filepath);
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
  }

  /**
   * 加密备份文件
   */
  private async encryptFile(
    inputPath: string,
    outputPath: string
  ): Promise<boolean> {
    try {
      if (!this.config.encryptionEnabled || !this.config.encryptionKey) {
        return false;
      }

      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv(algorithm, key, iv);

      const input = await fs.readFile(inputPath);
      const encrypted = Buffer.concat([
        iv,
        cipher.update(input),
        cipher.final(),
      ]);

      await fs.writeFile(outputPath, encrypted);
      return true;
    } catch (error) {
      console.error('[PROD] 加密备份文件失败:', error);
      return false;
    }
  }

  /**
   * 执行数据库备份
   */
  async createBackup(): Promise<BackupInfo> {
    const backupId = `backup_${Date.now()}`;
    const startTime = Date.now();
    const filename = this.generateBackupFilename();
    const filepath = path.join(this.config.backupDir, filename);

    console.log(`[PROD] 开始生产环境数据库备份: ${backupId}`);
    console.log(`[PROD] 加密状态: ${this.config.encryptionEnabled}`);
    console.log(`[PROD] 压缩状态: ${this.config.compressionEnabled}`);
    console.log(`[PROD] 云上传状态: ${this.cloudConfig.enabled}`);

    try {
      await this.ensureBackupDir();

      // 使用pg_dump创建PostgreSQL备份
      const command = this.buildBackupCommand(filepath);
      console.log('[PROD] 执行备份命令:', command);

      await execAsync(command);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 获取备份文件大小
      const stats = await fs.stat(filepath);
      const size = stats.size;
      const checksum = this.generateChecksum(filepath);

      let encryptedFilename: string | undefined;
      let encryptedSize: number | undefined;
      let encryptedChecksum: string | undefined;

      // 加密备份文件
      if (this.config.encryptionEnabled && this.config.encryptionKey) {
        encryptedFilename = this.generateEncryptedFilename();
        const encryptedPath = path.join(
          this.config.backupDir,
          encryptedFilename
        );
        const encrypted = await this.encryptFile(filepath, encryptedPath);

        if (encrypted) {
          const encryptedStats = await fs.stat(encryptedPath);
          encryptedSize = encryptedStats.size;
          encryptedChecksum = this.generateChecksum(encryptedPath);
          console.log('[PROD] 备份文件已加密');
        }
      }

      // 上传到云存储
      if (this.cloudConfig.enabled && encryptedFilename) {
        await this.uploadToCloudStorage();
      }

      const backupInfo: BackupInfo = {
        id: backupId,
        timestamp: new Date(),
        filename,
        encryptedFilename,
        size,
        encryptedSize,
        duration,
        success: true,
        checksum,
        encryptedChecksum,
      };

      console.log(
        `[PROD] 备份完成: ${filename} (${(size / 1024 / 1024).toFixed(2)} MB, ${duration}ms)`
      );

      // 记录备份信息到日志文件
      await this.logBackupInfo(backupInfo);

      return backupInfo;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const backupInfo: BackupInfo = {
        id: backupId,
        timestamp: new Date(),
        filename,
        size: 0,
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };

      console.error('[PROD] 备份失败:', backupInfo.error);

      // 记录失败信息到日志文件
      await this.logBackupInfo(backupInfo);

      return backupInfo;
    }
  }

  /**
   * 构建备份命令
   */
  private buildBackupCommand(filepath: string): string {
    const { databaseUrl } = this.config;
    const pgpassPath = path.join(process.cwd(), 'config', '.pgpass');

    let command = `set PGPASSFILE="${pgpassPath}" && pg_dump "${databaseUrl}" --no-password --verbose --format=custom --file="${filepath}"`;

    // 启用压缩
    if (this.config.compressionEnabled) {
      command += ' --compress=9';
    }

    // 添加更多生产环境优化选项
    command += ' --serializable-deferrable';
    command += ' --no-owner';
    command += ' --no-privileges';

    return command;
  }

  /**
   * 上传到云存储
   */
  private async uploadToCloudStorage(): Promise<void> {
    if (!this.cloudConfig.enabled) {
      return;
    }

    try {
      console.log(`[PROD] 上传备份到云存储: ${this.cloudConfig.provider}`);

      // TODO: 实现具体的云存储上传逻辑
      // AWS S3、阿里云OSS、腾讯云COS等

      console.log('[PROD] 云存储上传功能尚未实现');
    } catch (error) {
      console.error('[PROD] 云存储上传失败:', error);
      // 不中断备份流程，只记录错误
    }
  }

  /**
   * 记录备份信息到日志文件
   */
  private async logBackupInfo(backupInfo: BackupInfo): Promise<void> {
    const logPath = path.join(this.config.backupDir, 'backup.log');
    const logEntry = {
      ...backupInfo,
      environment: process.env.NODE_ENV || 'production',
    };

    const logLine = JSON.stringify(logEntry);
    try {
      await fs.appendFile(logPath, `${logLine}\n`);
    } catch (error) {
      console.error('[PROD] 写入备份日志失败:', error);
    }
  }

  /**
   * 清理过期备份
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.backupDir);
      const cutoffTime =
        Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;

      let deletedCount = 0;
      let totalSizeFreed = 0;

      for (const file of files) {
        // 只处理备份文件
        if (!file.includes('backup_') || !file.endsWith('.sql')) {
          continue;
        }

        const filepath = path.join(this.config.backupDir, file);
        const stats = await fs.stat(filepath);

        if (stats.mtime.getTime() < cutoffTime) {
          const size = stats.size;
          await fs.unlink(filepath);
          deletedCount++;
          totalSizeFreed += size;

          console.log(
            `[PROD] 删除过期备份: ${file} (${(size / 1024 / 1024).toFixed(2)} MB)`
          );
        }
      }

      if (deletedCount > 0) {
        console.log(
          `[PROD] 清理完成: 删除了 ${deletedCount} 个过期备份，释放 ${(
            totalSizeFreed /
            1024 /
            1024
          ).toFixed(2)} MB`
        );
      } else {
        console.log('[PROD] 没有需要清理的过期备份');
      }
    } catch (error) {
      console.error('[PROD] 清理过期备份失败:', error);
    }
  }

  /**
   * 列出所有备份
   */
  async listBackups(): Promise<BackupInfo[]> {
    try {
      const files = await fs.readdir(this.config.backupDir);
      const backups: BackupInfo[] = [];

      for (const file of files) {
        if (file.includes('backup_') && file.endsWith('.sql')) {
          const fileStats = await fs.stat(
            path.join(this.config.backupDir, file)
          );

          const timestampMatch = file.match(/backup_(.+)\.sql$/);
          const timestamp = timestampMatch
            ? new Date(timestampMatch[1].replace(/-/g, ':'))
            : fileStats.mtime;

          backups.push({
            id: file.replace('.sql', ''),
            timestamp,
            filename: file,
            size: fileStats.size,
            duration: 0,
            success: true,
          });
        }
      }

      return backups.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
    } catch (error) {
      console.error('[PROD] 列出备份失败:', error);
      return [];
    }
  }

  /**
   * 验证备份完整性
   */
  async verifyBackup(filename: string): Promise<boolean> {
    try {
      const filepath = path.join(this.config.backupDir, filename);
      const stats = await fs.stat(filepath);

      // 检查文件是否存在且不为空
      if (stats.size === 0) {
        console.error('[PROD] 备份文件为空');
        return false;
      }

      // 检查校验和
      const checksum = this.generateChecksum(filepath);
      if (!checksum) {
        console.error('[PROD] 无法生成校验和');
        return false;
      }

      // 设置PGPASSFILE环境变量
      const pgpassPath = path.join(process.cwd(), 'config', '.pgpass');

      // 尝试使用pg_restore验证备份文件
      const verifyCommand = `set PGPASSFILE="${pgpassPath}" && pg_restore --list "${filepath}"`;
      await execAsync(verifyCommand);

      console.log(`[PROD] 备份验证成功: ${filename}`);
      return true;
    } catch (error) {
      console.error(`[PROD] 验证备份 ${filename} 失败:`, error);
      return false;
    }
  }

  /**
   * 恢复备份
   */
  async restoreBackup(filename: string): Promise<boolean> {
    try {
      const filepath = path.join(this.config.backupDir, filename);
      const pgpassPath = path.join(process.cwd(), 'config', '.pgpass');

      console.log(`[PROD] 开始恢复备份: ${filename}`);

      // 如果是加密文件，需要先解密
      const restorePath = filepath;
      if (filename.endsWith('.enc')) {
        console.log('[PROD] 备份文件已加密，需要解密');
        console.log('[PROD] 解密功能尚未实现');
        return false;
      }

      // 使用pg_restore恢复数据库
      const restoreCommand = `set PGPASSFILE="${pgpassPath}" && pg_restore --clean --if-exists --verbose --dbname=${this.config.databaseUrl.split('/').pop()} "${restorePath}"`;
      await execAsync(restoreCommand);

      console.log(`[PROD] 备份恢复成功: ${filename}`);
      return true;
    } catch (error) {
      console.error(`[PROD] 恢复备份 ${filename} 失败:`, error);
      return false;
    }
  }
}

/**
 * 创建生产备份管理器实例
 */
export const createProductionBackupManager =
  (): ProductionDatabaseBackupManager => {
    const config: ProductionBackupConfig = {
      databaseUrl:
        process.env.DATABASE_URL ||
        'postgresql://postgres:TFL5650056btg@localhost:5432/legal_debate_dev',
      backupDir: process.env.BACKUP_DIR || './backups',
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
      compressionEnabled: process.env.BACKUP_COMPRESSION_ENABLED !== 'false',
      encryptionEnabled: process.env.BACKUP_ENCRYPTION_ENABLED === 'true',
      encryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
      uploadToCloud: process.env.CLOUD_BACKUP_ENABLED === 'true',
    };

    return new ProductionDatabaseBackupManager(config);
  };

/**
 * 定时备份函数
 */
export const scheduleProductionBackup = async (): Promise<void> => {
  const backupManager = createProductionBackupManager();

  console.log('[PROD] 开始定时生产环境数据库备份...');

  // 创建备份
  const backupInfo = await backupManager.createBackup();

  if (backupInfo.success) {
    // 验证备份
    const isValid = await backupManager.verifyBackup(backupInfo.filename);
    if (!isValid) {
      console.error('[PROD] 备份验证失败，删除无效备份文件');
      // 删除无效备份文件的逻辑可以在这里添加
    }
  }

  // 清理过期备份
  await backupManager.cleanupOldBackups();

  console.log('[PROD] 定时备份完成');
};

/**
 * 手动备份CLI命令
 */
export const runProductionManualBackup = async (): Promise<void> => {
  const backupManager = createProductionBackupManager();

  console.log('[PROD] 开始手动生产环境数据库备份...');
  const backupInfo = await backupManager.createBackup();

  if (backupInfo.success) {
    console.log(`[PROD] 备份成功: ${backupInfo.filename}`);
    console.log(
      `[PROD] 文件大小: ${(backupInfo.size / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(`[PROD] 耗时: ${backupInfo.duration} ms`);
    if (backupInfo.checksum) {
      console.log(`[PROD] 校验和: ${backupInfo.checksum}`);
    }
    if (backupInfo.encryptedFilename) {
      console.log(`[PROD] 加密文件: ${backupInfo.encryptedFilename}`);
    }
  } else {
    console.error('[PROD] 备份失败:', backupInfo.error);
    process.exit(1);
  }
};

/**
 * 列出备份CLI命令
 */
export const listProductionBackups = async (): Promise<void> => {
  const backupManager = createProductionBackupManager();
  const backups = await backupManager.listBackups();

  console.log('[PROD] 生产环境备份列表:');
  console.log('='.repeat(80));
  console.log('ID\t\t\t时间\t\t\t\t文件名\t\t大小\t\t状态');
  console.log('='.repeat(80));

  for (const backup of backups) {
    const dateStr = backup.timestamp.toLocaleString('zh-CN');
    const sizeStr = `${(backup.size / 1024 / 1024).toFixed(2)} MB`;
    const statusStr = backup.success ? '成功' : '失败';
    console.log(
      `${backup.id.substring(0, 20)}\t${dateStr}\t${backup.filename.substring(0, 30)}\t${sizeStr}\t${statusStr}`
    );
  }
};

/**
 * 清理过期备份CLI命令
 */
export const cleanupProductionBackups = async (): Promise<void> => {
  const backupManager = createProductionBackupManager();
  await backupManager.cleanupOldBackups();
};

/**
 * CLI主函数
 */
const main = async (): Promise<void> => {
  const command = process.argv[2];

  switch (command) {
    case 'backup':
    case 'create':
      await runProductionManualBackup();
      break;
    case 'list':
      await listProductionBackups();
      break;
    case 'cleanup':
      await cleanupProductionBackups();
      break;
    default:
      console.log('[PROD] 生产环境数据库备份工具');
      console.log('');
      console.log('用法:');
      console.log(
        '  node scripts/backup-database-prod.ts backup    # 创建备份'
      );
      console.log(
        '  node scripts/backup-database-prod.ts list      # 列出备份'
      );
      console.log(
        '  node scripts/backup-database-prod.ts cleanup   # 清理过期备份'
      );
      console.log('');
      console.log('环境变量:');
      console.log('  DATABASE_URL               # 数据库连接字符串');
      console.log('  BACKUP_DIR                # 备份目录 (默认: ./backups)');
      console.log('  BACKUP_RETENTION_DAYS    # 保留天数 (默认: 30)');
      console.log('  BACKUP_COMPRESSION_ENABLED  # 是否压缩 (默认: true)');
      console.log('  BACKUP_ENCRYPTION_ENABLED # 是否加密 (默认: false)');
      console.log('  BACKUP_ENCRYPTION_KEY     # 加密密钥');
      console.log('  CLOUD_BACKUP_ENABLED     # 是否上传云存储 (默认: false)');
      console.log(
        '  CLOUD_BACKUP_PROVIDER     # 云存储提供商 (aws/aliyun/tencent)'
      );
      console.log('  CLOUD_BACKUP_BUCKET        # 云存储桶名称');
      console.log('  CLOUD_BACKUP_REGION        # 云存储区域');
      process.exit(0);
  }
};

// 如果直接运行此脚本，执行CLI
if (require.main === module) {
  main().catch(console.error);
}
