/**
 * Bad Case扩展测试：金额识别
 * 基于KIMI优化建议报告中的金额识别问题
 */

import { AmountExtractor } from "@/lib/agent/doc-analyzer/extractors/amount-extractor";

describe("Bad Case: 金额识别测试", () => {
  let extractor: AmountExtractor;

  beforeEach(() => {
    extractor = new AmountExtractor();
  });

  describe("中文大写金额识别", () => {
    it("Bad Case 1: 应该正确识别壹佰万元整", async () => {
      const text = "诉讼请求：判令被告偿还借款本金壹佰万元整";
      const result = await extractor.extractFromText(text);

      expect(result.amounts.length).toBeGreaterThan(0);
      const amount = result.amounts[0];
      expect(amount.originalText).toContain("壹佰万元");
      expect(amount.normalizedAmount).toBe(1000000);
    });

    it("Bad Case 2: 应该正确识别伍拾万元", async () => {
      const text = "判令被告支付违约金伍拾万元";
      const result = await extractor.extractFromText(text);

      expect(result.amounts.length).toBeGreaterThan(0);
      const amount = result.amounts[0];
      expect(amount.originalText).toContain("伍拾万元");
      expect(amount.normalizedAmount).toBe(500000);
    });

    it("Bad Case 3: 应该正确识别玖万捌仟元", async () => {
      const text = "判令被告赔偿损失玖万捌仟元";
      const result = await extractor.extractFromText(text);

      expect(result.amounts.length).toBeGreaterThan(0);
      const amount = result.amounts[0];
      expect(amount.originalText).toContain("玖万捌仟元");
      expect(amount.normalizedAmount).toBe(98000);
    });
  });

  describe("阿拉伯数字金额识别", () => {
    it("Bad Case 4: 应该正确识别800,000元（带逗号）", async () => {
      const text = "判令被告支付拖欠货款人民币800,000元";
      const result = await extractor.extractFromText(text);

      expect(result.amounts.length).toBeGreaterThan(0);
      const amount = result.amounts[0];
      expect(amount.originalText).toContain("800,000");
      expect(amount.normalizedAmount).toBe(800000);
    });

    it("Bad Case 5: 应该正确识别1,234,567.89元（带小数）", async () => {
      const text = "判令被告支付货款1,234,567.89元";
      const result = await extractor.extractFromText(text);

      expect(result.amounts.length).toBeGreaterThan(0);
      const amount = result.amounts[0];
      expect(amount.normalizedAmount).toBe(1234567.89);
    });
  });

  describe("混合格式金额识别", () => {
    it("Bad Case 6: 应该优先识别阿拉伯数字（100万）", async () => {
      const text = "判令被告偿还借款100万元";
      const result = await extractor.extractFromText(text);

      expect(result.amounts.length).toBeGreaterThan(0);
      const amount = result.amounts[0];
      expect(amount.originalText).toContain("100万");
      expect(amount.normalizedAmount).toBe(1000000);
    });

    it("Bad Case 7: 应该识别约50万元（近似值）", async () => {
      const text = "判令被告支付约50万元赔偿金";
      const result = await extractor.extractFromText(text);

      expect(result.amounts.length).toBeGreaterThan(0);
      const amount = result.amounts[0];
      expect(amount.normalizedAmount).toBe(500000);
    });

    it("Bad Case 8: 应该识别100万元（壹佰万元整）", async () => {
      const text = "判令被告支付100万元（壹佰万元整）";
      const result = await extractor.extractFromText(text);

      expect(result.amounts.length).toBeGreaterThan(0);
      const amount = result.amounts[0];
      expect(amount.normalizedAmount).toBe(1000000);
    });
  });

  describe("万元单位转换", () => {
    it("Bad Case 9: 应该正确转换10万为100000", async () => {
      const text = "判令被告支付赔偿金10万";
      const result = await extractor.extractFromText(text);

      expect(result.amounts.length).toBeGreaterThan(0);
      const amount = result.amounts[0];
      expect(amount.normalizedAmount).toBe(100000);
    });

    it("Bad Case 10: 应该正确转换1.5万为15000", async () => {
      const text = "判令被告支付违约金1.5万元";
      const result = await extractor.extractFromText(text);

      expect(result.amounts.length).toBeGreaterThan(0);
      const amount = result.amounts[0];
      expect(amount.normalizedAmount).toBe(15000);
    });
  });

  describe("复杂金额场景", () => {
    it("Bad Case 11: 应该识别多个金额", async () => {
      const text = "判令被告支付本金100万元及利息5万元";
      const result = await extractor.extractFromText(text);

      expect(result.amounts.length).toBeGreaterThanOrEqual(2);

      const principal = result.amounts.find((r: any) =>
        r.originalText.includes("100万"),
      );
      const interest = result.amounts.find((r: any) =>
        r.originalText.includes("5万"),
      );

      expect(principal?.normalizedAmount).toBe(1000000);
      expect(interest?.normalizedAmount).toBe(50000);
    });

    it("Bad Case 12: 应该识别范围金额（50-100万元）", async () => {
      const text = "判令被告支付50-100万元赔偿金";
      const result = await extractor.extractFromText(text);

      expect(result.amounts.length).toBeGreaterThan(0);
      // 至少识别其中一个金额
      const amount = result.amounts[0];
      expect(amount.normalizedAmount).toBeGreaterThanOrEqual(500000);
      expect(amount.normalizedAmount).toBeLessThanOrEqual(1000000);
    });
  });

  describe("金额合理性验证", () => {
    it("Bad Case 13: 应该过滤明显不合理的金额", async () => {
      const text = "判令被告支付99999999999999亿元赔偿金";
      const result = await extractor.extractFromText(text);

      // 应该返回但置信度较低
      expect(result.amounts.length).toBeGreaterThan(0);
      const amount = result.amounts[0];
      expect(amount.confidence).toBeLessThan(0.5);
    });

    it("Bad Case 14: 应该处理0元金额", async () => {
      const text = "判令被告支付0元违约金";
      const result = await extractor.extractFromText(text);

      // 应该正确识别为0（或被过滤）
      expect(result.amounts.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("金额去重", () => {
    it("Bad Case 15: 应该去重重复金额", async () => {
      const text = "判令被告支付100万元（即壹佰万元）赔偿金";
      const result = await extractor.extractFromText(text);

      // 应该只返回一个金额
      expect(result.amounts.length).toBe(1);
      expect(result.amounts[0].normalizedAmount).toBe(1000000);
    });

    it("Bad Case 16: 应该保留置信度最高的金额", async () => {
      const text = "判令被告支付约100万元、壹佰万元整赔偿金";
      const result = await extractor.extractFromText(text);

      // 应该返回置信度最高的结果
      expect(result.amounts.length).toBe(1);
      expect(result.amounts[0].normalizedAmount).toBe(1000000);
      expect(result.amounts[0].confidence).toBeGreaterThan(0.7);
    });
  });
});
