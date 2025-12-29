/**
 * DocAnalyzer性能测试脚本
 * 测试各处理层的处理时间
 */

import { DocAnalyzerAgent } from "../src/lib/agent/doc-analyzer/doc-analyzer-agent";
import { FilterProcessor } from "../src/lib/agent/doc-analyzer/processors/filter-processor";
import { LegalRepresentativeFilter } from "../src/lib/agent/doc-analyzer/processors/legal-representative-filter";
import { AmountExtractor } from "../src/lib/agent/doc-analyzer/extractors/amount-extractor";
import type { Party } from "../src/lib/agent/doc-analyzer/core/types";

// =============================================================================
// 测试文档样本
// =============================================================================

const testDocuments = [
  {
    name: "民事起诉状-简单",
    content: `民事起诉状

原告：上海华诚科技有限公司
法定代表人：王明，男，1980年5月15日出生，汉族，住上海市浦东新区世纪大道100号

被告：北京长城贸易有限公司
法定代表人：李华，女，1982年8月20日出生，汉族，住北京市朝阳区建国路200号

诉讼请求：
1. 请求判令被告支付货款人民币1000000元；
2. 请求判令被告承担本案诉讼费用。

事实与理由：
原被告于2023年1月签订买卖合同，原告按约交付货物，被告未支付货款。

此致
上海市浦东新区人民法院

具状人：上海华诚科技有限公司
法定代表人：王明
2023年10月15日`,
  },
  {
    name: "民事起诉状-复杂",
    content: `民事起诉状

原告：张大伟，男，1988年7月12日出生，汉族，住上海市徐汇区淮海中路200号
原告：上海华诚科技有限公司
法定代表人：张大伟
被告：北京长城贸易有限公司
法定代表人：李华
被告：南京创新科技股份公司
法定代表人：刘芳
第三人：苏州协作企业集团
法定代表人：陈刚

诉讼请求：
1. 请求判令被告支付货款人民币500000元；
2. 请求判令被告支付违约金人民币50000元；
3. 请求判令被告承担本案诉讼费用。

事实与理由：
原被告于2023年1月签订买卖合同，合同约定货款为伍拾万元整。原告按约交付货物，被告未支付货款，构成违约。

此致
上海市浦东新区人民法院

具状人：张大伟
2023年10月15日`,
  },
];

// =============================================================================
// 性能测试函数
// =============================================================================

async function testFilterProcessor() {
  console.log("\n========================================");
  console.log("FilterProcessor性能测试");
  console.log("========================================");

  const filterProcessor = new FilterProcessor();
  const times: number[] = [];

  for (const doc of testDocuments) {
    const start = Date.now();
    await filterProcessor.process(doc.content);
    const time = Date.now() - start;
    times.push(time);
    console.log(`${doc.name}: ${time}ms`);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);

  console.log(`\n汇总:`);
  console.log(`  平均: ${avgTime.toFixed(2)}ms`);
  console.log(`  最大: ${maxTime}ms`);
  console.log(`  最小: ${minTime}ms`);
  console.log(`  目标: <10ms`);
  console.log(`  状态: ${avgTime < 10 ? "✅ 达标" : "❌ 未达标"}`);
}

async function testLegalRepFilter() {
  console.log("\n========================================");
  console.log("LegalRepresentativeFilter性能测试");
  console.log("========================================");

  const filter = new LegalRepresentativeFilter();
  const times: number[] = [];

  const testParties: Party[] = [
    {
      type: "plaintiff",
      name: "上海华诚科技有限公司",
      role: "原告",
      contact: "13900139000",
    },
    {
      type: "plaintiff",
      name: "王明",
      role: "法定代表人",
      contact: "13900139000",
    },
    {
      type: "defendant",
      name: "北京长城贸易有限公司",
      role: "被告",
      contact: "13800138000",
    },
    {
      type: "defendant",
      name: "李华",
      role: "法定代表人",
      contact: "13800138000",
    },
  ];

  for (const doc of testDocuments) {
    const start = Date.now();
    await filter.filter(doc.content, testParties);
    const time = Date.now() - start;
    times.push(time);
    console.log(`${doc.name}: ${time}ms`);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);

  console.log(`\n汇总:`);
  console.log(`  平均: ${avgTime.toFixed(2)}ms`);
  console.log(`  最大: ${maxTime}ms`);
  console.log(`  最小: ${minTime}ms`);
  console.log(`  目标: <5ms`);
  console.log(`  状态: ${avgTime < 5 ? "✅ 达标" : "❌ 未达标"}`);
}

async function testAmountExtractor() {
  console.log("\n========================================");
  console.log("AmountExtractor性能测试");
  console.log("========================================");

  const extractor = new AmountExtractor();
  const times: number[] = [];

  for (const doc of testDocuments) {
    const start = Date.now();
    await extractor.extractFromText(doc.content);
    const time = Date.now() - start;
    times.push(time);
    console.log(`${doc.name}: ${time}ms`);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);

  console.log(`\n汇总:`);
  console.log(`  平均: ${avgTime.toFixed(2)}ms`);
  console.log(`  最大: ${maxTime}ms`);
  console.log(`  最小: ${minTime}ms`);
  console.log(`  目标: <20ms`);
  console.log(`  状态: ${avgTime < 20 ? "✅ 达标" : "❌ 未达标"}`);
}

// =============================================================================
// 运行所有测试
// =============================================================================

async function runAllTests(): Promise<void> {
  console.log("========================================");
  console.log("DocAnalyzer性能测试");
  console.log("========================================");
  console.log(`测试文档数量: ${testDocuments.length}`);

  await testFilterProcessor();
  await testLegalRepFilter();
  await testAmountExtractor();

  console.log("\n========================================");
  console.log("测试完成");
  console.log("========================================");
}

// 运行测试
runAllTests().catch(console.error);
