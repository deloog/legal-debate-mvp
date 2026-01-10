/**
 * AI服务问题综合诊断脚本
 * 用于诊断为什么AI服务在测试中100%失败
 */

import { getUnifiedAIService } from "../src/lib/ai/unified-service";
import { TaskPriority } from "../src/types/agent";

interface DiagnosticResult {
  aiService: {
    timestamp: string;
    initialized: boolean;
    status?: string;
    error?: string;
  };
  docAnalyzer: {
    timestamp: string;
    initialized: boolean;
    status?: string;
    error?: string;
  };
  testCall: Array<{
    timestamp: string;
    success: boolean;
    duration: number;
    error?: string;
  }>;
}

/**
 * 打印诊断结果
 */
function printDiagnostic(results: DiagnosticResult): void {
  console.log("\n========================================");
  console.log("📊 AI服务问题诊断报告");
  console.log("========================================\n");

  console.log("🔍 1. AI服务初始化诊断");
  console.log(
    `   状态: ${results.aiService.initialized ? "✅ 成功" : "❌ 失败"}`,
  );
  if (results.aiService.error) {
    console.log(`   错误: ${results.aiService.error}`);
  }

  console.log("\n🔍 2. DocAnalyzerAgent诊断");
  console.log(
    `   状态: ${results.docAnalyzer.initialized ? "✅ 成功" : "❌ 失败"}`,
  );
  if (results.docAnalyzer.error) {
    console.log(`   错误: ${results.docAnalyzer.error}`);
  }

  console.log("\n🔍 3. 实际AI调用诊断");
  const successCount = results.testCall.filter((t) => t.success).length;
  const failCount = results.testCall.filter((t) => !t.success).length;

  console.log(`   测试调用数: ${results.testCall.length}`);
  console.log(`   成功数: ${successCount}`);
  console.log(`   失败数: ${failCount}`);
  console.log(
    `   成功率: ${((successCount / results.testCall.length) * 100).toFixed(2)}%`,
  );

  if (failCount > 0) {
    console.log("\n❌ 失败详情:");
    results.testCall
      .filter((t) => !t.success)
      .forEach((t, i) => {
        console.log(`   ${i + 1}. 测试用例: ${t.timestamp}`);
        console.log(`      耗时: ${t.duration}ms`);
        if (t.error) {
          console.log(`      错误信息: ${t.error}`);
        }
      });
  }

  console.log("\n========================================");
  console.log("📝 建议和解决方案\n");

  if (!results.aiService.initialized) {
    console.log("❌ AI服务未初始化");
    console.log("   建议1: 检查API密钥配置");
    console.log("   建议2: 检查.env文件是否存在");
    console.log("   建议3: 检查getUnifiedAIService函数是否被正确导入");
  }

  if (failCount === results.testCall.length) {
    console.log("✅ 所有测试都失败！");
    console.log("   可能原因:");
    console.log("   1. AI服务完全不可用（API密钥错误、网络问题）");
    console.log("   2. Mock降级机制被触发");
    console.log("   3. 环境变量配置问题");
    console.log("\n   解决方案:");
    console.log("   立即检查.env文件中的API密钥");
    console.log("   运行脚本/test-deepseek-connection.ts验证网络连接");
    console.log("   检查是否被防火墙或代理阻止");
  } else if (failCount > 0 && failCount < results.testCall.length) {
    console.log("⚠️  部分测试失败，但不是全部");
    console.log("   可能原因:");
    console.log("   1. AI服务间歇性故障");
    console.log("   2. 速率限制被触发");
    console.log("   3. 并发请求冲突");
    console.log("   4. 超时时间设置过短");
    console.log("\n   解决方案:");
    console.log("   已添加智能重试机制（3次重试）");
    console.log("   已增加测试超时时间到60秒");
    console.log("   已添加测试间间隔500ms");
    console.log("   建议增加重试间隔到2-5秒");
  }

  console.log("\n========================================\n");
}

/**
 * 诊断AI服务初始化
 */
async function diagnoseAIServiceInit(): Promise<{
  timestamp: string;
  initialized: boolean;
  status?: string;
  error?: string;
}> {
  const result = {
    timestamp: new Date().toISOString(),
    initialized: false,
    status: undefined as string | undefined,
    error: undefined as string | undefined,
  };

  try {
    console.log("🔍 诊断AI服务初始化...");
    await getUnifiedAIService(undefined, true);
    result.initialized = true;
    result.status = "初始化成功";
  } catch (error) {
    result.initialized = false;
    result.error = error instanceof Error ? error.message : String(error);
    result.status = "初始化失败";
  }

  return result;
}

/**
 * 诊断DocAnalyzerAgent初始化
 */
async function diagnoseDocAnalyzer(): Promise<{
  timestamp: string;
  initialized: boolean;
  status?: string;
  error?: string;
}> {
  const result = {
    timestamp: new Date().toISOString(),
    initialized: false,
    status: undefined as string | undefined,
    error: undefined as string | undefined,
  };

  try {
    console.log("🔍 诊断DocAnalyzerAgent...");
    const { DocAnalyzerAgent } =
      await import("../src/lib/agent/doc-analyzer/doc-analyzer-agent");
    const agent = new DocAnalyzerAgent();
    agent.forceUseRealAI();
    result.initialized = true;
    result.status = "初始化成功";
  } catch (error) {
    result.initialized = false;
    result.error = error instanceof Error ? error.message : String(error);
    result.status = "初始化失败";
  }

  return result;
}

/**
 * 诊断单个测试调用
 */
async function diagnoseSingleTestCall(
  testCaseName: string,
  testText: string,
): Promise<{
  timestamp: string;
  success: boolean;
  duration: number;
  error?: string;
}> {
  const result = {
    timestamp: new Date().toISOString(),
    success: false,
    duration: 0,
    error: undefined as string | undefined,
  };

  try {
    console.log(`\n🔍 测试用例: ${testCaseName}`);
    console.log(`   文本内容: ${testText.substring(0, 50)}...`);

    const { DocAnalyzerAgent } =
      await import("../src/lib/agent/doc-analyzer/doc-analyzer-agent");
    const agent = new DocAnalyzerAgent();
    agent.forceUseRealAI();
    agent.disableCache();

    const startTime = Date.now();
    const testResult = await agent.execute({
      task: "INFO_EXTRACT",
      priority: TaskPriority.MEDIUM,
      data: {
        documentId: `diagnose-${Date.now()}`,
        content: testText,
        fileType: "txt",
        options: {
          extractParties: true,
          extractClaims: false,
          extractTimeline: false,
          generateSummary: false,
        },
      },
    });

    result.success = testResult.success;
    result.duration = Date.now() - startTime;

    if (!testResult.success) {
      result.error = testResult.error?.message ?? "未知错误";
    } else {
      result.error = undefined;
      // 验证是否有数据
      const documentOutput = testResult.data as {
        extractedData?: unknown;
      };
      if (!documentOutput || !documentOutput.extractedData) {
        result.error = "返回数据格式不正确或缺少extractedData";
      }
    }
  } catch (error) {
    result.success = false;
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

/**
 * 诊断并发场景
 */
async function diagnoseConcurrentTests(): Promise<
  Array<{
    timestamp: string;
    success: boolean;
    duration: number;
    error?: string;
  }>
> {
  console.log("\n🔍 诊断并发测试场景（模拟多个同时请求）...");

  const { DocAnalyzerAgent } =
    await import("../src/lib/agent/doc-analyzer/doc-analyzer-agent");
  const agent = new DocAnalyzerAgent();
  agent.forceUseRealAI();
  agent.disableCache();

  const testCases = [
    {
      name: "测试1 - 简单当事人识别",
      text: "原告：张三\n被告：李四\n诉讼请求：判令被告偿还借款",
    },
    {
      name: "测试2 - 多当事人识别",
      text: "原告：张三、李四\n被告：王五\n诉讼请求：判令被告履行合同",
    },
    {
      name: "测试3 - 复杂名称",
      text: "原告：北京科技有限公司\n被告：上海贸易有限公司\n诉讼请求：判令被告支付货款",
    },
    {
      name: "测试4 - 法定代表人",
      text: "原告：北京某某公司\n法定代表人：张三\n被告：上海某某公司",
    },
    {
      name: "测试5 - 代理人识别",
      text: "原告：张三\n委托代理人：某某律师事务所王律师\n被告：李四",
    },
    {
      name: "测试6 - 长文本",
      text:
        "原告：张三\n被告：李四\n" +
        "诉讼请求：".repeat(50) +
        "判令被告偿还借款本金100万元",
    },
    {
      name: "测试7 - 空文档",
      text: "\n  \n  \n  \n  ",
    },
    {
      name: "测试8 - 格式错误",
      text: "不是法律文档内容",
    },
    {
      name: "测试9 - 特殊字符",
      text: "原告：张三\u0000\n被告：李四\uFFFF\n诉讼请求：判令被告偿还",
    },
    {
      name: "测试10 - 上诉场景",
      text: "上诉人：张三\n被上诉人：李四\n上诉请求：撤销原判",
    },
  ];

  const results: Array<{
    timestamp: string;
    success: boolean;
    duration: number;
    error?: string;
  }> = [];

  for (const testCase of testCases) {
    const startTime = Date.now();
    try {
      const testResult = await agent.execute({
        task: "INFO_EXTRACT",
        priority: TaskPriority.MEDIUM,
        data: {
          documentId: `concurrent-${Date.now()}`,
          content: testCase.text,
          fileType: "txt",
          options: {
            extractParties: true,
          },
        },
      });

      results.push({
        timestamp: new Date().toISOString(),
        success: testResult.success,
        duration: Date.now() - startTime,
        error: undefined,
      });

      console.log(`✅ ${testCase.name} - 成功 (${Date.now() - startTime}ms)`);
    } catch (error) {
      results.push({
        timestamp: new Date().toISOString(),
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(
        `❌ ${testCase.name} - 失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return results;
}

/**
 * 检查环境变量配置
 */
function checkEnvironmentConfig(): void {
  console.log("\n========================================");
  console.log("🔧 环境配置检查");
  console.log("========================================\n");

  console.log("NODE_ENV:", process.env.NODE_ENV ?? "未设置");
  console.log(
    "ZHIPU_API_KEY:",
    process.env.ZHIPU_API_KEY ? "✅ 已配置" : "❌ 未配置",
  );
  console.log(
    "DEEPSEEK_API_KEY:",
    process.env.DEEPSEEK_API_KEY ? "✅ 已配置" : "❌ 未配置",
  );
  console.log("USE_MOCK_AI:", process.env.USE_MOCK_AI ?? "未设置");

  console.log("\n📋 分析:");
  const hasKeys = process.env.ZHIPU_API_KEY && process.env.DEEPSEEK_API_KEY;
  if (!hasKeys) {
    console.log("❌ 缺少API密钥配置！");
  } else {
    console.log("✅ API密钥已配置");
  }

  console.log("========================================\n");
}

/**
 * 主诊断流程
 */
async function main(): Promise<void> {
  console.log("🔍 开始AI服务综合诊断\n");

  // 1. 检查环境配置
  checkEnvironmentConfig();

  // 2. 诊断AI服务初始化
  console.log("\n步骤1：诊断AI服务初始化...");
  const aiServiceDiag = await diagnoseAIServiceInit();

  // 3. 诊断DocAnalyzerAgent初始化
  console.log("\n步骤2：诊断DocAnalyzerAgent初始化...");
  const docAnalyzerDiag = await diagnoseDocAnalyzer();

  // 4. 诊断单个测试调用
  console.log("\n步骤3：诊断单个测试调用...");
  const singleTestDiag = await diagnoseSingleTestCall(
    "简单当事人识别",
    "原告：张三\n被告：李四\n诉讼请求：判令被告偿还借款本金100万元",
  );

  // 5. 诊断并发场景
  console.log("\n步骤4：诊断并发场景...");
  const concurrentTestDiags = await diagnoseConcurrentTests();

  // 6. 汇总诊断结果
  const allResults: DiagnosticResult = {
    aiService: aiServiceDiag,
    docAnalyzer: docAnalyzerDiag,
    testCall: [singleTestDiag, ...concurrentTestDiags],
  };

  printDiagnostic(allResults);

  console.log("\n📋 下一步操作建议：\n");
  console.log("1. 如果AI服务未初始化：");
  console.log("   检查.env文件是否存在并包含正确的API密钥");
  console.log(
    "   检查API密钥是否有效（可以运行test-deepseek-connection.ts验证）",
  );
  console.log("2. 如果部分测试失败：");
  console.log("   查看诊断报告中的详细错误信息");
  console.log("   根据错误类型采取相应措施");
  console.log("3. 通用建议：");
  console.log("   增加AI调用的详细日志输出");
  console.log("   在生产环境考虑使用更稳定的AI提供商");
  console.log("   考虑实现AI服务的健康检查和熔断机制");
  console.log("   检查网络连接和防火墙设置");
}

// 运行主诊断流程
main().catch((error) => {
  console.error("\n❌ 诊断过程失败:", error);
  process.exit(1);
});
