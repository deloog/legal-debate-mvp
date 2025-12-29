/**
 * FilterProcessor 单元测试
 *
 * 测试第一层快速过滤功能：
 * - OCR文本质量检查
 * - 文档类型分类
 * - 基础格式校验
 */

import {
  FilterProcessor,
  FilterConfig,
} from "../../../../lib/agent/doc-analyzer/processors/filter-processor";

describe("FilterProcessor", () => {
  let processor: FilterProcessor;

  beforeEach(() => {
    processor = new FilterProcessor();
  });

  describe("OCR质量检查", () => {
    it("应该通过正常的中文文本", async () => {
      const text =
        "张三诉李四借款合同纠纷一案。" +
        "被告于2020年1月1日向原告借款100万元，约定年利率5%。" +
        "请求判令被告偿还借款。";

      const result = await processor.process(text);

      expect(result.passed).toBe(true);
      expect(result.qualityScore).toBeGreaterThan(0.5);
      expect(result.warnings.length).toBeLessThan(2);
    });

    it("应该拒绝空文本", async () => {
      const text = "";
      const result = await processor.process(text);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain("OCR质量不合格");
    });

    it("应该拒绝只有空白字符的文本", async () => {
      const text = "   \n\n\t   ";
      const result = await processor.process(text);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain("OCR质量不合格");
    });

    it("应该警告文本长度过短", async () => {
      const text = "短文本";
      const result = await processor.process(text);

      expect(result.passed).toBe(false);
      expect(result.warnings.some((w) => w.includes("文本长度过短"))).toBe(
        true,
      );
    });

    it("应该警告中文字符过少", async () => {
      const text = "a".repeat(100);
      const result = await processor.process(text);

      expect(result.passed).toBe(false);
      expect(result.warnings.some((w) => w.includes("中文字符过少"))).toBe(
        true,
      );
    });

    it("应该处理乱码比例过高的情况", async () => {
      const text = "正常文本".repeat(10) + "\x00\x01\x02\xFFFD".repeat(50);
      const result = await processor.process(text);

      expect(result.warnings.some((w) => w.includes("乱码比例"))).toBe(true);
    });
  });

  describe("文档类型分类", () => {
    it("应该正确识别民事文档", async () => {
      const text =
        "原告张三诉被告李四借款合同纠纷一案。" +
        "请求法院判令被告偿还借款本金及利息。";

      const result = await processor.process(text);

      expect(result.documentType).toBe("civil");
    });

    it("应该正确识别刑事文档", async () => {
      const text =
        "被告人张三因涉嫌盗窃罪被提起公诉。" +
        "检察院指控被告人于2023年盗窃他人财物。";

      const result = await processor.process(text);

      expect(result.documentType).toBe("criminal");
    });

    it("应该正确识别行政文档", async () => {
      const text =
        "原告张三不服某局行政处罚决定，提起行政诉讼。" +
        "请求撤销该行政处罚决定。";

      const result = await processor.process(text);

      expect(result.documentType).toBe("administrative");
    });

    it("应该正确识别商事文档", async () => {
      const text =
        "某公司诉某企业股东资格确认纠纷案。" + "请求法院确认原告的股东资格。";

      const result = await processor.process(text);

      expect(result.documentType).toBe("commercial");
    });

    it("应该正确识别劳动文档", async () => {
      const text =
        "原告张三与被告某公司劳动争议案件。" +
        "请求支付解除劳动合同经济补偿金。";

      const result = await processor.process(text);

      expect(result.documentType).toBe("labor");
    });

    it("应该识别无明确类型的文档为other", async () => {
      const text = "这是一段普通的文本，没有特定的法律文档特征。";

      const result = await processor.process(text);

      expect(result.documentType).toBe("other");
    });
  });

  describe("基础格式校验", () => {
    it("应该通过格式正确的民事文档", async () => {
      const text =
        "张三诉李四借款合同纠纷一案。" +
        "原告张三，被告李四。" +
        "请求判令被告偿还借款。";

      const result = await processor.process(text);

      expect(result.passed).toBe(true);
      expect(result.warnings.length).toBeLessThan(2);
    });

    it("应该警告缺少原告或被告", async () => {
      // 需要足够长的文本通过质量检查，但没有原告或被告
      const text =
        "这是一份关于借款合同纠纷的文档。" +
        "合同约定于2020年签订，借款金额为100万元。" +
        "双方约定年利率为5%，借款期限为一年。" +
        "但文档中没有明确指出谁是起诉方和被诉方。";

      const result = await processor.process(text);

      // 应该有缺少原告或被告的警告
      expect(result.warnings.some((w) => w.includes("原告或被告"))).toBe(true);
    });

    it("应该警告文档过短", async () => {
      const text = "简短文档";

      const result = await processor.process(text);

      expect(result.warnings.some((w) => w.includes("过短"))).toBe(true);
    });
  });

  describe("文本清理", () => {
    it("应该去除多余的空白字符", async () => {
      const text = "测试文档" + "     ".repeat(5) + "正常内容";

      const result = await processor.process(text);

      expect(result.filteredText).toContain("测试文档");
      expect(result.filteredText).toContain("正常内容");
      // 只检查不应该有段落内部的大块空格
      expect(result.filteredText).not.toMatch(/^ +/gm);
      expect(result.filteredText).not.toMatch(/ +$/gm);
    });

    it("应该标准化换行符", async () => {
      const text = "测试文档\r\n正常内容\r更多内容";

      const result = await processor.process(text);

      expect(result.filteredText).toContain("\n");
    });

    it("应该保留有效的中文和英文内容", async () => {
      const text = "原告张三诉被告Company借款合同纠纷。";

      const result = await processor.process(text);

      expect(result.filteredText).toContain("原告张三");
      expect(result.filteredText).toContain("Company");
    });
  });

  describe("性能测试", () => {
    it("应该快速处理（<50ms）", async () => {
      const text =
        "原告张三诉被告李四借款合同纠纷一案。" +
        "被告于2020年1月1日向原告借款100万元，约定年利率5%。" +
        "请求法院判令被告偿还借款本金及利息。";

      const startTime = Date.now();
      await processor.process(text);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe("配置管理", () => {
    it("应该支持自定义配置", () => {
      const config: Partial<FilterConfig> = {
        minWordCount: 50,
        minChineseChars: 100,
        maxGarbageRatio: 0.1,
        minQualityScore: 0.8,
      };

      const customProcessor = new FilterProcessor(config);
      const actualConfig = customProcessor.getConfig();

      expect(actualConfig.minWordCount).toBe(50);
      expect(actualConfig.minChineseChars).toBe(100);
      expect(actualConfig.maxGarbageRatio).toBe(0.1);
      expect(actualConfig.minQualityScore).toBe(0.8);
    });

    it("应该支持动态更新配置", async () => {
      const text = "测试文本长度足够中文字符足够诉原告被告。";

      const result1 = await processor.process(text);
      expect(result1.passed).toBe(true);

      processor.updateConfig({ minWordCount: 1000 });

      const result2 = await processor.process(text);
      expect(result2.passed).toBe(false);
    });
  });

  describe("边界情况", () => {
    it("应该处理刚好达到最小要求的文本", async () => {
      const text =
        "a".repeat(15) +
        "张三李四王五赵六孙七周八吴九郑十诉" +
        "测试测试测试测试测试测试测试测试测试测试测试";

      const result = await processor.process(text);

      expect(result.passed).toBe(true);
    });

    it("应该处理非常大的文档", async () => {
      const text = "原告张三诉被告李四借款合同纠纷一案。".repeat(1000);

      const result = await processor.process(text);

      expect(result.passed).toBe(true);
      expect(result.filteredText.length).toBeGreaterThan(0);
    });

    it("应该处理特殊字符混合的文本", async () => {
      const text = "原告张三（身份证号：123456789012345678）诉被告李四。";

      const result = await processor.process(text);

      expect(result.passed).toBe(true);
    });
  });
});
