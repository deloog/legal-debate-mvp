#!/usr/bin/env node

/**
 * 文档解析优化效果测试脚本
 * 验证三阶递进策略（CoT增强+结构化约束+自我修正）的优化效果
 * 目标：当事人信息准确率≥98%，诉讼请求准确率≥95%，金额识别精度≥99%
 */

import { DocAnalyzerAgent } from '../src/lib/agent/doc-analyzer/doc-analyzer-agent';
import { AgentContext, TaskPriority } from '../src/types/agent';
import { LawsuitRequestClassifier } from '../src/lib/classification/lawsuit-request-classifier';
import { PrecisionAmountExtractor } from '../src/lib/extraction/amount-extractor-precision';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// =============================================================================
// 类型定义
// =============================================================================

interface ExtractedParty {
  type: 'plaintiff' | 'defendant' | 'other';
  name: string;
  role?: string;
  contact?: string;
  address?: string;
}

interface ExtractedClaim {
  type: string;
  content: string;
  amount?: number;
  evidence?: string[];
  legalBasis?: string;
}

interface ExpectedParties {
  plaintiffs: string[];
  defendants: string[];
  legalRepresentatives?: string[];
}

interface ExpectedClaims {
  types: string[];
  amounts: number[];
}

interface TestDocument {
  id: string;
  name: string;
  content: string;
  expectedParties?: {
    plaintiffs: string[];
    defendants: string[];
    legalRepresentatives?: string[];
  };
  expectedClaims?: {
    types: string[];
    amounts: number[];
  };
  expectedAmounts?: number[];
}

interface TestResult {
  documentId: string;
  documentName: string;
  partyAccuracy: number;
  claimAccuracy: number;
  amountAccuracy: number;
  overallAccuracy: number;
  processingTime: number;
  errors: string[];
  warnings: string[];
  improvements: string[];
}

interface OptimizationReport {
  totalDocuments: number;
  averagePartyAccuracy: number;
  averageClaimAccuracy: number;
  averageAmountAccuracy: number;
  averageOverallAccuracy: number;
  improvements: {
    partyAccuracy: string;
    claimAccuracy: string;
    amountAccuracy: string;
    overallPerformance: string;
  };
  detailedResults: TestResult[];
  recommendations: string[];
}

class OptimizationTester {
  private analyzer: DocAnalyzerAgent;
  private _claimClassifier: LawsuitRequestClassifier;
  private _amountExtractor: PrecisionAmountExtractor;

  constructor() {
    this.analyzer = new DocAnalyzerAgent();
    this._claimClassifier = new LawsuitRequestClassifier();
    this._amountExtractor = new PrecisionAmountExtractor();
  }

  /**
   * 运行优化效果测试
   */
  async runOptimizationTest(): Promise<OptimizationReport> {
    console.log('🚀 开始文档解析优化效果测试');
    console.log('================================================');

    // 加载测试文档
    const testDocuments = this.loadTestDocuments();
    console.log(`📄 加载了 ${testDocuments.length} 个测试文档`);

    const results: TestResult[] = [];

    for (const doc of testDocuments) {
      console.log(`\n🔍 测试文档: ${doc.name}`);
      const result = await this.testSingleDocument(doc);
      results.push(result);

      this.displayTestResult(result);
    }

    // 生成优化报告
    const report = this.generateOptimizationReport(results);
    this.displayOptimizationReport(report);

    return report;
  }

  /**
   * 加载测试文档
   */
  private loadTestDocuments(): TestDocument[] {
    const testDocs: TestDocument[] = [];

    try {
      // 测试文档1：复杂的民事纠纷
      const civilCasePath = join(
        process.cwd(),
        'test-data/legal-documents/test-variation-civil-case.txt'
      );
      const civilCaseContent = readFileSync(civilCasePath, 'utf-8');

      testDocs.push({
        id: 'civil-case-001',
        name: '复杂民事货款纠纷案',
        content: civilCaseContent,
        expectedParties: {
          plaintiffs: ['XX科技有限公司'],
          defendants: ['YY贸易有限公司'],
          legalRepresentatives: ['张三', '李四'],
        },
        expectedClaims: {
          types: [
            'PAY_PRINCIPAL',
            'PAY_INTEREST',
            'PAY_PENALTY',
            'LITIGATION_COST',
          ],
          amounts: [500000, 36666.67, 15000, 0],
        },
        expectedAmounts: [500000, 36666.67, 15000],
      });

      // 测试文档2：多被告案件
      testDocs.push({
        id: 'multi-defendant-001',
        name: '多被告借款纠纷案',
        content: `
          原告：王某某，男，汉族，1985年5月10日出生
          被告一：张某某，系XX公司法定代表人
          被告二：XX科技有限公司
          被告三：李某某，男，汉族，1980年8月15日出生
          
          诉讼请求：
          1. 判令三被告连带偿还原告借款本金壹佰万元整（1,000,000.00元）；
          2. 判令三被告支付自2023年1月1日起至实际清偿之日止的利息（按年利率6%计算）；
          3. 判令三被告承担本案全部诉讼费用。
        `,
        expectedParties: {
          plaintiffs: ['王某某'],
          defendants: ['张某某', 'XX科技有限公司', '李某某'],
          legalRepresentatives: ['张某某'],
        },
        expectedClaims: {
          types: ['PAY_PRINCIPAL', 'PAY_INTEREST', 'LITIGATION_COST'],
          amounts: [1000000, 0, 0],
        },
        expectedAmounts: [1000000],
      });

      // 测试文档3：法定代表人识别测试
      testDocs.push({
        id: 'legal-rep-001',
        name: '法定代表人识别测试案',
        content: `
          原告：AA商贸有限公司
          法定代表人：赵某某，该公司执行董事
          
          被告：BB建材有限公司
          法定代表人：钱某某，该公司总经理
          
          诉讼请求：
          1. 判令被告支付货款伍拾万元整及逾期付款违约金；
          2. 判令被告承担本案诉讼费用。
        `,
        expectedParties: {
          plaintiffs: ['AA商贸有限公司'],
          defendants: ['BB建材有限公司'],
          legalRepresentatives: ['赵某某', '钱某某'],
        },
        expectedClaims: {
          types: ['PAY_PRINCIPAL', 'PAY_PENALTY', 'LITIGATION_COST'],
          amounts: [500000, 0, 0],
        },
        expectedAmounts: [500000],
      });

      // 测试文档4：复合诉讼请求测试
      testDocs.push({
        id: 'compound-claims-001',
        name: '复合诉讼请求测试案',
        content: `
          原告：孙某某，女，汉族，1990年3月20日出生
          被告：周某某，男，汉族，1985年7月15日出生
          
          诉讼请求：
          1. 判令被告赔偿因违约造成的经济损失贰拾万元整并支付违约金伍万元整；
          2. 判令被告继续履行双方签订的房屋买卖合同；
          3. 本案诉讼费用由被告承担。
        `,
        expectedParties: {
          plaintiffs: ['孙某某'],
          defendants: ['周某某'],
        },
        expectedClaims: {
          types: [
            'PAY_DAMAGES',
            'PAY_PENALTY',
            'PERFORMANCE',
            'LITIGATION_COST',
          ],
          amounts: [200000, 50000, 0, 0],
        },
        expectedAmounts: [200000, 50000],
      });
    } catch (error) {
      console.error('❌ 加载测试文档失败:', error);
      process.exit(1);
    }

    return testDocs;
  }

  /**
   * 测试单个文档
   */
  private async testSingleDocument(doc: TestDocument): Promise<TestResult> {
    const startTime = Date.now();
    const result: TestResult = {
      documentId: doc.id,
      documentName: doc.name,
      partyAccuracy: 0,
      claimAccuracy: 0,
      amountAccuracy: 0,
      overallAccuracy: 0,
      processingTime: 0,
      errors: [],
      warnings: [],
      improvements: [],
    };

    try {
      // 使用优化后的分析器
      const context: AgentContext = {
        task: 'document_analysis',
        priority: TaskPriority.MEDIUM,
        data: {
          documentId: doc.id,
          filePath: '',
          fileType: 'TXT' as const,
          content: doc.content,
        },
        metadata: {},
      };

      const analysisResult = await this.analyzer.execute(context);
      const analysis = analysisResult.data as {
        extractedData?: {
          parties?: ExtractedParty[];
          claims?: ExtractedClaim[];
        };
      };

      // 评估当事人信息准确率
      if (doc.expectedParties) {
        result.partyAccuracy = this.evaluatePartyAccuracy(
          analysis.extractedData?.parties || [],
          doc.expectedParties
        );
      }

      // 评估诉讼请求准确率
      if (doc.expectedClaims) {
        result.claimAccuracy = this.evaluateClaimAccuracy(
          analysis.extractedData?.claims || [],
          doc.expectedClaims,
          result
        );
      }

      // 评估金额识别精度
      if (doc.expectedAmounts) {
        result.amountAccuracy = this.evaluateAmountAccuracy(
          analysis.extractedData?.claims || [],
          doc.expectedAmounts,
          result
        );
      }

      // 计算整体准确率
      result.overallAccuracy =
        (result.partyAccuracy + result.claimAccuracy + result.amountAccuracy) /
        3;

      // 记录改进效果
      if (result.partyAccuracy >= 98) {
        result.improvements.push('当事人信息准确率达到≥98%目标');
      }
      if (result.claimAccuracy >= 95) {
        result.improvements.push('诉讼请求准确率达到≥95%目标');
      }
      if (result.amountAccuracy >= 99) {
        result.improvements.push('金额识别精度达到≥99%目标');
      }
    } catch (error) {
      result.errors.push(`分析过程中发生错误: ${(error as Error).message}`);
    }

    result.processingTime = Date.now() - startTime;
    return result;
  }

  /**
   * 评估当事人信息准确率
   */
  private evaluatePartyAccuracy(
    actualParties: ExtractedParty[],
    expectedParties: ExpectedParties
  ): number {
    let correctCount = 0;
    let totalCount = 0;

    // 检查原告
    if (expectedParties.plaintiffs) {
      totalCount += expectedParties.plaintiffs.length;
      const actualPlaintiffs = actualParties
        .filter(p => p.type === 'plaintiff')
        .map(p => p.name);
      correctCount += this.calculateMatchCount(
        actualPlaintiffs,
        expectedParties.plaintiffs
      );
    }

    // 检查被告
    if (expectedParties.defendants) {
      totalCount += expectedParties.defendants.length;
      const actualDefendants = actualParties
        .filter(p => p.type === 'defendant')
        .map(p => p.name);
      correctCount += this.calculateMatchCount(
        actualDefendants,
        expectedParties.defendants
      );
    }

    // 检查法定代表人
    if (expectedParties.legalRepresentatives) {
      totalCount += expectedParties.legalRepresentatives.length;
      const actualLegalReps = actualParties
        .filter(
          p => p.type === 'other' && p.role && p.role.includes('法定代表人')
        )
        .map(p => p.name);
      correctCount += this.calculateMatchCount(
        actualLegalReps,
        expectedParties.legalRepresentatives
      );
    }

    return totalCount > 0 ? (correctCount / totalCount) * 100 : 0;
  }

  /**
   * 评估诉讼请求准确率
   */
  private evaluateClaimAccuracy(
    actualClaims: ExtractedClaim[],
    expectedClaims: ExpectedClaims,
    testResult: TestResult
  ): number {
    let correctCount = 0;
    const totalCount = expectedClaims.types.length;

    const actualTypes = actualClaims.map(claim => claim.type);

    for (const expectedType of expectedClaims.types) {
      if (actualTypes.includes(expectedType)) {
        correctCount++;
      } else {
        testResult.warnings.push(`未识别到预期请求类型: ${expectedType}`);
      }
    }

    // 检查金额匹配
    if (expectedClaims.amounts) {
      const actualAmounts = actualClaims
        .filter(claim => claim.amount)
        .map(claim => claim.amount);

      for (
        let i = 0;
        i < Math.min(actualAmounts.length, expectedClaims.amounts.length);
        i++
      ) {
        const diff = Math.abs(actualAmounts[i] - expectedClaims.amounts[i]);
        if (
          expectedClaims.amounts[i] > 0 &&
          diff / expectedClaims.amounts[i] < 0.01
        ) {
          // 允许1%误差
          correctCount += 0.5; // 金额匹配给部分分数
        } else if (expectedClaims.amounts[i] !== 0) {
          testResult.warnings.push(
            `金额不匹配: 期望 ${expectedClaims.amounts[i]}, 实际 ${actualAmounts[i]}`
          );
        }
      }
    }

    return totalCount > 0
      ? Math.min((correctCount / totalCount) * 100, 100)
      : 0;
  }

  /**
   * 评估金额识别精度
   */
  private evaluateAmountAccuracy(
    actualClaims: ExtractedClaim[],
    expectedAmounts: number[],
    testResult: TestResult
  ): number {
    const actualAmounts = actualClaims
      .filter(claim => claim.amount)
      .map(claim => claim.amount);

    if (actualAmounts.length === 0 && expectedAmounts.length === 0) {
      return 100;
    }

    if (actualAmounts.length !== expectedAmounts.length) {
      testResult.warnings.push(
        `金额数量不匹配: 期望 ${expectedAmounts.length}, 实际 ${actualAmounts.length}`
      );
      return 0;
    }

    let correctCount = 0;

    for (let i = 0; i < actualAmounts.length; i++) {
      const diff = Math.abs(actualAmounts[i] - expectedAmounts[i]);
      if (expectedAmounts[i] > 0 && diff / expectedAmounts[i] < 0.01) {
        // 允许1%误差
        correctCount++;
      } else {
        testResult.warnings.push(
          `金额识别不准确: 期望 ${expectedAmounts[i]}, 实际 ${actualAmounts[i]}`
        );
      }
    }

    return (correctCount / actualAmounts.length) * 100;
  }

  /**
   * 计算匹配数量
   */
  private calculateMatchCount(actual: string[], expected: string[]): number {
    let count = 0;
    for (const expectedItem of expected) {
      if (
        actual.some(
          actualItem =>
            actualItem.includes(expectedItem) ||
            expectedItem.includes(actualItem)
        )
      ) {
        count++;
      }
    }
    return count;
  }

  /**
   * 生成优化报告
   */
  private generateOptimizationReport(
    results: TestResult[]
  ): OptimizationReport {
    const totalDocs = results.length;
    const avgPartyAcc =
      results.reduce((sum, r) => sum + r.partyAccuracy, 0) / totalDocs;
    const avgClaimAcc =
      results.reduce((sum, r) => sum + r.claimAccuracy, 0) / totalDocs;
    const avgAmountAcc =
      results.reduce((sum, r) => sum + r.amountAccuracy, 0) / totalDocs;
    const avgOverallAcc =
      results.reduce((sum, r) => sum + r.overallAccuracy, 0) / totalDocs;

    // 基于之前的80%基准计算改进
    const baselineParty = 80;
    const baselineClaim = 80;
    const baselineAmount = 80;

    return {
      totalDocuments: totalDocs,
      averagePartyAccuracy: avgPartyAcc,
      averageClaimAccuracy: avgClaimAcc,
      averageAmountAccuracy: avgAmountAcc,
      averageOverallAccuracy: avgOverallAcc,
      improvements: {
        partyAccuracy: `${avgPartyAcc.toFixed(1)}% (基准: ${baselineParty}%, 提升: ${(avgPartyAcc - baselineParty).toFixed(1)}%)`,
        claimAccuracy: `${avgClaimAcc.toFixed(1)}% (基准: ${baselineClaim}%, 提升: ${(avgClaimAcc - baselineClaim).toFixed(1)}%)`,
        amountAccuracy: `${avgAmountAcc.toFixed(1)}% (基准: ${baselineAmount}%, 提升: ${(avgAmountAcc - baselineAmount).toFixed(1)}%)`,
        overallPerformance: this.getPerformanceRating(avgOverallAcc),
      },
      detailedResults: results,
      recommendations: this.generateRecommendations(results),
    };
  }

  /**
   * 获取性能评级
   */
  private getPerformanceRating(accuracy: number): string {
    if (accuracy >= 98) return '🏆 优秀';
    if (accuracy >= 95) return '🥇 良好';
    if (accuracy >= 90) return '🥈 合格';
    if (accuracy >= 80) return '🥉 需改进';
    return '❌ 不合格';
  }

  /**
   * 生成建议
   */
  private generateRecommendations(results: TestResult[]): string[] {
    const recommendations: string[] = [];

    const avgParty =
      results.reduce((sum, r) => sum + r.partyAccuracy, 0) / results.length;
    const avgClaim =
      results.reduce((sum, r) => sum + r.claimAccuracy, 0) / results.length;
    const avgAmount =
      results.reduce((sum, r) => sum + r.amountAccuracy, 0) / results.length;

    if (avgParty < 98) {
      recommendations.push(
        '当事人信息识别需要进一步优化，建议增加更多角色识别规则'
      );
    }
    if (avgClaim < 95) {
      recommendations.push('诉讼请求分类需要改进，建议扩展分类规则库');
    }
    if (avgAmount < 99) {
      recommendations.push('金额识别精度需提升，建议优化中文数字转换算法');
    }

    // 分析常见错误
    const commonErrors = this.analyzeCommonErrors(results);
    recommendations.push(...commonErrors);

    return recommendations;
  }

  /**
   * 分析常见错误
   */
  private analyzeCommonErrors(results: TestResult[]): string[] {
    const errors: string[] = [];
    const errorCounts = new Map<string, number>();

    for (const result of results) {
      for (const warning of result.warnings) {
        errorCounts.set(warning, (errorCounts.get(warning) || 0) + 1);
      }
    }

    // 找出最常见的错误
    const sortedErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    for (const [error, count] of sortedErrors) {
      if (count >= 2) {
        errors.push(`高频问题 (${count}次): ${error}`);
      }
    }

    return errors;
  }

  /**
   * 显示测试结果
   */
  private displayTestResult(result: TestResult): void {
    console.log(`  ✅ 当事人信息准确率: ${result.partyAccuracy.toFixed(1)}%`);
    console.log(`  ✅ 诉讼请求准确率: ${result.claimAccuracy.toFixed(1)}%`);
    console.log(`  ✅ 金额识别精度: ${result.amountAccuracy.toFixed(1)}%`);
    console.log(`  📊 整体准确率: ${result.overallAccuracy.toFixed(1)}%`);
    console.log(`  ⏱️  处理时间: ${result.processingTime}ms`);

    if (result.improvements.length > 0) {
      console.log(`  🎯 达成目标: ${result.improvements.join(', ')}`);
    }

    if (result.warnings.length > 0) {
      console.log(`  ⚠️  警告: ${result.warnings.slice(0, 3).join(', ')}`);
    }
  }

  /**
   * 显示优化报告
   */
  private displayOptimizationReport(report: OptimizationReport): void {
    console.log('\n📊 优化效果评估报告');
    console.log('==========================================');
    console.log(`测试文档数量: ${report.totalDocuments}`);
    console.log(`当事人信息准确率: ${report.improvements.partyAccuracy}`);
    console.log(`诉讼请求准确率: ${report.improvements.claimAccuracy}`);
    console.log(`金额识别精度: ${report.improvements.amountAccuracy}`);
    console.log(`整体性能评级: ${report.improvements.overallPerformance}`);

    console.log('\n🎯 目标达成情况:');
    console.log(
      `当事人信息准确率≥98%: ${report.averagePartyAccuracy >= 98 ? '✅ 已达成' : '❌ 未达成'}`
    );
    console.log(
      `诉讼请求准确率≥95%: ${report.averageClaimAccuracy >= 95 ? '✅ 已达成' : '❌ 未达成'}`
    );
    console.log(
      `金额识别精度≥99%: ${report.averageAmountAccuracy >= 99 ? '✅ 已达成' : '❌ 未达成'}`
    );

    if (report.recommendations.length > 0) {
      console.log('\n💡 改进建议:');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    console.log('\n📈 详细结果:');
    report.detailedResults.forEach(result => {
      console.log(`\n📄 ${result.documentName}:`);
      console.log(`   整体准确率: ${result.overallAccuracy.toFixed(1)}%`);
      if (result.processingTime > 5000) {
        console.log(`   ⚠️  处理时间较长: ${result.processingTime}ms`);
      }
    });
  }
}

// 主执行函数
async function main() {
  const tester = new OptimizationTester();

  try {
    const report = await tester.runOptimizationTest();

    // 保存报告到文件
    const reportPath = join(__dirname, '../optimization-effect-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📁 详细报告已保存至: ${reportPath}`);
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

export type { OptimizationReport, TestResult };
export { OptimizationTester };
