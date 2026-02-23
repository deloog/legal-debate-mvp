/**
 * DocAnalyzer准确率指标评估脚本
 * 评估设计指标：当事人信息准确率≥98%、诉讼请求准确率≥95%、金额识别精度≥99%
 */

import { DocAnalyzerAgentAdapter } from '../src/lib/agent/doc-analyzer/adapter';
import type { AgentContext } from '../src/types/agent';

// =============================================================================
// 测试用例定义
// =============================================================================

interface TestCase {
  id: string;
  name: string;
  document: string;
  expected: {
    parties?: {
      plaintiffs: string[];
      defendants: string[];
      thirdParties?: string[];
    };
    claims?: string[];
    amounts?: number[];
  };
}

const testCases: TestCase[] = [
  {
    id: 'T001',
    name: '简单民事起诉状',
    document: `民事起诉状

原告：上海华诚科技有限公司
法定代表人：王明，男，1980年5月15日出生，汉族，住上海市浦东新区世纪大道100号

被告：北京长城贸易有限公司
法定代表人：李华，女，1982年8月20日出生，汉族，住北京市朝阳区建国路200号

诉讼请求：
1. 请求判令被告支付货款人民币100万元；
2. 请求判令被告承担本案诉讼费用。

事实与理由：
原被告于2023年1月签订买卖合同，原告按约交付货物，被告未支付货款。

此致
上海市浦东新区人民法院

具状人：上海华诚科技有限公司
法定代表人：王明
2023年10月15日`,
    expected: {
      parties: {
        plaintiffs: ['上海华诚科技有限公司'],
        defendants: ['北京长城贸易有限公司'],
      },
      claims: ['支付货款'],
      amounts: [1000000],
    },
  },
  {
    id: 'T002',
    name: '复杂诉讼请求',
    document: `民事起诉状

原告：张大伟，男，1988年7月12日出生，汉族，住上海市徐汇区淮海中路200号
被告：李芳，女，1985年3月8日出生，汉族，住上海市黄浦区南京路50号

诉讼请求：
1. 请求判令被告偿还借款本金人民币伍拾万元整；
2. 请求判令被告支付利息人民币5万元；
3. 请求判令被告支付违约金人民币2万元；
4. 请求判令被告承担本案全部诉讼费用。

事实与理由：
被告向原告借款，至今未还。

此致
上海市徐汇区人民法院

具状人：张大伟
2023年11月20日`,
    expected: {
      parties: {
        plaintiffs: ['张大伟'],
        defendants: ['李芳'],
      },
      claims: ['偿还借款本金', '支付利息', '支付违约金'],
      amounts: [500000, 50000, 20000],
    },
  },
  {
    id: 'T003',
    name: '多个当事人',
    document: `民事起诉状

原告：上海华诚科技有限公司
原告：王明
被告：北京长城贸易有限公司
被告：南京创新科技股份公司
第三人：苏州协作企业集团

诉讼请求：
1. 请求判令被告支付货款人民币800000元；
2. 请求判令被告支付利息人民币40000元；
3. 请求判令被告承担本案诉讼费用。

事实与理由：
多方签订合同，发生纠纷。

此致
上海市浦东新区人民法院

具状人：上海华诚科技有限公司
2023年12月1日`,
    expected: {
      parties: {
        plaintiffs: ['上海华诚科技有限公司', '王明'],
        defendants: ['北京长城贸易有限公司', '南京创新科技股份公司'],
        thirdParties: ['苏州协作企业集团'],
      },
      claims: ['支付货款', '支付利息'],
      amounts: [800000, 40000],
    },
  },
  {
    id: 'T004',
    name: '大写金额',
    document: `民事起诉状

原告：张三
被告：李四

诉讼请求：
1. 请求判令被告赔偿损失人民币壹佰万元整；
2. 请求判令被告承担本案诉讼费用。

事实与理由：
因交通事故造成损失。

此致
上海市黄浦区人民法院

具状人：张三
2023年12月5日`,
    expected: {
      parties: {
        plaintiffs: ['张三'],
        defendants: ['李四'],
      },
      claims: ['赔偿损失'],
      amounts: [1000000],
    },
  },
  {
    id: 'T005',
    name: '混合金额格式',
    document: `民事起诉状

原告：A公司
被告：B公司

诉讼请求：
1. 请求判令被告支付货款200万元（贰佰万元整）；
2. 请求判令被告支付利息10万元；
3. 请求判令被告承担本案诉讼费用。

事实与理由：
合同纠纷。

此致
上海市浦东新区人民法院

具状人：A公司
2023年12月10日`,
    expected: {
      parties: {
        plaintiffs: ['A公司'],
        defendants: ['B公司'],
      },
      claims: ['支付货款', '支付利息'],
      amounts: [2000000, 100000],
    },
  },
];

// =============================================================================
// 准确率评估函数
// =============================================================================

interface AccuracyResult {
  total: number;
  correct: number;
  incorrect: number;
  details: Array<{
    testCaseId: string;
    testName: string;
    expected: any;
    actual: any;
    isCorrect: boolean;
    error?: string;
  }>;
}

class AccuracyEvaluator {
  private agent: DocAnalyzerAgentAdapter;
  private _results: Map<string, AccuracyResult> = new Map();

  constructor() {
    this.agent = new DocAnalyzerAgentAdapter();
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    await this.agent.initialize();
  }

  /**
   * 评估当事人信息准确率
   */
  async evaluatePartyAccuracy(): Promise<AccuracyResult> {
    console.log('\n========================================');
    console.log('评估当事人信息准确率');
    console.log('========================================\n');

    const result: AccuracyResult = {
      total: testCases.length,
      correct: 0,
      incorrect: 0,
      details: [],
    };

    for (const testCase of testCases) {
      if (!testCase.expected.parties) continue;

      try {
        const context: AgentContext = {
          task: 'document_analysis' as any,
          priority: 'medium' as any,
          data: {
            documentId: testCase.id,
            filePath: `${testCase.id}.txt`,
            fileType: 'TXT',
            content: testCase.document,
          },
        };
        const executeResult = await this.agent.execute(context);

        if (!executeResult.success || !executeResult.data) {
          throw new Error(executeResult.error?.message || '执行失败');
        }

        const analysisResult = executeResult.data;

        // 提取实际当事人
        const actualPlaintiffs = analysisResult.extractedData.parties
          .filter(p => p.type === 'plaintiff')
          .map(p => p.name);
        const actualDefendants = analysisResult.extractedData.parties
          .filter(p => p.type === 'defendant')
          .map(p => p.name);
        const actualThirdParties = analysisResult.extractedData.parties
          .filter(p => p.type === 'other')
          .map(p => p.name);

        // 检查是否匹配
        const plaintiffsMatch = this.arrayMatch(
          actualPlaintiffs,
          testCase.expected.parties.plaintiffs || []
        );
        const defendantsMatch = this.arrayMatch(
          actualDefendants,
          testCase.expected.parties.defendants || []
        );
        const thirdPartiesMatch = this.arrayMatch(
          actualThirdParties,
          testCase.expected.parties.thirdParties || []
        );

        const isCorrect =
          plaintiffsMatch && defendantsMatch && thirdPartiesMatch;

        if (isCorrect) {
          result.correct++;
          console.log(`✅ ${testCase.id}: ${testCase.name} - 当事人信息正确`);
        } else {
          result.incorrect++;
          console.log(`❌ ${testCase.id}: ${testCase.name} - 当事人信息错误`);
          console.log(
            `   原告: 期望=${testCase.expected.parties.plaintiffs?.join(', ')}, 实际=${actualPlaintiffs.join(', ')}`
          );
          console.log(
            `   被告: 期望=${testCase.expected.parties.defendants?.join(', ')}, 实际=${actualDefendants.join(', ')}`
          );
        }

        result.details.push({
          testCaseId: testCase.id,
          testName: testCase.name,
          expected: testCase.expected.parties,
          actual: {
            plaintiffs: actualPlaintiffs,
            defendants: actualDefendants,
            thirdParties: actualThirdParties,
          },
          isCorrect,
        });
      } catch (error) {
        result.incorrect++;
        console.log(`❌ ${testCase.id}: ${testCase.name} - 处理错误: ${error}`);
        result.details.push({
          testCaseId: testCase.id,
          testName: testCase.name,
          expected: testCase.expected.parties,
          actual: null,
          isCorrect: false,
          error: String(error),
        });
      }
    }

    return result;
  }

  /**
   * 评估诉讼请求准确率
   */
  async evaluateClaimAccuracy(): Promise<AccuracyResult> {
    console.log('\n========================================');
    console.log('评估诉讼请求准确率');
    console.log('========================================\n');

    const result: AccuracyResult = {
      total: 0,
      correct: 0,
      incorrect: 0,
      details: [],
    };

    // 统计有诉讼请求预期的测试用例
    const claimTestCases = testCases.filter(tc => tc.expected.claims);
    result.total = claimTestCases.length;

    for (const testCase of claimTestCases) {
      try {
        const context: AgentContext = {
          task: 'document_analysis' as any,
          priority: 'medium' as any,
          data: {
            documentId: testCase.id,
            filePath: `${testCase.id}.txt`,
            fileType: 'TXT',
            content: testCase.document,
          },
        };
        const executeResult = await this.agent.execute(context);

        if (!executeResult.success || !executeResult.data) {
          throw new Error(executeResult.error?.message || '执行失败');
        }

        const analysisResult = executeResult.data;

        // 提取实际诉讼请求
        const actualClaims = analysisResult.extractedData.claims.map(
          c => c.content
        );

        // 检查是否匹配（至少包含预期的诉讼请求）
        const isCorrect = testCase.expected.claims!.every(expectedClaim =>
          actualClaims.some(actualClaim => actualClaim.includes(expectedClaim))
        );

        if (isCorrect) {
          result.correct++;
          console.log(`✅ ${testCase.id}: ${testCase.name} - 诉讼请求正确`);
        } else {
          result.incorrect++;
          console.log(`❌ ${testCase.id}: ${testCase.name} - 诉讼请求不完整`);
          console.log(`   期望: ${testCase.expected.claims?.join(', ')}`);
          console.log(`   实际: ${actualClaims.join(', ')}`);
        }

        result.details.push({
          testCaseId: testCase.id,
          testName: testCase.name,
          expected: testCase.expected.claims,
          actual: actualClaims,
          isCorrect,
        });
      } catch (error) {
        result.incorrect++;
        console.log(`❌ ${testCase.id}: ${testCase.name} - 处理错误: ${error}`);
        result.details.push({
          testCaseId: testCase.id,
          testName: testCase.name,
          expected: testCase.expected.claims,
          actual: null,
          isCorrect: false,
          error: String(error),
        });
      }
    }

    return result;
  }

  /**
   * 评估金额识别精度
   */
  async evaluateAmountAccuracy(): Promise<AccuracyResult> {
    console.log('\n========================================');
    console.log('评估金额识别精度');
    console.log('========================================\n');

    const result: AccuracyResult = {
      total: 0,
      correct: 0,
      incorrect: 0,
      details: [],
    };

    // 统计有金额预期的测试用例
    const amountTestCases = testCases.filter(tc => tc.expected.amounts);
    result.total = amountTestCases.length;

    for (const testCase of amountTestCases) {
      try {
        const context: AgentContext = {
          task: 'document_analysis' as any,
          priority: 'medium' as any,
          data: {
            documentId: testCase.id,
            filePath: `${testCase.id}.txt`,
            fileType: 'TXT',
            content: testCase.document,
          },
        };
        const executeResult = await this.agent.execute(context);

        if (!executeResult.success || !executeResult.data) {
          throw new Error(executeResult.error?.message || '执行失败');
        }

        const analysisResult = executeResult.data;

        // 提取实际金额
        const actualAmounts = analysisResult.extractedData.claims
          .filter(c => c.amount && c.amount > 0)
          .map(c => c.amount!);

        // 检查是否匹配
        const isCorrect = testCase.expected.amounts!.every(expectedAmount =>
          actualAmounts.includes(expectedAmount)
        );

        if (isCorrect) {
          result.correct++;
          console.log(`✅ ${testCase.id}: ${testCase.name} - 金额识别正确`);
        } else {
          result.incorrect++;
          console.log(`❌ ${testCase.id}: ${testCase.name} - 金额识别不完整`);
          console.log(`   期望: ${testCase.expected.amounts?.join(', ')}`);
          console.log(`   实际: ${actualAmounts.join(', ')}`);
        }

        result.details.push({
          testCaseId: testCase.id,
          testName: testCase.name,
          expected: testCase.expected.amounts,
          actual: actualAmounts,
          isCorrect,
        });
      } catch (error) {
        result.incorrect++;
        console.log(`❌ ${testCase.id}: ${testCase.name} - 处理错误: ${error}`);
        result.details.push({
          testCaseId: testCase.id,
          testName: testCase.name,
          expected: testCase.expected.amounts,
          actual: null,
          isCorrect: false,
          error: String(error),
        });
      }
    }

    return result;
  }

  /**
   * 数组匹配（忽略顺序）
   */
  private arrayMatch(arr1: string[], arr2: string[]): boolean {
    if (arr1.length !== arr2.length) return false;
    const set1 = new Set(arr1.map(s => s.trim()));
    const set2 = new Set(arr2.map(s => s.trim()));
    return [...set1].every(item => set2.has(item));
  }

  /**
   * 生成报告
   */
  generateReport(
    partyResult: AccuracyResult,
    claimResult: AccuracyResult,
    amountResult: AccuracyResult
  ): void {
    console.log('\n========================================');
    console.log('DocAnalyzer准确率评估报告');
    console.log('========================================\n');

    const partyAccuracy = (partyResult.correct / partyResult.total) * 100;
    const claimAccuracy = (claimResult.correct / claimResult.total) * 100;
    const amountAccuracy = (amountResult.correct / amountResult.total) * 100;

    // 设计指标
    const targets = {
      party: 98,
      claim: 95,
      amount: 99,
    };

    console.log('一、当事人信息准确率');
    console.log('-------------------');
    console.log(`目标: ≥${targets.party}%`);
    console.log(`实际: ${partyAccuracy.toFixed(1)}%`);
    console.log(`测试数: ${partyResult.total}`);
    console.log(`正确: ${partyResult.correct}`);
    console.log(`错误: ${partyResult.incorrect}`);
    console.log(
      `状态: ${partyAccuracy >= targets.party ? '✅ 达标' : '❌ 未达标'}\n`
    );

    console.log('二、诉讼请求准确率');
    console.log('-------------------');
    console.log(`目标: ≥${targets.claim}%`);
    console.log(`实际: ${claimAccuracy.toFixed(1)}%`);
    console.log(`测试数: ${claimResult.total}`);
    console.log(`正确: ${claimResult.correct}`);
    console.log(`错误: ${claimResult.incorrect}`);
    console.log(
      `状态: ${claimAccuracy >= targets.claim ? '✅ 达标' : '❌ 未达标'}\n`
    );

    console.log('三、金额识别精度');
    console.log('-------------------');
    console.log(`目标: ≥${targets.amount}%`);
    console.log(`实际: ${amountAccuracy.toFixed(1)}%`);
    console.log(`测试数: ${amountResult.total}`);
    console.log(`正确: ${amountResult.correct}`);
    console.log(`错误: ${amountResult.incorrect}`);
    console.log(
      `状态: ${amountAccuracy >= targets.amount ? '✅ 达标' : '❌ 未达标'}\n`
    );

    console.log('========================================');
    const allPassed =
      partyAccuracy >= targets.party &&
      claimAccuracy >= targets.claim &&
      amountAccuracy >= targets.amount;
    console.log(
      `总体状态: ${allPassed ? '✅ 所有设计指标均达成' : '❌ 部分设计指标未达成'}`
    );
    console.log('========================================\n');
  }
}

// =============================================================================
// 主函数
// =============================================================================

async function main(): Promise<void> {
  console.log('========================================');
  console.log('DocAnalyzer准确率评估');
  console.log('========================================\n');

  const evaluator = new AccuracyEvaluator();

  try {
    await evaluator.initialize();

    const partyResult = await evaluator.evaluatePartyAccuracy();
    const claimResult = await evaluator.evaluateClaimAccuracy();
    const amountResult = await evaluator.evaluateAmountAccuracy();

    evaluator.generateReport(partyResult, claimResult, amountResult);
  } catch (error) {
    console.error('评估失败:', error);
    process.exit(1);
  }
}

// 运行评估
main().catch(console.error);
