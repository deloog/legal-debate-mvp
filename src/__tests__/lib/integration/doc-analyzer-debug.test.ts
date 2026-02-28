/**
 * DocAnalyzer调试测试
 * 用于定位当事人提取问题
 */

import { PartyExtractor } from '@/lib/agent/doc-analyzer/extractors/party-extractor';
import { RuleProcessor } from '@/lib/agent/doc-analyzer/processors/rule-processor';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('DocAnalyzer调试测试', () => {
  it('应该能够从测试文件中提取当事人', async () => {
    const testFilePath = join(
      process.cwd(),
      'test-data/legal-documents/test-variation-civil-case.txt'
    );

    // 读取文件内容
    const content = readFileSync(testFilePath, 'utf-8');
    console.log('文件内容长度:', content.length);
    console.log('文件内容前200字符:', content.substring(0, 200));

    // 直接使用PartyExtractor提取
    const extractor = new PartyExtractor();
    const result = await extractor.extractFromText(content);

    console.log('提取的当事人:', result.parties);
    console.log('当事人数量:', result.parties.length);
    console.log('置信度:', result.confidence);

    expect(result.parties.length).toBeGreaterThanOrEqual(2);

    const plaintiff = result.parties.find(p => p.type === 'plaintiff');
    expect(plaintiff).toBeDefined();
    expect(plaintiff?.name).toBe('王小红');

    const defendant = result.parties.find(p => p.type === 'defendant');
    expect(defendant).toBeDefined();
    expect(defendant?.name).toBe('张大伟');
  });

  it('RuleProcessor应该能够补充当事人', async () => {
    const testFilePath = join(
      process.cwd(),
      'test-data/legal-documents/test-variation-civil-case.txt'
    );

    const content = readFileSync(testFilePath, 'utf-8');

    // 模拟AI失败返回空数据
    const aiData = {
      parties: [],
      claims: [],
      timeline: [],
      summary: '',
      keyFacts: [],
    };

    // 使用RuleProcessor处理
    const processor = new RuleProcessor();
    const result = await processor.process(aiData, content);

    console.log('RuleProcessor处理后的当事人:', result.data.parties);
    console.log('当事人数量:', result.data.parties.length);
    console.log('修正记录:', result.corrections);

    expect(result.data.parties.length).toBeGreaterThanOrEqual(2);

    const plaintiff = result.data.parties.find(p => p.type === 'plaintiff');
    expect(plaintiff).toBeDefined();
    expect(plaintiff?.name).toBe('王小红');

    const defendant = result.data.parties.find(p => p.type === 'defendant');
    expect(defendant).toBeDefined();
    expect(defendant?.name).toBe('张大伟');
  });
});
