// =============================================================================
// Bad Case测试库 - 诉讼费用遗漏案例
// 基于KIMI优化建议报告建立
// 用于验证模块化版本的效果
// =============================================================================

import { DocAnalyzerAgent } from '../../lib/agent/doc-analyzer';
import { TaskPriority } from '../../types/agent';

describe('Bad Case测试库 - 诉讼费用遗漏案例', () => {
  let agent: DocAnalyzerAgent;

  beforeAll(() => {
    agent = new DocAnalyzerAgent();
  });

  const badCases = [
    {
      name: 'LITIGATION_COST遗漏案例1：标准借款纠纷',
      text: `民事起诉状

原告：张三，男，1980年5月1日出生，汉族，住北京市朝阳区xxx街道。

被告：李四，男，1975年3月15日出生，汉族，住北京市海淀区xxx街道。

诉讼请求：
1. 判令被告偿还借款本金100万元；
2. 判令被告支付利息（按LPR四倍计算）；
3. 诉讼费用由被告承担。

事实与理由：
原告与被告系朋友关系。2022年1月1日，被告因生意周转需要向原告借款100万元，约定年利率为24%。借款到期后，被告拒不偿还本息。为维护原告合法权益，特向贵院提起诉讼。`,
      expectedTypes: ['PAY_PRINCIPAL', 'PAY_INTEREST', 'LITIGATION_COST'],
      aiMissed: ['LITIGATION_COST'],
      expectedAfterPostProcess: true,
      priority: 'high',
    },
    {
      name: 'LITIGATION_COST遗漏案例2：买卖合同纠纷',
      text: `起诉状

原告：ABC公司，法定代表人：王五，住所：上海市浦东新区xxx路。

被告：XYZ公司，法定代表人：赵六，住所：上海市黄浦区xxx路。

诉讼请求：
1. 判令被告支付货款50万元；
2. 判令被告支付违约金10万元；
3. 本案诉讼费用由被告承担。

事实与理由：
原被告双方于2021年签订买卖合同，约定原告向被告供应货物，被告应在收货后30日内付款。被告至今未付款，构成违约。`,
      expectedTypes: ['PAY_PRINCIPAL', 'PAY_PENALTY', 'LITIGATION_COST'],
      aiMissed: ['LITIGATION_COST', 'PAY_PENALTY'],
      expectedAfterPostProcess: true,
      priority: 'high',
    },
    {
      name: '复合请求未拆解案例',
      text: `民事起诉状

原告：钱七，男，1990年1月1日出生。

被告：孙八，男，1985年1月1日出生。

诉讼请求：
判令被告偿还本金及利息共计150万元，诉讼费用由被告承担。`,
      expectedTypes: ['PAY_PRINCIPAL', 'PAY_INTEREST', 'LITIGATION_COST'],
      aiMissed: ['PAY_INTEREST', 'LITIGATION_COST'],
      expectedAfterPostProcess: true,
      priority: 'high',
    },
    {
      name: '当事人识别错误案例：法定代表人处理',
      text: `民事起诉状

原告：ABC科技有限公司
法定代表人：王总，职务：董事长
住所：北京市朝阳区xxx路

被告：XYZ贸易公司
法定代表人：李经理，职务：总经理
住所：北京市海淀区xxx路

诉讼请求：
1. 判令被告偿还货款30万元；
2. 诉讼费用由被告承担。`,
      expectedTypes: ['PAY_PRINCIPAL', 'LITIGATION_COST'],
      aiMissed: ['LITIGATION_COST'],
      partyError: true,
      expectedAfterPostProcess: true,
      priority: 'medium',
    },
  ];

  describe('Bad Case回归测试', () => {
    badCases.forEach((testCase, idx) => {
      test(`Bad Case ${idx + 1}: ${testCase.name}`, async () => {
        const result = await agent.execute({
          task: 'DOCUMENT_ANALYZE',
          priority: TaskPriority.MEDIUM,
          data: {
            documentId: `bad-case-${idx}`,
            filePath: '',
            fileType: 'TXT',
            content: testCase.text,
          },
        });

        expect(result.success).toBe(true);

        const data = result.data as {
          extractedData: { parties: any[]; claims: any[] };
        };
        expect(data.extractedData).toBeDefined();
        expect(data.extractedData.claims.length).toBeGreaterThan(0);

        const actualTypes = data.extractedData.claims.map(claim => claim.type);
        testCase.expectedTypes.forEach(expectedType => {
          expect(actualTypes).toContain(expectedType);
        });

        // 验证法定代表人被过滤
        if (testCase.name.includes('法定代表人')) {
          const actualPartyNames = data.extractedData.parties.map(p => p.name);
          // 验证没有法定代表人（如"王总"、"李经理"）被识别为独立当事人
          const hasLegalRepNames = actualPartyNames.some(
            n => n === '王总' || n === '李经理'
          );
          expect(hasLegalRepNames).toBe(false);
        }
      }, 30000);
    });
  });

  describe('后处理效果验证', () => {
    test('后处理应该补充遗漏的LITIGATION_COST', async () => {
      const testCase = badCases[0];
      const result = await agent.execute({
        task: 'DOCUMENT_ANALYZE',
        priority: TaskPriority.MEDIUM,
        data: {
          documentId: 'post-process-test',
          filePath: '',
          fileType: 'TXT',
          content: testCase.text,
        },
      });

      const data = result.data as { extractedData: { claims: any[] } };
      const litigationCostClaims = data.extractedData.claims.filter(
        claim => claim.type === 'LITIGATION_COST'
      );

      expect(litigationCostClaims.length).toBeGreaterThan(0);
      expect(litigationCostClaims[0].content).toContain('诉讼费用');
    }, 30000);

    test('后处理应该拆解复合请求', async () => {
      const testCase = badCases[2];
      const result = await agent.execute({
        task: 'DOCUMENT_ANALYZE',
        priority: TaskPriority.MEDIUM,
        data: {
          documentId: 'compound-test',
          filePath: '',
          fileType: 'TXT',
          content: testCase.text,
        },
      });

      const data = result.data as { extractedData: { claims: any[] } };
      const hasPrincipal = data.extractedData.claims.some(
        claim => claim.type === 'PAY_PRINCIPAL'
      );
      const hasInterest = data.extractedData.claims.some(
        claim => claim.type === 'PAY_INTEREST'
      );

      expect(hasPrincipal).toBe(true);
      expect(hasInterest).toBe(true);
    }, 30000);
  });
});
