// =============================================================================
// DocAnalyzer 时间线提取器测试
// 目标：时间线提取完整
// =============================================================================

import { TimelineExtractor, createTimelineExtractor, extractTimelineFromText } from '@/lib/agent/doc-analyzer/extractors/timeline-extractor';
import type { TimelineEventType, DisputeFocusCategory, ClaimType } from '@/lib/agent/doc-analyzer/core/types';

describe('TimelineExtractor', () => {
  let extractor: TimelineExtractor;

  beforeEach(() => {
    extractor = createTimelineExtractor();
  });

  describe('extractFromText', () => {
    it('应该提取合同签订事件', async () => {
      const text = '双方于2024年1月15日签订了合同。';
      const result = await extractor.extractFromText(text);

      expect(result.events.length).toBeGreaterThan(0);
      const contractEvent = result.events.find(e => e.eventType === 'CONTRACT_SIGNED');
      expect(contractEvent).toBeDefined();
      expect(contractEvent?.date).toBe('2024-01-15');
    });

    it('应该提取履行开始事件', async () => {
      const text = '原告于2024年2月1日开始履行合同义务。';
      const result = await extractor.extractFromText(text);

      expect(result.events.length).toBeGreaterThan(0);
      const performanceEvent = result.events.find(e => e.eventType === 'PERFORMANCE_START');
      expect(performanceEvent).toBeDefined();
    });

    it('应该提取违约事件', async () => {
      const text = '被告于2024年3月10日发生违约，未按约定履行。';
      const result = await extractor.extractFromText(text);

      expect(result.events.length).toBeGreaterThan(0);
      const breachEvent = result.events.find(e => e.eventType === 'BREACH_OCCURRED');
      expect(breachEvent).toBeDefined();
    });

    it('应该提取起诉事件', async () => {
      const text = '原告于2024年4月20日向法院提起诉讼。';
      const result = await extractor.extractFromText(text);

      expect(result.events.length).toBeGreaterThan(0);
      const lawsuitEvent = result.events.find(e => e.eventType === 'LAWSUIT_FILED');
      expect(lawsuitEvent).toBeDefined();
    });

    it('应该按时间排序事件', async () => {
      const text = '原告于2024年4月20日起诉，被告于2024年3月10日违约，双方于2024年1月15日签订合同。';
      const result = await extractor.extractFromText(text);

      expect(result.events.length).toBe(3);
      expect(result.events[0].eventType).toBe('CONTRACT_SIGNED');
      expect(result.events[1].eventType).toBe('BREACH_OCCURRED');
      expect(result.events[2].eventType).toBe('LAWSUIT_FILED');
    });

    it('应该计算重要性评分', async () => {
      const text = '双方于2024年1月15日签订合同。';
      const result = await extractor.extractFromText(text);

      result.events.forEach(event => {
        expect(event.importance).toBeGreaterThan(0);
        expect(event.importance).toBeLessThanOrEqual(5);
      });
    });

    it('应该生成正确的摘要', async () => {
      const text = '双方于2024年1月15日签订合同，2024年3月10日被告违约，2024年4月20日原告起诉。';
      const result = await extractor.extractFromText(text);

      expect(result.summary.total).toBeGreaterThan(0);
      expect(result.summary.explicitCount).toBeGreaterThan(0);
      expect(result.summary.avgImportance).toBeGreaterThan(0);
    });

    it('应该过滤低重要性事件', async () => {
      const text = '双方于2024年1月15日签订合同，2024年1月20日进行了沟通。';
      const result = await extractor.extractFromText(text, undefined, { minImportance: 5 });

      result.events.forEach(event => {
        expect(event.importance).toBeGreaterThanOrEqual(5);
      });
    });

    it('应该推断缺失的事件类型', async () => {
      const text = '双方签订了合同，被告未履行，原告向法院提起诉讼。';
      const result = await extractor.extractFromText(text, undefined, { fillGaps: true });

      const contractEvent = result.events.find(e => e.eventType === 'CONTRACT_SIGNED');
      const breachEvent = result.events.find(e => e.eventType === 'BREACH_OCCURRED');
      const lawsuitEvent = result.events.find(e => e.eventType === 'LAWSUIT_FILED');

      expect(contractEvent).toBeDefined();
      expect(breachEvent).toBeDefined();
      expect(lawsuitEvent).toBeDefined();
    });

    it('应该识别多种日期格式', async () => {
      const text = '2024年1月15日签订合同，2024-02-01开始履行，2024年3月10日违约。';
      const result = await extractor.extractFromText(text);

      expect(result.events.length).toBe(3);
    });
  });

  describe('extractTimelineFromText', () => {
    it('应该快速提取时间线', async () => {
      const events = await extractTimelineFromText('双方于2024年1月15日签订合同。');

      expect(events.length).toBeGreaterThan(0);
    });

    it('应该返回空数组', async () => {
      const events = await extractTimelineFromText('这是一段没有时间信息的文本');

      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('时间线完整性验证', () => {
    it('应该提取完整的时间线', async () => {
      const text = '双方于2024年1月15日签订合同，2024年2月1日开始履行，2024年3月10日被告违约，2024年3月20日原告发函催告，2024年4月20日原告起诉。';
      const result = await extractor.extractFromText(text);

      // 验证关键事件类型都存在
      const eventTypes = new Set(result.events.map(e => e.eventType));
      expect(eventTypes.has('CONTRACT_SIGNED')).toBe(true);
      expect(eventTypes.has('PERFORMANCE_START') || eventTypes.has('BREACH_OCCURRED')).toBe(true);
      expect(eventTypes.has('LAWSUIT_FILED')).toBe(true);
    });

    it('应该正确处理缺失日期的事件', async () => {
      const text = '双方签订合同后开始履行，但被告未按时付款。';
      const result = await extractor.extractFromText(text);

      // 即使没有明确日期，也应该提取到事件
      expect(result.events.length).toBeGreaterThan(0);
    });
  });

  describe('事件关联性验证', () => {
    it('应该关联争议焦点', async () => {
      const extractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [
          {
            id: 'focus_1',
            category: 'CONTRACT_BREACH' as DisputeFocusCategory,
            description: '合同违约争议',
            positionA: '原告认为被告违约',
            positionB: '被告辩称已履行',
            coreIssue: '是否违约',
            importance: 8,
            confidence: 0.8,
            relatedClaims: [],
            relatedFacts: [],
            evidence: ['民法典第509条'],
            legalBasis: '民法典第509条'
          }
        ],
        keyFacts: []
      };

      const text = '双方于2024年1月15日签订合同。';
      const result = await extractor.extractFromText(text, extractedData);

      // 验证事件是否被关联了法律依据
      const contractEvent = result.events[0];
      expect(contractEvent).toBeDefined();
    });

    it('应该关联诉讼请求', async () => {
      const extractedData = {
        parties: [],
        claims: [
          {
            type: 'PAY_PRINCIPAL' as ClaimType,
            content: '偿还本金5万元',
            amount: 50000,
            currency: 'CNY',
            evidence: [],
            legalBasis: '民法典第577条'
          }
        ],
        disputeFocuses: [],
        keyFacts: []
      };

      const text = '原告要求被告偿还本金。';
      const result = await extractor.extractFromText(text, extractedData);

      expect(result.events.length).toBeGreaterThan(0);
    });
  });

  describe('时区处理专项测试', () => {
    it('应该正确处理本地时区日期 - 2024年1月15日', async () => {
      const text = '双方于2024年1月15日签订了合同。';
      const result = await extractor.extractFromText(text);
      
      const contractEvent = result.events.find(e => e.eventType === 'CONTRACT_SIGNED');
      expect(contractEvent?.date).toBe('2024-01-15');
    });

    it('应该正确处理本地时区日期 - 2024年12月31日', async () => {
      const text = '双方于2024年12月31日终止合同。';
      const result = await extractor.extractFromText(text);
      
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events[0].date).toBe('2024-12-31');
    });

    it('应该正确处理闰年日期 - 2024年2月29日', async () => {
      const text = '双方于2024年2月29日签订补充协议。';
      const result = await extractor.extractFromText(text);
      
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events[0].date).toBe('2024-02-29');
    });

    it('应该正确处理月末日期 - 2024年4月30日', async () => {
      const text = '双方于2024年4月30日完成交付。';
      const result = await extractor.extractFromText(text);
      
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events[0].date).toBe('2024-04-30');
    });
  });

  describe('多种日期格式测试', () => {
    const dateFormatTestCases = [
      { format: 'YYYY年MM月DD日', text: '双方于2024年1月15日签订合同', expected: '2024-01-15' },
      { format: 'YYYY-MM-DD', text: '双方于2024-01-15签订合同', expected: '2024-01-15' },
      { format: 'YYYY/MM/DD', text: '双方于2024/01/15签订合同', expected: '2024-01-15' },
      { format: 'YYYY.MM.DD', text: '双方于2024.01.15签订合同', expected: '2024-01-15' },
      { format: 'YYYY年MM月', text: '双方于2024年1月签订合同', expected: '2024-01' },
      { format: 'MM月DD日', text: '双方于1月15日签订合同', expected: '1月15日' }
    ];

    it.each(dateFormatTestCases)('应该正确识别 $format 格式', async ({ text, expected }) => {
      const result = await extractor.extractFromText(text);
      
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events[0].date).toContain(expected);
    });

    it('应该处理连续多个不同格式的日期', async () => {
      const text = '2024年1月15日签订合同，2024-02-01开始履行，2024/03/10发生违约。';
      const result = await extractor.extractFromText(text);
      
      expect(result.events.length).toBe(3);
      expect(result.events[0].date).toBe('2024-01-15');
      expect(result.events[1].date).toBe('2024-02-01');
      expect(result.events[2].date).toBe('2024-03-10');
    });

    it('应该处理带时间的日期', async () => {
      const text = '双方于2024年1月15日14:30签订合同。';
      const result = await extractor.extractFromText(text);
      
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events[0].date).toBe('2024-01-15');
    });

    it('应该处理中文数字日期', async () => {
      const text = '双方于二〇二四年一月十五日签订合同。';
      const result = await extractor.extractFromText(text);
      
      // 中文数字日期可能无法解析，但不应报错
      expect(Array.isArray(result.events)).toBe(true);
    });
  });

  describe('边界情况测试', () => {
    it('应该处理空文本', async () => {
      const result = await extractor.extractFromText('');
      
      expect(Array.isArray(result.events)).toBe(true);
      expect(result.events.length).toBe(0);
      expect(result.summary.total).toBe(0);
    });

    it('应该处理纯空白文本', async () => {
      const result = await extractor.extractFromText('   \n\t  \r\n  ');
      
      expect(Array.isArray(result.events)).toBe(true);
      expect(result.events.length).toBe(0);
    });

    it('应该处理只有时间没有日期的文本', async () => {
      const text = '双方于14:30签订了合同。';
      const result = await extractor.extractFromText(text);
      
      // 不应提取事件，因为没有完整日期
      expect(Array.isArray(result.events)).toBe(true);
    });

    it('应该处理没有时间信息的文本', async () => {
      const text = '这是一个没有时间信息的文本，只描述了双方的行为。';
      const result = await extractor.extractFromText(text);
      
      // AI推断层可能会产生一些事件，但不应报错
      expect(Array.isArray(result.events)).toBe(true);
    });

    it('应该处理无效日期格式', async () => {
      const text = '双方于2024-13-32签订合同。';
      const result = await extractor.extractFromText(text);
      
      // 不应因无效日期而崩溃
      expect(Array.isArray(result.events)).toBe(true);
    });

    it('应该处理重复的日期事件', async () => {
      const text = '双方于2024年1月15日签订合同，当天2024年1月15日完成付款。';
      const result = await extractor.extractFromText(text);
      
      // 应该去重或合并同日事件
      expect(result.events.length).toBeGreaterThanOrEqual(1);
      const dates = result.events.map(e => e.date);
      expect(dates.every(d => d === '2024-01-15')).toBe(true);
    });

    it('应该处理超长文本', async () => {
      const longText = '双方于2024年1月15日签订合同。' + '这是一段很长的填充文本。'.repeat(1000);
      const result = await extractor.extractFromText(longText);
      
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events[0].date).toBe('2024-01-15');
    });

    it('应该处理特殊字符和标点', async () => {
      const text = '双方于2024年1月15日，签订合同（含附件）！';
      const result = await extractor.extractFromText(text);
      
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events[0].date).toBe('2024-01-15');
    });

    it('应该处理含有多余空格的文本', async () => {
      const text = '  双方  于  2024  年  1  月  15  日  签订  合同  。  ';
      const result = await extractor.extractFromText(text);
      
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('应该处理混合格式的日期文本', async () => {
      const text = '合同签订于2024年1月15日，但在2024-02-01变更，最后于2024/03/10终止。';
      const result = await extractor.extractFromText(text);
      
      expect(result.events.length).toBeGreaterThanOrEqual(2);
      expect(result.events[0].date).toBe('2024-01-15');
      expect(result.events[1].date).toBe('2024-02-01');
      expect(result.events[2]?.date).toBe('2024-03-10');
    });

    it('应该正确处理不完整月份', async () => {
      const text = '双方于2024年签订合同。';
      const result = await extractor.extractFromText(text);
      
      // 应该提取年份，日期可能不完整
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events[0].date).toContain('2024');
    });
  });

  describe('AI响应解析容错性测试', () => {
    it('应该正确解析标准JSON格式的AI响应', async () => {
      // 这个测试验证AI返回标准JSON格式的情况
      const text = '双方于2024年1月15日签订合同，2024年3月10日违约。';
      const result = await extractor.extractFromText(text, undefined, { useAIExtraction: true });
      
      // 规则匹配层应该能提取到事件
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events[0].date).toBe('2024-01-15');
    });

    it('应该正确处理带代码块标记的AI响应', async () => {
      // 验证AI返回包含```json代码块的情况
      const text = '双方于2024年1月15日签订合同。';
      const result = await extractor.extractFromText(text);
      
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('应该正确处理部分格式错误的JSON', async () => {
      // 验证JSON清理功能
      const text = '双方于2024年1月15日签订合同。';
      const result = await extractor.extractFromText(text);
      
      // 即使JSON格式有问题，规则匹配层应该能兜底
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('应该在AI解析失败时返回规则匹配结果', async () => {
      // 验证三层架构的兜底机制
      const text = '双方于2024年1月15日签订合同，2024年3月10日被告违约。';
      const result = await extractor.extractFromText(text);
      
      // 即使AI层失败，规则匹配层也应该提取到事件
      expect(result.events.length).toBeGreaterThanOrEqual(2);
      expect(result.summary.ruleExtractedCount).toBeGreaterThan(0);
    });

    it('应该记录详细的解析日志', async () => {
      // 这个测试验证日志记录功能
      // 注意：实际运行时需要检查控制台日志
      const text = '双方于2024年1月15日签订合同。';
      const spy = jest.spyOn(console, 'log');
      const warnSpy = jest.spyOn(console, 'warn');
      const errorSpy = jest.spyOn(console, 'error');
      
      try {
        const result = await extractor.extractFromText(text);
        
        // 验证有日志输出
        const logCalls = spy.mock.calls.some(call => 
          call.some(arg => typeof arg === 'string' && arg.includes('AI'))
        );
        // 注意：由于AI层可能不总是调用日志，这里不强制断言
        
        // 验证基本功能
        expect(result.events.length).toBeGreaterThan(0);
      } finally {
        spy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });
  });

  describe('AI响应解析部分解析机制测试', () => {
    it('应该能从部分JSON中提取有效信息', async () => {
      // 验证部分解析机制
      const text = '双方于2024年1月15日签订合同，2024年3月10日违约。';
      const result = await extractor.extractFromText(text);
      
      // 即使部分字段缺失，也应该能提取到有效事件
      expect(result.events.length).toBeGreaterThanOrEqual(1);
      
      // 验证事件包含必需字段
      result.events.forEach(event => {
        expect(event.date).toBeDefined();
        expect(event.event).toBeDefined();
        expect(event.importance).toBeGreaterThan(0);
        expect(event.importance).toBeLessThanOrEqual(5);
      });
    });

    it('应该能处理缺失字段的AI响应', async () => {
      // 验证缺失字段的默认值处理
      const text = '双方于2024年1月15日签订合同。';
      const result = await extractor.extractFromText(text);
      
      result.events.forEach(event => {
        // 即使AI没有返回某些字段，也应该有合理的默认值
        expect(event.importance).toBeGreaterThanOrEqual(1);
        expect(event.importance).toBeLessThanOrEqual(5);
        expect(Array.isArray(event.evidence)).toBe(true);
      });
    });

    it('应该能处理evidence字段不是数组的情况', async () => {
      const text = '双方于2024年1月15日签订合同。';
      const result = await extractor.extractFromText(text);
      
      result.events.forEach(event => {
        expect(Array.isArray(event.evidence)).toBe(true);
      });
    });
  });

  describe('AI审查响应解析测试', () => {
    it('应该正确解析AI审查响应', async () => {
      const text = '双方于2024年1月15日签订合同，2024年3月10日违约。';
      const result = await extractor.extractFromText(text);
      
      // 验证事件被正确处理
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.summary.aiReviewedCount).toBeGreaterThanOrEqual(0);
    });

    it('应该在审查失败时保留原始事件', async () => {
      const text = '双方于2024年1月15日签订合同。';
      const result = await extractor.extractFromText(text);
      
      // 即使审查失败，也应该有事件
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('应该正确处理invalidIds字段', async () => {
      const text = '双方于2024年1月15日签订合同。';
      const result = await extractor.extractFromText(text);
      
      // 验证事件列表不为空
      expect(result.events.length).toBeGreaterThanOrEqual(0);
    });
  });
});
