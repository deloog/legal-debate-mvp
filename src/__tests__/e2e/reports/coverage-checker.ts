/**
 * 覆盖率检查器
 * 验证E2E测试覆盖率是否达到要求
 */

export interface CoverageRequirements {
  e2eFlow: { min: number; target: number };
  criticalPath: { min: number; target: number };
  exceptionHandling: { min: number; target: number };
  overall: { min: number; target: number };
}

export interface CoverageResult {
  passed: boolean;
  e2eFlow: CoverageMetric;
  criticalPath: CoverageMetric;
  exceptionHandling: CoverageMetric;
  overall: CoverageMetric;
  issues: CoverageIssue[];
  recommendations: string[];
}

export interface CoverageMetric {
  actual: number;
  min: number;
  target: number;
  passed: boolean;
}

export interface CoverageIssue {
  type: string;
  metric: string;
  actual: number;
  expected: number;
  message: string;
}

export class CoverageChecker {
  private readonly requirements: CoverageRequirements = {
    e2eFlow: { min: 85, target: 90 },
    criticalPath: { min: 95, target: 100 },
    exceptionHandling: { min: 80, target: 85 },
    overall: { min: 85, target: 90 },
  };

  /**
   * 计算E2E流程覆盖率
   */
  calculateE2EFlowCoverage(
    testedScenarios: string[],
    requiredScenarios: string[]
  ): CoverageMetric {
    const covered = requiredScenarios.filter(scenario =>
      testedScenarios.some(tested => tested.includes(scenario))
    ).length;

    const actual = (covered / requiredScenarios.length) * 100;

    return {
      actual,
      min: this.requirements.e2eFlow.min,
      target: this.requirements.e2eFlow.target,
      passed: actual >= this.requirements.e2eFlow.min,
    };
  }

  /**
   * 计算关键路径覆盖率
   */
  calculateCriticalPathCoverage(
    testedSteps: string[],
    requiredSteps: string[]
  ): CoverageMetric {
    const covered = requiredSteps.filter(step =>
      testedSteps.some(tested => tested.includes(step))
    ).length;

    const actual = (covered / requiredSteps.length) * 100;

    return {
      actual,
      min: this.requirements.criticalPath.min,
      target: this.requirements.criticalPath.target,
      passed: actual >= this.requirements.criticalPath.min,
    };
  }

  /**
   * 计算异常处理覆盖率
   */
  calculateExceptionHandlingCoverage(
    testedExceptions: string[],
    requiredExceptions: string[]
  ): CoverageMetric {
    const covered = requiredExceptions.filter(exception =>
      testedExceptions.some(tested => tested.includes(exception))
    ).length;

    const actual = (covered / requiredExceptions.length) * 100;

    return {
      actual,
      min: this.requirements.exceptionHandling.min,
      target: this.requirements.exceptionHandling.target,
      passed: actual >= this.requirements.exceptionHandling.min,
    };
  }

  /**
   * 综合计算整体覆盖率
   */
  calculateOverallCoverage(metrics: {
    e2eFlow: CoverageMetric;
    criticalPath: CoverageMetric;
    exceptionHandling: CoverageMetric;
  }): CoverageMetric {
    const weights = {
      e2eFlow: 0.4,
      criticalPath: 0.4,
      exceptionHandling: 0.2,
    };

    const actual =
      metrics.e2eFlow.actual * weights.e2eFlow +
      metrics.criticalPath.actual * weights.criticalPath +
      metrics.exceptionHandling.actual * weights.exceptionHandling;

    const min =
      metrics.e2eFlow.min * weights.e2eFlow +
      metrics.criticalPath.min * weights.criticalPath +
      metrics.exceptionHandling.min * weights.exceptionHandling;

    const target =
      metrics.e2eFlow.target * weights.e2eFlow +
      metrics.criticalPath.target * weights.criticalPath +
      metrics.exceptionHandling.target * weights.exceptionHandling;

    return {
      actual,
      min,
      target,
      passed: actual >= min,
    };
  }

  /**
   * 检查覆盖率并生成报告
   */
  checkCoverage(
    testSuites: {
      name: string;
      tests: string[];
    }[]
  ): CoverageResult {
    // 提取测试场景
    const testedScenarios = testSuites.flatMap(suite => suite.tests);

    // 定义必需的测试场景
    const requiredE2EScenarios = [
      '单轮辩论',
      '多轮辩论',
      '文档上传',
      '文档解析',
      '法条检索',
      '适用性分析',
      '辩论生成',
      '流式输出',
    ];

    const requiredCriticalSteps = [
      '创建案件',
      '上传文档',
      '文档解析',
      '法条检索',
      '适用性分析',
      '创建辩论',
      '生成论点',
    ];

    const requiredExceptions = [
      '文档解析失败',
      '法条检索无结果',
      'AI服务超时',
      'AI服务错误',
      'SSE连接中断',
      '并发冲突',
    ];

    // 计算各项覆盖率
    const e2eFlow = this.calculateE2EFlowCoverage(
      testedScenarios,
      requiredE2EScenarios
    );

    const criticalPath = this.calculateCriticalPathCoverage(
      testedScenarios,
      requiredCriticalSteps
    );

    const exceptionHandling = this.calculateExceptionHandlingCoverage(
      testedScenarios,
      requiredExceptions
    );

    const overall = this.calculateOverallCoverage({
      e2eFlow,
      criticalPath,
      exceptionHandling,
    });

    // 识别问题
    const issues = this.identifyCoverageIssues({
      e2eFlow,
      criticalPath,
      exceptionHandling,
      overall,
    });

    // 生成建议
    const recommendations = this.generateRecommendations(
      {
        e2eFlow,
        criticalPath,
        exceptionHandling,
        overall,
      },
      issues
    );

    const passed =
      e2eFlow.passed &&
      criticalPath.passed &&
      exceptionHandling.passed &&
      overall.passed;

    return {
      passed,
      e2eFlow,
      criticalPath,
      exceptionHandling,
      overall,
      issues,
      recommendations,
    };
  }

  /**
   * 识别覆盖率问题
   */
  private identifyCoverageIssues(metrics: {
    e2eFlow: CoverageMetric;
    criticalPath: CoverageMetric;
    exceptionHandling: CoverageMetric;
    overall: CoverageMetric;
  }): CoverageIssue[] {
    const issues: CoverageIssue[] = [];

    if (!metrics.e2eFlow.passed) {
      issues.push({
        type: 'e2eFlow',
        metric: 'E2E流程覆盖率',
        actual: metrics.e2eFlow.actual,
        expected: metrics.e2eFlow.target,
        message: `E2E流程覆盖率 ${metrics.e2eFlow.actual.toFixed(
          1
        )}% 未达到目标 ${metrics.e2eFlow.target}%`,
      });
    }

    if (!metrics.criticalPath.passed) {
      issues.push({
        type: 'criticalPath',
        metric: '关键路径覆盖率',
        actual: metrics.criticalPath.actual,
        expected: metrics.criticalPath.target,
        message: `关键路径覆盖率 ${metrics.criticalPath.actual.toFixed(
          1
        )}% 未达到目标 ${metrics.criticalPath.target}%`,
      });
    }

    if (!metrics.exceptionHandling.passed) {
      issues.push({
        type: 'exceptionHandling',
        metric: '异常处理覆盖率',
        actual: metrics.exceptionHandling.actual,
        expected: metrics.exceptionHandling.target,
        message: `异常处理覆盖率 ${metrics.exceptionHandling.actual.toFixed(
          1
        )}% 未达到目标 ${metrics.exceptionHandling.target}%`,
      });
    }

    if (!metrics.overall.passed) {
      issues.push({
        type: 'overall',
        metric: '整体覆盖率',
        actual: metrics.overall.actual,
        expected: metrics.overall.target,
        message: `整体覆盖率 ${metrics.overall.actual.toFixed(
          1
        )}% 未达到目标 ${metrics.overall.target}%`,
      });
    }

    return issues;
  }

  /**
   * 生成覆盖率改进建议
   */
  private generateRecommendations(
    metrics: {
      e2eFlow: CoverageMetric;
      criticalPath: CoverageMetric;
      exceptionHandling: CoverageMetric;
      overall: CoverageMetric;
    },
    issues: CoverageIssue[]
  ): string[] {
    const recommendations: string[] = [];

    // E2E流程建议
    if (metrics.e2eFlow.actual < metrics.e2eFlow.target) {
      recommendations.push('E2E流程覆盖率不足，建议补充完整流程测试用例');
      recommendations.push(
        '考虑添加更复杂的用户场景测试，如断点续传、多轮嵌套等'
      );
    }

    // 关键路径建议
    if (metrics.criticalPath.actual < metrics.criticalPath.target) {
      recommendations.push('关键路径覆盖率不足，建议增加核心功能测试');
      recommendations.push('确保所有关键API接口都有对应的E2E测试');
    }

    // 异常处理建议
    if (metrics.exceptionHandling.actual < metrics.exceptionHandling.target) {
      recommendations.push('异常处理覆盖率不足，建议补充异常场景测试');
      recommendations.push('关注网络异常、服务超时、数据冲突等边界情况');
    }

    // 整体建议
    if (issues.length > 0) {
      recommendations.push('定期审查和更新测试用例，保持覆盖率处于高位');
      recommendations.push('建立覆盖率门禁，确保新代码不会降低覆盖率');
    }

    return recommendations;
  }

  /**
   * 打印覆盖率报告
   */
  printReport(result: CoverageResult): void {
    console.log('\n========================================');
    console.log('       覆盖率检查报告');
    console.log('========================================\n');

    this.printMetric('E2E流程覆盖率', result.e2eFlow);
    this.printMetric('关键路径覆盖率', result.criticalPath);
    this.printMetric('异常处理覆盖率', result.exceptionHandling);
    this.printMetric('整体覆盖率', result.overall);

    console.log(
      `\n${result.passed ? '✅' : '❌'} 覆盖率检查${result.passed ? '通过' : '未通过'}\n`
    );

    if (result.issues.length > 0) {
      console.log('覆盖率问题');
      console.log('--------');
      result.issues.forEach((issue, index) => {
        console.log(`${index + 1}. [${issue.type}] ${issue.metric}`);
        console.log(`   ${issue.message}`);
        console.log(
          `   实际: ${issue.actual.toFixed(1)}%, 期望: ${issue.expected}%\n`
        );
      });
    }

    if (result.recommendations.length > 0) {
      console.log('改进建议');
      console.log('--------');
      result.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
      console.log('');
    }
  }

  /**
   * 打印单个指标
   */
  private printMetric(name: string, metric: CoverageMetric): void {
    const status = metric.passed ? '✅' : '❌';
    const gap = metric.target - metric.actual;

    console.log(`${name}`);
    console.log(
      `  实际: ${metric.actual.toFixed(1)}% | 目标: ${metric.target}% | 最低要求: ${metric.min}%`
    );

    if (gap > 0) {
      console.log(`  ${status} 差距: ${gap.toFixed(1)}%`);
    } else {
      console.log(`  ${status} 达标`);
    }

    console.log('');
  }

  /**
   * 生成Markdown格式的报告
   */
  generateMarkdownReport(result: CoverageResult): string {
    const lines: string[] = [];

    lines.push('# 覆盖率检查报告\n');
    lines.push(`**检查状态**: ${result.passed ? '✅ 通过' : '❌ 未通过'}\n`);

    lines.push('## 覆盖率指标\n');

    lines.push('### E2E流程覆盖率');
    lines.push(`- 实际: **${result.e2eFlow.actual.toFixed(1)}%**`);
    lines.push(`- 目标: ${result.e2eFlow.target}%`);
    lines.push(`- 最低要求: ${result.e2eFlow.min}%`);
    lines.push(`- 状态: ${result.e2eFlow.passed ? '✅ 达标' : '❌ 未达标'}\n`);

    lines.push('### 关键路径覆盖率');
    lines.push(`- 实际: **${result.criticalPath.actual.toFixed(1)}%**`);
    lines.push(`- 目标: ${result.criticalPath.target}%`);
    lines.push(`- 最低要求: ${result.criticalPath.min}%`);
    lines.push(
      `- 状态: ${result.criticalPath.passed ? '✅ 达标' : '❌ 未达标'}\n`
    );

    lines.push('### 异常处理覆盖率');
    lines.push(`- 实际: **${result.exceptionHandling.actual.toFixed(1)}%**`);
    lines.push(`- 目标: ${result.exceptionHandling.target}%`);
    lines.push(`- 最低要求: ${result.exceptionHandling.min}%`);
    lines.push(
      `- 状态: ${result.exceptionHandling.passed ? '✅ 达标' : '❌ 未达标'}\n`
    );

    lines.push('### 整体覆盖率');
    lines.push(`- 实际: **${result.overall.actual.toFixed(1)}%**`);
    lines.push(`- 目标: ${result.overall.target}%`);
    lines.push(`- 最低要求: ${result.overall.min}%`);
    lines.push(`- 状态: ${result.overall.passed ? '✅ 达标' : '❌ 未达标'}\n`);

    if (result.issues.length > 0) {
      lines.push('## 发现的问题\n');

      result.issues.forEach((issue, index) => {
        lines.push(`${index + 1}. **${issue.metric}**`);
        lines.push(`   - 类型: ${issue.type}`);
        lines.push(`   - ${issue.message}`);
        lines.push(
          `   - 实际: ${issue.actual.toFixed(1)}%, 期望: ${issue.expected}%\n`
        );
      });
    }

    if (result.recommendations.length > 0) {
      lines.push('## 改进建议\n');

      result.recommendations.forEach((rec, index) => {
        lines.push(`${index + 1}. ${rec}`);
      });
    }

    return lines.join('\n');
  }
}

export default CoverageChecker;
