/**
 * 部署前检查脚本
 * 验证所有关键配置是否就绪
 */

import dotenv from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// 加载环境变量
dotenv.config({ path: resolve(process.cwd(), '.env.production') });

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

const results: CheckResult[] = [];

/**
 * 添加检查结果
 */
function addResult(
  name: string,
  status: 'pass' | 'fail' | 'warn',
  message: string,
  severity: 'critical' | 'high' | 'medium' | 'low' = 'medium'
) {
  results.push({ name, status, message, severity });
}

/**
 * 1. 检查环境变量
 */
function checkEnvironmentVariables() {
  console.log('\n🔍 检查环境变量...\n');

  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
  ];

  const optionalVars = [
    'DEEPSEEK_API_KEY',
    'ZHIPU_API_KEY',
    'REDIS_URL',
    'SMTP_HOST',
  ];

  // 检查必需变量
  for (const varName of requiredVars) {
    const value = process.env[varName];

    if (!value) {
      addResult(varName, 'fail', `缺少必需的环境变量: ${varName}`, 'critical');
    } else if (value.includes('placeholder')) {
      addResult(
        varName,
        'fail',
        `环境变量包含占位符值: ${varName}`,
        'critical'
      );
    } else if (varName === 'DATABASE_URL' && value.includes(':password@')) {
      addResult(varName, 'fail', `数据库使用弱密码 "password"`, 'critical');
    } else if (
      varName === 'NEXTAUTH_SECRET' &&
      value.startsWith('http://localhost')
    ) {
      addResult(
        varName,
        'fail',
        `NEXTAUTH_SECRET 使用了 URL 而非密钥`,
        'critical'
      );
    } else if (value.length < 16 && varName.includes('SECRET')) {
      addResult(
        varName,
        'warn',
        `密钥长度较短（< 16字符）: ${varName}`,
        'high'
      );
    } else {
      addResult(varName, 'pass', `✓ ${varName} 已配置`, 'low');
    }
  }

  // 检查可选但重要的变量
  for (const varName of optionalVars) {
    const value = process.env[varName];

    if (!value) {
      addResult(
        varName,
        'warn',
        `未配置可选变量: ${varName}（某些功能可能不可用）`,
        'medium'
      );
    } else if (value.includes('placeholder')) {
      addResult(varName, 'fail', `环境变量包含占位符值: ${varName}`, 'high');
    } else {
      addResult(varName, 'pass', `✓ ${varName} 已配置`, 'low');
    }
  }
}

/**
 * 2. 检查数据库连接配置
 */
function checkDatabaseConfig() {
  console.log('\n🔍 检查数据库配置...\n');

  const poolMin = parseInt(process.env.DATABASE_POOL_MIN || '2', 10);
  const poolMax = parseInt(process.env.DATABASE_POOL_MAX || '10', 10);

  if (poolMax < 20) {
    addResult(
      'DATABASE_POOL_MAX',
      'warn',
      `连接池最大连接数较低（${poolMax}），建议生产环境设置为 20-50`,
      'medium'
    );
  } else {
    addResult(
      'DATABASE_POOL_MAX',
      'pass',
      `✓ 连接池配置合理（${poolMax}）`,
      'low'
    );
  }

  if (poolMin >= poolMax) {
    addResult(
      'DATABASE_POOL',
      'fail',
      `连接池配置错误：最小值（${poolMin}）>= 最大值（${poolMax}）`,
      'high'
    );
  }
}

/**
 * 3. 检查安全配置
 */
function checkSecurityConfig() {
  console.log('\n🔍 检查安全配置...\n');

  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv !== 'production') {
    addResult(
      'NODE_ENV',
      'fail',
      `NODE_ENV 应设置为 "production"，当前值: ${nodeEnv}`,
      'critical'
    );
  } else {
    addResult('NODE_ENV', 'pass', `✓ NODE_ENV = production`, 'low');
  }

  const logLevel = process.env.LOG_LEVEL;
  if (logLevel && ['debug', 'verbose'].includes(logLevel)) {
    addResult(
      'LOG_LEVEL',
      'warn',
      `生产环境日志级别应设置为 "error" 或 "warn"，当前: ${logLevel}`,
      'medium'
    );
  }

  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS;
  if (!corsOrigins || corsOrigins.includes('localhost')) {
    addResult(
      'CORS_ALLOWED_ORIGINS',
      'warn',
      `CORS 配置包含 localhost 或未配置，可能存在安全风险`,
      'high'
    );
  }
}

/**
 * 4. 检查文件和目录
 */
function checkFilesAndDirectories() {
  console.log('\n🔍 检查必要文件...\n');

  const requiredFiles = [
    '.env.production',
    'prisma/schema.prisma',
    'package.json',
    'next.config.js',
  ];

  for (const file of requiredFiles) {
    const filePath = resolve(process.cwd(), file);
    if (existsSync(filePath)) {
      addResult(file, 'pass', `✓ 文件存在: ${file}`, 'low');
    } else {
      addResult(
        file,
        'fail',
        `缺少必需文件: ${file}`,
        file === '.env.production' ? 'critical' : 'high'
      );
    }
  }

  // 检查构建目录
  const buildDir = resolve(process.cwd(), '.next');
  if (!existsSync(buildDir)) {
    addResult(
      '.next',
      'warn',
      '未找到构建目录，请先运行 npm run build',
      'high'
    );
  } else {
    addResult('.next', 'pass', `✓ 项目已构建`, 'low');
  }
}

/**
 * 5. 检查 AI 服务配置
 */
function checkAIServicesConfig() {
  console.log('\n🔍 检查 AI 服务配置...\n');

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const zhipuKey = process.env.ZHIPU_API_KEY;

  if (!deepseekKey && !zhipuKey) {
    addResult(
      'AI_SERVICES',
      'fail',
      '未配置任何 AI 服务密钥，核心功能将无法使用',
      'critical'
    );
  } else {
    const configuredServices = [];
    if (deepseekKey && !deepseekKey.includes('placeholder')) {
      configuredServices.push('DeepSeek');
    }
    if (zhipuKey && !zhipuKey.includes('placeholder')) {
      configuredServices.push('智谱AI');
    }

    if (configuredServices.length > 0) {
      addResult(
        'AI_SERVICES',
        'pass',
        `✓ 已配置 AI 服务: ${configuredServices.join(', ')}`,
        'low'
      );
    } else {
      addResult('AI_SERVICES', 'fail', 'AI 服务密钥均为占位符值', 'critical');
    }
  }

  // 检查超时配置
  const aiTimeout = parseInt(process.env.AI_SERVICE_TIMEOUT || '30000', 10);
  if (aiTimeout < 10000) {
    addResult(
      'AI_SERVICE_TIMEOUT',
      'warn',
      `AI 服务超时时间较短（${aiTimeout}ms），建议设置为 30000ms 以上`,
      'medium'
    );
  }
}

/**
 * 打印结果
 */
function printResults() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 部署前检查结果');
  console.log('='.repeat(80) + '\n');

  const grouped = {
    critical: results.filter(r => r.severity === 'critical'),
    high: results.filter(r => r.severity === 'high'),
    medium: results.filter(r => r.severity === 'medium'),
    low: results.filter(r => r.severity === 'low'),
  };

  const failed = results.filter(r => r.status === 'fail');
  const warned = results.filter(r => r.status === 'warn');
  const passed = results.filter(r => r.status === 'pass');

  // 打印严重问题
  if (grouped.critical.length > 0) {
    console.log('🔴 严重问题（必须修复）:\n');
    grouped.critical.forEach(r => {
      const icon = r.status === 'pass' ? '✅' : '❌';
      console.log(`  ${icon} ${r.name}: ${r.message}`);
    });
    console.log('');
  }

  // 打印高优先级问题
  if (grouped.high.length > 0) {
    console.log('🟠 高优先级问题（强烈建议修复）:\n');
    grouped.high.forEach(r => {
      const icon =
        r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌';
      console.log(`  ${icon} ${r.name}: ${r.message}`);
    });
    console.log('');
  }

  // 打印中等优先级问题
  if (grouped.medium.length > 0) {
    console.log('🟡 中等优先级问题（建议修复）:\n');
    grouped.medium.forEach(r => {
      const icon =
        r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌';
      console.log(`  ${icon} ${r.name}: ${r.message}`);
    });
    console.log('');
  }

  // 总结
  console.log('='.repeat(80));
  console.log('📈 统计:\n');
  console.log(`  ✅ 通过: ${passed.length}`);
  console.log(`  ⚠️  警告: ${warned.length}`);
  console.log(`  ❌ 失败: ${failed.length}`);
  console.log(`  📊 总计: ${results.length}`);
  console.log('='.repeat(80) + '\n');

  // 最终建议
  const criticalFailed = grouped.critical.filter(r => r.status === 'fail');
  if (criticalFailed.length > 0) {
    console.log('🚨 结论: 存在严重问题，不建议部署！\n');
    console.log('请先解决以下问题：');
    criticalFailed.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.message}`);
    });
    console.log('');
    process.exit(1);
  } else if (
    failed.length > 0 ||
    grouped.high.filter(r => r.status !== 'pass').length > 0
  ) {
    console.log('⚠️  结论: 存在重要问题，建议修复后再部署\n');
    process.exit(1);
  } else {
    console.log('✅ 结论: 基本检查通过，可以部署！\n');
    if (warned.length > 0) {
      console.log('   建议部署后尽快解决警告问题。\n');
    }
    process.exit(0);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('\n🚀 开始部署前检查...\n');

  try {
    checkEnvironmentVariables();
    checkDatabaseConfig();
    checkSecurityConfig();
    checkFilesAndDirectories();
    checkAIServicesConfig();

    printResults();
  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error);
    process.exit(1);
  }
}

main();
