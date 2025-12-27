// 调试测试 - 检查为什么准确率是75%
import { DisputeFocusExtractor } from '@/lib/agent/doc-analyzer/extractors/dispute-focus-extractor';

// Mock AI Service
const mockAIChat = jest.fn();

jest.mock('@/lib/ai/unified-service', () => ({
  getUnifiedAIService: jest.fn(() => Promise.resolve({
    chatCompletion: mockAIChat
  }))
}));

describe('DisputeFocusExtractor - 准确率调试', () => {
  let extractor: DisputeFocusExtractor;

  beforeEach(() => {
    extractor = new DisputeFocusExtractor();
    mockAIChat.mockClear();
  });

  it('调试：逐个测试合同违约识别', async () => {
    const testCases = [
      '原告认为被告未履行合同义务，构成违约',
      '被告存在违约行为',
      '合同违约事实清楚',
      '未按合同约定履行'
    ];

    mockAIChat.mockResolvedValue({
      choices: [{ message: { content: '{"disputeFocuses": []}' } }]
    });

    for (const text of testCases) {
      const result = await extractor.extractFromText(text, undefined, { useAIMatching: false });
      const hasBreach = result.disputeFocuses.some(f => f.category === 'CONTRACT_BREACH');
      console.log(`Text: "${text}"`);
      console.log(`  - Extracted ${result.disputeFocuses.length} focuses`);
      console.log(`  - Has CONTRACT_BREACH: ${hasBreach}`);
      if (result.disputeFocuses.length > 0) {
        console.log(`  - Categories: ${result.disputeFocuses.map(f => f.category).join(', ')}`);
      }
    }
  });

  it('调试：逐个测试支付争议识别', async () => {
    const testCases = [
      '双方对支付数额存在争议',
      '本金数额认定不一致',
      '关于支付金额有分歧',
      '赔偿数额有争议'
    ];

    mockAIChat.mockResolvedValue({
      choices: [{ message: { content: '{"disputeFocuses": []}' } }]
    });

    for (const text of testCases) {
      const result = await extractor.extractFromText(text, undefined, { useAIMatching: false });
      const hasPayment = result.disputeFocuses.some(
        f => f.category === 'PAYMENT_DISPUTE' || f.category === 'DAMAGES_CALCULATION'
      );
      console.log(`Text: "${text}"`);
      console.log(`  - Extracted ${result.disputeFocuses.length} focuses`);
      console.log(`  - Has Payment Dispute: ${hasPayment}`);
      if (result.disputeFocuses.length > 0) {
        console.log(`  - Categories: ${result.disputeFocuses.map(f => f.category).join(', ')}`);
      }
    }
  });

  it('调试：逐个测试责任认定识别', async () => {
    const testCases = [
      '对于违约责任应由谁承担，双方存在分歧',
      '责任认定是本案的争议焦点',
      '谁应该承担违约责任',
      '责任划分存在争议'
    ];

    mockAIChat.mockResolvedValue({
      choices: [{ message: { content: '{"disputeFocuses": []}' } }]
    });

    for (const text of testCases) {
      const result = await extractor.extractFromText(text, undefined, { useAIMatching: false });
      const hasLiability = result.disputeFocuses.some(f => f.category === 'LIABILITY_ISSUE');
      console.log(`Text: "${text}"`);
      console.log(`  - Extracted ${result.disputeFocuses.length} focuses`);
      console.log(`  - Has LIABILITY_ISSUE: ${hasLiability}`);
      if (result.disputeFocuses.length > 0) {
        console.log(`  - Categories: ${result.disputeFocuses.map(f => f.category).join(', ')}`);
      }
    }
  });
});
