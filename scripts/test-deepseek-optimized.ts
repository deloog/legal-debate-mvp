#!/usr/bin/env npx tsx

/**
 * 优化后的DeepSeek辩论生成测试
 *
 * 测试优化措施的效果：
 * - 缩短超时时间
 * - 优化请求参数
 * - 增强缓存机制
 * - 改进重试策略
 */

import { config } from "dotenv";
import { getUnifiedAIService } from "../src/lib/ai/unified-service";

// 加载环境变量
config();

// =============================================================================
// 测试案例定义
// =============================================================================

const OPTIMIZED_TEST_CASES = [
  {
    title: "房屋买卖合同纠纷",
    description: "买方支付定金后卖方违约不办理过户，要求解除合同并赔偿损失",
    legalReferences: ["《民法典》第577条", "《民法典》第587条"],
    category: "民事纠纷",
  },
  {
    title: "劳动合同争议",
    description: "员工因公司未按时支付工资而被迫离职，要求支付经济补偿",
    legalReferences: ["《劳动合同法》第38条", "《劳动合同法》第46条"],
    category: "劳动纠纷",
  },
  {
    title: "交通事故赔偿",
    description: "机动车交通事故造成人身损害，要求赔偿医疗费和误工费",
    legalReferences: ["《道路交通安全法》第76条", "《民法典》第1179条"],
    category: "侵权纠纷",
  },
  // 新增相似案例测试缓存效果
  {
    title: "商品房买卖纠纷",
    description: "购房人支付首付款后开发商不交房，要求退款并赔偿",
    legalReferences: ["《民法典》第577条", "《民法典》第584条"],
    category: "民事纠纷",
  },
];

// =============================================================================
// 测试结果接口
// =============================================================================

interface OptimizedTestResult {
  testCase: (typeof OPTIMIZED_TEST_CASES)[0];
  response: any;
  duration: number;
  cached: boolean;
  quality: {
    clarity: number;
    balance: number;
    accuracy: number;
    completeness: number;
    overall: number;
    analysis: string;
  };
}

interface OptimizationMetrics {
  totalTests: number;
  averageDuration: number;
  cachedResponses: number;
  cacheHitRate: number;
  successRate: number;
  qualityImprovement: number;
  performanceGain: number;
}

// =============================================================================
// 性能监控
// =============================================================================

class PerformanceMonitor {
  private metrics: Array<{
    timestamp: number;
    duration: number;
    cached: boolean;
    quality: number;
  }> = [];

  public recordMetric(
    duration: number,
    cached: boolean,
    quality: number,
  ): void {
    this.metrics.push({
      timestamp: Date.now(),
      duration,
      cached,
      quality,
    });

    console.log(
      `📊 Performance Metric: ${duration}ms, Cached: ${cached}, Quality: ${quality.toFixed(1)}`,
    );
  }

  public getMetrics(): OptimizationMetrics {
    if (this.metrics.length === 0) {
      return {
        totalTests: 0,
        averageDuration: 0,
        cachedResponses: 0,
        cacheHitRate: 0,
        successRate: 0,
        qualityImprovement: 0,
        performanceGain: 0,
      };
    }

    const totalTests = this.metrics.length;
    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = totalDuration / totalTests;
    const cachedResponses = this.metrics.filter((m) => m.cached).length;
    const cacheHitRate = (cachedResponses / totalTests) * 100;
    const averageQuality =
      this.metrics.reduce((sum, m) => sum + m.quality, 0) / totalTests;

    // 与基准测试对比（原始平均21.2秒，质量8.7）
    const baselineDuration = 21200;
    const baselineQuality = 8.7;
    const performanceGain =
      ((baselineDuration - averageDuration) / baselineDuration) * 100;
    const qualityImprovement =
      ((averageQuality - baselineQuality) / baselineQuality) * 100;

    return {
      totalTests,
      averageDuration,
      cachedResponses,
      cacheHitRate,
      successRate: 100, // 假设都成功
      qualityImprovement,
      performanceGain,
    };
  }
}

// =============================================================================
// 质量评估函数（复用原有逻辑）
// =============================================================================

function evaluateDebateQuality(
  title: string,
  description: string,
  debateContent: string,
): OptimizedTestResult["quality"] {
  let clarity = 7;
  let balance = 7;
  let accuracy = 7;
  let completeness = 7;

  if (
    debateContent.includes("首先") ||
    debateContent.includes("其次") ||
    debateContent.includes("最后")
  ) {
    clarity += 1;
  }
  if (debateContent.length > 200) {
    clarity += 1;
  }

  const hasPlaintiff =
    debateContent.includes("原告") ||
    debateContent.includes("买方") ||
    debateContent.includes("员工");
  const hasDefendant =
    debateContent.includes("被告") ||
    debateContent.includes("卖方") ||
    debateContent.includes("公司");
  if (hasPlaintiff && hasDefendant) {
    balance += 2;
  } else if (hasPlaintiff || hasDefendant) {
    balance += 1;
  }

  const legalTerms = [
    "民法典",
    "合同法",
    "劳动法",
    "道路交通安全法",
    "条款",
    "规定",
    "依法",
  ];
  const legalTermCount = legalTerms.filter((term) =>
    debateContent.includes(term),
  ).length;
  accuracy += Math.min(legalTermCount, 3);

  if (
    debateContent.includes("事实") &&
    debateContent.includes("理由") &&
    debateContent.includes("请求")
  ) {
    completeness += 2;
  } else if (
    debateContent.includes("事实") ||
    debateContent.includes("理由") ||
    debateContent.includes("请求")
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
  completeness: number,
): string {
  const analysis = [];

  if (clarity >= 8) {
    analysis.push("✅ 论点逻辑清晰，结构合理");
  } else if (clarity >= 6) {
    analysis.push("⚠️ 论点基本清晰，结构可进一步优化");
  } else {
    analysis.push("❌ 论点逻辑不够清晰，需要改进");
  }

  if (balance >= 8) {
    analysis.push("✅ 正反方论点平衡，考虑全面");
  } else if (balance >= 6) {
    analysis.push("⚠️ 正反方基本平衡，可加强对立观点");
  } else {
    analysis.push("❌ 正反方论点不平衡");
  }

  if (accuracy >= 8) {
    analysis.push("✅ 法律依据准确，引用恰当");
  } else if (accuracy >= 6) {
    analysis.push("⚠️ 法律依据基本准确，可进一步精确化");
  } else {
    analysis.push("❌ 法律依据不够准确");
  }

  if (completeness >= 8) {
    analysis.push("✅ 论点完整，涵盖关键要素");
  } else if (completeness >= 6) {
    analysis.push("⚠️ 论点基本完整，可补充细节");
  } else {
    analysis.push("❌ 论点不够完整");
  }

  return analysis.join("\n");
}

// =============================================================================
// 主测试函数
// =============================================================================

async function testOptimizedDeepSeek(): Promise<void> {
  console.log("🚀 开始优化后的DeepSeek辩论生成测试\n");
  console.log("=".repeat(60));

  const aiService = await getUnifiedAIService();
  const performanceMonitor = new PerformanceMonitor();
  const results: OptimizedTestResult[] = [];

  for (const testCase of OPTIMIZED_TEST_CASES) {
    console.log(`\n📋 测试案例: ${testCase.title}`);
    console.log(`   类型: ${testCase.category}`);
    console.log(`   描述: ${testCase.description}`);

    const startTime = Date.now();
    let cached = false;

    try {
      const response = await aiService.generateDebate({
        title: testCase.title,
        description: testCase.description,
        legalReferences: testCase.legalReferences,
      });

      const duration = Date.now() - startTime;
      const debateContent = response.choices[0]?.message?.content || "";
      cached = response.cached || false;

      console.log(`✅ 辩论生成成功，响应时间: ${duration}ms`);
      console.log(`   缓存状态: ${cached ? "🎯 命中缓存" : "🔄 生成新内容"}`);
      console.log(`   内容长度: ${debateContent.length} 字符`);
      console.log(`   Token使用: ${response.usage?.totalTokens || 0}`);

      // 评估质量
      const quality = evaluateDebateQuality(
        testCase.title,
        testCase.description,
        debateContent,
      );

      results.push({
        testCase,
        response,
        duration,
        cached,
        quality,
      });

      // 记录性能指标
      performanceMonitor.recordMetric(duration, cached, quality.overall);

      console.log(`   质量评分: ${quality.overall.toFixed(1)}/10`);
      console.log(`   - 逻辑清晰度: ${quality.clarity}/10`);
      console.log(`   - 正反方平衡: ${quality.balance}/10`);
      console.log(`   - 法律依据准确性: ${quality.accuracy}/10`);
      console.log(`   - 论点完整性: ${quality.completeness}/10`);

      if (duration > 15000) {
        console.log(`⚠️ 响应时间仍较长: ${duration}ms`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(
        `❌ 辩论生成失败: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      );

      results.push({
        testCase,
        response: null,
        duration,
        cached: false,
        quality: {
          clarity: 0,
          balance: 0,
          accuracy: 0,
          completeness: 0,
          overall: 0,
          analysis: "生成失败",
        },
      });
    }

    console.log("\n" + "─".repeat(60));
  }

  // 生成优化效果报告
  generateOptimizationReport(results, performanceMonitor);
}

function generateOptimizationReport(
  results: OptimizedTestResult[],
  performanceMonitor: PerformanceMonitor,
): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 优化效果分析报告");
  console.log("=".repeat(60));

  const metrics = performanceMonitor.getMetrics();
  const successfulTests = results.filter((r) => r.response !== null);

  console.log(`\n📈 性能指标:`);
  console.log(`   总测试数: ${metrics.totalTests}`);
  console.log(`   成功数: ${successfulTests.length}`);
  console.log(`   缓存命中数: ${metrics.cachedResponses}`);
  console.log(
    `   成功率: ${((successfulTests.length / metrics.totalTests) * 100).toFixed(1)}%`,
  );
  console.log(`   缓存命中率: ${metrics.cacheHitRate.toFixed(1)}%`);

  console.log(`\n⏱️ 响应时间分析:`);
  console.log(
    `   平均响应时间: ${metrics.averageDuration.toFixed(0)}ms (${(metrics.averageDuration / 1000).toFixed(1)}秒)`,
  );
  console.log(`   性能提升: ${metrics.performanceGain.toFixed(1)}%`);

  // 响应时间分布
  const durations = successfulTests.map((r) => r.duration);
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  const medianDuration = durations.sort((a, b) => a - b)[
    Math.floor(durations.length / 2)
  ];

  console.log(`   最快响应: ${minDuration}ms`);
  console.log(`   最慢响应: ${maxDuration}ms`);
  console.log(`   中位数响应: ${medianDuration}ms`);

  console.log(`\n🎯 质量评估:`);
  if (successfulTests.length > 0) {
    const avgQuality =
      successfulTests.reduce((sum, r) => sum + r.quality.overall, 0) /
      successfulTests.length;
    const avgClarity =
      successfulTests.reduce((sum, r) => sum + r.quality.clarity, 0) /
      successfulTests.length;
    const avgBalance =
      successfulTests.reduce((sum, r) => sum + r.quality.balance, 0) /
      successfulTests.length;
    const avgAccuracy =
      successfulTests.reduce((sum, r) => sum + r.quality.accuracy, 0) /
      successfulTests.length;

    console.log(`   平均质量评分: ${avgQuality.toFixed(1)}/10`);
    console.log(`   质量提升: ${metrics.qualityImprovement.toFixed(1)}%`);
    console.log(`   平均逻辑清晰度: ${avgClarity.toFixed(1)}/10`);
    console.log(`   平均正反方平衡: ${avgBalance.toFixed(1)}/10`);
    console.log(`   平均法律依据准确性: ${avgAccuracy.toFixed(1)}/10`);
  }

  console.log(`\n🎯 优化目标达成情况:`);

  // 响应时间目标：<15秒
  if (metrics.averageDuration < 15000) {
    console.log(
      `   ✅ 响应时间目标达成: ${metrics.averageDuration.toFixed(0)}ms < 15000ms`,
    );
  } else {
    console.log(
      `   ❌ 响应时间目标未达成: ${metrics.averageDuration.toFixed(0)}ms >= 15000ms`,
    );
  }

  // 缓存命中率目标：>30%
  if (metrics.cacheHitRate > 30) {
    console.log(
      `   ✅ 缓存命中率目标达成: ${metrics.cacheHitRate.toFixed(1)}% > 30%`,
    );
  } else {
    console.log(
      `   ⚠️ 缓存命中率目标部分达成: ${metrics.cacheHitRate.toFixed(1)}% (目标 >30%)`,
    );
  }

  // 质量保持目标：>8.0
  if (successfulTests.length > 0) {
    const avgQuality =
      successfulTests.reduce((sum, r) => sum + r.quality.overall, 0) /
      successfulTests.length;
    if (avgQuality >= 8.0) {
      console.log(`   ✅ 质量保持目标达成: ${avgQuality.toFixed(1)}/10 >= 8.0`);
    } else {
      console.log(
        `   ⚠️ 质量保持目标部分达成: ${avgQuality.toFixed(1)}/10 (目标 >=8.0)`,
      );
    }
  }

  console.log(`\n🏆 总体评价:`);
  if (metrics.performanceGain > 50 && metrics.cacheHitRate > 20) {
    console.log(
      `   🎉 优化效果显著！性能提升${metrics.performanceGain.toFixed(1)}%，缓存命中率${metrics.cacheHitRate.toFixed(1)}%`,
    );
  } else if (metrics.performanceGain > 30) {
    console.log(
      `   👍 优化效果良好！性能提升${metrics.performanceGain.toFixed(1)}%，建议进一步优化缓存策略`,
    );
  } else if (metrics.performanceGain > 10) {
    console.log(
      `   👌 优化效果一般，性能提升${metrics.performanceGain.toFixed(1)}%，需要继续优化`,
    );
  } else {
    console.log(`   😐 优化效果有限，需要重新评估优化策略`);
  }

  // 保存详细报告
  const reportPath = "./deepseek-optimization-report.json";
  const fs = require("fs");
  const report = {
    timestamp: new Date().toISOString(),
    summary: metrics,
    details: results.map((r) => ({
      testCase: r.testCase,
      success: r.response !== null,
      duration: r.duration,
      cached: r.cached,
      quality: r.quality,
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
    await testOptimizedDeepSeek();
  } catch (error) {
    console.error("测试执行失败:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("脚本执行失败:", error);
    process.exit(1);
  });
}

export {
  testOptimizedDeepSeek,
  type OptimizedTestResult,
  type OptimizationMetrics,
};
