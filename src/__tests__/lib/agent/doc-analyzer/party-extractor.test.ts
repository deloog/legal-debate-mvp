/**
 * PartyExtractor 单元测试
 * 测试当事人提取功能
 */

import { PartyExtractor } from '@/lib/agent/doc-analyzer/extractors/party-extractor';

describe('PartyExtractor', () => {
  let extractor: PartyExtractor;

  beforeEach(() => {
    extractor = new PartyExtractor();
  });

  describe('基本当事人提取', () => {
    it('应该正确提取原告信息', async () => {
      const text = `
民事起诉状

原告：王小红，女，1990年3月8日出生，汉族，住上海市浦东新区陆家嘴环路100号

被告：张大伟，男，1988年7月12日出生，汉族，住上海市徐汇区淮海中路200号
      `;

      const result = await extractor.extractFromText(text);

      expect(result.parties).toBeDefined();
      expect(result.parties.length).toBeGreaterThanOrEqual(2);

      // 验证原告
      const plaintiff = result.parties.find(p => p.type === 'plaintiff');
      expect(plaintiff).toBeDefined();
      expect(plaintiff?.name).toBe('王小红');
      expect(plaintiff?.role).toBe('原告');

      // 验证被告
      const defendant = result.parties.find(p => p.type === 'defendant');
      expect(defendant).toBeDefined();
      expect(defendant?.name).toBe('张大伟');
      expect(defendant?.role).toBe('被告');
    });

    it('应该正确提取第三人信息', async () => {
      const text = `
原告：王小红
被告：张大伟
第三人：赵明，男，1985年11月20日出生
      `;

      const result = await extractor.extractFromText(text);

      expect(result.parties.length).toBeGreaterThanOrEqual(3);

      const thirdParty = result.parties.find(p => p.type === 'other');
      expect(thirdParty).toBeDefined();
      expect(thirdParty?.name).toBe('赵明');
      expect(thirdParty?.role).toBe('第三人');
    });

    it('应该正确提取上诉人和被上诉人', async () => {
      const text = `
上诉人（原审原告）：王小红
被上诉人（原审被告）：张大伟
      `;

      const result = await extractor.extractFromText(text);

      expect(result.parties.length).toBeGreaterThanOrEqual(2);

      const appellant = result.parties.find(p => p.role === '上诉人');
      expect(appellant).toBeDefined();
      expect(appellant?.name).toBe('王小红');

      const appellee = result.parties.find(p => p.role === '被上诉人');
      expect(appellee).toBeDefined();
      expect(appellee?.name).toBe('张大伟');
    });
  });

  describe('当事人过滤', () => {
    it('应该过滤掉法定代表人', async () => {
      const text = `
原告：某某科技有限公司
法定代表人：张三
被告：李四
      `;

      const result = await extractor.extractFromText(text);

      // 不应该把法定代表人当作独立的当事人
      const legalRep = result.parties.find(p => p.name === '张三');
      expect(legalRep).toBeUndefined();
    });

    it('应该过滤掉诉讼代理人', async () => {
      const text = `
原告：王小红
委托代理人：李律师
被告：张大伟
      `;

      const result = await extractor.extractFromText(text);

      // 不应该把律师当作独立的当事人
      const lawyer = result.parties.find(p => p.name?.includes('律师'));
      expect(lawyer).toBeUndefined();
    });

    it('应该保留公司名称', async () => {
      const text = `
原告：北京某某科技有限公司
被告：上海某某贸易有限公司
      `;

      const result = await extractor.extractFromText(text);

      expect(result.parties.length).toBeGreaterThanOrEqual(2);

      const plaintiff = result.parties.find(p => p.type === 'plaintiff');
      expect(plaintiff).toBeDefined();
      expect(plaintiff?.name).toContain('科技有限公司');

      const defendant = result.parties.find(p => p.type === 'defendant');
      expect(defendant).toBeDefined();
      expect(defendant?.name).toContain('贸易有限公司');
    });
  });

  describe('地址提取', () => {
    it('应该提取当事人地址', async () => {
      const text = `
原告：王小红，住址：上海市浦东新区陆家嘴环路100号
被告：张大伟，住址：上海市徐汇区淮海中路200号
      `;

      const result = await extractor.extractFromText(text);

      const plaintiff = result.parties.find(p => p.type === 'plaintiff');
      expect(plaintiff?.address).toBeDefined();
      expect(plaintiff?.address).toContain('上海市浦东新区');

      const defendant = result.parties.find(p => p.type === 'defendant');
      expect(defendant?.address).toBeDefined();
      expect(defendant?.address).toContain('上海市徐汇区');
    });
  });

  describe('边界情况', () => {
    it('应该处理空文本', async () => {
      const result = await extractor.extractFromText('');
      expect(result.parties).toEqual([]);
    });

    it('应该处理没有当事人的文本', async () => {
      const text = '这是一段普通的文本，没有任何当事人信息。';
      const result = await extractor.extractFromText(text);
      expect(result.parties).toEqual([]);
    });

    it('应该去重相同的当事人', async () => {
      const text = `
原告：王小红
原告：王小红
被告：张大伟
      `;

      const result = await extractor.extractFromText(text);

      // 应该只有2个当事人，不应该有重复
      const wangCount = result.parties.filter(p => p.name === '王小红').length;
      expect(wangCount).toBe(1);
    });
  });

  describe('置信度计算', () => {
    it('应该返回合理的置信度', async () => {
      const text = `
原告：王小红
被告：张大伟
      `;

      const result = await extractor.extractFromText(text);

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('合并当事人', () => {
    it('应该合并AI提取和算法提取的结果', () => {
      const aiParties = [
        { type: 'plaintiff' as const, name: '王小红', role: '原告' },
      ];

      const algorithmParties = [
        { type: 'defendant' as const, name: '张大伟', role: '被告' },
      ];

      const merged = extractor.mergeParties(aiParties, algorithmParties);

      expect(merged.length).toBe(2);
      expect(merged.find(p => p.name === '王小红')).toBeDefined();
      expect(merged.find(p => p.name === '张大伟')).toBeDefined();
    });

    it('应该去重相同的当事人', () => {
      const aiParties = [
        { type: 'plaintiff' as const, name: '王小红', role: '原告' },
      ];

      const algorithmParties = [
        { type: 'plaintiff' as const, name: '王小红', role: '原告' },
        { type: 'defendant' as const, name: '张大伟', role: '被告' },
      ];

      const merged = extractor.mergeParties(aiParties, algorithmParties);

      expect(merged.length).toBe(2);
      const wangCount = merged.filter(p => p.name === '王小红').length;
      expect(wangCount).toBe(1);
    });
  });
});
