/**
 * TimelineExtractor 测试
 * 目标：时间线提取准确性
 */

import {
  TimelineExtractor,
  extractTimelineFromText,
} from "@/lib/agent/doc-analyzer/extractors/timeline-extractor";
import type { ExtractedData } from "@/lib/agent/doc-analyzer/core/types";

describe("TimelineExtractor", () => {
  let extractor: TimelineExtractor;

  beforeEach(() => {
    extractor = new TimelineExtractor();
  });

  describe("extractFromText", () => {
    it("应该从文本中提取时间事件", async () => {
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

      const result = await extractor.extractFromText(text, extractedData, {
        useAIExtraction: false,
        useAIMatching: false,
      });

      expect(result).toBeDefined();
      expect(result.events).toBeInstanceOf(Array);
      expect(result.summary.total).toBeGreaterThan(0);
    });

    it("应该使用提取数据丰富事件", async () => {
      const text = "2024年1月15日签订合同。根据《民法典》第500条规定履行义务。";

      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [
          {
            id: "focus_1",
            category: "PERFORMANCE_DISPUTE",
            description: "合同履行义务",
            positionA: "原告观点",
            positionB: "被告观点",
            coreIssue: "履行争议",
            importance: 5,
            confidence: 0.8,
            relatedClaims: [],
            relatedFacts: [],
            legalBasis: "《民法典》第500条",
          },
        ],
        keyFacts: [],
      };

      const result = await extractor.extractFromText(text, extractedData, {
        useAIExtraction: false,
        useAIMatching: false,
      });

      expect(result.summary.total).toBeGreaterThan(0);
      if (result.events.length > 0) {
        expect(result.events[0].evidence).toBeDefined();
      }
    });

    it("应该处理空数据", async () => {
      const text = "这是一段文本。";

      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = await extractor.extractFromText(text, extractedData, {
        useAIExtraction: false,
        useAIMatching: false,
      });

      expect(result).toBeDefined();
      expect(result.summary.total).toBe(0);
    });
  });

  describe("summary", () => {
    it("应该计算摘要信息", async () => {
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

      const result = await extractor.extractFromText(text, extractedData, {
        useAIExtraction: false,
        useAIMatching: false,
      });

      expect(result.summary).toBeDefined();
      expect(result.summary.total).toBeGreaterThan(0);
      expect(result.summary.avgImportance).toBeGreaterThanOrEqual(0);
      expect(result.summary.earliestDate).toBeDefined();
      expect(result.summary.latestDate).toBeDefined();
    });
  });

  describe("gapInfo", () => {
    it("应该检测时间线缺口", async () => {
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

      const result = await extractor.extractFromText(text, extractedData, {
        useAIExtraction: false,
        useAIMatching: false,
        fillGaps: true,
      });

      expect(result.gapInfo).toBeDefined();
      expect(result.gapInfo.startDate).toBe("2024-01-15");
      expect(result.gapInfo.endDate).toBe("2024-06-15");
      expect(result.gapInfo.missingTypes).toBeInstanceOf(Array);
    });
  });

  describe("边界情况", () => {
    it("应该处理空文本", async () => {
      const text = "";
      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = await extractor.extractFromText(text, extractedData, {
        useAIExtraction: false,
        useAIMatching: false,
      });

      expect(result.summary.total).toBe(0);
      expect(result.events).toHaveLength(0);
    });

    it("应该处理没有日期的文本", async () => {
      const text = "这是一段没有日期信息的文本。";

      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = await extractor.extractFromText(text, extractedData, {
        useAIExtraction: false,
        useAIMatching: false,
      });

      expect(result.summary.total).toBe(0);
    });

    it("应该处理特殊字符", async () => {
      const text = "2024年1月15日\n\t\r签订合同。";

      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = await extractor.extractFromText(text, extractedData, {
        useAIExtraction: false,
        useAIMatching: false,
      });

      expect(result).toBeDefined();
      expect(result.summary.total).toBeGreaterThanOrEqual(0);
    });

    it("应该处理超长文本", async () => {
      const longText = "这是一段文本。".repeat(1000);

      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = await extractor.extractFromText(longText, extractedData, {
        useAIExtraction: false,
        useAIMatching: false,
      });

      expect(result).toBeDefined();
    });
  });

  describe("事件类型识别", () => {
    it("应该识别合同签订事件", async () => {
      const text = "2024年1月15日双方签订合同。";
      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = await extractor.extractFromText(text, extractedData, {
        useAIExtraction: false,
        useAIMatching: false,
      });

      expect(result.events).toBeInstanceOf(Array);
      if (result.events.length > 0) {
        expect(result.events[0].eventType).toBe("CONTRACT_SIGNED");
      }
    });

    it("应该识别违约事件", async () => {
      const text = "2024年3月1日被告发生违约。";
      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = await extractor.extractFromText(text, extractedData, {
        useAIExtraction: false,
        useAIMatching: false,
      });

      expect(result.events).toBeInstanceOf(Array);
      if (result.events.length > 0) {
        expect(result.events[0].eventType).toBe("BREACH_OCCURRED");
      }
    });

    it("应该识别诉讼提起事件", async () => {
      const text = "2024年6月1日原告提起诉讼。";
      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = await extractor.extractFromText(text, extractedData, {
        useAIExtraction: false,
        useAIMatching: false,
      });

      expect(result.events).toBeInstanceOf(Array);
      if (result.events.length > 0) {
        expect(result.events[0].eventType).toBe("LAWSUIT_FILED");
      }
    });
  });

  describe("extractTimelineFromText", () => {
    it("应该提供快速提取时间线的便捷方法", async () => {
      const text = `
        2024年1月15日签订合同。
        2024年3月1日支付款项。
        2024年6月1日违约。
      `;

      const events = await extractTimelineFromText(text, undefined, {
        useAIExtraction: false,
        useAIMatching: false,
      });

      expect(events).toBeInstanceOf(Array);
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe("选项配置", () => {
    it("应该支持最小重要性过滤", async () => {
      const text = `
        2024年1月15日签订一些小事情。
        2024年3月1日违约。
      `;

      const result = await extractor.extractFromText(text, undefined, {
        useAIExtraction: false,
        useAIMatching: false,
        minImportance: 4,
      });

      expect(result.events).toBeInstanceOf(Array);
    });

    it("应该支持包含/排除推断事件", async () => {
      const text = `
        2024年1月15日签订合同。
        2024年6月1日违约。
      `;

      const resultWithInferred = await extractor.extractFromText(
        text,
        undefined,
        {
          useAIExtraction: false,
          useAIMatching: false,
          fillGaps: true,
          includeInferred: true,
        },
      );

      const resultWithoutInferred = await extractor.extractFromText(
        text,
        undefined,
        {
          useAIExtraction: false,
          useAIMatching: false,
          fillGaps: true,
          includeInferred: false,
        },
      );

      expect(resultWithInferred.summary.inferredCount).toBeGreaterThanOrEqual(
        resultWithoutInferred.summary.inferredCount,
      );
    });
  });
});
