/**
 * E2E测试详细诊断脚本
 * 用于诊断AI服务、API验证等关键问题
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

interface DiagnosticResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'INFO';
  details: string;
  duration?: number;
  error?: unknown;
  data?: unknown;
}

const results: DiagnosticResult[] = [];

function recordResult(result: DiagnosticResult): void {
  results.push(result);
  const icon =
    result.status === 'PASS'
      ? '✅'
      : result.status === 'WARN'
        ? '⚠️'
        : result.status === 'INFO'
          ? 'ℹ️'
          : '❌';
  console.log(`${icon} ${result.name}`);
  if (result.details) {
    console.log(`   ${result.details}`);
  }
  if (result.duration) {
    console.log(`   耗时: ${result.duration}ms`);
  }
}

/**
 * 检查1: AI服务配置
 */
async function checkAIServiceConfig(): Promise<void> {
  const start = Date.now();
  try {
    const envVars = {
      DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY,
      ZHIPU_API_KEY: !!process.env.ZHIPU_API_KEY,
      KIMI_API_KEY: !!process.env.KIMI_API_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      AI_PROVIDER: process.env.AI_PROVIDER || '未设置（使用默认值）',
    };

    const configuredProviders: string[] = [];
    if (envVars.DEEPSEEK_API_KEY) {
      configuredProviders.push('DeepSeek');
    }
    if (envVars.ZHIPU_API_KEY) {
      configuredProviders.push('智谱AI');
    }
    if (envVars.KIMI_API_KEY) {
      configuredProviders.push('Kimi');
    }
    if (envVars.ANTHROPIC_API_KEY) {
      configuredProviders.push('Anthropic');
    }
    if (envVars.OPENAI_API_KEY) {
      configuredProviders.push('OpenAI');
    }

    if (configuredProviders.length > 0) {
      recordResult({
        name: 'AI服务配置',
        status: 'PASS',
        details: `已配置AI服务: ${configuredProviders.join(', ')}`,
        duration: Date.now() - start,
        data: {
          providers: configuredProviders,
          AI_PROVIDER: envVars.AI_PROVIDER,
        },
      });
    } else {
      recordResult({
        name: 'AI服务配置',
        status: 'FAIL',
        details: '未配置任何AI服务密钥',
        duration: Date.now() - start,
        data: envVars,
      });
    }
  } catch (error) {
    recordResult({
      name: 'AI服务配置',
      status: 'FAIL',
      details: '检查AI服务配置失败',
      error,
      duration: Date.now() - start,
    });
  }
}

/**
 * 检查2: 测试创建辩论API
 */
async function checkCreateDebateAPI(): Promise<void> {
  const start = Date.now();
  try {
    // 获取测试用户和案件（使用ID查找更可靠）
    const user = await prisma.user.findFirst({
      where: { id: { startsWith: 'test-e2e' } },
    });

    if (!user) {
      recordResult({
        name: '创建辩论API测试',
        status: 'FAIL',
        details: '没有找到测试用户',
        duration: Date.now() - start,
      });
      return;
    }

    const testCase = await prisma.case.create({
      data: {
        userId: user.id,
        title: `诊断测试辩论_${Date.now()}`,
        description: 'E2E诊断测试',
        type: 'CIVIL',
        status: 'ACTIVE',
      },
    });

    // 尝试创建辩论
    const fetch = (await import('node-fetch')).default;

    const response = await fetch('http://localhost:3000/api/v1/debates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        caseId: testCase.id,
        title: '测试辩论',
        status: 'IN_PROGRESS',
        config: {
          debateMode: 'standard',
          maxRounds: 3,
          timePerRound: 30,
          allowNewEvidence: true,
        },
      }),
    });

    const responseBody = await response.text();
    let errorData = null;

    try {
      errorData = JSON.parse(responseBody);
    } catch {
      errorData = { raw: responseBody };
    }

    if (response.ok) {
      recordResult({
        name: '创建辩论API测试',
        status: 'PASS',
        details: `创建辩论成功，状态: ${response.status}`,
        duration: Date.now() - start,
        data: { status: response.status },
      });
    } else {
      recordResult({
        name: '创建辩论API测试',
        status: 'FAIL',
        details: `创建辩论失败: ${response.status}`,
        error: errorData,
        duration: Date.now() - start,
        data: {
          status: response.status,
          statusText: response.statusText,
          body: errorData,
        },
      });
    }

    // 清理测试数据
    await prisma.case.delete({ where: { id: testCase.id } });
  } catch (error) {
    recordResult({
      name: '创建辩论API测试',
      status: 'FAIL',
      details: '测试创建辩论API失败',
      error,
      duration: Date.now() - start,
    });
  }
}

/**
 * 检查3: 测试法条适用性分析API
 */
async function checkApplicabilityAPI(): Promise<void> {
  const start = Date.now();
  try {
    // 获取测试用户、案件和法条（使用ID查找更可靠）
    const user = await prisma.user.findFirst({
      where: { id: { startsWith: 'test-e2e' } },
    });

    if (!user) {
      recordResult({
        name: '法条适用性分析API测试',
        status: 'FAIL',
        details: '没有找到测试用户',
        duration: Date.now() - start,
      });
      return;
    }

    const testCase = await prisma.case.create({
      data: {
        userId: user.id,
        title: `诊断测试案件_${Date.now()}`,
        description: 'E2E诊断测试',
        type: 'CIVIL',
        status: 'ACTIVE',
      },
    });

    // 获取一个法条ID
    const article = await prisma.lawArticle.findFirst();

    if (!article) {
      recordResult({
        name: '法条适用性分析API测试',
        status: 'WARN',
        details: '没有找到法条数据',
        duration: Date.now() - start,
      });
      await prisma.case.delete({ where: { id: testCase.id } });
      return;
    }

    // 尝试调用适用性分析API
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(
      'http://localhost:3000/api/v1/legal-analysis/applicability',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caseId: testCase.id,
          articleIds: [article.id],
        }),
      }
    );

    const responseBody = await response.text();
    let errorData = null;

    try {
      errorData = JSON.parse(responseBody);
    } catch {
      errorData = { raw: responseBody };
    }

    if (response.ok) {
      recordResult({
        name: '法条适用性分析API测试',
        status: 'PASS',
        details: `法条适用性分析成功，状态: ${response.status}`,
        duration: Date.now() - start,
      });
    } else {
      recordResult({
        name: '法条适用性分析API测试',
        status: response.status === 404 ? 'WARN' : 'FAIL',
        details: `法条适用性分析失败: ${response.status}`,
        error: errorData,
        duration: Date.now() - start,
        data: {
          status: response.status,
          statusText: response.statusText,
          body: errorData,
        },
      });
    }

    // 清理测试数据
    await prisma.case.delete({ where: { id: testCase.id } });
  } catch (error) {
    recordResult({
      name: '法条适用性分析API测试',
      status: 'FAIL',
      details: '测试法条适用性分析API失败',
      error,
      duration: Date.now() - start,
    });
  }
}

/**
 * 检查4: 环境变量检查
 */
async function checkEnvironmentVariables(): Promise<void> {
  const start = Date.now();
  const warnings: string[] = [];
  const requiredVars = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    NODE_ENV: !!process.env.NODE_ENV,
    AI_PROVIDER: !!process.env.AI_PROVIDER,
  };

  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
      warnings.push(`${key} 未设置`);
    }
  }

  if (warnings.length > 0) {
    recordResult({
      name: '环境变量检查',
      status: 'WARN',
      details: `缺失环境变量: ${warnings.join(', ')}`,
      duration: Date.now() - start,
      data: requiredVars,
    });
  } else {
    recordResult({
      name: '环境变量检查',
      status: 'PASS',
      details: `NODE_ENV: ${process.env.NODE_ENV}`,
      duration: Date.now() - start,
      data: requiredVars,
    });
  }
}

/**
 * 检查5: 法条数据统计
 */
async function checkLawArticlesStats(): Promise<void> {
  const start = Date.now();
  try {
    const stats = await prisma.lawArticle.groupBy({
      by: ['category'],
      _count: true,
    });

    const total = await prisma.lawArticle.count();

    if (total >= 100) {
      recordResult({
        name: '法条数据统计',
        status: 'PASS',
        details: `共有${total}条法条数据，覆盖${stats.length}个分类`,
        duration: Date.now() - start,
        data: { total, categories: stats },
      });
    } else {
      recordResult({
        name: '法条数据统计',
        status: 'WARN',
        details: `共有${total}条法条数据（建议≥100），覆盖${stats.length}个分类`,
        duration: Date.now() - start,
        data: { total, categories: stats },
      });
    }
  } catch (error) {
    recordResult({
      name: '法条数据统计',
      status: 'FAIL',
      details: '统计法条数据失败',
      error,
      duration: Date.now() - start,
    });
  }
}

/**
 * 检查6: 测试案件列表分页API响应格式
 */
async function checkCasesAPIFormat(): Promise<void> {
  const start = Date.now();
  try {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(
      'http://localhost:3000/api/v1/cases?page=1&limit=10'
    );
    const data = (await response.json()) as Record<string, unknown>;

    const hasSuccess = 'success' in data;
    const hasData = 'data' in data;
    const dataIsArray = Array.isArray(data.data);
    const dataHasItems =
      typeof data.data === 'object' &&
      data.data !== null &&
      'items' in data.data;

    let details = `响应格式: success=${hasSuccess}, data=${hasData}`;
    if (dataIsArray) {
      details += ', data类型=数组';
    } else if (dataHasItems) {
      details += ', data类型=对象(包含items)';
    }

    recordResult({
      name: '案件列表API响应格式',
      status: 'INFO',
      details,
      duration: Date.now() - start,
      data: {
        responseStructure: {
          success: hasSuccess,
          dataType: dataIsArray ? 'array' : dataHasItems ? 'object' : 'unknown',
        },
      },
    });
  } catch (error) {
    recordResult({
      name: '案件列表API响应格式',
      status: 'FAIL',
      details: '检查案件列表API响应格式失败',
      error,
      duration: Date.now() - start,
    });
  }
}

/**
 * 生成详细诊断报告
 */
function generateDetailedReport(): string {
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;
  const infoCount = results.filter(r => r.status === 'INFO').length;

  let report = `# E2E测试详细诊断报告\n\n`;
  report += `## 执行时间\n${new Date().toLocaleString('zh-CN')}\n\n`;
  report += `## 摘要\n`;
  report += `- 总检查项: ${results.length}\n`;
  report += `- ✅ 通过: ${passCount}\n`;
  report += `- ⚠️ 警告: ${warnCount}\n`;
  report += `- ❌ 失败: ${failCount}\n`;
  report += `- ℹ️ 信息: ${infoCount}\n\n`;

  if (failCount > 0) {
    report += `## 关键失败问题\n\n`;
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        report += `### ${r.name}\n`;
        report += `- 详情: ${r.details}\n`;
        if (r.error) {
          report += `- 错误: ${JSON.stringify(r.error, null, 2)}\n`;
        }
        if (r.data) {
          report += `- 数据: ${JSON.stringify(r.data, null, 2)}\n`;
        }
        report += `\n`;
      });
  }

  if (warnCount > 0) {
    report += `## 警告信息\n\n`;
    results
      .filter(r => r.status === 'WARN')
      .forEach(r => {
        report += `### ${r.name}\n`;
        report += `- 详情: ${r.details}\n`;
        if (r.data) {
          report += `- 数据: ${JSON.stringify(r.data, null, 2)}\n`;
        }
        report += `\n`;
      });
  }

  report += `## 详细结果\n\n`;
  results.forEach(r => {
    const icon =
      r.status === 'PASS'
        ? '✅'
        : r.status === 'WARN'
          ? '⚠️'
          : r.status === 'INFO'
            ? 'ℹ️'
            : '❌';
    report += `${icon} **${r.name}** - ${r.details}`;
    if (r.duration) {
      report += ` (${r.duration}ms)`;
    }
    report += `\n`;
  });

  report += `\n## 诊断结论\n\n`;

  const hasAIService =
    results.find(r => r.name === 'AI服务配置' && r.status === 'PASS') !==
    undefined;
  const debateAPIFailed =
    results.find(r => r.name === '创建辩论API测试' && r.status === 'FAIL') !==
    undefined;
  const enoughArticles =
    results.find(r => r.name === '法条数据统计' && r.status === 'PASS') !==
    undefined;

  report += `### 关键问题识别\n\n`;

  if (!hasAIService) {
    report += `1. ❌ **AI服务未配置** - 这会导致所有依赖AI的功能失败（文档解析、辩论生成等）\n\n`;
    report += `   **建议**: 在.env文件中配置AI服务密钥（DEEPSEEK_API_KEY或KIMI_API_KEY）\n\n`;
  }

  if (debateAPIFailed) {
    report += `2. ❌ **创建辩论API失败** - 这是导致多个E2E测试失败的根本原因\n\n`;
    const debateError = results.find(r => r.name === '创建辩论API测试');
    if (debateError?.data && typeof debateError.data === 'object') {
      const errorData = debateError.data as { body?: unknown };
      report += `   **错误详情**: ${JSON.stringify(errorData.body, null, 2)}\n\n`;
    }
    report += `   **建议**: 检查API验证逻辑，确认config字段的schema定义\n\n`;
  }

  if (!enoughArticles) {
    report += `3. ⚠️ **法条数据不足** - 可能影响检索和分析测试\n\n`;
    report += `   **建议**: 运行 \`npx tsx scripts/import-law-articles.ts\` 导入更多法条\n\n`;
  }

  report += `### 优先级建议\n\n`;
  report += `**P0 - 立即修复**:\n`;
  if (!hasAIService) {
    report += `1. 配置AI服务密钥\n`;
  }
  if (debateAPIFailed) {
    report += `2. 修复创建辩论API验证问题\n`;
  }
  report += `3. 实现文档解析Mock逻辑\n\n`;

  report += `**P1 - 短期优化**:\n`;
  if (!enoughArticles) {
    report += `1. 导入完整法条数据\n`;
  }
  report += `2. 统一API响应格式\n`;
  report += `3. 优化缓存性能\n\n`;

  return report;
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('========================================');
  console.log('E2E测试详细诊断');
  console.log('========================================\n');

  console.log('注意: 确保Next.js开发服务器正在运行 (npm run dev)\n');

  // 执行所有检查
  await checkEnvironmentVariables();
  await checkAIServiceConfig();
  await checkLawArticlesStats();
  await checkCasesAPIFormat();
  await checkCreateDebateAPI();
  await checkApplicabilityAPI();

  console.log('\n========================================');
  console.log('详细诊断完成');
  console.log('========================================\n');

  // 生成报告
  const report = generateDetailedReport();
  console.log(report);

  // 保存报告到文件
  const fs = await import('fs');
  const path = await import('path');
  const reportPath = path.join(
    process.cwd(),
    'docs',
    'E2E_DETAILED_DIAGNOSIS_REPORT.md'
  );
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n详细诊断报告已保存到: ${reportPath}`);

  // 退出码
  const failCount = results.filter(r => r.status === 'FAIL').length;
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('详细诊断脚本执行失败:', error);
  process.exit(1);
});
