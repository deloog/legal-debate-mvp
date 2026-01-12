import { DocAnalyzerAgent } from '../src/lib/agent/doc-analyzer';
import { AIVerificationService } from '../src/lib/ai/ai-verification-service';
import { AgentContext, TaskPriority } from '../src/types/agent';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// =============================================================================
// 改进的文档解析准确性测试脚本
// 使用AI验证AI，避免算法匹配的局限性
// =============================================================================

interface TestDocument {
  id: string;
  filePath: string;
  fileType: 'TXT' | 'PDF' | 'DOCX' | 'DOC' | 'IMAGE';
  goldStandard?: {
    parties: Array<{
      type: 'plaintiff' | 'defendant' | 'other';
      name: string;
      role?: string;
      contact?: string;
      address?: string;
    }>;
    claims: Array<{
      type: string;
      content: string;
      amount?: number;
      evidence?: string[];
      legalBasis?: string;
    }>;
  };
  description: string;
}

interface ImprovedAccuracyMetrics {
  overallAccuracy: number; // AI评估的总体准确率 (0-100)
  partiesAccuracy: {
    score: number; // AI评估分数 (0-100)
    issues: string[];
    correctCount: number;
    totalCount: number;
    duplicates: Array<{
      name: string;
      occurrences: number;
      roles: string[];
    }>;
  };
  claimsAccuracy: {
    score: number; // AI评估分数 (0-100)
    issues: string[];
    correctCount: number;
    totalCount: number;
    missingClaims: string[];
  };
  qualityAssessment: {
    completeness: number; // 完整性 (0-100)
    consistency: number; // 一致性 (0-100)
    clarity: number; // 清晰度 (0-100)
  };
  detailedAnalysis: string; // AI详细分析
  confidence: number; // AI验证置信度 (0-1)
  processingTime: number; // 处理时间(ms)
}

class ImprovedDocumentAccuracyTester {
  private agent: DocAnalyzerAgent;
  private verificationService: AIVerificationService;

  constructor() {
    this.agent = new DocAnalyzerAgent();
    this.verificationService = new AIVerificationService();
  }

  async runImprovedAccuracyTest(): Promise<void> {
    console.log('🧠 开始AI验证的文档解析准确性测试...\n');
    console.log('📝 测试特点：使用AI验证AI，避免算法匹配局限性\n');

    // 定义测试文档
    const testDocuments: TestDocument[] = [
      {
        id: 'civil-case-001',
        filePath: join(
          __dirname,
          '../test-data/legal-documents/sample-civil-case.txt'
        ),
        fileType: 'TXT',
        description: '基础民事借款纠纷案例',
        goldStandard: {
          parties: [
            {
              type: 'plaintiff',
              name: '张三',
              role: '软件工程师',
              contact: '13800138000',
              address: '北京市朝阳区建国门外大街1号',
            },
            {
              type: 'defendant',
              name: '李四',
              role: '公司经理',
              contact: '13900139000',
              address: '北京市海淀区中关村大街2号',
            },
          ],
          claims: [
            {
              type: '借款返还',
              content: '请求判令被告返还借款本金人民币500,000元',
              amount: 500000,
              evidence: ['借条原件', '银行转账记录'],
              legalBasis: '民法典借款合同相关规定',
            },
            {
              type: '利息支付',
              content:
                '请求判令被告支付逾期利息（以500,000元为基数，自2023年1月1日起至实际付清之日止，按年利率6%计算）',
              amount: undefined,
              evidence: ['借条'],
              legalBasis: '民法典利息相关规定',
            },
            {
              type: '诉讼费用承担',
              content: '请求判令被告承担本案全部诉讼费用',
              amount: undefined,
              evidence: [],
              legalBasis: '诉讼费用交纳办法',
            },
          ],
        },
      },
      {
        id: 'variation-case-001',
        filePath: join(
          __dirname,
          '../test-data/legal-documents/test-variation-civil-case.txt'
        ),
        fileType: 'TXT',
        description: '变体测试：不同人名、职业、金额的民事货款纠纷',
        goldStandard: {
          parties: [
            {
              type: 'plaintiff',
              name: '王小红',
              role: '财务主管',
              contact: '18600186000',
              address: '上海市浦东新区陆家嘴环路1000号',
            },
            {
              type: 'defendant',
              name: '张大伟',
              role: '企业总经理',
              contact: '18700187000',
              address: '上海市黄浦区南京东路200号',
            },
            {
              type: 'other',
              name: '赵明',
              role: '法务经理',
              contact: '18800188000',
              address: '上海市静安区威海路300号',
            },
          ],
          claims: [
            {
              type: 'payment',
              content: '支付拖欠货款人民币800,000元',
              amount: 800000,
              evidence: ['销售合同', '发货单', '验收确认书'],
              legalBasis: '民法典买卖合同相关规定',
            },
            {
              type: 'penalty',
              content:
                '支付违约金（以800,000元为基数，自2023年5月1日起至实际付清之日止，按年利率8%计算）',
              amount: undefined,
              evidence: ['合同违约条款'],
              legalBasis: '民法典违约责任相关规定',
            },
            {
              type: 'costs',
              content: '承担本案全部诉讼费用',
              amount: undefined,
              evidence: [],
              legalBasis: '诉讼费用交纳办法',
            },
            {
              type: 'compensation',
              content: '赔偿原告因追讨欠款产生的律师费50,000元',
              amount: 50000,
              evidence: ['律师委托合同', '发票'],
              legalBasis: '民法典损失赔偿相关规定',
            },
          ],
        },
      },
    ];

    const results: ImprovedAccuracyMetrics[] = [];

    // 对每个文档进行测试
    for (const testDoc of testDocuments) {
      console.log(`📄 测试文档: ${testDoc.id}`);
      console.log(`📋 ${testDoc.description}`);

      const metrics = await this.testDocumentWithAIVerification(testDoc);
      results.push(metrics);
      this.printImprovedResults(testDoc.id, testDoc.description, metrics);
      console.log('---\n');
    }

    // 生成总体报告
    this.generateImprovedReport(results);
  }

  private async testDocumentWithAIVerification(
    testDoc: TestDocument
  ): Promise<ImprovedAccuracyMetrics> {
    const startTime = Date.now();

    try {
      // 初始化Agent
      await this.agent.initialize();

      // 构建执行上下文
      const context: AgentContext = {
        task: 'document_analysis',
        taskType: 'document_parse',
        priority: TaskPriority.HIGH,
        data: {
          documentId: testDoc.id,
          filePath: testDoc.filePath,
          fileType: testDoc.fileType,
          options: {
            extractParties: true,
            extractClaims: true,
            extractTimeline: true,
            generateSummary: true,
          },
        },
        metadata: {
          documentId: testDoc.id,
          fileType: testDoc.fileType,
          timestamp: new Date().toISOString(),
        },
      };

      // 执行文档分析
      const analysisResult = await this.agent.execute(context);

      if (!analysisResult.success) {
        throw new Error(analysisResult.error?.message || '分析失败');
      }

      const extractedData = analysisResult.data.extractedData;

      // 读取原始文档内容用于AI验证
      const originalText = readFileSync(testDoc.filePath, 'utf-8');

      // 使用AI验证提取结果
      const verificationResult =
        await this.verificationService.verifyExtraction({
          originalText,
          extractedData,
          goldStandard: testDoc.goldStandard,
        });

      const processingTime = Date.now() - startTime;

      return {
        overallAccuracy: verificationResult.overallAccuracy,
        partiesAccuracy: verificationResult.partiesAccuracy,
        claimsAccuracy: verificationResult.claimsAccuracy,
        qualityAssessment: verificationResult.qualityAssessment,
        detailedAnalysis: verificationResult.detailedAnalysis,
        confidence: verificationResult.confidence,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(
        `测试失败: ${error instanceof Error ? error.message : String(error)}`
      );

      // 返回最低准确率
      return {
        overallAccuracy: 0,
        partiesAccuracy: {
          score: 0,
          issues: [
            `测试失败: ${error instanceof Error ? error.message : String(error)}`,
          ],
          correctCount: 0,
          totalCount: 0,
          duplicates: [],
        },
        claimsAccuracy: {
          score: 0,
          issues: ['测试失败'],
          correctCount: 0,
          totalCount: 0,
          missingClaims: [],
        },
        qualityAssessment: {
          completeness: 0,
          consistency: 0,
          clarity: 0,
        },
        detailedAnalysis: '测试过程中发生错误，无法完成验证',
        confidence: 0,
        processingTime,
      };
    } finally {
      await this.agent.cleanup();
    }
  }

  private printImprovedResults(
    docId: string,
    description: string,
    metrics: ImprovedAccuracyMetrics
  ): void {
    console.log(`📊 ${docId} AI验证结果:`);
    console.log(`📋 ${description}`);
    console.log(`  总体准确率: ${metrics.overallAccuracy.toFixed(1)}%`);
    console.log(`  AI验证置信度: ${(metrics.confidence * 100).toFixed(1)}%`);
    console.log(`  处理时间: ${metrics.processingTime}ms`);

    console.log('\n👥 当事人信息验证:');
    console.log(`  准确率: ${metrics.partiesAccuracy.score.toFixed(1)}%`);
    console.log(
      `  正确数: ${metrics.partiesAccuracy.correctCount}/${metrics.partiesAccuracy.totalCount}`
    );

    if (metrics.partiesAccuracy.duplicates.length > 0) {
      console.log(`  ⚠️  重复当事人:`);
      metrics.partiesAccuracy.duplicates.forEach(dup => {
        console.log(
          `    ${dup.name} (${dup.occurrences}次): ${dup.roles.join(', ')}`
        );
      });
    }

    if (metrics.partiesAccuracy.issues.length > 0) {
      console.log(`  ⚠️  问题:`);
      metrics.partiesAccuracy.issues.forEach(issue => {
        console.log(`    - ${issue}`);
      });
    }

    console.log('\n⚖️ 诉讼请求验证:');
    console.log(`  准确率: ${metrics.claimsAccuracy.score.toFixed(1)}%`);
    console.log(
      `  正确数: ${metrics.claimsAccuracy.correctCount}/${metrics.claimsAccuracy.totalCount}`
    );

    if (metrics.claimsAccuracy.missingClaims.length > 0) {
      console.log(`  ⚠️  遗漏请求:`);
      metrics.claimsAccuracy.missingClaims.forEach(claim => {
        console.log(`    - ${claim}`);
      });
    }

    if (metrics.claimsAccuracy.issues.length > 0) {
      console.log(`  ⚠️  问题:`);
      metrics.claimsAccuracy.issues.forEach(issue => {
        console.log(`    - ${issue}`);
      });
    }

    console.log('\n📈 质量评估:');
    console.log(
      `  完整性: ${metrics.qualityAssessment.completeness.toFixed(1)}%`
    );
    console.log(
      `  一致性: ${metrics.qualityAssessment.consistency.toFixed(1)}%`
    );
    console.log(`  清晰度: ${metrics.qualityAssessment.clarity.toFixed(1)}%`);

    console.log('\n🔍 AI详细分析:');
    console.log(`  ${metrics.detailedAnalysis.substring(0, 200)}...`);
  }

  private generateImprovedReport(results: ImprovedAccuracyMetrics[]): void {
    const avgOverallAccuracy =
      results.reduce((sum, r) => sum + r.overallAccuracy, 0) / results.length;
    const avgPartiesAccuracy =
      results.reduce((sum, r) => sum + r.partiesAccuracy.score, 0) /
      results.length;
    const avgClaimsAccuracy =
      results.reduce((sum, r) => sum + r.claimsAccuracy.score, 0) /
      results.length;
    const avgConfidence =
      results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    const avgCompleteness =
      results.reduce((sum, r) => sum + r.qualityAssessment.completeness, 0) /
      results.length;
    const avgConsistency =
      results.reduce((sum, r) => sum + r.qualityAssessment.consistency, 0) /
      results.length;
    const avgClarity =
      results.reduce((sum, r) => sum + r.qualityAssessment.clarity, 0) /
      results.length;

    const report = {
      testType: 'AI-VERIFIED',
      testDate: new Date().toISOString(),
      totalDocuments: results.length,
      averageMetrics: {
        overallAccuracy: avgOverallAccuracy,
        partiesAccuracy: avgPartiesAccuracy,
        claimsAccuracy: avgClaimsAccuracy,
        confidence: avgConfidence,
        qualityAssessment: {
          completeness: avgCompleteness,
          consistency: avgConsistency,
          clarity: avgClarity,
        },
      },
      individualResults: results.map((r, index) => ({
        documentId: `doc-${index + 1}`,
        overallAccuracy: r.overallAccuracy,
        partiesAccuracy: r.partiesAccuracy.score,
        claimsAccuracy: r.claimsAccuracy.score,
        confidence: r.confidence,
        processingTime: r.processingTime,
        issues: [...r.partiesAccuracy.issues, ...r.claimsAccuracy.issues],
      })),
      summary: {
        partiesAccuracyMet: avgPartiesAccuracy >= 98,
        claimsAccuracyMet: avgClaimsAccuracy >= 95,
        overallPassed: avgPartiesAccuracy >= 98 && avgClaimsAccuracy >= 95,
        verificationReliable: avgConfidence >= 0.8,
      },
    };

    // 保存报告
    const reportPath = join(
      __dirname,
      '../test-data/improved-accuracy-report.json'
    );
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n🎯 AI验证总体测试结果:');
    console.log(`  测试方式: ${report.testType}`);
    console.log(`  平均总体准确率: ${avgOverallAccuracy.toFixed(1)}%`);
    console.log(
      `  平均当事人准确率: ${avgPartiesAccuracy.toFixed(1)}% (目标: ≥98%)`
    );
    console.log(
      `  平均诉讼请求准确率: ${avgClaimsAccuracy.toFixed(1)}% (目标: ≥95%)`
    );
    console.log(`  平均AI验证置信度: ${(avgConfidence * 100).toFixed(1)}%`);

    console.log('\n📈 质量评估:');
    console.log(`  完整性: ${avgCompleteness.toFixed(1)}%`);
    console.log(`  一致性: ${avgConsistency.toFixed(1)}%`);
    console.log(`  清晰度: ${avgClarity.toFixed(1)}%`);

    console.log('\n🎯 验收标准:');
    console.log(
      `  当事人信息准确率: ${report.summary.partiesAccuracyMet ? '✅ 通过' : '❌ 未通过'}`
    );
    console.log(
      `  诉讼请求准确率: ${report.summary.claimsAccuracyMet ? '✅ 通过' : '❌ 未通过'}`
    );
    console.log(
      `  总体验收: ${report.summary.overallPassed ? '✅ 通过' : '❌ 未通过'}`
    );
    console.log(
      `  验证可靠性: ${report.summary.verificationReliable ? '✅ 可靠' : '⚠️ 需要人工复核'}`
    );

    console.log(`\n📄 详细报告已保存至: ${reportPath}`);
    console.log('\n💡 报告特点:');
    console.log('  - 使用AI验证AI，避免算法匹配局限性');
    console.log('  - 识别重复当事人问题');
    console.log('  - 深度语义理解和逻辑推理');
    console.log('  - 提供详细的问题分析和改进建议');
  }
}

// =============================================================================
// 主执行函数
// =============================================================================

async function main() {
  const tester = new ImprovedDocumentAccuracyTester();

  try {
    await tester.runImprovedAccuracyTest();
    console.log('\n✅ AI验证准确性测试完成');
    console.log('📝 测试采用了AI验证AI的现代方法，避免了传统算法匹配的局限性');
  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

export { ImprovedDocumentAccuracyTester };
