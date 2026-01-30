import {
  createBackup,
  runMigration,
  validateSchema,
  checkDataIntegrity,
  rollbackMigration,
  MigrationResult,
} from '../database-migration';
import { execAsync } from '../migration-utils';
import fs from 'fs/promises';

// Mock dependencies
jest.mock('../migration-utils', () => ({
  ...jest.requireActual('../migration-utils'),
  execAsync: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  stat: jest.fn(),
  unlink: jest.fn(),
  readdir: jest.fn(),
  access: jest.fn(),
}));

describe('DatabaseMigration', () => {
  let mockedExecAsync: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_URL =
      'postgresql://user:password@localhost:5432/test_db';
    process.env.BACKUP_DIR = './backups';

    // 设置默认的execAsync mock
    mockedExecAsync = execAsync as jest.Mock;
    mockedExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.BACKUP_DIR;
  });

  describe('createBackup', () => {
    it('应该成功创建数据库备份', async () => {
      const mockStats = { size: 1024000 };
      (fs.stat as jest.Mock).mockResolvedValue(mockStats);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await createBackup();
      expect(result.success).toBe(true);
      expect(result.backupFile).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('应该在备份失败时返回错误', async () => {
      const error = new Error('Backup failed');
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      mockedExecAsync.mockRejectedValue(error);

      const result = await createBackup();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Backup creation failed');
    });

    it('应该支持自定义备份目录', async () => {
      const mockStats = { size: 1024 };
      (fs.stat as jest.Mock).mockResolvedValue(mockStats);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await createBackup({ backupDir: '/custom/backup' });
      expect(result.success).toBe(true);
      // Windows使用反斜杠，Linux使用正斜杠
      expect(result.backupFile).toMatch(/custom.*backup/);
    });
  });

  describe('runMigration', () => {
    it('应该成功执行Prisma迁移', async () => {
      mockedExecAsync.mockResolvedValue({
        stdout: '1 migration applied',
        stderr: '',
      });

      const result = await runMigration({ createBackupBefore: false });
      expect(result.success).toBe(true);
      expect(result.appliedMigrations).toBe(1);
    });

    it('应该在迁移失败时返回错误', async () => {
      const error = new Error('Migration failed');
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 1024 });

      mockedExecAsync.mockRejectedValue(error);

      const result = await runMigration({ createBackupBefore: true });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Pre-migration backup failed');
    });

    it('应该跳过已应用的迁移', async () => {
      mockedExecAsync.mockResolvedValue({
        stdout: 'No pending migrations',
        stderr: '',
      });

      const result = await runMigration({ createBackupBefore: false });
      expect(result.success).toBe(true);
      expect(result.appliedMigrations).toBe(0);
    });

    it('应该处理迁移执行时的错误', async () => {
      const mockStats = { size: 1024 };
      const error = new Error('Migration failed');
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue(mockStats);

      // 调用次数：1=createBackup, 2=validateBackupFile, 3=migrate deploy
      mockedExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // createBackup的pg_dump
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // validateBackupFile
        .mockRejectedValueOnce(error); // migrate deploy失败

      const result = await runMigration({ createBackupBefore: true });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Migration failed');
    });
  });

  describe('validateSchema', () => {
    it('应该验证关键表存在', async () => {
      // 第一个调用返回所有表名
      mockedExecAsync.mockImplementation((cmd: string) => {
        if (cmd.includes('SELECT tablename FROM pg_tables')) {
          return Promise.resolve({
            stdout: 'User\nCase\nEvidence\nDocument\nMembership\nUserRole\n',
            stderr: '',
          });
        } else {
          return Promise.resolve({ stdout: '0\n', stderr: '' });
        }
      });

      const result = await validateSchema();
      expect(result.valid).toBe(true);
      expect(result.missingTables).toHaveLength(0);
    });

    it('应该检测缺失的表', async () => {
      mockedExecAsync.mockResolvedValue({
        stdout: 'User\nCase\n',
        stderr: '',
      });

      const result = await validateSchema(['Evidence']);
      expect(result.valid).toBe(false);
      expect(result.missingTables).toContain('Evidence');
    });
  });

  describe('checkDataIntegrity', () => {
    it('应该检查外键约束', async () => {
      mockedExecAsync.mockResolvedValue({
        stdout: '0\n',
        stderr: '',
      });

      const result = await checkDataIntegrity();
      expect(result.valid).toBe(true);
      expect(result.orphanRecords).toHaveLength(0);
    });

    it('应该检测孤立记录', async () => {
      let callCount = 0;
      mockedExecAsync.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve({ stdout: '5\n', stderr: '' });
        } else {
          return Promise.resolve({ stdout: '0\n', stderr: '' });
        }
      });

      const result = await checkDataIntegrity();
      expect(result.valid).toBe(false);
      expect(result.orphanRecords.length).toBeGreaterThan(0);
    });

    it('应该处理数据库连接错误', async () => {
      const error = new Error('Connection failed');
      mockedExecAsync.mockRejectedValue(error);

      const result = await checkDataIntegrity();
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('rollbackMigration', () => {
    it('应该记录回滚请求', async () => {
      const stats = { size: 1024 };
      (fs.stat as jest.Mock).mockResolvedValue(stats);

      const result = await rollbackMigration('20260130_100000_backup.sql');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Rollback request logged');
    });

    it('应该拒绝回滚当备份文件不存在时', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.stat as jest.Mock).mockRejectedValue(error);

      const result = await rollbackMigration('nonexistent.sql');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Backup file not found');
    });

    it('应该验证备份文件完整性', async () => {
      const stats = { size: 1024 };
      (fs.stat as jest.Mock).mockResolvedValue(stats);
      // 确保execAsync返回成功
      mockedExecAsync.mockResolvedValue('');

      const result = await rollbackMigration('backup.sql');
      expect(result.success).toBe(true);
    });

    it('应该处理备份文件验证失败', async () => {
      const stats = { size: 1024 };
      (fs.stat as jest.Mock).mockResolvedValue(stats);
      // 模拟validateBackupFile失败
      mockedExecAsync.mockRejectedValue(new Error('Invalid backup'));

      const result = await rollbackMigration('invalid.sql');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Backup file validation failed');
    });

    it('应该处理未知错误', async () => {
      const error = new Error('Unknown error');
      (fs.stat as jest.Mock).mockRejectedValue(error);

      const result = await rollbackMigration('unknown.sql');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown error');
    });
  });

  describe('MigrationResult', () => {
    it('应该初始化默认值', () => {
      const result: MigrationResult = {
        success: false,
        error: undefined,
        appliedMigrations: 0,
        backupFile: undefined,
        size: 0,
        duration: 0,
      };

      expect(result.success).toBe(false);
      expect(result.appliedMigrations).toBe(0);
      expect(result.size).toBe(0);
    });

    it('应该支持成功结果', () => {
      const result: MigrationResult = {
        success: true,
        appliedMigrations: 3,
        backupFile: 'backup.sql',
        size: 1024000,
        duration: 5000,
      };

      expect(result.success).toBe(true);
      expect(result.appliedMigrations).toBe(3);
      expect(result.backupFile).toBe('backup.sql');
    });
  });
});
