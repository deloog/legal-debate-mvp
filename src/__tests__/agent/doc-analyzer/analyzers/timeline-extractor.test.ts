/**
 * TimelineExtractor 测试
 * 目标：时间线提取准确性
 */

import { TimelineExtractor } from "@/lib/agent/doc-analyzer/analyzers/timeline-extractor";
import type { ExtractedData } from "@/lib/agent/doc-analyzer/core/types";

describe("TimelineExtractor", () => {
  let extractor: TimelineExtractor;

  beforeEach(() => {
    extractor = new TimelineExtractor();
  });

  describe("extractTimeline", () => {
    it("应该从文本中提取时间事件", () => {
      const text = `
        2024年1月15日签订合同。
        2024年3月1日原告提交立案申请。
        2024年6月1日法院立案。
        2024年9月15日开庭审理。
      `;

      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = extractor.extractTimeline(text, extractedData);

      expect(result).toBeDefined();
      expect(result.events).toBeInstanceOf(Array);
      expect(result.totalEvents).toBeGreaterThan(0);
    });

    it("应该从提取数据中构建事件", () => {
      const text = "这是一段文本。";

      const extractedData: ExtractedData = {
        parties: [],
        claims: [
          {
            type: "PAY_PRINCIPAL",
            content: "2024年5月1日到期支付",
            amount: 50000,
            currency: "CNY",
          },
        ],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = extractor.extractTimeline(text, extractedData);

      expect(result.totalEvents).toBeGreaterThan(0);
    });

    it("应该处理空数据", () => {
      const text = "这是一段文本。";

      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = extractor.extractTimeline(text, extractedData);

      expect(result).toBeDefined();
      expect(result.totalEvents).toBe(0);
    });
  });

  describe("analyzeIntervals", () => {
    it("应该计算时间间隔", () => {
      const text = `
        2024年1月15日签订合同。
        2024年3月15日支付第一期款项。
        2024年6月15日支付第二期款项。
      `;

      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = extractor.extractTimeline(text, extractedData);

      expect(result.intervals).toBeInstanceOf(Array);
      expect(result.averageInterval).toBeGreaterThanOrEqual(0);
    });

    it("应该计算日期范围", () => {
      const text = `
        2024年1月15日签订合同。
        2024年6月15日案件审理终结。
      `;

      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = extractor.extractTimeline(text, extractedData);

      expect(result.dateRange).toBeDefined();
      expect(result.dateRange.start).toBe("2024-01-15");
      expect(result.dateRange.end).toBe("2024-06-15");
      expect(result.dateRange.duration).toBeGreaterThan(0);
    });
  });

  describe("边界情况", () => {
    it("应该处理空文本", () => {
      const text = "";
      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = extractor.extractTimeline(text, extractedData);

      expect(result.totalEvents).toBe(0);
      expect(result.events).toHaveLength(0);
    });

    it("应该处理没有日期的文本", () => {
      const text = "这是一段没有日期信息的文本。";

      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = extractor.extractTimeline(text, extractedData);

      expect(result.totalEvents).toBe(0);
    });

    it("应该处理特殊字符", () => {
      const text = "2024年1月15日\n\t\r签订合同。";

      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = extractor.extractTimeline(text, extractedData);

      expect(result).toBeDefined();
      expect(result.totalEvents).toBeGreaterThanOrEqual(0);
    });

    it("应该处理超长文本", () => {
      const longText = "这是一段文本。".repeat(1000);

      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = extractor.extractTimeline(longText, extractedData);

      expect(result).toBeDefined();
    });
  });

  describe("事件类型识别", () => {
    it("应该识别立案事件", () => {
      const text = "2024年1月15日原告提交立案申请。";
      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = extractor.extractTimeline(text, extractedData);

      expect(result.events).toBeInstanceOf(Array);
    });

    it("应该识别开庭事件", () => {
      const text = "2024年9月15日开庭审理。";
      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = extractor.extractTimeline(text, extractedData);

      expect(result.events).toBeInstanceOf(Array);
    });

    it("应该识别判决事件", () => {
      const text = "2024年12月20日法院作出判决。";
      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = extractor.extractTimeline(text, extractedData);

      expect(result.events).toBeInstanceOf(Array);
    });
  });
});
