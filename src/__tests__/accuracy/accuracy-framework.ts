/**
 * 准确性评估框架
 * 用于量化验证系统准确性提升效果
 */

export interface AccuracyMetrics {
  // 文档解析准确性
  documentParsing: {
    partyRecognitionAccuracy: number; // 当事人识别准确率
    claimExtractionRecall: number; // 诉讼请求提取召回率
    amountExtractionAccuracy: number; // 金额提取准确率
    overallScore: number; // 综合评分
  };

  // 法条检索准确性
  lawRetrieval: {
    recallRate: number; // 检索召回率
    applicabilityScore: number; // 适用性评分
    relevanceScore: number; // 相关性评分
  };

  // 辩论生成质量
  debateGeneration: {
    argumentLogicScore: number; // 论点逻辑性
    legalBasisAccuracy: number; // 法律依据准确性
    balanceScore: number; // 正反方平衡性
  };

  // 错误恢复和成本
  performance: {
    errorRecoveryRate: number; // 错误恢复率
    cacheHitRate: number; // 缓存命中率
    apiCallReduction: number; // API调用减少百分比
  };
}

export interface AccuracyTestResult {
  testName: string;
  actualValue: number;
  targetValue: number;
  improvement: number;
  passed: boolean;
  details?: string[];
}

export interface AccuracyReport {
  reportId: string;
  generatedAt: Date;
  version: string;
  overallStatus: "PASSED" | "FAILED" | "PARTIAL";
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    passRate: number;
  };
  metrics: AccuracyMetrics;
  testResults: Map<string, AccuracyTestResult>;
  recommendations: string[];
}

/**
 * 准确性评估器
 */
export class AccuracyEvaluator {
  private version: string;

  constructor(version: string) {
    this.version = version;
  }

  /**
   * 评估文档解析准确性
   */
  evaluateDocumentParsing(data: {
    extractedParties: string[];
    expectedParties: string[];
    extractedClaims: string[];
    expectedClaims: string[];
    extractedAmounts: number[];
    expectedAmounts: number[];
  }): AccuracyMetrics["documentParsing"] {
    const partyRecognitionAccuracy = this.calculateAccuracy(
      data.extractedParties,
      data.expectedParties,
    );

    const claimExtractionRecall = this.calculateRecall(
      data.extractedClaims,
      data.expectedClaims,
    );

    const amountExtractionAccuracy = this.calculateAmountAccuracy(
      data.extractedAmounts,
      data.expectedAmounts,
    );

    const overallScore =
      (partyRecognitionAccuracy +
        claimExtractionRecall +
        amountExtractionAccuracy) /
      3;

    return {
      partyRecognitionAccuracy,
      claimExtractionRecall,
      amountExtractionAccuracy,
      overallScore,
    };
  }

  /**
   * 评估法条检索准确性
   */
  evaluateLawRetrieval(data: {
    retrievedArticles: string[];
    relevantArticles: string[];
    applicabilityScores: number[];
    relevanceScores: number[];
  }): AccuracyMetrics["lawRetrieval"] {
    const recallRate = this.calculateRecall(
      data.retrievedArticles,
      data.relevantArticles,
    );

    const applicabilityScore =
      data.applicabilityScores.length > 0
        ? data.applicabilityScores.reduce((a, b) => a + b, 0) /
          data.applicabilityScores.length
        : 0;

    const relevanceScore =
      data.relevanceScores.length > 0
        ? data.relevanceScores.reduce((a, b) => a + b, 0) /
          data.relevanceScores.length
        : 0;

    return {
      recallRate,
      applicabilityScore,
      relevanceScore,
    };
  }

  /**
   * 评估辩论生成质量
   */
  evaluateDebateGeneration(data: {
    argumentLogicScores: number[];
    legalBasisAccuracyScores: number[];
    balanceScores: number[];
  }): AccuracyMetrics["debateGeneration"] {
    const argumentLogicScore =
      data.argumentLogicScores.length > 0
        ? data.argumentLogicScores.reduce((a, b) => a + b, 0) /
          data.argumentLogicScores.length
        : 0;

    const legalBasisAccuracy =
      data.legalBasisAccuracyScores.length > 0
        ? data.legalBasisAccuracyScores.reduce((a, b) => a + b, 0) /
          data.legalBasisAccuracyScores.length
        : 0;

    const balanceScore =
      data.balanceScores.length > 0
        ? data.balanceScores.reduce((a, b) => a + b, 0) /
          data.balanceScores.length
        : 0;

    return {
      argumentLogicScore,
      legalBasisAccuracy,
      balanceScore,
    };
  }

  /**
   * 评估性能指标
   */
  evaluatePerformance(data: {
    totalErrors: number;
    recoveredErrors: number;
    cacheHits: number;
    totalCacheRequests: number;
    apiCallsWithCache: number;
    apiCallsWithoutCache: number;
  }): AccuracyMetrics["performance"] {
    const errorRecoveryRate =
      data.totalErrors > 0 ? data.recoveredErrors / data.totalErrors : 0;

    const cacheHitRate =
      data.totalCacheRequests > 0
        ? data.cacheHits / data.totalCacheRequests
        : 0;

    const apiCallReduction =
      data.apiCallsWithoutCache > 0
        ? ((data.apiCallsWithoutCache - data.apiCallsWithCache) /
            data.apiCallsWithoutCache) *
          100
        : 0;

    return {
      errorRecoveryRate,
      cacheHitRate,
      apiCallReduction,
    };
  }

  /**
   * 生成测试结果
   */
  generateTestResult(
    testName: string,
    actualValue: number,
    targetValue: number,
    details?: string[],
  ): AccuracyTestResult {
    const passed = actualValue >= targetValue;
    const improvement = ((actualValue - targetValue) / targetValue) * 100;

    return {
      testName,
      actualValue,
      targetValue,
      improvement,
      passed,
      details,
    };
  }

  /**
   * 生成评估报告
   */
  generateReport(
    metrics: AccuracyMetrics,
    testResults: AccuracyTestResult[],
  ): AccuracyReport {
    const passedTests = testResults.filter((r) => r.passed).length;
    const failedTests = testResults.filter((r) => !r.passed).length;
    const passRate =
      testResults.length > 0 ? passedTests / testResults.length : 1; // 默认为1表示全部通过

    let overallStatus: "PASSED" | "FAILED" | "PARTIAL";
    if (testResults.length === 0 || passRate >= 1) {
      overallStatus = "PASSED";
    } else if (passRate >= 0.8) {
      overallStatus = "PARTIAL";
    } else {
      overallStatus = "FAILED";
    }

    const recommendations = this.generateRecommendations(metrics);

    const testResultsMap = new Map();
    testResults.forEach((result) => {
      testResultsMap.set(result.testName, result);
    });

    return {
      reportId: `accuracy-report-${Date.now()}`,
      generatedAt: new Date(),
      version: this.version,
      overallStatus,
      summary: {
        totalTests: testResults.length,
        passedTests,
        failedTests,
        passRate,
      },
      metrics,
      testResults: testResultsMap,
      recommendations,
    };
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(metrics: AccuracyMetrics): string[] {
    const recommendations: string[] = [];

    // 文档解析相关建议
    if (metrics.documentParsing.partyRecognitionAccuracy < 0.95) {
      recommendations.push(
        `当事人识别准确率${(
          metrics.documentParsing.partyRecognitionAccuracy * 100
        ).toFixed(1)}%低于目标95%，建议优化AI提示词和规则算法`,
      );
    }

    if (metrics.documentParsing.claimExtractionRecall < 0.95) {
      recommendations.push(
        `诉讼请求提取召回率${(
          metrics.documentParsing.claimExtractionRecall * 100
        ).toFixed(1)}%低于目标95%，建议增强诉讼请求分类规则`,
      );
    }

    if (metrics.documentParsing.amountExtractionAccuracy < 0.95) {
      recommendations.push(
        `金额提取准确率${(
          metrics.documentParsing.amountExtractionAccuracy * 100
        ).toFixed(1)}%低于目标95%，建议优化金额识别正则表达式`,
      );
    }

    // 法条检索相关建议
    if (metrics.lawRetrieval.recallRate < 0.9) {
      recommendations.push(
        `法条检索召回率${(metrics.lawRetrieval.recallRate * 100).toFixed(
          1,
        )}%低于目标90%，建议优化关键词匹配和扩展算法`,
      );
    }

    // 辩论生成相关建议
    if (metrics.debateGeneration.argumentLogicScore < 0.92) {
      recommendations.push(
        `论点逻辑性评分${(
          metrics.debateGeneration.argumentLogicScore * 100
        ).toFixed(1)}%低于目标92%，建议优化论点生成AI提示词`,
      );
    }

    // 性能相关建议
    if (metrics.performance.cacheHitRate < 0.6) {
      recommendations.push(
        `缓存命中率${(metrics.performance.cacheHitRate * 100).toFixed(
          1,
        )}%低于目标60%，建议优化缓存策略`,
      );
    }

    if (metrics.performance.errorRecoveryRate < 0.9) {
      recommendations.push(
        `错误恢复率${(metrics.performance.errorRecoveryRate * 100).toFixed(
          1,
        )}%低于目标90%，建议完善错误处理和重试机制`,
      );
    }

    return recommendations;
  }

  /**
   * 计算准确率
   */
  private calculateAccuracy<T>(extracted: T[], expected: T[]): number {
    if (expected.length === 0) return 1;

    const correct = extracted.filter((e) => expected.includes(e)).length;
    return correct / expected.length;
  }

  /**
   * 计算召回率
   */
  private calculateRecall<T>(extracted: T[], expected: T[]): number {
    if (expected.length === 0) return 1;

    const recalled = expected.filter((e) => extracted.includes(e)).length;
    return recalled / expected.length;
  }

  /**
   * 计算金额准确率（允许小误差）
   */
  private calculateAmountAccuracy(
    extracted: number[],
    expected: number[],
    tolerance: number = 0.01, // 1%容差
  ): number {
    if (expected.length === 0) return 1;

    let correct = 0;
    for (const exp of expected) {
      const found = extracted.find(
        (ext) => Math.abs(ext - exp) / Math.abs(exp) <= tolerance,
      );
      if (found) correct++;
    }

    return correct / expected.length;
  }
}
