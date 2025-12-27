/**
 * 法定代表人过滤功能简单测试脚本
 * 直接测试过滤逻辑，绕过AI调用
 */

import { LegalRepresentativeFilter } from '../src/lib/agent/doc-analyzer/processors/legal-representative-filter';
import type { Party } from '../src/lib/agent/doc-analyzer/core/types';

// =============================================================================
// 测试用例定义
// =============================================================================

interface TestCase {
  id: number;
  name: string;
  content: string;
  expectedParties: {
    shouldKeep: string[];
    shouldFilter: string[];
  };
}

const testCases: TestCase[] = [
  {
    id: 1,
    name: '标准法定代表人表达',
    content: `民事起诉状

原告：上海华诚科技有限公司
法定代表人：王明，男，1980年5月15日出生，汉族，住上海市浦东新区世纪大道100号，联系电话：13900139000

被告：北京长城贸易有限公司
法定代表人：李华，女，1982年8月20日出生，汉族，住北京市朝阳区建国路200号，联系电话：13800138000

诉讼请求：
1. 请求判令被告支付货款人民币1,000,000元；
2. 请求判令被告承担本案诉讼费用。

事实与理由：
原被告于2023年1月签订买卖合同，原告按约交付货物，被告未支付货款。

此致
上海市浦东新区人民法院

具状人：上海华诚科技有限公司
法定代表人：王明
2023年10月15日`,
    expectedParties: {
      shouldKeep: ['上海华诚科技有限公司', '北京长城贸易有限公司'],
      shouldFilter: ['王明', '李华']
    }
  },
  {
    id: 2,
    name: '法定代表（简称）',
    content: `民事起诉状

原告：杭州梦想软件有限公司
法定代表：张伟，男，1978年3月10日出生，汉族，住杭州市西湖区文三路50号，联系电话：13700137000

被告：南京创新科技股份公司
法定代表人：刘芳，女，1985年11月5日出生，汉族，住南京市鼓楼区中山路80号，联系电话：13600136000

第三人：苏州协作企业集团
法定代表人：陈刚，男，1981年7月25日出生，汉族，住苏州市工业园区金鸡湖大道120号，联系电话：13500135000

诉讼请求：
1. 请求判令被告支付服务费人民币500,000元；
2. 请求判令被告支付违约金50,000元；
3. 请求判令第三人承担连带责任。

事实与理由：
原告为被告提供软件开发服务，第三人提供担保。

此致
杭州市西湖区人民法院

具状人：杭州梦想软件有限公司
法定代表：张伟
2023年9月20日`,
    expectedParties: {
      shouldKeep: ['杭州梦想软件有限公司', '南京创新科技股份公司', '苏州协作企业集团'],
      shouldFilter: ['张伟', '刘芳', '陈刚']
    }
  },
  {
    id: 3,
    name: '法人代表（另一种表达）',
    content: `民事起诉状

原告：深圳天际网络技术有限公司
法人代表：赵云，男，1983年6月18日出生，汉族，住深圳市南山区科技园南区科苑路88号，联系电话：13400134000

被告：广州星辰电子商务有限公司
法定代表人：孙丽，女，1984年9月22日出生，汉族，住广州市天河区珠江新城花城大道66号，联系电话：13300133000

诉讼请求：
1. 请求判令被告赔偿损失人民币800,000元；
2. 请求判令被告赔礼道歉。

事实与理由：
被告盗用原告商业秘密，造成经济损失。

此致
深圳市南山区人民法院

具状人：深圳天际网络技术有限公司
法人代表：赵云
2023年11月1日`,
    expectedParties: {
      shouldKeep: ['深圳天际网络技术有限公司', '广州星辰电子商务有限公司'],
      shouldFilter: ['赵云', '孙丽']
    }
  },
  {
    id: 4,
    name: '多个公司的法定代表人',
    content: `民事起诉状

原告：北京华信投资管理有限公司
法定代表人：周涛，男，1975年12月30日出生，汉族，住北京市朝阳区光华路16号，联系电话：13200132000

被告：上海金鼎实业发展股份有限公司
法定代表人：吴强，男，1979年4月12日出生，汉族，住上海市黄浦区南京东路300号，联系电话：13100131000

第三人：广州信达控股集团有限公司
法定代表人：郑敏，女，1980年2月28日出生，汉族，住广州市天河区天河北路580号，联系电话：13000130000

诉讼请求：
1. 请求判令被告支付股权转让款人民币2,000,000元；
2. 请求判令被告支付利息100,000元；
3. 请求判令被告承担本案诉讼费用。

事实与理由：
原告与被告签订股权转让协议，被告未按约支付款项。

此致
北京市朝阳区人民法院

具状人：北京华信投资管理有限公司
法定代表人：周涛
2023年8月5日`,
    expectedParties: {
      shouldKeep: ['北京华信投资管理有限公司', '上海金鼎实业发展股份有限公司', '广州信达控股集团有限公司'],
      shouldFilter: ['周涛', '吴强', '郑敏']
    }
  },
  {
    id: 5,
    name: '法定代表人同时也是独立当事人',
    content: `民事起诉状

原告：张大伟，男，1988年7月12日出生，汉族，住上海市徐汇区淮海中路200号，联系电话：18700187000，职业：企业总经理

原告：上海华诚科技有限公司
法定代表人：张大伟，男，1988年7月12日出生，汉族，住上海市徐汇区淮海中路200号，联系电话：18700187000

被告：北京长城贸易有限公司
法定代表人：李华，女，1982年8月20日出生，汉族，住北京市朝阳区建国路200号，联系电话：13800138000

诉讼请求：
1. 请求判令被告支付货款人民币800,000元；
2. 请求判令被告承担本案诉讼费用。

事实与理由：
张大伟既是原告个人，也是原告公司的法定代表人，被告拖欠货款。

此致
上海市徐汇区人民法院

具状人：张大伟
2023年10月30日`,
    expectedParties: {
      shouldKeep: ['张大伟', '上海华诚科技有限公司', '北京长城贸易有限公司'],
      shouldFilter: ['李华']
    }
  },
  {
    id: 6,
    name: '只有法定代表人，没有详细公司信息',
    content: `民事起诉状

原告：某某科技有限公司
法定代表人：王明

被告：某某贸易有限公司
法定代表人：李华

诉讼请求：
1. 请求判令被告支付货款人民币500,000元。

此致
某某区人民法院

具状人：某某科技有限公司
2023年12月1日`,
    expectedParties: {
      shouldKeep: ['某某科技有限公司', '某某贸易有限公司'],
      shouldFilter: ['王明', '李华']
    }
  },
  {
    id: 7,
    name: '公司名称和法定代表人混在一起',
    content: `民事起诉状

原告：上海华诚科技有限公司（法定代表人：王明，身份证号：310101198005150001）

被告：北京长城贸易有限公司（法定代表人：李华，身份证号：110101198208200002）

诉讼请求：
1. 请求判令被告支付货款人民币1,500,000元；
2. 请求判令被告承担诉讼费用。

此致
上海市浦东新区人民法院

具状人：上海华诚科技有限公司
2023年11月15日`,
    expectedParties: {
      shouldKeep: ['上海华诚科技有限公司', '北京长城贸易有限公司'],
      shouldFilter: ['王明', '李华']
    }
  },
  {
    id: 8,
    name: '法定代表人的多种写法',
    content: `民事起诉状

原告：杭州梦想软件有限公司
法定代表人：张伟（身份证号：330101197803100001）

被告：南京创新科技股份公司
法定代表人：刘芳（身份证号：320101198511050002）

第三人：苏州协作企业集团
法定代表人：陈刚，男，1981年7月25日出生，汉族，住苏州市工业园区金鸡湖大道120号，联系电话：13500135000

诉讼请求：
1. 请求判令被告支付服务费人民币750,000元；
2. 请求判令第三人承担连带责任。

此致
杭州市西湖区人民法院

具状人：杭州梦想软件有限公司
法定代表：张伟
2023年10月25日`,
    expectedParties: {
      shouldKeep: ['杭州梦想软件有限公司', '南京创新科技股份公司', '苏州协作企业集团'],
      shouldFilter: ['张伟', '刘芳', '陈刚']
    }
  },
  {
    id: 9,
    name: '自然人当事人（无公司）',
    content: `民事起诉状

原告：王小红，女，1990年3月8日出生，汉族，住上海市浦东新区陆家嘴环路100号，联系电话：18600186000，职业：财务主管

被告：张大伟，男，1988年7月12日出生，汉族，住上海市徐汇区淮海中路200号，联系电话：18700187000，职业：企业总经理

诉讼请求：
1. 请求判令被告支付欠款人民币100,000元；
2. 请求判令被告承担诉讼费用。

事实与理由：
被告向原告借款，到期未还。

此致
上海市浦东新区人民法院

具状人：王小红
2023年9月10日`,
    expectedParties: {
      shouldKeep: ['王小红', '张大伟'],
      shouldFilter: []
    }
  },
  {
    id: 10,
    name: '混合公司和个人',
    content: `民事起诉状

原告：李明，男，1985年5月10日出生，汉族，住广州市天河区天河路200号，联系电话：15900159000

原告：深圳天际网络技术有限公司
法定代表人：赵云，男，1983年6月18日出生，汉族，住深圳市南山区科技园南区科苑路88号，联系电话：13400134000

被告：王华，男，1982年2月14日出生，汉族，住北京市朝阳区三里屯路50号，联系电话：15800158000

被告：广州星辰电子商务有限公司
法定代表人：孙丽，女，1984年9月22日出生，汉族，住广州市天河区珠江新城花城大道66号，联系电话：13300133000

诉讼请求：
1. 请求判令两被告共同支付货款人民币1,200,000元；
2. 请求判令两被告承担连带责任。

此致
深圳市南山区人民法院

具状人：李明
2023年11月20日`,
    expectedParties: {
      shouldKeep: ['李明', '深圳天际网络技术有限公司', '王华', '广州星辰电子商务有限公司'],
      shouldFilter: ['赵云', '孙丽']
    }
  }
];

// =============================================================================
// 测试逻辑
// =============================================================================

/**
 * 从文档内容中模拟提取当事人
 * 由于PartyExtractor不存在，使用正则表达式模拟提取
 */
function extractMockParties(content: string): Party[] {
  const parties: Party[] = [];
  
  // 提取原告 - 提取第一个逗号或中文逗号之前的内容（姓名）
  const plaintiffMatches = content.matchAll(/原告[：:]\s*([^，,\n]+?)(?=，|,|\n|$)/g);
  for (const match of plaintiffMatches) {
    const name = match[1].trim();
    if (name) {
      parties.push({
        type: 'plaintiff',
        name: name
      });
    }
  }
  
  // 提取被告 - 提取第一个逗号或中文逗号之前的内容（姓名）
  const defendantMatches = content.matchAll(/被告[：:]\s*([^，,\n]+?)(?=，|,|\n|$)/g);
  for (const match of defendantMatches) {
    const name = match[1].trim();
    if (name) {
      parties.push({
        type: 'defendant',
        name: name
      });
    }
  }
  
  // 提取第三人 - 提取第一个逗号或中文逗号之前的内容（姓名）
  const thirdPartyMatches = content.matchAll(/第三人[：:]\s*([^，,\n]+?)(?=，|,|\n|$)/g);
  for (const match of thirdPartyMatches) {
    const name = match[1].trim();
    if (name) {
      parties.push({
        type: 'other',
        name: name
      });
    }
  }
  
  // 添加法定代表人条目（模拟错误提取）
  const legalRepMatches = content.matchAll(/法定代表人[：:]\s*(.+?)(?=，|,|\n|$)/g);
  for (const match of legalRepMatches) {
    const name = match[1].trim();
    if (name && name.length > 0) {
      parties.push({
        type: 'plaintiff',
        name: `法定代表人：${name}`,
        _inferred: true
      });
    }
  }
  
  return parties;
}

async function runTests(): Promise<void> {
  console.log('========================================');
  console.log('法定代表人过滤功能测试');
  console.log('========================================');
  console.log(`测试用例数量: ${testCases.length}\n`);

  const filter = new LegalRepresentativeFilter();

  let totalCases = 0;
  let totalParties = 0;
  let correctKept = 0;
  let correctFiltered = 0;
  let incorrectFiltered = 0;
  let incorrectKept = 0;

  const results: any[] = [];

  for (const testCase of testCases) {
    console.log(`\n测试案例 ${testCase.id}: ${testCase.name}`);
    console.log('---');

    const startTime = Date.now();

    try {
      // 模拟提取当事人
      const extractedParties = extractMockParties(testCase.content);
      const processingTime = Date.now() - startTime;

      // 过滤法定代表人
      const filterResult = await filter.filter(testCase.content, extractedParties);
      const filteredParties = filterResult.parties;

      const actualPartyNames = filteredParties.map((p: Party) => p.name);
      const allExtractedNames = extractedParties.map((p: Party) => p.name);

      console.log(`提取的当事人: ${allExtractedNames.join(', ')}`);
      console.log(`过滤后的当事人: ${actualPartyNames.join(', ')}`);
      console.log(`处理时间: ${processingTime}ms`);

      // 评估结果
      const caseCorrectKept = testCase.expectedParties.shouldKeep.filter(
        name => actualPartyNames.includes(name)
      );

      const caseIncorrectFiltered = testCase.expectedParties.shouldKeep.filter(
        name => !actualPartyNames.includes(name)
      );

      const caseCorrectFiltered = testCase.expectedParties.shouldFilter.filter(
        name => !actualPartyNames.includes(name)
      );

      const caseIncorrectKept = testCase.expectedParties.shouldFilter.filter(
        name => actualPartyNames.includes(name)
      );

      const totalExpected = testCase.expectedParties.shouldKeep.length + testCase.expectedParties.shouldFilter.length;
      const caseCorrect = caseCorrectKept.length + caseCorrectFiltered.length;
      const accuracy = totalExpected > 0 ? (caseCorrect / totalExpected) * 100 : 0;

      console.log(`正确保留: ${caseCorrectKept.join(', ') || '无'}`);
      console.log(`错误过滤: ${caseIncorrectFiltered.join(', ') || '无'}`);
      console.log(`正确过滤: ${caseCorrectFiltered.join(', ') || '无'}`);
      console.log(`错误保留: ${caseIncorrectKept.join(', ') || '无'}`);
      console.log(`准确率: ${accuracy.toFixed(2)}%`);

      // 累计统计
      totalCases++;
      totalParties += totalExpected;
      correctKept += caseCorrectKept.length;
      correctFiltered += caseCorrectFiltered.length;
      incorrectFiltered += caseIncorrectFiltered.length;
      incorrectKept += caseIncorrectKept.length;

      results.push({
        caseId: testCase.id,
        caseName: testCase.name,
        extractedParties: allExtractedNames,
        filteredParties: actualPartyNames,
        expectedParties: testCase.expectedParties,
        correctKept: caseCorrectKept,
        incorrectFiltered: caseIncorrectFiltered,
        correctFiltered: caseCorrectFiltered,
        incorrectKept: caseIncorrectKept,
        accuracy,
        processingTime
      });

    } catch (error) {
      console.error(`测试案例 ${testCase.id} 失败:`, error);
      totalCases++;
      totalParties += testCase.expectedParties.shouldKeep.length + testCase.expectedParties.shouldFilter.length;
      incorrectFiltered += testCase.expectedParties.shouldKeep.length;

      results.push({
        caseId: testCase.id,
        caseName: testCase.name,
        error: String(error),
        accuracy: 0
      });
    }
  }

  // 打印汇总
  const overallAccuracy = totalParties > 0 ? ((correctKept + correctFiltered) / totalParties) * 100 : 0;
  const keepAccuracy = (correctKept + incorrectKept) > 0 ? (correctKept / (correctKept + incorrectKept)) * 100 : 0;
  const filterAccuracy = (correctFiltered + incorrectFiltered) > 0 ? (correctFiltered / (correctFiltered + incorrectFiltered)) * 100 : 0;

  console.log('\n========================================');
  console.log('测试汇总');
  console.log('========================================');
  console.log(`总测试案例: ${totalCases}`);
  console.log(`总当事人数量: ${totalParties}`);
  console.log(`\n准确率统计:`);
  console.log(`  整体准确率: ${overallAccuracy.toFixed(2)}%`);
  console.log(`  保留准确率: ${keepAccuracy.toFixed(2)}%`);
  console.log(`  过滤准确率: ${filterAccuracy.toFixed(2)}%`);
  console.log(`\n分类统计:`);
  console.log(`  正确保留: ${correctKept} 个`);
  console.log(`  正确过滤: ${correctFiltered} 个`);
  console.log(`  错误过滤: ${incorrectFiltered} 个`);
  console.log(`  错误保留: ${incorrectKept} 个`);
  console.log(`\n达标状态: ${overallAccuracy >= 90 ? '✅ 达标' : '❌ 未达标'}`);
  console.log('========================================');
}

// 运行测试
runTests().catch(console.error);
