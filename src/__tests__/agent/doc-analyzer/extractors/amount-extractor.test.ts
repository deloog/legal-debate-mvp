// =============================================================================
// DocAnalyzer 金额提取器测试
// =============================================================================

import { AmountExtractor, extractBestAmount, createAmountExtractor } from '@/lib/agent/doc-analyzer/extractors/amount-extractor';

describe('AmountExtractor', () => {
  let extractor: AmountExtractor;

  beforeEach(() => {
    extractor = createAmountExtractor();
  });

  describe('extractFromText', () => {
    it('应该提取阿拉伯数字金额', async () => {
      const result = await extractor.extractFromText('偿还本金50000元');
      
      expect(result.amounts).toHaveLength(1);
      expect(result.amounts[0].normalizedAmount).toBe(50000);
      expect(result.amounts[0].currency).toBe('CNY');
      expect(result.amounts[0].confidence).toBeGreaterThan(0.5);
    });

    it('应该提取万元单位的金额', async () => {
      const result = await extractor.extractFromText('赔偿10万元');
      
      expect(result.amounts).toHaveLength(1);
      expect(result.amounts[0].normalizedAmount).toBe(100000);
    });

    it('应该提取中文大写金额', async () => {
      const result = await extractor.extractFromText('人民币伍万元整');
      
      expect(result.amounts).toHaveLength(1);
      expect(result.amounts[0].normalizedAmount).toBe(50000);
    });

    it('应该处理混合格式金额', async () => {
      const result = await extractor.extractFromText('500万元（伍佰万元整）');
      
      expect(result.amounts.length).toBeGreaterThan(0);
    });

    it('应该去重相同金额', async () => {
      const result = await extractor.extractFromText('50000元和50000元');
      
      expect(result.amounts).toHaveLength(1);
    });

    it('应该生成正确的摘要', async () => {
      const result = await extractor.extractFromText('本金50000元，利息10000元');
      
      expect(result.summary.total).toBe(60000);
      expect(result.summary.count).toBe(2);
      expect(result.summary.average).toBe(30000);
    });

    it('应该验证金额合理性', async () => {
      const result = await extractor.extractFromText('支付1000元');
      
      expect(result.validation.isValid).toBe(true);
      expect(result.validation.riskLevel).toBe('low');
    });

    it('应该识别异常大的金额', async () => {
      const result = await extractor.extractFromText('支付200000000元');
      
      expect(result.validation.issues).toContain('金额异常大: 200000000');
    });
  });

  describe('isAmountReasonable', () => {
    it('应该接受合理的金额', () => {
      expect(extractor.isAmountReasonable(1000, 'CNY')).toBe(true);
      expect(extractor.isAmountReasonable(10000, 'CNY')).toBe(true);
    });

    it('应该拒绝负金额', () => {
      expect(extractor.isAmountReasonable(-100, 'CNY')).toBe(false);
    });

    it('应该拒绝零金额', () => {
      expect(extractor.isAmountReasonable(0, 'CNY')).toBe(false);
    });

    it('应该拒绝过大的金额', () => {
      expect(extractor.isAmountReasonable(200000000, 'CNY')).toBe(false);
    });
  });

  describe('formatAmount', () => {
    it('应该格式化人民币金额', () => {
      const formatted = extractor.formatAmount(12345.67, 'CNY');
      expect(formatted).toBe('¥12,345.67');
    });

    it('应该格式化美元金额', () => {
      const formatted = extractor.formatAmount(12345.67, 'USD');
      expect(formatted).toBe('$12,345.67');
    });

    it('应该处理整数金额', () => {
      const formatted = extractor.formatAmount(10000, 'CNY');
      expect(formatted).toBe('¥10,000.00');
    });
  });

  describe('normalizeBatch', () => {
    it('应该批量标准化金额', async () => {
      const amounts = ['10000元', '5000元', '20000元'];
      const result = await extractor.normalizeBatch(amounts);
      
      expect(result).toEqual([10000, 5000, 20000]);
    });

    it('应该处理万元单位', async () => {
      const amounts = ['10万', '5万'];
      const result = await extractor.normalizeBatch(amounts);
      
      expect(result).toEqual([100000, 50000]);
    });
  });
});

describe('extractBestAmount', () => {
  it('应该返回最佳金额', async () => {
    const result = await extractBestAmount('偿还本金50000元和利息10000元');
    
    expect(result).not.toBeNull();
    expect(result?.amount).toBeGreaterThan(0);
    expect(result?.currency).toBe('CNY');
    expect(result?.confidence).toBeGreaterThan(0);
  });

  it('应该在没有金额时返回null', async () => {
    const result = await extractBestAmount('这是一段没有金额的文本');
    
    expect(result).toBeNull();
  });

  it('应该按置信度排序', async () => {
    const result = await extractBestAmount('伍万元整（大写）和5万元');
    
    expect(result).not.toBeNull();
  });
});
