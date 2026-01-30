/**
 * E2E诊断报告生成器
 * 生成Markdown和JSON格式的诊断报告
 */

import {
  DiagnosisResult,
  DiagnosisProblem,
  ProblemCategory,
  ProblemSeverity,
} from './e2e-diagnosis-service';

/**
 * 诊断报告接口
 */
export interface DiagnosisReport {
  timestamp: string;
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    failureRate: number;
    healthScore: number;
  };
  problems: DiagnosisProblem[];
  problemsByCategory: {
    mockConfig: DiagnosisProblem[];
    apiResponse: DiagnosisProblem[];
    stateSync: DiagnosisProblem[];
    other: DiagnosisProblem[];
  };
  problemDistribution: {
    mockConfig: number;
    apiResponse: number;
    stateSync: number;
    other: number;
  };
  recommendations: string[];
}

/**
 * E2E诊断报告生成器类
 */
export class E2EDiagnosisReportGenerator {
  /**
   * 生成诊断报告对象
   */
  generateReport(result: DiagnosisResult): DiagnosisReport {
    const healthScore = this.calculateHealthScore(result);

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        failedTests: result.failedTests,
        skippedTests: result.skippedTests,
        failureRate: result.failureRate,
        healthScore,
      },
      problems: result.problems,
      problemsByCategory: this.groupProblemsByCategory(result.problems),
      problemDistribution: result.problemDistribution,
      recommendations: result.recommendations,
    };
  }

  /**
   * 生成Markdown格式报告
   */
  generateMarkdown(result: DiagnosisResult): string {
    const report = this.generateReport(result);
    const lines: string[] = [];

    // 标题
    lines.push('# E2E测试诊断报告');
    lines.push('');
    lines.push(`**生成时间**: ${report.timestamp}`);
    lines.push('');

    // 概要
    lines.push('## 概要');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 总测试数 | ${report.summary.totalTests} |`);
    lines.push(`| 通过 | ${report.summary.passedTests} |`);
    lines.push(`| 失败 | ${report.summary.failedTests} |`);
    lines.push(`| 跳过 | ${report.summary.skippedTests} |`);
    lines.push(`| 失败率 | ${report.summary.failureRate.toFixed(1)}% |`);
    lines.push(
      `| 健康分数 | ${this.getStatusEmoji(report.summary.healthScore)} ${report.summary.healthScore}/100 |`
    );
    lines.push('');

    // 问题分布
    if (result.failedTests > 0) {
      lines.push('## 问题分布');
      lines.push('');
      lines.push('| 问题类型 | 占比 |');
      lines.push('|----------|------|');
      lines.push(
        `| Mock配置问题 | ${report.problemDistribution.mockConfig}% |`
      );
      lines.push(
        `| API响应问题 | ${report.problemDistribution.apiResponse}% |`
      );
      lines.push(`| 状态同步问题 | ${report.problemDistribution.stateSync}% |`);
      lines.push(`| 其他问题 | ${report.problemDistribution.other}% |`);
      lines.push('');

      // 问题分析
      lines.push('## 问题分析');
      lines.push('');

      // Mock配置问题
      const mockSection = this.formatProblemSection(
        'Mock配置问题',
        report.problemsByCategory.mockConfig,
        report.problemDistribution.mockConfig
      );
      if (mockSection) lines.push(mockSection);

      // API响应问题
      const apiSection = this.formatProblemSection(
        'API响应问题',
        report.problemsByCategory.apiResponse,
        report.problemDistribution.apiResponse
      );
      if (apiSection) lines.push(apiSection);

      // 状态同步问题
      const stateSection = this.formatProblemSection(
        '状态同步问题',
        report.problemsByCategory.stateSync,
        report.problemDistribution.stateSync
      );
      if (stateSection) lines.push(stateSection);

      // 修复建议
      if (report.recommendations.length > 0) {
        lines.push('## 修复建议');
        lines.push('');
        report.recommendations.forEach((rec, index) => {
          lines.push(`${index + 1}. ${rec}`);
        });
        lines.push('');
      }
    } else {
      lines.push('## 测试状态');
      lines.push('');
      lines.push('✅ **所有测试通过**，无需诊断。');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 生成JSON格式报告
   */
  generateJSON(result: DiagnosisResult): string {
    const report = this.generateReport(result);
    return JSON.stringify(report, null, 2);
  }

  /**
   * 计算健康分数
   */
  calculateHealthScore(result: DiagnosisResult): number {
    if (result.totalTests === 0) return 100;

    // 基础分数：通过率
    let score = 100 - result.failureRate;

    // 根据问题严重程度扣分
    for (const problem of result.problems) {
      const affectedCount = problem.affectedTests.length;
      switch (problem.severity) {
        case ProblemSeverity.HIGH:
          score -= affectedCount * 5;
          break;
        case ProblemSeverity.MEDIUM:
          score -= affectedCount * 3;
          break;
        case ProblemSeverity.LOW:
          score -= affectedCount * 1;
          break;
      }
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * 获取状态表情
   */
  getStatusEmoji(score: number): string {
    if (score >= 80) return '✅';
    if (score >= 60) return '⚠️';
    return '❌';
  }

  /**
   * 格式化问题部分
   */
  formatProblemSection(
    title: string,
    problems: DiagnosisProblem[],
    percentage: number
  ): string {
    if (problems.length === 0) return '';

    const lines: string[] = [];
    lines.push(`### ${title} (${percentage}%)`);
    lines.push('');

    for (const problem of problems) {
      const severityEmoji = this.getSeverityEmoji(problem.severity);
      lines.push(`#### ${severityEmoji} ${problem.description}`);
      lines.push('');
      lines.push(`**影响的测试**:`);
      problem.affectedTests.forEach(test => {
        lines.push(`- ${test}`);
      });
      lines.push('');
      lines.push(`**建议修复**: ${problem.suggestedFix}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 按类别分组问题
   */
  private groupProblemsByCategory(problems: DiagnosisProblem[]): {
    mockConfig: DiagnosisProblem[];
    apiResponse: DiagnosisProblem[];
    stateSync: DiagnosisProblem[];
    other: DiagnosisProblem[];
  } {
    return {
      mockConfig: problems.filter(
        p => p.category === ProblemCategory.MOCK_CONFIG
      ),
      apiResponse: problems.filter(
        p => p.category === ProblemCategory.API_RESPONSE
      ),
      stateSync: problems.filter(
        p => p.category === ProblemCategory.STATE_SYNC
      ),
      other: problems.filter(p => p.category === ProblemCategory.OTHER),
    };
  }

  /**
   * 获取严重程度表情
   */
  private getSeverityEmoji(severity: ProblemSeverity): string {
    switch (severity) {
      case ProblemSeverity.HIGH:
        return '🔴';
      case ProblemSeverity.MEDIUM:
        return '🟡';
      case ProblemSeverity.LOW:
        return '🟢';
      default:
        return '⚪';
    }
  }
}
