/**
 * ErrorAnalyzer 测试
 *
 * 测试错误分析器
 */

import { ErrorAnalyzer } from "@/lib/error/error-analyzer";
import { ErrorLog, ErrorSeverity, ErrorType } from "@/lib/error/types";

describe("ErrorAnalyzer", () => {
  let analyzer: ErrorAnalyzer;

  beforeEach(() => {
    analyzer = new ErrorAnalyzer();
    jest.clearAllMocks();
  });

  describe("根因分析", () => {
    it("应该正确识别超时错误的根因", async () => {
      const errorLog: ErrorLog = {
        id: "1",
        errorType: ErrorType.NETWORK_TIMEOUT,
        errorMessage: "Request timeout after 30s",
        context: {},
        severity: ErrorSeverity.MEDIUM,
        recoveryAttempts: 0,
        recovered: false,
        learned: false,
        createdAt: new Date(),
      };

      const analysis = await analyzer.performRootCauseAnalysis(errorLog);

      expect(analysis.rootCause).toContain("服务响应超时");
      expect(analysis.contributingFactors).toBeDefined();
      expect(analysis.suggestedFixes).toBeDefined();
      expect(analysis.confidence).toBeGreaterThan(0);
    });

    it("应该正确识别限流错误的根因", async () => {
      const errorLog: ErrorLog = {
        id: "2",
        errorType: ErrorType.AI_RATE_LIMIT,
        errorMessage: "Rate limit exceeded",
        context: {},
        severity: ErrorSeverity.HIGH,
        recoveryAttempts: 0,
        recovered: false,
        learned: false,
        createdAt: new Date(),
      };

      const analysis = await analyzer.performRootCauseAnalysis(errorLog);

      expect(analysis.rootCause).toContain("API调用频率");
    });

    it("应该正确识别数据库连接错误的根因", async () => {
      const errorLog: ErrorLog = {
        id: "3",
        errorType: ErrorType.DATABASE_CONNECTION_ERROR,
        errorMessage: "Database connection failed",
        context: {},
        severity: ErrorSeverity.CRITICAL,
        recoveryAttempts: 0,
        recovered: false,
        learned: false,
        createdAt: new Date(),
      };

      const analysis = await analyzer.performRootCauseAnalysis(errorLog);

      expect(analysis.rootCause).toContain("网络连接");
      expect(analysis.confidence).toBeGreaterThan(0.5);
    });

    it("应该为未知错误返回通用根因", async () => {
      const errorLog: ErrorLog = {
        id: "4",
        errorType: ErrorType.UNKNOWN_ERROR,
        errorMessage: "Unknown issue occurred",
        context: {},
        severity: ErrorSeverity.MEDIUM,
        recoveryAttempts: 0,
        recovered: false,
        learned: false,
        createdAt: new Date(),
      };

      const analysis = await analyzer.performRootCauseAnalysis(errorLog);

      expect(analysis.rootCause).toContain("未知原因");
    });
  });

  describe("置信度计算", () => {
    it("应该为明确错误计算高置信度", async () => {
      const errorLog: ErrorLog = {
        id: "1",
        errorType: ErrorType.NETWORK_TIMEOUT,
        errorMessage: "Request timeout",
        stackTrace: "Error: timeout\n    at test.js:10",
        context: {
          agentName: "TestAgent",
        },
        severity: ErrorSeverity.MEDIUM,
        recoveryAttempts: 0,
        recovered: false,
        learned: false,
        createdAt: new Date(),
      };

      const analysis = await analyzer.performRootCauseAnalysis(errorLog);

      expect(analysis.confidence).toBeGreaterThan(0.7);
    });

    it("应该为模糊错误计算低置信度", async () => {
      const errorLog: ErrorLog = {
        id: "2",
        errorType: ErrorType.UNKNOWN_ERROR,
        errorMessage: "Unknown issue",
        context: {},
        severity: ErrorSeverity.MEDIUM,
        recoveryAttempts: 0,
        recovered: false,
        learned: false,
        createdAt: new Date(),
      };

      const analysis = await analyzer.performRootCauseAnalysis(errorLog);

      expect(analysis.confidence).toBeGreaterThanOrEqual(0.5);
      expect(analysis.confidence).toBeLessThanOrEqual(1.0);
    });
  });
});
