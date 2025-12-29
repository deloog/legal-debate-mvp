/**
 * 法定代表人过滤功能评估脚本
 *
 * 用途：
 * - 评估法定代表人过滤的准确性
 * - 统计误过滤率和漏过滤率
 * - 生成详细的评估报告
 */

import fs from "fs";
import path from "path";
import { DocAnalyzerAgent } from "../src/lib/agent/doc-analyzer/doc-analyzer-agent";
import type {
  DocumentAnalysisInput,
  Party,
} from "../src/lib/agent/doc-analyzer/core/types";
import { TaskPriority } from "../src/types/agent";

// =============================================================================
// 类型定义
// =============================================================================

interface TestCase {
  id: number;
  name: string;
  content: string;
  expectedParties: {
    shouldKeep: string[];
    shouldFilter: string[];
  };
}

interface TestResult {
  caseId: number;
  caseName: string;
  expectedParties: {
    shouldKeep: string[];
    shouldFilter: string[];
  };
  actualParties: Party[];
  correctKept: string[];
  incorrectFiltered: string[];
  correctFiltered: string[];
  incorrectKept: string[];
  accuracy: number;
}

interface EvaluationSummary {
  totalCases: number;
  totalParties: number;
  correctKept: number;
  correctFiltered: number;
  incorrectFiltered: number;
  incorrectKept: number;
  overallAccuracy: number;
  filterAccuracy: number;
  keepAccuracy: number;
  results: TestResult[];
}

// =============================================================================
// 测试用例定义
// =============================================================================

const testCases: TestCase[] = [
  {
    id: 1,
    name: "标准法定代表人表达",
    content: `民事起诉状

原告：上海华诚科技有限公司
法定代表人：王明，男，1980年5月15日出生，汉族，住上海市浦东新区世纪大道100号，联系电话：13900139000

被告：北京长城贸易有限公司
法定代表人：李华，女，1982年8月20日出生，汉族，住北京市朝阳区建国路200号，联系电话：13800138000

诉讼请求：
1. 请求判令被告支付货款人民币1,000,000元；
2. 请求判令被告承担本案诉讼费用。

事实与理由：
原被告于2023年1月签订买卖合同，原告按约交付货物，被告未支付货款。

此致
上海市浦东新区人民法院

具状人：上海华诚科技有限公司
法定代表人：王明
2023年10月15日`,
    expectedParties: {
      shouldKeep: ["上海华诚科技有限公司", "北京长城贸易有限公司"],
      shouldFilter: ["王明", "李华"],
    },
  },
  {
    id: 2,
    name: "法定代表（简称）",
    content: `民事起诉状

原告：杭州梦想软件有限公司
法定代表：张伟，男，1978年3月10日出生，汉族，住杭州市西湖区文三路50号，联系电话：13700137000

被告：南京创新科技股份公司
法定代表人：刘芳，女，1985年11月5日出生，汉族，住南京市鼓楼区中山路80号，联系电话：13600136000

第三人：苏州协作企业集团
法定代表人：陈刚，男，1981年7月25日出生，汉族，住苏州市工业园区金鸡湖大道120号，联系电话：13500135000

诉讼请求：
1. 请求判令被告支付服务费人民币500,000元；
2. 请求判令被告支付违约金50,000元；
3. 请求判令第三人承担连带责任。

事实与理由：
原告为被告提供软件开发服务，第三人提供担保。

此致
杭州市西湖区人民法院

具状人：杭州梦想软件有限公司
法定代表：张伟
2023年9月20日`,
    expectedParties: {
      shouldKeep: [
        "杭州梦想软件有限公司",
        "南京创新科技股份公司",
        "苏州协作企业集团",
      ],
      shouldFilter: ["张伟", "刘芳", "陈刚"],
    },
  },
  {
    id: 3,
    name: "法人代表（另一种表达）",
    content: `民事起诉状

原告：深圳天际网络技术有限公司
法人代表：赵云，男，1983年6月18日出生，汉族，住深圳市南山区科技园南区科苑路88号，联系电话：13400134000

被告：广州星辰电子商务有限公司
法定代表人：孙丽，女，1984年9月22日出生，汉族，住广州市天河区珠江新城花城大道66号，联系电话：13300133000

诉讼请求：
1. 请求判令被告赔偿损失人民币800,000元；
2. 请求判令被告赔礼道歉。

事实与理由：
被告盗用原告商业秘密，造成经济损失。

此致
深圳市南山区人民法院

具状人：深圳天际网络技术有限公司
法人代表：赵云
2023年11月1日`,
    expectedParties: {
      shouldKeep: ["深圳天际网络技术有限公司", "广州星辰电子商务有限公司"],
      shouldFilter: ["赵云", "孙丽"],
    },
  },
  {
    id: 4,
    name: "多个公司的法定代表人",
    content: `民事起诉状

原告：北京华信投资管理有限公司
法定代表人：周涛，男，1975年12月30日出生，汉族，住北京市朝阳区光华路16号，联系电话：13200132000

被告：上海金鼎实业发展股份有限公司
法定代表人：吴强，男，1979年4月12日出生，汉族，住上海市黄浦区南京东路300号，联系电话：13100131000

第三人：广州信达控股集团有限公司
法定代表人：郑敏，女，1980年2月28日出生，汉族，住广州市天河区天河北路580号，联系电话：13000130000

诉讼请求：
1. 请求判令被告支付股权转让款人民币2,000,000元；
2. 请求判令被告支付利息100,000元；
3. 请求判令被告承担本案诉讼费用。

事实与理由：
原告与被告签订股权转让协议，被告未按约支付款项。

此致
北京市朝阳区人民法院

具状人：北京华信投资管理有限公司
法定代表人：周涛
2023年8月5日`,
    expectedParties: {
      shouldKeep: [
        "北京华信投资管理有限公司",
        "上海金鼎实业发展股份有限公司",
        "广州信达控股集团有限公司",
      ],
      shouldFilter: ["周涛", "吴强", "郑敏"],
    },
  },
  {
    id: 5,
    name: "法定代表人同时也是独立当事人",
    content: `民事起诉状

原告：张大伟，男，1988年7月12日出生，汉族，住上海市徐汇区淮海中路200号，联系电话：18700187000，职业：企业总经理

原告：上海华诚科技有限公司
法定代表人：张大伟，男，1988年7月12日出生，汉族，住上海市徐汇区淮海中路200号，联系电话：18700187000

被告：北京长城贸易有限公司
法定代表人：李华，女，1982年8月20日出生，汉族，住北京市朝阳区建国路200号，联系电话：13800138000

诉讼请求：
1. 请求判令被告支付货款人民币800,000元；
2. 请求判令被告承担本案诉讼费用。

事实与理由：
张大伟既是原告个人，也是原告公司的法定代表人，被告拖欠货款。

此致
上海市徐汇区人民法院

具状人：张大伟
2023年10月30日`,
    expectedParties: {
      shouldKeep: ["张大伟", "上海华诚科技有限公司", "北京长城贸易有限公司"],
      shouldFilter: ["李华"],
    },
  },
  {
    id: 6,
    name: "只有法定代表人，没有详细公司信息",
    content: `民事起诉状

原告：某某科技有限公司
法定代表人：王明

被告：某某贸易有限公司
法定代表人：李华

诉讼请求：
1. 请求判令被告支付货款人民币500,000元。

此致
某某区人民法院

具状人：某某科技有限公司
2023年12月1日`,
    expectedParties: {
      shouldKeep: ["某某科技有限公司", "某某贸易有限公司"],
      shouldFilter: ["王明", "李华"],
    },
  },
  {
    id: 7,
    name: "公司名称和法定代表人混在一起",
    content: `民事起诉状

原告：上海华诚科技有限公司（法定代表人：王明，身份证号：310101198005150001）

被告：北京长城贸易有限公司（法定代表人：李华，身份证号：110101198208200002）

诉讼请求：
1. 请求判令被告支付货款人民币1,500,000元；
2. 请求判令被告承担诉讼费用。

此致
上海市浦东新区人民法院

具状人：上海华诚科技有限公司
2023年11月15日`,
    expectedParties: {
      shouldKeep: ["上海华诚科技有限公司", "北京长城贸易有限公司"],
      shouldFilter: ["王明", "李华"],
    },
  },
  {
    id: 8,
    name: "法定代表人的多种写法",
    content: `民事起诉状

原告：杭州梦想软件有限公司
法定代表人：张伟（身份证号：330101197803100001）

被告：南京创新科技股份公司
法定代表人：刘芳（身份证号：320101198511050002）

第三人：苏州协作企业集团
法定代表人：陈刚，男，1981年7月25日出生，汉族，住苏州市工业园区金鸡湖大道120号，联系电话：13500135000

诉讼请求：
1. 请求判令被告支付服务费人民币750,000元；
2. 请求判令第三人承担连带责任。

此致
杭州市西湖区人民法院

具状人：杭州梦想软件有限公司
法定代表：张伟
2023年10月25日`,
    expectedParties: {
      shouldKeep: [
        "杭州梦想软件有限公司",
        "南京创新科技股份公司",
        "苏州协作企业集团",
      ],
      shouldFilter: ["张伟", "刘芳", "陈刚"],
    },
  },
  {
    id: 9,
    name: "自然人当事人（无公司）",
    content: `民事起诉状

原告：王小红，女，1990年3月8日出生，汉族，住上海市浦东新区陆家嘴环路100号，联系电话：18600186000，职业：财务主管

被告：张大伟，男，1988年7月12日出生，汉族，住上海市徐汇区淮海中路200号，联系电话：18700187000，职业：企业总经理

诉讼请求：
1. 请求判令被告支付欠款人民币100,000元；
2. 请求判令被告承担诉讼费用。

事实与理由：
被告向原告借款，到期未还。

此致
上海市浦东新区人民法院

具状人：王小红
2023年9月10日`,
    expectedParties: {
      shouldKeep: ["王小红", "张大伟"],
      shouldFilter: [],
    },
  },
  {
    id: 10,
    name: "混合公司和个人",
    content: `民事起诉状

原告：李明，男，1985年5月10日出生，汉族，住广州市天河区天河路200号，联系电话：15900159000

原告：深圳天际网络技术有限公司
法定代表人：赵云，男，1983年6月18日出生，汉族，住深圳市南山区科技园南区科苑路88号，联系电话：13400134000

被告：王华，男，1982年2月14日出生，汉族，住北京市朝阳区三里屯路50号，联系电话：15800158000

被告：广州星辰电子商务有限公司
法定代表人：孙丽，女，1984年9月22日出生，汉族，住广州市天河区珠江新城花城大道66号，联系电话：13300133000

诉讼请求：
1. 请求判令两被告共同支付货款人民币1,200,000元；
2. 请求判令两被告承担连带责任。

此致
深圳市南山区人民法院

具状人：李明
2023年11月20日`,
    expectedParties: {
      shouldKeep: [
        "李明",
        "深圳天际网络技术有限公司",
        "王华",
        "广州星辰电子商务有限公司",
      ],
      shouldFilter: ["赵云", "孙丽"],
    },
  },
];

// =============================================================================
// 评估逻辑
// =============================================================================

/**
 * 评估单个测试用例
 */
async function evaluateTestCase(
  testCase: TestCase,
  agent: DocAnalyzerAgent,
): Promise<TestResult> {
  const input: DocumentAnalysisInput = {
    documentId: `test-case-${testCase.id}`,
    filePath: "",
    fileType: "TXT",
    content: testCase.content,
  };

  try {
    const startTime = Date.now();
    const result = await agent.execute({
      task: "DOCUMENT_ANALYZE",
      taskType: "DOC_ANALYZER",
      data: input,
      priority: TaskPriority.MEDIUM,
    });
    const processingTime = Date.now() - startTime;

    // 调试输出
    const dataStr = result.data
      ? JSON.stringify(result.data).substring(0, 800)
      : "undefined";
    console.log("Debug result structure:", {
      success: result.success,
      hasData: !!result.data,
      dataType: typeof result.data,
      extractedData: result.data
        ? (result.data as any).extractedData
        : undefined,
      parties: result.data
        ? (result.data as any).extractedData?.parties
        : undefined,
      dataStr,
    });

    // result.data是DocumentAnalysisOutput，包含extractedData
    const actualParties = (result.data as any)?.extractedData?.parties || [];
    const actualPartyNames = actualParties.map((p) => p.name);

    // 检查正确保留的当事人
    const correctKept = testCase.expectedParties.shouldKeep.filter((name) =>
      actualPartyNames.includes(name),
    );

    // 检查错误过滤的当事人（应该保留但被过滤）
    const incorrectFiltered = testCase.expectedParties.shouldKeep.filter(
      (name) => !actualPartyNames.includes(name),
    );

    // 检查正确过滤的当事人
    const correctFiltered = testCase.expectedParties.shouldFilter.filter(
      (name) => !actualPartyNames.includes(name),
    );

    // 检查错误保留的当事人（应该过滤但被保留）
    const incorrectKept = testCase.expectedParties.shouldFilter.filter((name) =>
      actualPartyNames.includes(name),
    );

    const totalExpected =
      testCase.expectedParties.shouldKeep.length +
      testCase.expectedParties.shouldFilter.length;
    const correct = correctKept.length + correctFiltered.length;
    const accuracy = totalExpected > 0 ? (correct / totalExpected) * 100 : 0;

    console.log(`\n测试案例 ${testCase.id}: ${testCase.name}`);
    console.log(`处理时间: ${processingTime}ms`);
    console.log(`识别当事人: ${actualPartyNames.join(", ")}`);
    console.log(`正确保留: ${correctKept.join(", ")}`);
    console.log(`错误过滤: ${incorrectFiltered.join(", ")}`);
    console.log(`正确过滤: ${correctFiltered.join(", ")}`);
    console.log(`错误保留: ${incorrectKept.join(", ")}`);
    console.log(`准确率: ${accuracy.toFixed(2)}%`);

    return {
      caseId: testCase.id,
      caseName: testCase.name,
      expectedParties: testCase.expectedParties,
      actualParties,
      correctKept,
      incorrectFiltered,
      correctFiltered,
      incorrectKept,
      accuracy,
    };
  } catch (error) {
    console.error(`\n测试案例 ${testCase.id} 失败:`, error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "Unknown",
      stack: error instanceof Error ? error.stack : "",
      cause: error instanceof Error ? error.cause : undefined,
      toString: String(error),
    });
    // 打印更详细的堆栈信息
    if (error instanceof Error) {
      console.error("Full stack:", error.stack);
    }
    return {
      caseId: testCase.id,
      caseName: testCase.name,
      expectedParties: testCase.expectedParties,
      actualParties: [],
      correctKept: [],
      incorrectFiltered: testCase.expectedParties.shouldKeep,
      correctFiltered: [],
      incorrectKept: [],
      accuracy: 0,
    };
  }
}

/**
 * 运行所有测试用例
 */
async function runEvaluation(): Promise<EvaluationSummary> {
  console.log("========================================");
  console.log("法定代表人过滤功能评估");
  console.log("========================================");
  console.log(`测试用例数量: ${testCases.length}`);

  const agent = new DocAnalyzerAgent();
  const results: TestResult[] = [];

  // 只运行第一个测试案例进行调试
  for (let i = 0; i < 1; i++) {
    const testCase = testCases[i];
    console.log(`\n开始处理测试案例 ${testCase.id}...`);
    const result = await evaluateTestCase(testCase, agent);
    results.push(result);
  }

  // 统计汇总
  const totalCases = results.length;
  const totalParties = results.reduce(
    (sum, r) =>
      sum +
      r.expectedParties.shouldKeep.length +
      r.expectedParties.shouldFilter.length,
    0,
  );
  const correctKept = results.reduce((sum, r) => sum + r.correctKept.length, 0);
  const correctFiltered = results.reduce(
    (sum, r) => sum + r.correctFiltered.length,
    0,
  );
  const incorrectFiltered = results.reduce(
    (sum, r) => sum + r.incorrectFiltered.length,
    0,
  );
  const incorrectKept = results.reduce(
    (sum, r) => sum + r.incorrectKept.length,
    0,
  );

  const overallAccuracy =
    totalParties > 0
      ? ((correctKept + correctFiltered) / totalParties) * 100
      : 0;
  const keepAccuracy =
    correctKept + incorrectKept > 0
      ? (correctKept / (correctKept + incorrectKept)) * 100
      : 0;
  const filterAccuracy =
    correctFiltered + incorrectFiltered > 0
      ? (correctFiltered / (correctFiltered + incorrectFiltered)) * 100
      : 0;

  const summary: EvaluationSummary = {
    totalCases,
    totalParties,
    correctKept,
    correctFiltered,
    incorrectFiltered,
    incorrectKept,
    overallAccuracy,
    filterAccuracy,
    keepAccuracy,
    results,
  };

  return summary;
}

/**
 * 生成评估报告
 */
function generateReport(summary: EvaluationSummary): string {
  const report = `# 法定代表人过滤功能评估报告

## 评估概要

- **评估时间**: ${new Date().toLocaleString("zh-CN")}
- **测试用例数量**: ${summary.totalCases}
- **总当事人数量**: ${summary.totalParties}
- **整体准确率**: ${summary.overallAccuracy.toFixed(2)}%
- **保留准确率**: ${summary.keepAccuracy.toFixed(2)}%
- **过滤准确率**: ${summary.filterAccuracy.toFixed(2)}%

## 详细统计

| 指标 | 数量 | 占比 |
|------|------|------|
| 正确保留的当事人 | ${summary.correctKept} | ${((summary.correctKept / summary.totalParties) * 100).toFixed(2)}% |
| 正确过滤的法定代表人 | ${summary.correctFiltered} | ${((summary.correctFiltered / summary.totalParties) * 100).toFixed(2)}% |
| 错误过滤的当事人 | ${summary.incorrectFiltered} | ${((summary.incorrectFiltered / summary.totalParties) * 100).toFixed(2)}% |
| 错误保留的法定代表人 | ${summary.incorrectKept} | ${((summary.incorrectKept / summary.totalParties) * 100).toFixed(2)}% |

## 各案例详细结果

${summary.results
  .map(
    (r) => `
### 案例 ${r.caseId}: ${r.caseName}

**准确率**: ${r.accuracy.toFixed(2)}%

**预期保留**: ${r.expectedParties.shouldKeep.join(", ")}
**预期过滤**: ${r.expectedParties.shouldFilter.join(", ")}
**实际识别**: ${r.actualParties.map((p) => p.name).join(", ")}

**正确保留**: ${r.correctKept.join(", ") || "无"}
**错误过滤**: ${r.incorrectFiltered.join(", ") || "无"}
**正确过滤**: ${r.correctFiltered.join(", ") || "无"}
**错误保留**: ${r.incorrectKept.join(", ") || "无"}
`,
  )
  .join("---\n")}

## 评估结论

### 达标情况

- 目标准确率: >90%
- 实际准确率: ${summary.overallAccuracy.toFixed(2)}%
- 达标状态: ${summary.overallAccuracy >= 90 ? "✅ 达标" : "❌ 未达标"}

### 问题分析

${
  summary.incorrectFiltered > 0
    ? `
#### 错误过滤问题
错误过滤了 ${summary.incorrectFiltered} 个应该保留的当事人：
${summary.results
  .filter((r) => r.incorrectFiltered.length > 0)
  .map((r) => `- 案例${r.caseId}: ${r.incorrectFiltered.join(", ")}`)
  .join("\n")}

**建议**:
- 检查是否过于严格地过滤了短名称当事人
- 增加当事人详细信息的权重（如地址、联系方式等）
- 优化公司名称识别逻辑
`
    : "✅ 无错误过滤问题"
}

${
  summary.incorrectKept > 0
    ? `
#### 错误保留问题
错误保留了 ${summary.incorrectKept} 个应该过滤的法定代表人：
${summary.results
  .filter((r) => r.incorrectKept.length > 0)
  .map((r) => `- 案例${r.caseId}: ${r.incorrectKept.join(", ")}`)
  .join("\n")}

**建议**:
- 增强法定代表人识别规则
- 检查上下文，识别"法定代表人："后面的名称
- 优化短名称法定代表人的过滤逻辑
`
    : "✅ 无错误保留问题"
}

### 优化建议

1. **如果保留准确率较低**:
   - 增加当事人详细信息的权重
   - 优化公司名称识别模式
   - 减少对短名称当事人的过滤

2. **如果过滤准确率较低**:
   - 增强法定代表人关键词识别（法定代表人、法定代表、法人代表等）
   - 添加上下文分析（检查名称前是否有关键词）
   - 优化法定代表人的置信度评分

3. **如果整体准确率未达标**:
   - 分析具体失败案例
   - 调整过滤规则的参数
   - 考虑添加机器学习辅助判断

---

_报告生成时间: ${new Date().toLocaleString("zh-CN")}_
`;

  return report;
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log("开始评估...\n");
    const summary = await runEvaluation();
    const report = generateReport(summary);

    // 保存报告
    const reportPath = path.join(
      __dirname,
      "../docs/LEGAL_REPRESENTATIVE_FILTER_EVALUATION.md",
    );
    fs.writeFileSync(reportPath, report, "utf-8");
    console.log(`\n评估报告已保存至: ${reportPath}`);

    // 打印汇总
    console.log("\n========================================");
    console.log("评估汇总");
    console.log("========================================");
    console.log(`整体准确率: ${summary.overallAccuracy.toFixed(2)}%`);
    console.log(`保留准确率: ${summary.keepAccuracy.toFixed(2)}%`);
    console.log(`过滤准确率: ${summary.filterAccuracy.toFixed(2)}%`);
    console.log(`错误过滤: ${summary.incorrectFiltered} 个`);
    console.log(`错误保留: ${summary.incorrectKept} 个`);
    console.log(
      `达标状态: ${summary.overallAccuracy >= 90 ? "✅ 达标" : "❌ 未达标"}`,
    );
    console.log("========================================");

    process.exit(summary.overallAccuracy >= 90 ? 0 : 1);
  } catch (error) {
    console.error("评估失败:", error);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

export { runEvaluation, generateReport };
export type { TestResult, EvaluationSummary };
