/**
 * Bad Case扩展测试：诉讼请求识别
 * 基于KIMI优化建议报告中的诉讼请求分类问题
 */

import { ClaimExtractor } from "@/lib/agent/doc-analyzer/extractors/claim-extractor";

describe("Bad Case: 诉讼请求识别测试", () => {
  let extractor: ClaimExtractor;

  beforeEach(() => {
    extractor = new ClaimExtractor();
  });

  describe("LITIGATION_COST补充测试", () => {
    it("Bad Case 1: 应该补充被遗漏的LITIGATION_COST", async () => {
      const text = "判令被告偿还本金100万元";
      const result = await extractor.extractFromText(text);

      // 应该自动补充LITIGATION_COST
      const hasLitigationCost = result.claims.some(
        (c: any) => c.type === "LITIGATION_COST",
      );
      expect(hasLitigationCost).toBe(true);
    });

    it("Bad Case 2: 明确提到诉讼费用应该被识别", async () => {
      const text = "判令被告承担本案全部诉讼费用";
      const result = await extractor.extractFromText(text);

      const hasLitigationCost = result.claims.some(
        (c: any) => c.type === "LITIGATION_COST",
      );
      expect(hasLitigationCost).toBe(true);
    });

    // 扩展：测试新增的同义词
    it('Bad Case 2a: 应该识别"案件受理费"', async () => {
      const text = "判令被告承担案件受理费5000元";
      const result = await extractor.extractFromText(text);

      const hasLitigationCost = result.claims.some(
        (c: any) => c.type === "LITIGATION_COST",
      );
      expect(hasLitigationCost).toBe(true);
    });

    it('Bad Case 2b: 应该识别"保全费"', async () => {
      const text = "判令被告承担保全费3000元";
      const result = await extractor.extractFromText(text);

      const hasLitigationCost = result.claims.some(
        (c: any) => c.type === "LITIGATION_COST",
      );
      expect(hasLitigationCost).toBe(true);
    });

    it('Bad Case 2c: 应该识别"鉴定费"', async () => {
      const text = "判令被告承担鉴定费10000元";
      const result = await extractor.extractFromText(text);

      const hasLitigationCost = result.claims.some(
        (c: any) => c.type === "LITIGATION_COST",
      );
      expect(hasLitigationCost).toBe(true);
    });

    it('Bad Case 2d: 应该识别"公告费"', async () => {
      const text = "判令被告承担公告费800元";
      const result = await extractor.extractFromText(text);

      const hasLitigationCost = result.claims.some(
        (c: any) => c.type === "LITIGATION_COST",
      );
      expect(hasLitigationCost).toBe(true);
    });

    it('Bad Case 2e: 应该识别"执行费"', async () => {
      const text = "判令被告承担执行费5000元";
      const result = await extractor.extractFromText(text);

      const hasLitigationCost = result.claims.some(
        (c: any) => c.type === "LITIGATION_COST",
      );
      expect(hasLitigationCost).toBe(true);
    });

    it('Bad Case 2f: 应该识别"律师费"', async () => {
      const text = "判令被告承担律师费20000元";
      const result = await extractor.extractFromText(text);

      const hasLitigationCost = result.claims.some(
        (c: any) => c.type === "LITIGATION_COST",
      );
      expect(hasLitigationCost).toBe(true);
    });

    it('Bad Case 2g: 应该识别"代理费"', async () => {
      const text = "判令被告承担代理费15000元";
      const result = await extractor.extractFromText(text);

      const hasLitigationCost = result.claims.some(
        (c: any) => c.type === "LITIGATION_COST",
      );
      expect(hasLitigationCost).toBe(true);
    });

    it('Bad Case 2h: 应该识别"公证费"', async () => {
      const text = "判令被告承担公证费500元";
      const result = await extractor.extractFromText(text);

      const hasLitigationCost = result.claims.some(
        (c: any) => c.type === "LITIGATION_COST",
      );
      expect(hasLitigationCost).toBe(true);
    });

    it('Bad Case 2i: 应该识别"翻译费"', async () => {
      const text = "判令被告承担翻译费1000元";
      const result = await extractor.extractFromText(text);

      const hasLitigationCost = result.claims.some(
        (c: any) => c.type === "LITIGATION_COST",
      );
      expect(hasLitigationCost).toBe(true);
    });

    it('Bad Case 2j: 应该识别"差旅费"', async () => {
      const text = "判令被告承担差旅费2000元";
      const result = await extractor.extractFromText(text);

      const hasLitigationCost = result.claims.some(
        (c: any) => c.type === "LITIGATION_COST",
      );
      expect(hasLitigationCost).toBe(true);
    });

    it('Bad Case 2k: 应该识别"律师费承担"', async () => {
      const text = "判令被告律师费承担25000元";
      const result = await extractor.extractFromText(text);

      const hasLitigationCost = result.claims.some(
        (c: any) => c.type === "LITIGATION_COST",
      );
      expect(hasLitigationCost).toBe(true);
    });

    it('Bad Case 2l: 应该识别"案件费用"', async () => {
      const text = "判令被告承担案件费用8000元";
      const result = await extractor.extractFromText(text);

      const hasLitigationCost = result.claims.some(
        (c: any) => c.type === "LITIGATION_COST",
      );
      expect(hasLitigationCost).toBe(true);
    });
  });

  describe("复合请求拆解测试", () => {
    it('Bad Case 3: 拆解"本金及利息"为两个请求', async () => {
      const text = "判令被告偿还本金及利息共计150万元";
      const result = await extractor.extractFromText(text);

      const hasPrincipal = result.claims.some(
        (c: any) => c.type === "PAY_PRINCIPAL",
      );
      const hasInterest = result.claims.some(
        (c: any) => c.type === "PAY_INTEREST",
      );

      expect(hasPrincipal).toBe(true);
      expect(hasInterest).toBe(true);
    });

    it('Bad Case 4: 拆解"货款及违约金"为两个请求', async () => {
      const text = "判令被告支付货款及违约金";
      const result = await extractor.extractFromText(text);

      const hasPrincipal = result.claims.some(
        (c: any) => c.type === "PAY_PRINCIPAL",
      );
      const hasPenalty = result.claims.some(
        (c: any) => c.type === "PAY_PENALTY",
      );

      expect(hasPrincipal).toBe(true);
      expect(hasPenalty).toBe(true);
    });
  });

  describe("PAY_PRINCIPAL补充测试", () => {
    it('Bad Case 5: 文本有"本金"应该补充PAY_PRINCIPAL', async () => {
      const text = "判令被告支付利息，要求偿还全部本金";
      const result = await extractor.extractFromText(text);

      const hasPrincipal = result.claims.some(
        (c: any) => c.type === "PAY_PRINCIPAL",
      );
      expect(hasPrincipal).toBe(true);
    });

    it('Bad Case 6: 文本有"借款本金"应该识别PAY_PRINCIPAL', async () => {
      const text = "判令被告偿还借款本金50万元";
      const result = await extractor.extractFromText(text);

      const principal = result.claims.find(
        (c: any) => c.type === "PAY_PRINCIPAL",
      );
      expect(principal).toBeDefined();
      expect(principal.content).toContain("本金");
    });
  });

  describe("PAY_PENALTY补充测试", () => {
    it('Bad Case 7: 文本有"违约金"应该补充PAY_PENALTY', async () => {
      const text = "判令被告支付本金和违约金";
      const result = await extractor.extractFromText(text);

      const hasPenalty = result.claims.some(
        (c: any) => c.type === "PAY_PENALTY",
      );
      expect(hasPenalty).toBe(true);
    });

    it('Bad Case 8: 文本有"罚息"应该识别PAY_PENALTY', async () => {
      const text = "判令被告支付逾期罚息";
      const result = await extractor.extractFromText(text);

      const hasPenalty = result.claims.some(
        (c: any) => c.type === "PAY_PENALTY",
      );
      expect(hasPenalty).toBe(true);
    });

    // 扩展：测试新增的同义词
    it('Bad Case 8a: 文本有"罚金"应该识别PAY_PENALTY', async () => {
      const text = "判令被告支付罚金5000元";
      const result = await extractor.extractFromText(text);

      const hasPenalty = result.claims.some(
        (c: any) => c.type === "PAY_PENALTY",
      );
      expect(hasPenalty).toBe(true);
    });

    it('Bad Case 8b: 文本有"罚款"应该识别PAY_PENALTY', async () => {
      const text = "判令被告支付罚款20000元";
      const result = await extractor.extractFromText(text);

      const hasPenalty = result.claims.some(
        (c: any) => c.type === "PAY_PENALTY",
      );
      expect(hasPenalty).toBe(true);
    });

    it('Bad Case 8c: 文本有"违约罚金"应该识别PAY_PENALTY', async () => {
      const text = "判令被告支付违约罚金10000元";
      const result = await extractor.extractFromText(text);

      const hasPenalty = result.claims.some(
        (c: any) => c.type === "PAY_PENALTY",
      );
      expect(hasPenalty).toBe(true);
    });

    it('Bad Case 8d: 文本有"迟延履行金"应该识别PAY_PENALTY', async () => {
      const text = "判令被告支付迟延履行金5000元";
      const result = await extractor.extractFromText(text);

      const hasPenalty = result.claims.some(
        (c: any) => c.type === "PAY_PENALTY",
      );
      expect(hasPenalty).toBe(true);
    });

    it('Bad Case 8e: 文本有"赔偿金违约"应该识别PAY_PENALTY', async () => {
      const text = "判令被告支付赔偿金违约50000元";
      const result = await extractor.extractFromText(text);

      const hasPenalty = result.claims.some(
        (c: any) => c.type === "PAY_PENALTY",
      );
      expect(hasPenalty).toBe(true);
    });

    it('Bad Case 8f: 文本有"违约赔偿"应该识别PAY_PENALTY', async () => {
      const text = "判令被告支付违约赔偿30000元";
      const result = await extractor.extractFromText(text);

      const hasPenalty = result.claims.some(
        (c: any) => c.type === "PAY_PENALTY",
      );
      expect(hasPenalty).toBe(true);
    });
  });

  describe("PAY_INTEREST识别测试", () => {
    it('Bad Case 9: 应该识别"支付利息"', async () => {
      const text = "判令被告按年利率8%支付利息";
      const result = await extractor.extractFromText(text);

      const interest = result.claims.find(
        (c: any) => c.type === "PAY_INTEREST",
      );
      expect(interest).toBeDefined();
      expect(interest.content).toContain("利息");
    });

    it('Bad Case 10: 应该识别"资金占用费"', async () => {
      const text = "判令被告支付资金占用费";
      const result = await extractor.extractFromText(text);

      const interest = result.claims.find(
        (c: any) => c.type === "PAY_INTEREST",
      );
      expect(interest).toBeDefined();
    });

    // 扩展：测试新增的同义词
    it('Bad Case 10a: 应该识别"利息计算"', async () => {
      const text = "判令被告按照年利率8%计算利息";
      const result = await extractor.extractFromText(text);

      const hasInterest = result.claims.some(
        (c: any) => c.type === "PAY_INTEREST",
      );
      expect(hasInterest).toBe(true);
    });

    it('Bad Case 10b: 应该识别"利息支付"', async () => {
      const text = "判令被告利息支付10000元";
      const result = await extractor.extractFromText(text);

      const hasInterest = result.claims.some(
        (c: any) => c.type === "PAY_INTEREST",
      );
      expect(hasInterest).toBe(true);
    });

    it('Bad Case 10c: 应该识别"利息承担"', async () => {
      const text = "判令被告承担利息20000元";
      const result = await extractor.extractFromText(text);

      const hasInterest = result.claims.some(
        (c: any) => c.type === "PAY_INTEREST",
      );
      expect(hasInterest).toBe(true);
    });

    it('Bad Case 10d: 应该识别"利息偿还"', async () => {
      const text = "判令被告偿还利息5000元";
      const result = await extractor.extractFromText(text);

      const hasInterest = result.claims.some(
        (c: any) => c.type === "PAY_INTEREST",
      );
      expect(hasInterest).toBe(true);
    });

    it('Bad Case 10e: 应该识别"年利率利息"', async () => {
      const text = "判令被告按年利率6%计算利息";
      const result = await extractor.extractFromText(text);

      const hasInterest = result.claims.some(
        (c: any) => c.type === "PAY_INTEREST",
      );
      expect(hasInterest).toBe(true);
    });

    it('Bad Case 10f: 应该识别"月利率利息"', async () => {
      const text = "判令被告按月利率0.5%计算利息";
      const result = await extractor.extractFromText(text);

      const hasInterest = result.claims.some(
        (c: any) => c.type === "PAY_INTEREST",
      );
      expect(hasInterest).toBe(true);
    });
  });

  describe("类型标准化测试", () => {
    it('Bad Case 11: 应该标准化"律师费"为相关类型', async () => {
      const text = "判令被告承担律师费";
      const result = await extractor.extractFromText(text);

      expect(result.claims.length).toBeGreaterThan(0);
      const claim = result.claims[0];
      expect(claim.type).toBeDefined();
      expect(claim.type.length).toBeGreaterThan(0);
    });

    it('Bad Case 12: 应该标准化"差旅费"', async () => {
      const text = "判令被告支付差旅费";
      const result = await extractor.extractFromText(text);

      expect(result.claims.length).toBeGreaterThan(0);
      const claim = result.claims[0];
      expect(claim.type).toBeDefined();
    });
  });
});
