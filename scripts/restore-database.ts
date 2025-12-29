import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

// 恢复配置接口
interface RestoreConfig {
  databaseUrl: string;
  backupDir: string;
  targetDatabase?: string;
  createTargetDb?: boolean;
  dropExistingDb?: boolean;
}

// 恢复信息接口
interface RestoreInfo {
  id: string;
  timestamp: Date;
  backupFilename: string;
  targetDatabase: string;
  duration: number;
  success: boolean;
  error?: string;
  tablesRestored?: number;
}

// 恢复管理器类
export class DatabaseRestoreManager {
  private config: RestoreConfig;

  constructor(config: RestoreConfig) {
    this.config = config;
  }

  // 从DATABASE_URL提取数据库名
  private extractDatabaseName(): string {
    const match = this.config.databaseUrl.match(/\/([^\/?]+)(\?|$)/);
    return match?.[1] || "legal_debate_db";
  }

  // 从DATABASE_URL提取连接信息（不包含数据库名）
  private extractConnectionInfo(): string {
    return this.config.databaseUrl;
  }

  // 验证备份文件存在且可读
  private async validateBackupFile(filename: string): Promise<void> {
    const filepath = path.join(this.config.backupDir, filename);

    try {
      const stats = await fs.stat(filepath);

      if (stats.size === 0) {
        throw new Error(`备份文件为空: ${filename}`);
      }

      // 检查文件是否为有效的备份格式
      const listCommand = this.buildListCommand(filepath);
      await execAsync(listCommand);

      console.log(`✅ 备份文件验证通过: ${filename}`);
    } catch (error) {
      throw new Error(
        `备份文件验证失败 ${filename}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // 构建备份文件列表命令
  private buildListCommand(filepath: string): string {
    const pgpassPath = path.join(process.cwd(), "config", ".pgpass");
    return `set PGPASSFILE="${pgpassPath}" && pg_restore --list "${filepath}"`;
  }

  // 创建目标数据库
  private async createTargetDatabase(databaseName: string): Promise<void> {
    try {
      const connectionInfo = this.extractConnectionInfo();
      const pgpassPath = path.join(process.cwd(), "config", ".pgpass");

      // 连接到postgres数据库创建新数据库
      const createDbCommand = `set PGPASSFILE="${pgpassPath}" && psql "${connectionInfo}/postgres" -c "CREATE DATABASE ${databaseName};"`;

      console.log(`创建目标数据库: ${databaseName}`);
      await execAsync(createDbCommand);

      console.log(`✅ 数据库创建成功: ${databaseName}`);
    } catch (error) {
      throw new Error(
        `创建数据库失败 ${databaseName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // 删除现有数据库
  private async dropExistingDatabase(databaseName: string): Promise<void> {
    try {
      const connectionInfo = this.extractConnectionInfo();
      const pgpassPath = path.join(process.cwd(), "config", ".pgpass");

      // 终止现有连接并删除数据库
      const killConnectionsCommand = `set PGPASSFILE="${pgpassPath}" && psql "${connectionInfo}/postgres" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}';"`;
      const dropDbCommand = `set PGPASSFILE="${pgpassPath}" && psql "${connectionInfo}/postgres" -c "DROP DATABASE IF EXISTS ${databaseName};"`;

      console.log(`终止现有数据库连接: ${databaseName}`);
      await execAsync(killConnectionsCommand).catch(() => {
        // 忽略终止连接失败
        console.log(`⚠️ 无法终止连接，继续删除数据库`);
      });

      console.log(`删除现有数据库: ${databaseName}`);
      await execAsync(dropDbCommand);

      console.log(`✅ 数据库删除成功: ${databaseName}`);
    } catch (error) {
      throw new Error(
        `删除数据库失败 ${databaseName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // 执行数据库恢复
  async restoreDatabase(filename: string): Promise<RestoreInfo> {
    const restoreId = `restore_${Date.now()}`;
    const startTime = Date.now();
    const targetDatabase =
      this.config.targetDatabase || this.extractDatabaseName();

    console.log(`开始数据库恢复: ${restoreId}`);
    console.log(`备份文件: ${filename}`);
    console.log(`目标数据库: ${targetDatabase}`);

    try {
      // 验证备份文件
      await this.validateBackupFile(filename);

      const filepath = path.join(this.config.backupDir, filename);

      // 创建或处理目标数据库
      if (this.config.createTargetDb) {
        try {
          await this.createTargetDatabase(targetDatabase);
        } catch (error) {
          if (
            (error as Error).message.includes("already exists") &&
            this.config.dropExistingDb
          ) {
            console.log(`数据库已存在，删除后重新创建: ${targetDatabase}`);
            await this.dropExistingDatabase(targetDatabase);
            await this.createTargetDatabase(targetDatabase);
          } else {
            throw error;
          }
        }
      } else if (this.config.dropExistingDb) {
        await this.dropExistingDatabase(targetDatabase);
      }

      // 构建恢复命令
      const restoreCommand = this.buildRestoreCommand(filepath, targetDatabase);
      console.log("执行恢复命令:", restoreCommand);

      // 执行恢复
      const { stdout } = await execAsync(restoreCommand);

      // 解析恢复结果
      const tablesRestored = this.parseRestoreOutput(stdout);

      const endTime = Date.now();
      const duration = endTime - startTime;

      const restoreInfo: RestoreInfo = {
        id: restoreId,
        timestamp: new Date(),
        backupFilename: filename,
        targetDatabase,
        duration,
        success: true,
        tablesRestored,
      };

      console.log(
        `恢复完成: ${filename} -> ${targetDatabase} (${tablesRestored}个表, ${duration}ms)`,
      );

      return restoreInfo;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const restoreInfo: RestoreInfo = {
        id: restoreId,
        timestamp: new Date(),
        backupFilename: filename,
        targetDatabase,
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };

      console.error("恢复失败:", restoreInfo.error);
      return restoreInfo;
    }
  }

  // 构建恢复命令
  private buildRestoreCommand(
    filepath: string,
    targetDatabase: string,
  ): string {
    const pgpassPath = path.join(process.cwd(), "config", ".pgpass");
    const connectionInfo = this.extractConnectionInfo();

    return `set PGPASSFILE="${pgpassPath}" && pg_restore --verbose --clean --if-exists --no-owner --no-privileges --dbname="${connectionInfo}/${targetDatabase}" "${filepath}"`;
  }

  // 解析恢复输出以获取恢复的表数量
  private parseRestoreOutput(stdout: string): number {
    // 查找恢复过程中的表信息
    const tableMatches = stdout.match(/processing table/gi);
    return tableMatches ? tableMatches.length : 0;
  }

  // 验证恢复后的数据库
  async validateRestoredDatabase(databaseName: string): Promise<boolean> {
    try {
      const connectionInfo = this.extractConnectionInfo();
      const pgpassPath = path.join(process.cwd(), "config", ".pgpass");

      // 检查数据库是否存在
      const checkDbCommand = `set PGPASSFILE="${pgpassPath}" && psql "${connectionInfo}/${databaseName}" -c "SELECT 1;"`;
      await execAsync(checkDbCommand);

      // 获取表列表
      const listTablesCommand = `set PGPASSFILE="${pgpassPath}" && psql "${connectionInfo}/${databaseName}" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"`;
      const { stdout } = await execAsync(listTablesCommand);

      const tableCount = parseInt(stdout.trim().split("\n")[2]);
      console.log(`✅ 数据库验证成功: ${databaseName} (${tableCount}个表)`);

      return tableCount > 0;
    } catch (error) {
      console.error(`数据库验证失败 ${databaseName}:`, error);
      return false;
    }
  }

  // 列出所有可用的备份文件
  async listAvailableBackups(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.config.backupDir);
      const backupFiles = files.filter((file) => file.endsWith(".sql"));

      return backupFiles.sort((a, b) => {
        // 按时间戳排序，最新的在前
        const aMatch = a.match(/backup_(.+)\.sql$/);
        const bMatch = b.match(/backup_(.+)\.sql$/);

        if (aMatch && bMatch) {
          const aTime = new Date(aMatch[1].replace(/-/g, ":")).getTime();
          const bTime = new Date(bMatch[1].replace(/-/g, ":")).getTime();
          return bTime - aTime;
        }

        return b.localeCompare(a);
      });
    } catch (error) {
      console.error("列出备份文件失败:", error);
      return [];
    }
  }
}

// 创建默认恢复管理器实例
export const createRestoreManager = (): DatabaseRestoreManager => {
  const config: RestoreConfig = {
    databaseUrl:
      process.env.DATABASE_URL ||
      "postgresql://postgres:TFL5650056btg@localhost:5432/legal_debate_dev",
    backupDir: process.env.BACKUP_DIR || "./backups",
  };

  return new DatabaseRestoreManager(config);
};

// 交互式恢复命令
export const runInteractiveRestore = async (): Promise<void> => {
  const restoreManager = createRestoreManager();

  console.log("=== 数据库恢复工具 ===");

  // 列出可用备份
  const backups = await restoreManager.listAvailableBackups();

  if (backups.length === 0) {
    console.log("❌ 没有找到可用的备份文件");
    process.exit(1);
  }

  console.log("\n可用的备份文件:");
  backups.forEach((backup, index) => {
    console.log(`${index + 1}. ${backup}`);
  });

  // 这里应该有用户交互，但在脚本中我们使用最新的备份
  const latestBackup = backups[0];
  console.log(`\n使用最新备份: ${latestBackup}`);

  // 执行恢复
  const restoreInfo = await restoreManager.restoreDatabase(latestBackup);

  if (restoreInfo.success) {
    console.log("✅ 恢复成功!");
    console.log(`恢复详情:`);
    console.log(`  备份文件: ${restoreInfo.backupFilename}`);
    console.log(`  目标数据库: ${restoreInfo.targetDatabase}`);
    console.log(`  恢复表数: ${restoreInfo.tablesRestored}`);
    console.log(`  耗时: ${restoreInfo.duration}ms`);

    // 验证恢复结果
    const isValid = await restoreManager.validateRestoredDatabase(
      restoreInfo.targetDatabase,
    );
    if (isValid) {
      console.log("✅ 数据库验证通过");
    } else {
      console.log("❌ 数据库验证失败");
      process.exit(1);
    }
  } else {
    console.error("❌ 恢复失败:", restoreInfo.error);
    process.exit(1);
  }
};

// 如果直接运行此脚本，执行交互式恢复
if (require.main === module) {
  runInteractiveRestore().catch(console.error);
}
