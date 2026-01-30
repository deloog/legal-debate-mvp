import { exec } from 'child_process';
import fs from 'fs/promises';
import { promisify } from 'util';

/**
 * 迁移配置接口
 */
export interface BackupConfig {
  databaseUrl: string;
  backupDir: string;
  retentionDays: number;
}

/**
 * 备份信息接口
 */
export interface BackupInfo {
  id: string;
  timestamp: Date;
  filename: string;
  size: number;
  duration: number;
  success: boolean;
  error?: string;
}

/**
 * 表验证结果接口
 */
export interface TableValidation {
  tableName: string;
  exists: boolean;
  recordCount: number;
}

/**
 * 孤立记录接口
 */
export interface OrphanRecord {
  tableName: string;
  foreignKeyColumn: string;
  count: number;
}

/**
 * 迁移自定义错误类
 */
export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

// 导出execAsync以便测试覆盖
export const execAsync = promisify(exec);

/**
 * 从DATABASE_URL提取数据库名
 */
export function extractDatabaseName(databaseUrl: string): string {
  const match = databaseUrl.match(/\/([^\/?]+)(\?|$)/);
  return match?.[1] || 'legal_debate_db';
}

/**
 * 生成备份文件名
 */
export function generateBackupFilename(timestamp: Date): string {
  const dbName = extractDatabaseName(
    process.env.DATABASE_URL || 'postgresql://localhost:5432/legal_debate_db'
  );
  const formattedTimestamp = timestamp.toISOString().replace(/[:.]/g, '-');
  return `${dbName}_backup_${formattedTimestamp}.sql`;
}

/**
 * 带重试的命令执行
 */
export async function executeWithRetry<T>(
  command: string,
  maxRetries: number
): Promise<T> {
  const originalSetTimeout = global.setTimeout;
  const delays: number[] = [];

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await new Promise<T>((resolve, reject) => {
        exec(command, (error, stdout) => {
          if (error) {
            reject(error);
          } else {
            resolve(stdout as unknown as T);
          }
        });
      });
      return result;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }

      // 指数退避
      const delay = Math.pow(2, attempt) * 1000;
      delays.push(delay);

      await new Promise<void>(resolve => {
        const timerId = originalSetTimeout(() => {
          resolve();
        }, delay) as NodeJS.Timeout;
        return timerId;
      });
    }
  }

  throw new MigrationError('Max retries exceeded', 'MAX_RETRIES_EXCEEDED');
}

/**
 * 确保目录存在
 */
export async function ensureDirectory(dir: string): Promise<void> {
  try {
    await fs.access(dir);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      await fs.mkdir(dir, { recursive: true });
    } else if (err.code === 'EACCES') {
      throw new MigrationError('Permission denied', 'PERMISSION_DENIED', {
        dir,
      });
    } else {
      throw new MigrationError(
        'Failed to access directory',
        'DIRECTORY_ACCESS_ERROR',
        {
          dir,
          error: err.message,
        }
      );
    }
  }
}

/**
 * 获取文件大小
 */
export async function getFileSize(filepath: string): Promise<number> {
  try {
    const stats = await fs.stat(filepath);
    return stats.size;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new MigrationError('File not found', 'FILE_NOT_FOUND', {
        filepath,
      });
    } else if (err.code === 'EACCES') {
      throw new MigrationError('Permission denied', 'PERMISSION_DENIED', {
        filepath,
      });
    } else {
      throw new MigrationError('Failed to get file size', 'FILE_ACCESS_ERROR', {
        filepath,
        error: err.message,
      });
    }
  }
}

/**
 * 验证备份文件
 */
export async function validateBackupFile(
  filepath: string,
  customExec?: typeof execAsync
): Promise<boolean> {
  try {
    const stats = await fs.stat(filepath);

    // 检查文件是否为空
    if (stats.size === 0) {
      return false;
    }

    // 使用pg_restore验证备份文件
    try {
      const execFn = customExec ?? execAsync;
      await execFn(`pg_restore --list "${filepath}"`);
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * 生成唯一的备份ID
 */
export function generateBackupId(): string {
  return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${value} ${sizes[i]}`;
}

/**
 * 记录迁移日志
 */
export function logMigration(
  message: string,
  level: 'info' | 'warn' | 'error' = 'info'
): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [MIGRATION] [${level.toUpperCase()}]`;
  const logMessage = `${prefix} ${message}`;

  switch (level) {
    case 'info':
      console.log(logMessage);
      break;
    case 'warn':
      console.warn(logMessage);
      break;
    case 'error':
      console.error(logMessage);
      break;
  }
}
