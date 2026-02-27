/**
 * 快速验证Mock模式修复
 * 直接测试PartyExtractor和RuleProcessor的算法兜底功能
 */

import { PartyExtractor } from '@/lib/agent/doc-analyzer/extractors/party-extractor';
import { RuleProcessor } from '@/lib/agent/doc-analyzer/processors/rule-processor';

describe('Mock模式修复验证', () => {
  it('PartyExtractor应该能够提取当事人（算法兜底）', async () => {
    const text = `
民事起诉状

原告：王小红，女，1990年3月8日出生，汉族，住上海市浦东新区陆家嘴环路100号

被告：张大伟，男，1988年7月12日出生，汉族，住上海市徐汇区淮海中路200号

第三人：赵明，男，1985年11月20日出生，汉族，住上海市静安区南京西路300号
    `;

    const extractor = new PartyExtractor();
    const result = await extractor.extractFromText(text);

    console.log('✅ PartyExtractor测试结果:');
    console.log('  - 提取的当事人数量:', result.parties.length);
    console.log(
      '  - 当事人列表:',
      result.parties.map(p => `${p.name}(${p.role})`)
    );
    console.log('  - 置信度:', result.confidence);

    expect(result.parties.length).toBeGreaterThanOrEqual(3);

    const plaintiff = result.parties.find(p => p.type === 'plaintiff');
    expect(plaintiff).toBeDefined();
    expect(plaintiff?.name).toBe('王小红');

    const defendant = result.parties.find(p => p.type === 'defendant');
    expect(defendant).toBeDefined();
    expect(defendant?.name).toBe('张大伟');

    const thirdParty = result.parties.find(p => p.type === 'other');
    expect(thirdParty).toBeDefined();
    expect(thirdParty?.name).toBe('赵明');
  });

  it('RuleProcessor应该能够补充AI失败时的空数据', async () => {
    const text = `
民事起诉状

原告：王小红，女，1990年3月8日出生
被告：张大伟，男，1988年7月12日出生

诉讼请求：
1. 请求判令被告支付拖欠货款人民币800,000元；
2. 请求判令被告承担本案全部诉讼费用；
    `;

    // 模拟AI失败返回的空数据
    const emptyData = {
      parties: [],
      claims: [],
      timeline: [],
      summary: '',
      keyFacts: [],
    };

    const processor = new RuleProcessor();
    const result = await processor.process(emptyData, text);

    console.log('\n✅ RuleProcessor测试结果:');
    console.log('  - 补充的当事人数量:', result.data.parties.length);
    console.log(
      '  - 当事人列表:',
      result.data.parties.map(p => `${p.name}(${p.role})`)
    );
    console.log('  - 补充的诉讼请求数量:', result.data.claims.length);
    console.log(
      '  - 修正记录:',
      result.corrections.map(c => c.description)
    );

    // 验证算法兜底成功补充了当事人
    expect(result.data.parties.length).toBeGreaterThanOrEqual(2);

    const plaintiff = result.data.parties.find(p => p.type === 'plaintiff');
    expect(plaintiff).toBeDefined();
    expect(plaintiff?.name).toBe('王小红');

    const defendant = result.data.parties.find(p => p.type === 'defendant');
    expect(defendant).toBeDefined();
    expect(defendant?.name).toBe('张大伟');

    // 验证有修正记录
    const partyCorrection = result.corrections.find(
      c => c.type === 'ADD_PARTY'
    );
    expect(partyCorrection).toBeDefined();
  });

  it('完整流程：AI失败 → 算法兜底 → 成功提取', async () => {
    const text = `
民事起诉状

原告：王小红，女，1990年3月8日出生，汉族
被告：张大伟，男，1988年7月12日出生，汉族

诉讼请求：
1. 请求判令被告支付拖欠货款人民币800,000元；
2. 请求判令被告支付违约金；
3. 请求判令被告承担本案全部诉讼费用；
    `;

    // 步骤1: AI失败，返回空数据
    const aiFailedData = {
      parties: [],
      claims: [],
      timeline: [],
      summary: '',
      keyFacts: [],
    };

    console.log('\n✅ 完整流程测试:');
    console.log('  步骤1: AI调用失败，返回空数据');
    console.log('    - parties:', aiFailedData.parties.length);
    console.log('    - claims:', aiFailedData.claims.length);

    // 步骤2: RuleProcessor算法兜底
    const processor = new RuleProcessor();
    const result = await processor.process(aiFailedData, text);

    console.log('  步骤2: RuleProcessor算法兜底');
    console.log('    - 补充当事人:', result.data.parties.length);
    console.log('    - 补充诉讼请求:', result.data.claims.length);
    console.log('    - 修正记录:', result.corrections.length);

    // 步骤3: 验证最终结果
    console.log('  步骤3: 验证最终结果');

    expect(result.data.parties.length).toBeGreaterThanOrEqual(2);
    expect(result.data.claims.length).toBeGreaterThanOrEqual(1);

    const plaintiff = result.data.parties.find(p => p.name === '王小红');
    const defendant = result.data.parties.find(p => p.name === '张大伟');

    expect(plaintiff).toBeDefined();
    expect(defendant).toBeDefined();

    console.log('    ✓ 原告:', plaintiff?.name);
    console.log('    ✓ 被告:', defendant?.name);
    console.log(
      '    ✓ 诉讼请求类型:',
      result.data.claims.map(c => c.type).join(', ')
    );

    console.log('\n🎉 算法兜底机制工作正常！');
  });
});
