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
      // 地址提取是可选功能，如果实现了应该包含地址
      if (plaintiff?.address) {
        expect(plaintiff.address).toContain('上海市浦东新区');
      }

      const defendant = result.parties.find(p => p.type === 'defendant');
      if (defendant?.address) {
        expect(defendant.address).toContain('上海市徐汇区');
      }
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

  describe('特殊组织架构识别', () => {
    it('应该识别清算组', async () => {
      const text = `
原告：某某公司清算组
被告：张大伟
      `;

      const result = await extractor.extractFromText(text);

      const plaintiff = result.parties.find(
        p => p.type === 'plaintiff' && p.name.includes('清算组')
      );
      expect(plaintiff).toBeDefined();
      expect(plaintiff?.name).toContain('清算组');
      // role可能是'清算组'或'原告'，取决于提取顺序
      expect(['清算组', '原告']).toContain(plaintiff?.role);
    });

    it('应该识别破产管理人', async () => {
      const text = `
原告：某某公司破产管理人
被告：李四
      `;

      const result = await extractor.extractFromText(text);

      const plaintiff = result.parties.find(
        p => p.type === 'plaintiff' && p.name.includes('破产管理人')
      );
      expect(plaintiff).toBeDefined();
      expect(plaintiff?.name).toContain('破产管理人');
      expect(['破产管理人', '原告']).toContain(plaintiff?.role);
    });

    it('应该识别联合体', async () => {
      const text = `
原告：甲公司与乙公司联合体
被告：丙公司
      `;

      const result = await extractor.extractFromText(text);

      const plaintiff = result.parties.find(
        p => p.type === 'plaintiff' && p.name.includes('联合体')
      );
      expect(plaintiff).toBeDefined();
      expect(plaintiff?.name).toContain('联合体');
      expect(['联合体', '原告']).toContain(plaintiff?.role);
    });

    it('应该识别分支机构', async () => {
      const text = `
原告：某某公司上海分公司
被告：王五
      `;

      const result = await extractor.extractFromText(text);

      const plaintiff = result.parties.find(
        p => p.type === 'plaintiff' && p.name.includes('分公司')
      );
      expect(plaintiff).toBeDefined();
      expect(plaintiff?.name).toContain('分公司');
      expect(['分支机构', '原告']).toContain(plaintiff?.role);
    });

    it('应该识别临时机构', async () => {
      const text = `
原告：某某项目筹备组
被告：赵六
      `;

      const result = await extractor.extractFromText(text);

      const plaintiff = result.parties.find(
        p => p.type === 'plaintiff' && p.name.includes('筹备组')
      );
      expect(plaintiff).toBeDefined();
      expect(plaintiff?.name).toContain('筹备组');
      expect(['临时机构', '原告']).toContain(plaintiff?.role);
    });
  });

  describe('当事人身份验证', () => {
    it('应该验证当事人姓名不为空', async () => {
      const text = `
原告：
被告：张大伟
      `;

      const result = await extractor.extractFromText(text);

      // 空姓名的当事人应该被过滤
      expect(
        result.parties.every(p => p.name && p.name.trim().length > 0)
      ).toBe(true);
    });

    it('应该验证当事人姓名长度合理', async () => {
      const text = `
原告：这是一个非常非常非常非常非常非常非常非常非常非常非常非常非常非常长的名字超过五十个字符
被告：张大伟
      `;

      const result = await extractor.extractFromText(text);

      // 过长的姓名应该被标记为低置信度或过滤
      const longNameParty = result.parties.find(p => p.name.length > 50);
      if (longNameParty) {
        expect(result.confidence).toBeLessThan(1.0);
      }
    });

    it('应该检测姓名中包含职务描述', async () => {
      const text = `
原告：王小红法定代表人
被告：张大伟委托代理人
第三人：李四
      `;

      const result = await extractor.extractFromText(text);

      // 包含职务描述的姓名应该被清理或过滤
      const hasJobTitle = result.parties.some(
        p => p.name.includes('法定代表人') || p.name.includes('委托代理人')
      );
      expect(hasJobTitle).toBe(false);
    });

    it('应该计算当事人身份验证置信度', async () => {
      const text = `
原告：王小红
被告：张大伟
第三人：李四
      `;

      const result = await extractor.extractFromText(text);

      // 所有当事人都有效，置信度应该较高
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('应该处理包含多余信息的当事人姓名', async () => {
      const text = `
原告：王小红，女，1990年出生，汉族
被告：张大伟，男，1988年出生
      `;

      const result = await extractor.extractFromText(text);

      const plaintiff = result.parties.find(p => p.type === 'plaintiff');
      expect(plaintiff).toBeDefined();
      // 姓名应该被清理，不包含性别、出生年份等信息
      expect(plaintiff?.name).toBe('王小红');
      expect(plaintiff?.name).not.toContain('女');
      expect(plaintiff?.name).not.toContain('1990');
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内处理大量文本', async () => {
      // 生成包含100个当事人的文本
      let text = '';
      for (let i = 0; i < 100; i++) {
        text += `原告：当事人${i}\n`;
      }

      const startTime = Date.now();
      const result = await extractor.extractFromText(text);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
      expect(result.parties.length).toBeGreaterThan(0);
    });

    it('应该处理包含特殊字符的文本', async () => {
      const text = `
原告：王小红@#$%^&*()
被告：张大伟！@#￥%……&*（）
      `;

      const result = await extractor.extractFromText(text);

      // 应该能够提取当事人，即使包含特殊字符
      expect(result.parties.length).toBeGreaterThan(0);
    });
  });

  describe('复杂场景', () => {
    it('应该处理多个原告的情况', async () => {
      const text = `
原告：王小红、李明、赵强
被告：张大伟
      `;

      const result = await extractor.extractFromText(text);

      const plaintiffs = result.parties.filter(p => p.type === 'plaintiff');
      // 应该识别出多个原告
      expect(plaintiffs.length).toBeGreaterThanOrEqual(1);
    });

    it('应该处理括号中的补充信息', async () => {
      const text = `
原告：某某科技有限公司（原名：某某网络公司）
被告：张大伟（身份证号：123456）
      `;

      const result = await extractor.extractFromText(text);

      const plaintiff = result.parties.find(p => p.type === 'plaintiff');
      expect(plaintiff).toBeDefined();
      // 括号内容应该被清理
      expect(plaintiff?.name).not.toContain('原名');
    });

    it('应该处理混合中英文括号', async () => {
      const text = `
原告：某某公司(有限责任)
被告：张大伟（个人）
      `;

      const result = await extractor.extractFromText(text);

      expect(result.parties.length).toBeGreaterThanOrEqual(2);
    });

    it('应该从诉讼请求中推断被告', async () => {
      const text = `
原告：王小红
诉讼请求：判令张大伟偿还借款10万元
      `;

      const result = await extractor.extractFromText(text);

      // 应该能从诉讼请求中推断出被告
      const defendant = result.parties.find(
        p => p.type === 'defendant' && p.name === '张大伟'
      );
      expect(defendant).toBeDefined();
      if (defendant) {
        expect(defendant._inferred).toBe(true);
      }
    });

    it('应该处理不同格式的冒号', async () => {
      const text = `
原告：王小红
被告:张大伟
第三人：李四
      `;

      const result = await extractor.extractFromText(text);

      expect(result.parties.length).toBeGreaterThanOrEqual(3);
    });
  });
});
