// 调试测试 - 检查规则匹配是否正常工作
import { DisputeFocusExtractor } from '@/lib/agent/doc-analyzer/extractors/dispute-focus-extractor';

describe('DisputeFocusExtractor - 调试', () => {
  let extractor: DisputeFocusExtractor;

  beforeEach(() => {
    extractor = new DisputeFocusExtractor();
  });

  it('规则匹配应该能识别违约', async () => {
    const text = '原告认为被告未履行合同义务，构成违约。';
    const result = await extractor.extractFromText(text, undefined, { useAIExtraction: false, useAIMatching: false });
    
    console.log('规则匹配结果:', JSON.stringify(result, null, 2));
    console.log('争议焦点数量:', result.disputeFocuses.length);
    
    expect(result.disputeFocuses.length).toBeGreaterThan(0);
  });
});
