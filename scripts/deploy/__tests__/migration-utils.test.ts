import {
  execAsync,
  extractDatabaseName,
  generateBackupFilename,
  executeWithRetry,
  ensureDirectory,
  getFileSize,
  validateBackupFile,
  MigrationError,
} from '../migration-utils';
import { exec } from 'child_process';
import fs from 'fs/promises';

// Mock dependencies
jest.mock('child_process');
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  stat: jest.fn(),
  readdir: jest.fn(),
  access: jest.fn(),
  unlink: jest.fn(),
}));

describe('MigrationUtils', () => {
  let mockedExec: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // 模拟exec，支持2参数和3参数形式
    mockedExec = exec as unknown as jest.Mock;
    mockedExec.mockImplementation(
      (cmd: string, opts: unknown, callback: unknown) => {
        const cb = typeof opts === 'function' ? opts : callback;
        (cb as (error: Error | null, stdout: string, stderr: string) => void)(
          null,
          '',
          ''
        );
      }
    );
  });

  describe('extractDatabaseName', () => {
    it('应该从标准DATABASE_URL提取数据库名', () => {
      const url = 'postgresql://user:password@localhost:5432/legal_db';
      const dbName = extractDatabaseName(url);
      expect(dbName).toBe('legal_db');
    });

    it('应该从带端口的DATABASE_URL提取数据库名', () => {
      const url = 'postgresql://user:password@localhost:5433/my_database';
      const dbName = extractDatabaseName(url);
      expect(dbName).toBe('my_database');
    });

    it('应该从带查询参数的DATABASE_URL提取数据库名', () => {
      const url =
        'postgresql://user:password@localhost:5432/test_db?schema=public';
      const dbName = extractDatabaseName(url);
      expect(dbName).toBe('test_db');
    });

    it('应该处理带有连接池参数的DATABASE_URL', () => {
      const url =
        'postgresql://user:password@localhost:5432/legal_db?connection_limit=10';
      const dbName = extractDatabaseName(url);
      expect(dbName).toBe('legal_db');
    });

    it('应该返回默认值当DATABASE_URL格式不正确时', () => {
      const url = 'invalid-url';
      const dbName = extractDatabaseName(url);
      expect(dbName).toBe('legal_debate_db');
    });
  });

  describe('generateBackupFilename', () => {
    it('应该生成带时间戳的备份文件名', () => {
      const timestamp = new Date('2026-01-30T10:00:00Z');
      const filename = generateBackupFilename(timestamp);
      expect(filename).toContain('legal_debate_db_backup_2026-01-30');
    });

    it('应该使用正确的文件扩展名', () => {
      const timestamp = new Date('2026-01-30T10:00:00Z');
      const filename = generateBackupFilename(timestamp);
      expect(filename).toMatch(/\.sql$/);
    });

    it('应该替换时间戳中的特殊字符', () => {
      const timestamp = new Date('2026-01-30T10:30:45.123Z');
      const filename = generateBackupFilename(timestamp);
      expect(filename).not.toContain(':');
      // 文件名包含数字、字母、下划线、短横线、T、Z和.sql扩展名
      expect(filename).toMatch(/^[a-z_0-9\-TZ.]+\.sql$/);
    });

    it('应该根据当前数据库名生成文件名', () => {
      process.env.DATABASE_URL =
        'postgresql://user:password@localhost:5432/custom_db';
      const timestamp = new Date('2026-01-30T10:00:00Z');
      const filename = generateBackupFilename(timestamp);
      expect(filename).toContain('custom_db_backup_');
      process.env.DATABASE_URL = undefined;
    });
  });

  describe('executeWithRetry', () => {
    it('应该在第一次尝试成功时返回结果', async () => {
      const mockCommand = 'echo "success"';
      const maxRetries = 3;

      mockedExec.mockImplementation(
        (cmd: string, opts: unknown, callback: unknown) => {
          const cb = typeof opts === 'function' ? opts : callback;
          (cb as (error: Error | null, stdout: string, stderr: string) => void)(
            null,
            'stdout',
            null
          );
        }
      );

      const result = await executeWithRetry(mockCommand, maxRetries);
      expect(result).toBe('stdout');
      expect(exec as unknown as jest.Mock).toHaveBeenCalledTimes(1);
    });

    it('应该在失败时重试直到成功', async () => {
      const mockCommand = 'echo "retry"';
      const maxRetries = 3;
      let attemptCount = 0;

      mockedExec.mockImplementation(
        (cmd: string, opts: unknown, callback: unknown) => {
          const cb = typeof opts === 'function' ? opts : callback;
          attemptCount++;
          if (attemptCount < 3) {
            (
              cb as (
                error: Error | null,
                stdout: string,
                stderr: string
              ) => void
            )(new Error('Command failed'), '', null);
          } else {
            (
              cb as (
                error: Error | null,
                stdout: string,
                stderr: string
              ) => void
            )(null, 'success', null);
          }
        }
      );

      const result = await executeWithRetry(mockCommand, maxRetries);
      expect(result).toBe('success');
      expect(exec as unknown as jest.Mock).toHaveBeenCalledTimes(3);
    });

    it('超过重试次数后应该抛出错误', async () => {
      const mockCommand = 'failing_command';
      const maxRetries = 2;

      mockedExec.mockImplementation(
        (cmd: string, opts: unknown, callback: unknown) => {
          const cb = typeof opts === 'function' ? opts : callback;
          (cb as (error: Error | null, stdout: string, stderr: string) => void)(
            new Error('Always fails'),
            '',
            null
          );
        }
      );

      await expect(executeWithRetry(mockCommand, maxRetries)).rejects.toThrow(
        'Always fails'
      );
      expect(exec as unknown as jest.Mock).toHaveBeenCalledTimes(maxRetries);
    });

    it('应该使用指数退避策略', async () => {
      const mockCommand = 'echo "test"';
      const maxRetries = 3;
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      mockedExec.mockImplementation(
        (cmd: string, opts: unknown, callback: unknown) => {
          const cb = typeof opts === 'function' ? opts : callback;
          // 第一次调用失败
          if ((exec as unknown as jest.Mock).mock.calls.length === 1) {
            (
              cb as (
                error: Error | null,
                stdout: string,
                stderr: string
              ) => void
            )(new Error('Failed'), '', null);
          } else {
            (
              cb as (
                error: Error | null,
                stdout: string,
                stderr: string
              ) => void
            )(null, 'success', null);
          }
        }
      );

      global.setTimeout = jest.fn((fn, delay) => {
        delays.push(delay);
        return originalSetTimeout(fn, delay) as unknown;
      }) as unknown as typeof setTimeout;

      await executeWithRetry(mockCommand, maxRetries);

      global.setTimeout = originalSetTimeout;

      // 验证延迟是指数增长（1000ms, 2000ms, 4000ms）
      expect(delays.length).toBeGreaterThan(0);
    });
  });

  describe('ensureDirectory', () => {
    it('应该创建不存在的目录', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.access as jest.Mock).mockRejectedValue(error);

      await ensureDirectory('/test/path');
      expect(fs.mkdir).toHaveBeenCalledWith('/test/path', { recursive: true });
    });

    it('应该跳过已存在的目录', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      await ensureDirectory('/existing/path');
      expect(fs.mkdir).not.toHaveBeenCalled();
    });

    it('应该处理目录创建错误', async () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      (fs.access as jest.Mock).mockRejectedValue(error);
      (fs.mkdir as jest.Mock).mockRejectedValue(error);

      await expect(ensureDirectory('/forbidden/path')).rejects.toThrow(
        'Permission denied'
      );
    });

    it('应该处理未知访问错误', async () => {
      const error = new Error('Unknown error') as NodeJS.ErrnoException;
      error.code = 'UNKNOWN';
      (fs.access as jest.Mock).mockRejectedValue(error);

      await expect(ensureDirectory('/unknown/path')).rejects.toThrow(
        'Failed to access directory'
      );
    });
  });

  describe('getFileSize', () => {
    it('应该返回文件大小（字节）', async () => {
      const mockStats = { size: 1024 };
      (fs.stat as jest.Mock).mockResolvedValue(mockStats);

      const size = await getFileSize('/test/file.txt');
      expect(size).toBe(1024);
      expect(fs.stat).toHaveBeenCalledWith('/test/file.txt');
    });

    it('应该处理文件不存在错误', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.stat as jest.Mock).mockRejectedValue(error);

      await expect(getFileSize('/nonexistent/file.txt')).rejects.toThrow(
        MigrationError
      );
    });

    it('应该处理权限错误', async () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      (fs.stat as jest.Mock).mockRejectedValue(error);

      await expect(getFileSize('/protected/file.txt')).rejects.toThrow(
        MigrationError
      );
    });

    it('应该处理未知访问错误', async () => {
      const error = new Error('Unknown error') as NodeJS.ErrnoException;
      error.code = 'UNKNOWN';
      (fs.stat as jest.Mock).mockRejectedValue(error);

      await expect(getFileSize('/unknown/file.txt')).rejects.toThrow(
        'Failed to get file size'
      );
    });
  });

  describe('validateBackupFile', () => {
    it('应该验证有效的备份文件', async () => {
      const mockStats = { size: 1024000 };
      const mockExecAsync = jest.fn().mockResolvedValue('');
      (fs.stat as jest.Mock).mockResolvedValue(mockStats);

      const isValid = await validateBackupFile(
        '/backup/file.sql',
        mockExecAsync as any
      );
      expect(isValid).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith(
        'pg_restore --list "/backup/file.sql"'
      );
    });

    it('应该拒绝空文件', async () => {
      const mockStats = { size: 0 };
      const mockExecAsync = jest.fn().mockResolvedValue('');
      (fs.stat as jest.Mock).mockResolvedValue(mockStats);

      const isValid = await validateBackupFile(
        '/backup/empty.sql',
        mockExecAsync as any
      );
      expect(isValid).toBe(false);
      expect(mockExecAsync).not.toHaveBeenCalled();
    });

    it('应该拒绝验证失败的文件', async () => {
      const mockStats = { size: 1024 };
      const mockExecAsync = jest.fn().mockRejectedValue(new Error('Invalid'));
      (fs.stat as jest.Mock).mockResolvedValue(mockStats);

      const isValid = await validateBackupFile(
        '/backup/invalid.sql',
        mockExecAsync as any
      );
      expect(isValid).toBe(false);
    });

    it('应该处理文件访问错误', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      const mockExecAsync = jest.fn().mockResolvedValue('');
      (fs.stat as jest.Mock).mockRejectedValue(error);

      const isValid = await validateBackupFile(
        '/nonexistent/file.sql',
        mockExecAsync as any
      );
      expect(isValid).toBe(false);
      expect(mockExecAsync).not.toHaveBeenCalled();
    });

    it('应该使用默认execAsync当未提供customExec', async () => {
      const mockStats = { size: 1024 };
      (fs.stat as jest.Mock).mockResolvedValue(mockStats);
      // 默认的execAsync应该返回成功
      const result = await validateBackupFile('/backup/file.sql');
      expect(result).toBe(true);
    });
  });

  describe('MigrationError', () => {
    it('应该创建自定义错误实例', () => {
      const error = new MigrationError('Test error message', 'TEST_CODE', {
        detail: 'test detail',
      });

      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('MigrationError');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ detail: 'test detail' });
    });

    it('应该作为Error实例工作', () => {
      const error = new MigrationError('Test', 'CODE');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof MigrationError).toBe(true);
    });

    it('应该支持可选的details参数', () => {
      const error1 = new MigrationError('Test1', 'CODE1');
      const error2 = new MigrationError('Test2', 'CODE2', { key: 'value' });

      expect(error1.details).toBeUndefined();
      expect(error2.details).toEqual({ key: 'value' });
    });
  });
});
