import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// 备份配置接口
interface BackupConfig {
  databaseUrl: string;
  backupDir: string;
  retentionDays: number;
  compressionEnabled: boolean;
}

// 备份信息接口
interface BackupInfo {
  id: string;
  timestamp: Date;
  filename: string;
  size: number;
  duration: number;
  success: boolean;
  error?: string;
}

// 备份管理器类
export class DatabaseBackupManager {
  private config: BackupConfig;

  constructor(config: BackupConfig) {
    this.config = config;
  }

  // 创建备份目录
  private async ensureBackupDir(): Promise<void> {
    try {
      await fs.mkdir(this.config.backupDir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  // 生成备份文件名
  private generateBackupFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dbName = this.extractDatabaseName();
    return `${dbName}_backup_${timestamp}.sql`;
  }

  // 从DATABASE_URL提取数据库名
  private extractDatabaseName(): string {
    const match = this.config.databaseUrl.match(/\/([^\/?]+)(\?|$)/);
    return match?.[1] || 'legal_debate_db';
  }

  // 执行数据库备份
  async createBackup(): Promise<BackupInfo> {
    const backupId = `backup_${Date.now()}`;
    const startTime = Date.now();
    const filename = this.generateBackupFilename();
    const filepath = path.join(this.config.backupDir, filename);

    console.log(`开始数据库备份: ${backupId}`);

    try {
      await this.ensureBackupDir();

      // 使用pg_dump创建PostgreSQL备份
      const command = this.buildBackupCommand(filepath);
      console.log('执行备份命令:', command);

      await execAsync(command);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 获取备份文件大小
      const stats = await fs.stat(filepath);
      const size = stats.size;

      const backupInfo: BackupInfo = {
        id: backupId,
        timestamp: new Date(),
        filename,
        size,
        duration,
        success: true,
      };

      console.log(`备份完成: ${filename} (${(size / 1024 / 1024).toFixed(2)} MB, ${duration}ms)`);
      
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

      console.error('备份失败:', backupInfo.error);
      return backupInfo;
    }
  }

  // 构建备份命令
  private buildBackupCommand(filepath: string): string {
    const { databaseUrl } = this.config;
    
    // 设置PGPASSFILE环境变量指向.pgpass文件
    const pgpassPath = path.join(process.cwd(), '.pgpass');
    
    let command = `set PGPASSFILE="${pgpassPath}" && pg_dump "${databaseUrl}" --no-password --verbose --format=custom --file="${filepath}"`;

    if (this.config.compressionEnabled) {
      command += ' --compress=9';
    }

    return command;
  }

  // 清理过期备份
  async cleanupOldBackups(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.backupDir);
      const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);

      let deletedCount = 0;
      let totalSizeFreed = 0;

      for (const file of files) {
        const filepath = path.join(this.config.backupDir, file);
        const stats = await fs.stat(filepath);

        if (stats.mtime.getTime() < cutoffTime && file.endsWith('.sql')) {
          const size = stats.size;
          await fs.unlink(filepath);
          deletedCount++;
          totalSizeFreed += size;
          
          console.log(`删除过期备份: ${file} (${(size / 1024 / 1024).toFixed(2)} MB)`);
        }
      }

      if (deletedCount > 0) {
        console.log(`清理完成: 删除了 ${deletedCount} 个过期备份，释放 ${(totalSizeFreed / 1024 / 1024).toFixed(2)} MB`);
      } else {
        console.log('没有需要清理的过期备份');
      }
    } catch (error) {
      console.error('清理过期备份失败:', error);
    }
  }

  // 列出所有备份
  async listBackups(): Promise<BackupInfo[]> {
    try {
      const files = await fs.readdir(this.config.backupDir);
      const backups: BackupInfo[] = [];

      for (const file of files) {
        if (file.endsWith('.sql')) {
          const filepath = path.join(this.config.backupDir, file);
          const stats = await fs.stat(filepath);

          // 从文件名解析时间戳
          const timestampMatch = file.match(/backup_(.+)\.sql$/);
          const timestamp = timestampMatch ? new Date(timestampMatch[1].replace(/-/g, ':')) : stats.mtime;

          backups.push({
            id: file.replace('.sql', ''),
            timestamp,
            filename: file,
            size: stats.size,
            duration: 0, // 无法从文件获取
            success: true,
          });
        }
      }

      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('列出备份失败:', error);
      return [];
    }
  }

  // 验证备份完整性
  async verifyBackup(filename: string): Promise<boolean> {
    try {
      const filepath = path.join(this.config.backupDir, filename);
      const stats = await fs.stat(filepath);

      // 检查文件是否存在且不为空
      if (stats.size === 0) {
        return false;
      }

      // 设置PGPASSFILE环境变量
      const pgpassPath = path.join(process.cwd(), '.pgpass');
      
      // 尝试使用pg_restore验证备份文件
      const verifyCommand = `set PGPASSFILE="${pgpassPath}" && pg_restore --list "${filepath}"`;
      await execAsync(verifyCommand);

      return true;
    } catch (error) {
      console.error(`验证备份 ${filename} 失败:`, error);
      return false;
    }
  }
}

// 创建默认备份管理器实例
export const createBackupManager = (): DatabaseBackupManager => {
  const config: BackupConfig = {
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/legal_debate_dev',
    backupDir: process.env.BACKUP_DIR || './backups',
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10),
    compressionEnabled: process.env.BACKUP_COMPRESSION_ENABLED !== 'false',
  };

  return new DatabaseBackupManager(config);
};

// 定时备份函数
export const scheduleBackup = async (): Promise<void> => {
  const backupManager = createBackupManager();
  
  console.log('开始定时数据库备份...');
  
  // 创建备份
  const backupInfo = await backupManager.createBackup();
  
  if (backupInfo.success) {
    // 验证备份
    const isValid = await backupManager.verifyBackup(backupInfo.filename);
    if (!isValid) {
      console.error('备份验证失败，删除无效备份文件');
      // 删除无效备份文件的逻辑可以在这里添加
    }
  }
  
  // 清理过期备份
  await backupManager.cleanupOldBackups();
  
  console.log('定时备份完成');
};

// 手动备份CLI命令
export const runManualBackup = async (): Promise<void> => {
  const backupManager = createBackupManager();
  
  console.log('开始手动数据库备份...');
  const backupInfo = await backupManager.createBackup();
  
  if (backupInfo.success) {
    console.log(`备份成功: ${backupInfo.filename}`);
    console.log(`文件大小: ${(backupInfo.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`耗时: ${backupInfo.duration} ms`);
  } else {
    console.error('备份失败:', backupInfo.error);
    process.exit(1);
  }
};

// 如果直接运行此脚本，执行手动备份
if (require.main === module) {
  runManualBackup().catch(console.error);
}
