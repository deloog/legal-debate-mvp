/**
 * 测试报告生成器
 * 生成标准化的E2E测试报告
 */

import fs from 'fs';

// Playwright类型定义
interface TestCase {
  title: string;
  parent: { title: string };
}

interface TestResult {
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  title?: string;
  error?: { message: string };
}

export interface TestReport {
  execution: ExecutionInfo;
  summary: Summary;
  functionalTests: TestSuiteResults;
  performanceTests: TestSuiteResults;
  dataConsistency: DataConsistencyResults;
  coverage: CoverageStats;
  issues: TestIssue[];
  recommendations: string[];
}

export interface ExecutionInfo {
  timestamp: string;
  duration: number;
  environment: {
    os: string;
    nodeVersion: string;
    testFramework: string;
  };
}

export interface Summary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
}

export interface TestSuiteResults {
  singleRound: TestResultSummary;
  multiRound: TestResultSummary;
  errorHandling: TestResultSummary;
}

export interface TestResultSummary {
  total: number;
  passed: number;
  failed: number;
  tests: TestCaseResult[];
}

export interface TestCaseResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

export interface DataConsistencyResults {
  passed: boolean;
  checks: ConsistencyCheck[];
}

export interface ConsistencyCheck {
  name: string;
  status: 'passed' | 'failed';
  message: string;
}

export interface CoverageStats {
  e2eFlow: number;
  criticalPath: number;
  exceptionHandling: number;
}

export interface TestIssue {
  severity: 'high' | 'medium' | 'low';
  category: string;
  description: string;
  affectedTests: string[];
}

export class E2ETestReporter {
  private results: Map<string, TestResult[]> = new Map();
  private startTime: number = Date.now();

  onBegin(): void {
    console.log('=== E2E测试开始 ===');
    console.log(`测试环境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`开始时间: ${new Date().toISOString()}`);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const suiteName = test.parent.title;

    if (!this.results.has(suiteName)) {
      this.results.set(suiteName, []);
    }

    this.results.get(suiteName)!.push(result);
  }

  onEnd(): void {
    const duration = Date.now() - this.startTime;
    const report = this.generateReport(duration);

    this.printReport(report);
    this.saveReportToFile(report);
  }

  private generateReport(duration: number): TestReport {
    const allResults = Array.from(this.results.values()).flat();

    const summary: Summary = {
      totalTests: allResults.length,
      passed: allResults.filter(r => r.status === 'passed').length,
      failed: allResults.filter(r => r.status === 'failed').length,
      skipped: allResults.filter(r => r.status === 'skipped').length,
      passRate: 0,
    };

    summary.passRate = (summary.passed / summary.totalTests) * 100;

    const functionalTests = this.analyzeFunctionalTests();
    const performanceTests = this.analyzePerformanceTests();
    const dataConsistency = this.analyzeDataConsistency();
    const coverage = this.calculateCoverage();
    const issues = this.identifyIssues(allResults);
    const recommendations = this.generateRecommendations(issues, summary);

    return {
      execution: {
        timestamp: new Date().toISOString(),
        duration,
        environment: {
          os: process.platform,
          nodeVersion: process.version,
          testFramework: 'Playwright',
        },
      },
      summary,
      functionalTests,
      performanceTests,
      dataConsistency,
      coverage,
      issues,
      recommendations,
    };
  }

  private analyzeFunctionalTests(): TestSuiteResults {
    return {
      singleRound: this.analyzeSuite('单轮辩论完整流程'),
      multiRound: this.analyzeSuite('多轮辩论流程'),
      errorHandling: this.analyzeSuite('异常处理流程'),
    };
  }

  private analyzePerformanceTests(): TestSuiteResults {
    return {
      singleRound: this.analyzeSuite('响应时间性能测试'),
      multiRound: this.analyzeSuite('并发用户性能测试'),
      errorHandling: { total: 0, passed: 0, failed: 0, tests: [] },
    };
  }

  private analyzeSuite(suiteName: string): TestResultSummary {
    const suiteResults = this.results.get(suiteName) || [];

    return {
      total: suiteResults.length,
      passed: suiteResults.filter(r => r.status === 'passed').length,
      failed: suiteResults.filter(r => r.status === 'failed').length,
      tests: suiteResults.map(r => ({
        name: r.title,
        status: r.status as 'passed' | 'failed' | 'skipped',
        duration: r.duration,
        error: r.error?.message,
      })),
    };
  }

  private analyzeDataConsistency(): DataConsistencyResults {
    const consistencyResults = this.results.get('数据一致性测试') || [];
    const allPassed = consistencyResults.every(r => r.status === 'passed');

    return {
      passed: allPassed,
      checks: consistencyResults.map(r => ({
        name: r.title,
        status: r.status as 'passed' | 'failed',
        message:
          r.status === 'passed' ? '数据一致性检查通过' : '数据一致性检查失败',
      })),
    };
  }

  private calculateCoverage(): CoverageStats {
    // 基于测试用例名称估算覆盖率
    const allTestNames = Array.from(this.results.keys()).flat();

    const e2eFlowTests = allTestNames.filter(
      name =>
        name.includes('单轮辩论') ||
        name.includes('多轮辩论') ||
        name.includes('完整流程')
    );

    const criticalPathTests = allTestNames.filter(
      name =>
        name.includes('文档上传') ||
        name.includes('文档解析') ||
        name.includes('法条检索') ||
        name.includes('辩论生成')
    );

    const exceptionTests = allTestNames.filter(
      name =>
        name.includes('异常') || name.includes('失败') || name.includes('错误')
    );

    return {
      e2eFlow: Math.min((e2eFlowTests.length / 10) * 100, 100),
      criticalPath: Math.min((criticalPathTests.length / 8) * 100, 100),
      exceptionHandling: Math.min((exceptionTests.length / 8) * 100, 100),
    };
  }

  private identifyIssues(results: TestResult[]): TestIssue[] {
    const issues: TestIssue[] = [];

    const failedTests = results.filter(r => r.status === 'failed');

    failedTests.forEach(test => {
      const error = test.error?.message || '未知错误';

      if (error.includes('超时')) {
        issues.push({
          severity: 'high',
          category: '性能',
          description: `测试超时: ${test.title}`,
          affectedTests: [test.title],
        });
      } else if (error.includes('断言失败')) {
        issues.push({
          severity: 'medium',
          category: '功能',
          description: `功能验证失败: ${test.title}`,
          affectedTests: [test.title],
        });
      } else {
        issues.push({
          severity: 'medium',
          category: '其他',
          description: `测试失败: ${test.title} - ${error}`,
          affectedTests: [test.title],
        });
      }
    });

    return issues;
  }

  private generateRecommendations(
    issues: TestIssue[],
    summary: Summary
  ): string[] {
    const recommendations: string[] = [];

    if (summary.passRate < 100) {
      recommendations.push('存在失败的测试用例，需要修复后重新运行');
    }

    const highSeverityIssues = issues.filter(i => i.severity === 'high');
    if (highSeverityIssues.length > 0) {
      recommendations.push(
        `存在${highSeverityIssues.length}个高优先级问题，需要优先处理`
      );
    }

    const performanceIssues = issues.filter(i => i.category === '性能');
    if (performanceIssues.length > 0) {
      recommendations.push('性能指标未达标，建议优化接口响应时间');
    }

    if (summary.skipped > 0) {
      recommendations.push(
        `有${summary.skipped}个测试用例被跳过，建议补充测试`
      );
    }

    recommendations.push('建议在CI/CD中集成E2E测试，确保代码质量');

    return recommendations;
  }

  private printReport(report: TestReport): void {
    console.log('\n');
    console.log('========================================');
    console.log('       E2E测试报告');
    console.log('========================================\n');

    console.log('执行概要');
    console.log('--------');
    console.log(`执行时间: ${report.execution.timestamp}`);
    console.log(`总耗时: ${report.execution.duration}ms`);
    console.log(`操作系统: ${report.execution.environment.os}`);
    console.log(`Node版本: ${report.execution.environment.nodeVersion}\n`);

    console.log('测试结果');
    console.log('--------');
    console.log(`总测试数: ${report.summary.totalTests}`);
    console.log(
      `通过: ${report.summary.passed} (${report.summary.passRate.toFixed(2)}%)`
    );
    console.log(`失败: ${report.summary.failed}`);
    console.log(`跳过: ${report.summary.skipped}\n`);

    console.log('功能测试结果');
    console.log('--------');
    console.log(
      `单轮辩论: ${report.functionalTests.singleRound.passed}/${report.functionalTests.singleRound.total}`
    );
    console.log(
      `多轮辩论: ${report.functionalTests.multiRound.passed}/${report.functionalTests.multiRound.total}`
    );
    console.log(
      `异常处理: ${report.functionalTests.errorHandling.passed}/${report.functionalTests.errorHandling.total}\n`
    );

    console.log('覆盖率统计');
    console.log('--------');
    console.log(`E2E流程: ${report.coverage.e2eFlow.toFixed(1)}%`);
    console.log(`关键路径: ${report.coverage.criticalPath.toFixed(1)}%`);
    console.log(`异常处理: ${report.coverage.exceptionHandling.toFixed(1)}%\n`);

    if (report.issues.length > 0) {
      console.log('发现的问题');
      console.log('--------');
      report.issues.forEach((issue, index) => {
        console.log(
          `${index + 1}. [${issue.severity.toUpperCase()}] ${issue.category}`
        );
        console.log(`   ${issue.description}`);
        console.log(`   影响测试: ${issue.affectedTests.join(', ')}\n`);
      });
    }

    if (report.recommendations.length > 0) {
      console.log('改进建议');
      console.log('--------');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
      console.log('');
    }
  }

  private saveReportToFile(report: TestReport): void {
    const reportDir = `${process.cwd()}/test-reports`;
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = `${reportDir}/e2e-test-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n测试报告已保存到: ${reportPath}`);
  }

  static createReportContent(report: TestReport): string {
    return `# E2E测试报告

## 执行概要

- **执行时间**: ${report.execution.timestamp}
- **总耗时**: ${report.execution.duration}ms
- **操作系统**: ${report.execution.environment.os}
- **Node版本**: ${report.execution.environment.nodeVersion}

## 测试结果

| 指标 | 数量 | 百分比 |
|--------|------|--------|
| 总测试数 | ${report.summary.totalTests} | 100% |
| 通过 | ${report.summary.passed} | ${report.summary.passRate.toFixed(2)}% |
| 失败 | ${report.summary.failed} | ${((report.summary.failed / report.summary.totalTests) * 100).toFixed(2)}% |
| 跳过 | ${report.summary.skipped} | ${((report.summary.skipped / report.summary.totalTests) * 100).toFixed(2)}% |

## 功能测试结果

### 单轮辩论流程
- 通过: ${report.functionalTests.singleRound.passed}/${report.functionalTests.singleRound.total}

### 多轮辩论流程
- 通过: ${report.functionalTests.multiRound.passed}/${report.functionalTests.multiRound.total}

### 异常处理流程
- 通过: ${report.functionalTests.errorHandling.passed}/${report.functionalTests.errorHandling.total}

## 性能测试结果

### 响应时间测试
- 通过: ${report.performanceTests.singleRound.passed}/${report.performanceTests.singleRound.total}

### 并发用户测试
- 通过: ${report.performanceTests.multiRound.passed}/${report.performanceTests.multiRound.total}

## 覆盖率统计

| 指标 | 覆盖率 | 目标 | 状态 |
|--------|--------|------|------|
| E2E流程 | ${report.coverage.e2eFlow.toFixed(1)}% | >90% | ${report.coverage.e2eFlow >= 90 ? '✅' : '❌'} |
| 关键路径 | ${report.coverage.criticalPath.toFixed(1)}% | 100% | ${report.coverage.criticalPath >= 100 ? '✅' : '❌'} |
| 异常处理 | ${report.coverage.exceptionHandling.toFixed(1)}% | >85% | ${report.coverage.exceptionHandling >= 85 ? '✅' : '❌'} |

## 数据一致性检查

${report.dataConsistency.passed ? '✅ 所有一致性检查通过' : '❌ 存在一致性检查失败'}

## 发现的问题

${
  report.issues.length === 0
    ? '无'
    : report.issues
        .map(
          (issue, i) => `
${i + 1}. **[${issue.severity.toUpperCase()}] ${issue.category}**
   - ${issue.description}
   - 影响测试: ${issue.affectedTests.join(', ')}
`
        )
        .join('')
}

## 改进建议

${report.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}
`;
  }
}

export default E2ETestReporter;
