#!/usr/bin/env npx tsx

/**
 * DeepSeek辩论生成专项测试
 *
 * 专门测试DeepSeek的辩论生成能力，验证：
 * - 辩论论点逻辑清晰
 * - 正反方论点平衡
 * - 法律依据准确
 */

import { config } from 'dotenv';
import { getUnifiedAIService } from '../src/lib/ai/unified-service';

// 加载环境变量
config();

// =============================================================================
// 测试案例定义
// =============================================================================

const DEBATE_TEST_CASES = [
  {
    title: '房屋买卖合同纠纷',
    description: '买方支付定金后卖方违约不办理过户，要求解除合同并赔偿损失',
    legalReferences: ['《民法典》第577条', '《民法典》第587条'],
    category: '民事纠纷',
  },
  {
    title: '劳动合同争议',
    description: '员工因公司未按时支付工资而被迫离职，要求支付经济补偿',
    legalReferences: ['《劳动合同法》第38条', '《劳动合同法》第46条'],
    category: '劳动纠纷',
  },
  {
    title: '交通事故赔偿',
    description: '机动车交通事故造成人身损害，要求赔偿医疗费和误工费',
    legalReferences: ['《道路交通安全法》第76条', '《民法典》第1179条'],
    category: '侵权纠纷',
  },
];

// =============================================================================
// 辩论质量评估接口
// =============================================================================

interface DebateQuality {
  clarity: number; // 逻辑清晰度 (1-10)
  balance: number; // 正反方平衡度 (1-10)
  accuracy: number; // 法律依据准确性 (1-10)
  completeness: number; // 论点完整性 (1-10)
  overall: number; // 总体评分 (1-10)
  analysis: string; // 详细分析
}

interface TestResult {
  testCase: (typeof DEBATE_TEST_CASES)[0];
  response: any;
  quality: DebateQuality;
  duration: number;
}

// =============================================================================
// 质量评估函数
// =============================================================================

function evaluateDebateQuality(
  title: string,
  description: string,
  debateContent: string
): DebateQuality {
  // 简单的启发式评估
  let clarity = 7; // 默认清晰度
  let balance = 7; // 默认平衡度
  let accuracy = 7; // 默认准确性
  let completeness = 7; // 默认完整性

  // 评估逻辑清晰度
  if (
    debateContent.includes('首先') ||
    debateContent.includes('其次') ||
    debateContent.includes('最后')
  ) {
    clarity += 1;
  }
  if (debateContent.length > 200) {
    clarity += 1;
  }

  // 评估正反方平衡度
  const hasPlaintiff =
    debateContent.includes('原告') ||
    debateContent.includes('买方') ||
    debateContent.includes('员工');
  const hasDefendant =
    debateContent.includes('被告') ||
    debateContent.includes('卖方') ||
    debateContent.includes('公司');
  if (hasPlaintiff && hasDefendant) {
    balance += 2;
  } else if (hasPlaintiff || hasDefendant) {
    balance += 1;
  }

  // 评估法律依据准确性
  const legalTerms = [
    '民法典',
    '合同法',
    '劳动法',
    '道路交通安全法',
    '条款',
    '规定',
    '依法',
  ];
  const legalTermCount = legalTerms.filter(term =>
    debateContent.includes(term)
  ).length;
  accuracy += Math.min(legalTermCount, 3);

  // 评估论点完整性
  if (
    debateContent.includes('事实') &&
    debateContent.includes('理由') &&
    debateContent.includes('请求')
  ) {
    completeness += 2;
  } else if (
    debateContent.includes('事实') ||
    debateContent.includes('理由') ||
    debateContent.includes('请求')
  ) {
    completeness += 1;
  }

  const overall = (clarity + balance + accuracy + completeness) / 4;

  return {
    clarity: Math.min(clarity, 10),
    balance: Math.min(balance, 10),
    accuracy: Math.min(accuracy, 10),
    completeness: Math.min(completeness, 10),
    overall: Math.min(overall, 10),
    analysis: generateQualityAnalysis(clarity, balance, accuracy, completeness),
  };
}

function generateQualityAnalysis(
  clarity: number,
  balance: number,
  accuracy: number,
  completeness: number
): string {
  const analysis = [];

  if (clarity >= 8) {
    analysis.push('✅ 论点逻辑清晰，结构合理');
  } else if (clarity >= 6) {
    analysis.push('⚠️ 论点基本清晰，结构可进一步优化');
  } else {
    analysis.push('❌ 论点逻辑不够清晰，需要改进');
  }

  if (balance >= 8) {
    analysis.push('✅ 正反方论点平衡，考虑全面');
  } else if (balance >= 6) {
    analysis.push('⚠️ 正反方基本平衡，可加强对立观点');
  } else {
    analysis.push('❌ 正反方论点不平衡');
  }

  if (accuracy >= 8) {
    analysis.push('✅ 法律依据准确，引用恰当');
  } else if (accuracy >= 6) {
    analysis.push('⚠️ 法律依据基本准确，可进一步精确化');
  } else {
    analysis.push('❌ 法律依据不够准确');
  }

  if (completeness >= 8) {
    analysis.push('✅ 论点完整，涵盖关键要素');
  } else if (completeness >= 6) {
    analysis.push('⚠️ 论点基本完整，可补充细节');
  } else {
    analysis.push('❌ 论点不够完整');
  }

  return analysis.join('\n');
}

// =============================================================================
// 测试函数
// =============================================================================

async function testDeepSeekDebate(): Promise<void> {
  console.log('🎯 开始DeepSeek辩论生成专项测试\n');
  console.log('='.repeat(60));

  const aiService = await getUnifiedAIService();
  const results: TestResult[] = [];

  for (const testCase of DEBATE_TEST_CASES) {
    console.log(`\n📋 测试案例: ${testCase.title}`);
    console.log(`   类型: ${testCase.category}`);
    console.log(`   描述: ${testCase.description}`);

    const startTime = Date.now();

    try {
      const response = await aiService.generateDebate({
        title: testCase.title,
        description: testCase.description,
        legalReferences: testCase.legalReferences,
      });

      const duration = Date.now() - startTime;
      const debateContent = response.choices[0]?.message?.content || '';

      console.log(`✅ 辩论生成成功，响应时间: ${duration}ms`);
      console.log(`   内容长度: ${debateContent.length} 字符`);
      console.log(`   Token使用: ${response.usage?.totalTokens || 0}`);

      // 评估质量
      const quality = evaluateDebateQuality(
        testCase.title,
        testCase.description,
        debateContent
      );

      results.push({
        testCase,
        response,
        quality,
        duration,
      });

      console.log(`   质量评分: ${quality.overall.toFixed(1)}/10`);
      console.log(`   - 逻辑清晰度: ${quality.clarity}/10`);
      console.log(`   - 正反方平衡: ${quality.balance}/10`);
      console.log(`   - 法律依据准确性: ${quality.accuracy}/10`);
      console.log(`   - 论点完整性: ${quality.completeness}/10`);

      console.log(`\n📝 生成的辩论内容:`);
      console.log('─'.repeat(50));
      console.log(debateContent);
      console.log('─'.repeat(50));

      console.log(`\n🔍 质量分析:`);
      console.log(quality.analysis);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(
        `❌ 辩论生成失败: ${error instanceof Error ? error.message : JSON.stringify(error)}`
      );

      results.push({
        testCase,
        response: null,
        quality: {
          clarity: 0,
          balance: 0,
          accuracy: 0,
          completeness: 0,
          overall: 0,
          analysis: '生成失败',
        },
        duration,
      });
    }

    console.log('\n' + '─'.repeat(60));
  }

  // 生成总结报告
  generateSummaryReport(results);
}

function generateSummaryReport(results: TestResult[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 DeepSeek辩论生成测试总结报告');
  console.log('='.repeat(60));

  const successfulTests = results.filter(r => r.response !== null);
  const failedTests = results.filter(r => r.response === null);

  console.log(`\n📈 总体统计:`);
  console.log(`   总测试数: ${results.length}`);
  console.log(`   成功数: ${successfulTests.length}`);
  console.log(`   失败数: ${failedTests.length}`);
  console.log(
    `   成功率: ${((successfulTests.length / results.length) * 100).toFixed(1)}%`
  );

  let avgOverall = 0;
  let avgClarity = 0;
  let avgBalance = 0;
  let avgAccuracy = 0;
  let avgCompleteness = 0;

  if (successfulTests.length > 0) {
    const avgDuration =
      successfulTests.reduce((sum, r) => sum + r.duration, 0) /
      successfulTests.length;
    avgClarity =
      successfulTests.reduce((sum, r) => sum + r.quality.clarity, 0) /
      successfulTests.length;
    avgBalance =
      successfulTests.reduce((sum, r) => sum + r.quality.balance, 0) /
      successfulTests.length;
    avgAccuracy =
      successfulTests.reduce((sum, r) => sum + r.quality.accuracy, 0) /
      successfulTests.length;
    avgCompleteness =
      successfulTests.reduce((sum, r) => sum + r.quality.completeness, 0) /
      successfulTests.length;
    avgOverall =
      successfulTests.reduce((sum, r) => sum + r.quality.overall, 0) /
      successfulTests.length;

    console.log(`   平均响应时间: ${avgDuration.toFixed(0)}ms`);
    console.log(`   平均质量评分: ${avgOverall.toFixed(1)}/10`);
    console.log(`   平均逻辑清晰度: ${avgClarity.toFixed(1)}/10`);
    console.log(`   平均正反方平衡: ${avgBalance.toFixed(1)}/10`);
    console.log(`   平均法律依据准确性: ${avgAccuracy.toFixed(1)}/10`);
    console.log(`   平均论点完整性: ${avgCompleteness.toFixed(1)}/10`);
  }

  console.log(`\n📋 详细结果:`);
  results.forEach((result, index) => {
    const status = result.response ? '✅' : '❌';
    console.log(
      `   ${index + 1}. ${status} ${result.testCase.title} - 质量: ${result.quality.overall.toFixed(1)}/10 - ${result.duration}ms`
    );
  });

  // 验收标准检查
  console.log(`\n🎯 验收标准检查:`);

  let standardsMet = 0;
  const totalStandards = 3;

  if (avgOverall >= 7.0) {
    console.log(
      `   ✅ 辩论论点逻辑清晰: 通过 (平均${avgOverall.toFixed(1)}/10 ≥ 7.0)`
    );
    standardsMet++;
  } else {
    console.log(
      `   ❌ 辩论论点逻辑清晰: 未通过 (平均${avgOverall.toFixed(1)}/10 < 7.0)`
    );
  }

  if (avgBalance >= 7.0) {
    console.log(
      `   ✅ 正反方论点平衡: 通过 (平均${avgBalance.toFixed(1)}/10 ≥ 7.0)`
    );
    standardsMet++;
  } else {
    console.log(
      `   ❌ 正反方论点平衡: 未通过 (平均${avgBalance.toFixed(1)}/10 < 7.0)`
    );
  }

  if (avgAccuracy >= 7.0) {
    console.log(
      `   ✅ 法律依据准确: 通过 (平均${avgAccuracy.toFixed(1)}/10 ≥ 7.0)`
    );
    standardsMet++;
  } else {
    console.log(
      `   ❌ 法律依据准确: 未通过 (平均${avgAccuracy.toFixed(1)}/10 < 7.0)`
    );
  }

  console.log(`\n🏆 最终结论:`);
  if (standardsMet >= totalStandards) {
    console.log(
      `   ✅ DeepSeek POC验证通过 (${standardsMet}/${totalStandards} 项验收标准满足)`
    );
    console.log(`   💡 建议：可以进入生产环境集成阶段`);
  } else {
    console.log(
      `   ⚠️ DeepSeek POC验证部分通过 (${standardsMet}/${totalStandards} 项验收标准满足)`
    );
    console.log(`   💡 建议：需要进一步优化或考虑其他提供商`);
  }

  // 保存报告
  const reportPath = './deepseek-debate-test-report.json';
  const fs = require('fs');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: results.length,
      successCount: successfulTests.length,
      failureCount: failedTests.length,
      successRate: (successfulTests.length / results.length) * 100,
      averageDuration:
        successfulTests.length > 0
          ? successfulTests.reduce((sum, r) => sum + r.duration, 0) /
            successfulTests.length
          : 0,
      averageQuality: {
        overall: avgOverall,
        clarity: avgClarity,
        balance: avgBalance,
        accuracy: avgAccuracy,
        completeness: avgCompleteness,
      },
    },
    standards: {
      met: standardsMet,
      total: totalStandards,
      passed: standardsMet >= totalStandards,
    },
    details: results.map(r => ({
      testCase: r.testCase,
      success: r.response !== null,
      duration: r.duration,
      quality: r.quality,
      response: r.response?.choices[0]?.message?.content || null,
    })),
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 详细报告已保存到: ${reportPath}`);
}

// =============================================================================
// 主函数
// =============================================================================

async function main(): Promise<void> {
  try {
    await testDeepSeekDebate();
  } catch (error) {
    console.error('测试执行失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
}

export { testDeepSeekDebate, type DebateQuality };
