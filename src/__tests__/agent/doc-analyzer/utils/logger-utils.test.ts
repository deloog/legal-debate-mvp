/**
 * 日志工具单元测试
 */

import { DocAnalyzerLogger } from "@/lib/agent/doc-analyzer/utils/logger-utils";
import { StructuredLogger } from "@/lib/agent/security/logger";

// Mock the StructuredLogger
jest.mock("@/lib/agent/security/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    recordDocumentProcessing: jest.fn(),
  },
}));

describe("DocAnalyzer日志工具", () => {
  let docLogger: DocAnalyzerLogger;
  let mockLogger: any;

  beforeEach(() => {
    docLogger = new DocAnalyzerLogger("TestModule");
    const { logger } = require("@/lib/agent/security/logger");
    mockLogger = logger;
    jest.clearAllMocks();
  });

  describe("基础日志方法", () => {
    it("应该记录调试信息", () => {
      const message = "调试信息";
      const context = { key: "value" };

      docLogger.debug(message, context);

      expect(mockLogger.debug).toHaveBeenCalledWith(message, {
        module: "TestModule",
        key: "value",
      });
    });

    it("应该记录一般信息", () => {
      const message = "一般信息";
      const context = { key: "value" };

      docLogger.info(message, context);

      expect(mockLogger.info).toHaveBeenCalledWith(message, {
        module: "TestModule",
        key: "value",
      });
    });

    it("应该记录警告信息", () => {
      const message = "警告信息";
      const context = { key: "value" };

      docLogger.warn(message, context);

      expect(mockLogger.warn).toHaveBeenCalledWith(message, {
        module: "TestModule",
        key: "value",
      });
    });

    it("应该记录错误信息", () => {
      const message = "错误信息";
      const error = new Error("测试错误");
      const context = { key: "value" };

      docLogger.error(message, error, context);

      expect(mockLogger.error).toHaveBeenCalledWith(message, error, {
        module: "TestModule",
        key: "value",
      });
    });

    it("应该处理无上下文的日志", () => {
      const message = "无上下文信息";

      docLogger.debug(message);

      expect(mockLogger.debug).toHaveBeenCalledWith(message, {
        module: "TestModule",
      });
    });
  });

  describe("DocAnalyzer专用日志方法", () => {
    it("应该记录文档分析开始", () => {
      const documentId = "doc-123";

      docLogger.logAnalysisStart(documentId);

      expect(mockLogger.info).toHaveBeenCalledWith("文档分析开始", {
        module: "TestModule",
        documentId,
      });
    });

    it("应该记录文档分析完成", () => {
      const documentId = "doc-123";
      const processingTime = 1000;
      const confidence = 0.95;

      docLogger.logAnalysisComplete(documentId, processingTime, confidence);

      expect(mockLogger.recordDocumentProcessing).toHaveBeenCalledWith(
        true,
        processingTime,
        confidence,
      );
      expect(mockLogger.info).toHaveBeenCalledWith("文档分析完成", {
        module: "TestModule",
        documentId,
        processingTime,
        confidence,
      });
    });

    it("应该记录文档分析失败", () => {
      const documentId = "doc-123";
      const error = new Error("分析失败");
      const processingTime = 500;

      docLogger.logAnalysisFailure(documentId, error, processingTime);

      expect(mockLogger.recordDocumentProcessing).toHaveBeenCalledWith(
        false,
        processingTime,
        0,
      );
      expect(mockLogger.error).toHaveBeenCalledWith("文档分析失败", error, {
        module: "TestModule",
        documentId,
        processingTime,
      });
    });

    it("应该记录缓存命中", () => {
      const documentId = "doc-123";

      docLogger.logCacheHit(documentId);

      expect(mockLogger.info).toHaveBeenCalledWith("缓存命中", {
        module: "TestModule",
        documentId,
      });
    });

    it("应该记录缓存未命中", () => {
      const documentId = "doc-123";

      docLogger.logCacheMiss(documentId);

      expect(mockLogger.debug).toHaveBeenCalledWith("缓存未命中", {
        module: "TestModule",
        documentId,
      });
    });

    it("应该记录AI调用", () => {
      const provider = "TestProvider";
      const model = "test-model";
      const tokens = 1000;

      docLogger.logAICall(provider, model, tokens);

      expect(mockLogger.debug).toHaveBeenCalledWith("AI调用", {
        module: "TestModule",
        provider,
        model,
        tokens,
      });
    });

    it("应该记录性能指标", () => {
      const metricName = "processingTime";
      const value = 500;
      const unit = "ms";

      docLogger.logPerformanceMetric(metricName, value, unit);

      expect(mockLogger.debug).toHaveBeenCalledWith("性能指标", {
        module: "TestModule",
        metricName,
        value,
        unit,
      });
    });

    it("应该使用默认单位", () => {
      const metricName = "memoryUsage";
      const value = 1024;

      docLogger.logPerformanceMetric(metricName, value);

      expect(mockLogger.debug).toHaveBeenCalledWith("性能指标", {
        module: "TestModule",
        metricName,
        value,
        unit: "ms",
      });
    });
  });

  describe("子模块日志器", () => {
    it("应该创建带有正确模块名称的子日志器", () => {
      const childLogger = docLogger.createChildLogger("SubModule");

      expect(childLogger).toBeInstanceOf(DocAnalyzerLogger);

      const message = "子模块消息";
      childLogger.debug(message);

      expect(mockLogger.debug).toHaveBeenCalledWith(message, {
        module: "TestModule:SubModule",
      });
    });

    it("应该支持多级子模块", () => {
      const childLogger1 = docLogger.createChildLogger("Level1");
      const childLogger2 = childLogger1.createChildLogger("Level2");

      const message = "多级子模块消息";
      childLogger2.debug(message);

      expect(mockLogger.debug).toHaveBeenCalledWith(message, {
        module: "TestModule:Level1:Level2",
      });
    });
  });

  describe("模块名称处理", () => {
    it("应该使用默认模块名称", () => {
      const defaultLogger = new DocAnalyzerLogger();

      const message = "默认模块消息";
      defaultLogger.debug(message);

      expect(mockLogger.debug).toHaveBeenCalledWith(message, {
        module: "DocAnalyzer",
      });
    });

    it("应该使用自定义模块名称", () => {
      const customLogger = new DocAnalyzerLogger("CustomModule");

      const message = "自定义模块消息";
      customLogger.debug(message);

      expect(mockLogger.debug).toHaveBeenCalledWith(message, {
        module: "CustomModule",
      });
    });
  });
});
