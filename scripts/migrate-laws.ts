/**
 * 数据库迁移脚本 - 法律法规数据迁移
 *
 * 使用方法：
 * 1. 在源电脑（法律法规数据好的电脑）运行：node scripts/migrate-laws.js export
 * 2. 将生成的 legal_debate_laws.backup 文件拷贝到目标电脑
 * 3. 在目标电脑运行：node scripts/migrate-laws.js import
 *
 * 注意：需要先确保目标电脑的数据库已运行过 Prisma 迁移
 */

import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { resolve } from 'path';

const BACKUP_FILE = 'legal_debate_laws.backup';
const DB_NAME = process.env.DATABASE_NAME || 'legal_debate_dev';

function exportDatabase() {
  console.log('📤 开始导出法律法规数据...');

  try {
    // 使用 pg_dump 导出（自定义格式，更高效）
    const cmd = `pg_dump -U postgres -h localhost -F c -b -v -f ${BACKUP_FILE} ${DB_NAME}`;
    console.log(`执行命令: ${cmd}`);

    execSync(cmd, { stdio: 'inherit' });

    console.log(`✅ 导出成功！文件保存在: ${resolve(BACKUP_FILE)}`);
    console.log('📦 请将此文件拷贝到目标电脑');
  } catch (error) {
    console.error('❌ 导出失败:', (error as Error).message);
    process.exit(1);
  }
}

function importDatabase() {
  console.log('📥 开始导入法律法规数据...');

  // 先检查备份文件是否存在
  if (!existsSync(BACKUP_FILE)) {
    console.error(`❌ 找不到备份文件: ${BACKUP_FILE}`);
    console.log('请确保已将 backup 文件拷贝到此目录');
    process.exit(1);
  }

  // 先运行 Prisma 迁移确保表结构存在
  console.log('🔄 确保数据库结构是最新的...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  } catch (_error) {
    console.warn('⚠️ Prisma 迁移可能有问题，但继续尝试导入...');
  }

  try {
    // 使用 pg_restore 导入
    const cmd = `pg_restore -U postgres -d ${DB_NAME} -v ${BACKUP_FILE}`;
    console.log(`执行命令: ${cmd}`);

    execSync(cmd, { stdio: 'inherit' });

    console.log('✅ 导入成功！');

    // 验证数据
    console.log('🔍 验证导入数据...');
    const count = execSync(
      `psql -U postgres -d ${DB_NAME} -t -c "SELECT COUNT(*) FROM law_articles;"`,
      { encoding: 'utf8' }
    );
    console.log(`📊 法律法规数量: ${count.trim()}`);

    // 删除备份文件
    unlinkSync(BACKUP_FILE);
    console.log('🗑️ 已清理备份文件');
  } catch (error) {
    console.error('❌ 导入失败:', (error as Error).message);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
🔧 数据库迁移工具

使用方法:
  node scripts/migrate-laws.js [command]

命令:
  export     - 导出法律法规数据（在源电脑运行）
  import     - 导入法律法规数据（在目标电脑运行）
  help       - 显示帮助信息

示例:
  # 导出（在数据好的电脑上）
  node scripts/migrate-laws.js export
  
  # 导入（在需要数据的电脑上）
  node scripts/migrate-laws.js import

注意:
  - 确保两台电脑都安装了 PostgreSQL
  - 确保数据库名称一致 (默认: legal_debate_dev)
  - 导入前请先运行 npx prisma migrate deploy
  `);
}

const command = process.argv[2];

switch (command) {
  case 'export':
    exportDatabase();
    break;
  case 'import':
    importDatabase();
    break;
  case 'help':
  default:
    showHelp();
    break;
}
