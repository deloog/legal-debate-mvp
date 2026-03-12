/**
 * 法定代表人过滤功能测试脚本
 * 模拟AI响应，测试过滤逻辑
 */

import type { Party } from '../src/lib/agent/doc-analyzer/core/types';

// =============================================================================
// 模拟AI响应的数据
// =============================================================================

interface TestCase {
  id: number;
  name: string;
  content: string;
  aiResponse: {
    extractedData: {
      parties: Party[];
    };
  };
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
    aiResponse: {
      extractedData: {
        parties: [
          {
            type: 'plaintiff',
            name: '上海华诚科技有限公司',
            role: '原告',
            contact: '13900139000',
            address: '上海市浦东新区世纪大道100号',
          },
          {
            type: 'plaintiff',
            name: '王明',
            role: '法定代表人',
            contact: '13900139000',
            address: '上海市浦东新区世纪大道100号',
          },
          {
            type: 'defendant',
            name: '北京长城贸易有限公司',
            role: '被告',
            contact: '13800138000',
            address: '北京市朝阳区建国路200号',
          },
          {
            type: 'defendant',
            name: '李华',
            role: '法定代表人',
            contact: '13800138000',
            address: '北京市朝阳区建国路200号',
          },
        ],
      },
    },
    expectedParties: {
      shouldKeep: ['上海华诚科技有限公司', '北京长城贸易有限公司'],
      shouldFilter: ['王明', '李华'],
    },
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
法定代表人：陈刚，男，1981年7月25日出生，汉族，住苏州市工业园区金鸡湖大道120号，联系电话：13500135000`,
    aiResponse: {
      extractedData: {
        parties: [
          {
            type: 'plaintiff',
            name: '杭州梦想软件有限公司',
            role: '原告',
            contact: '13700137000',
            address: '杭州市西湖区文三路50号',
          },
          {
            type: 'plaintiff',
            name: '张伟',
            role: '法定代表',
            contact: '13700137000',
            address: '杭州市西湖区文三路50号',
          },
          {
            type: 'defendant',
            name: '南京创新科技股份公司',
            role: '被告',
            contact: '13600136000',
            address: '南京市鼓楼区中山路80号',
          },
          {
            type: 'defendant',
            name: '刘芳',
            role: '法定代表人',
            contact: '13600136000',
            address: '南京市鼓楼区中山路80号',
          },
          {
            type: 'other',
            name: '苏州协作企业集团',
            role: '第三人',
            contact: '13500135000',
            address: '苏州市工业园区金鸡湖大道120号',
          },
          {
            type: 'other',
            name: '陈刚',
            role: '法定代表人',
            contact: '13500135000',
            address: '苏州市工业园区金鸡湖大道120号',
          },
        ],
      },
    },
    expectedParties: {
      shouldKeep: [
        '杭州梦想软件有限公司',
        '南京创新科技股份公司',
        '苏州协作企业集团',
      ],
      shouldFilter: ['张伟', '刘芳', '陈刚'],
    },
  },
  {
    id: 3,
    name: '法人代表（另一种表达）',
    content: `民事起诉状

原告：深圳天际网络技术有限公司
法人代表：赵云，男，1983年6月18日出生，汉族，住深圳市南山区科技园南区科苑路88号，联系电话：13400134000

被告：广州星辰电子商务有限公司
法定代表人：孙丽，女，1984年9月22日出生，汉族，住广州市天河区珠江新城花城大道66号，联系电话：13300133000`,
    aiResponse: {
      extractedData: {
        parties: [
          {
            type: 'plaintiff',
            name: '深圳天际网络技术有限公司',
            role: '原告',
            contact: '13400134000',
            address: '深圳市南山区科技园南区科苑路88号',
          },
          {
            type: 'plaintiff',
            name: '赵云',
            role: '法人代表',
            contact: '13400134000',
            address: '深圳市南山区科技园南区科苑路88号',
          },
          {
            type: 'defendant',
            name: '广州星辰电子商务有限公司',
            role: '被告',
            contact: '13300133000',
            address: '广州市天河区珠江新城花城大道66号',
          },
          {
            type: 'defendant',
            name: '孙丽',
            role: '法定代表人',
            contact: '13300133000',
            address: '广州市天河区珠江新城花城大道66号',
          },
        ],
      },
    },
    expectedParties: {
      shouldKeep: ['深圳天际网络技术有限公司', '广州星辰电子商务有限公司'],
      shouldFilter: ['赵云', '孙丽'],
    },
  },
  {
    id: 5,
    name: '法定代表人同时也是独立当事人',
    content: `民事起诉状

原告：张大伟，男，1988年7月12日出生，汉族，住上海市徐汇区淮海中路200号，联系电话：18700187000，职业：企业总经理

原告：上海华诚科技有限公司
法定代表人：张大伟，男，1988年7月12日出生，汉族，住上海市徐汇区淮海中路200号，联系电话：18700187000

被告：北京长城贸易有限公司
法定代表人：李华，女，1982年8月20日出生，汉族，住北京市朝阳区建国路200号，联系电话：13800138000`,
    aiResponse: {
      extractedData: {
        parties: [
          {
            type: 'plaintiff',
            name: '张大伟',
            role: '原告',
            contact: '18700187000',
            address: '上海市徐汇区淮海中路200号',
          },
          {
            type: 'plaintiff',
            name: '上海华诚科技有限公司',
            role: '原告',
            contact: '18700187000',
            address: '上海市徐汇区淮海中路200号',
          },
          {
            type: 'plaintiff',
            name: '张大伟',
            role: '法定代表人',
            contact: '18700187000',
            address: '上海市徐汇区淮海中路200号',
          },
          {
            type: 'defendant',
            name: '北京长城贸易有限公司',
            role: '被告',
            contact: '13800138000',
            address: '北京市朝阳区建国路200号',
          },
          {
            type: 'defendant',
            name: '李华',
            role: '法定代表人',
            contact: '13800138000',
            address: '北京市朝阳区建国路200号',
          },
        ],
      },
    },
    expectedParties: {
      shouldKeep: ['张大伟', '上海华诚科技有限公司', '北京长城贸易有限公司'],
      shouldFilter: ['李华'],
    },
  },
  {
    id: 9,
    name: '自然人当事人（无公司）',
    content: `民事起诉状

原告：王小红，女，1990年3月8日出生，汉族，住上海市浦东新区陆家嘴环路100号，联系电话：18600186000，职业：财务主管

被告：张大伟，男，1988年7月12日出生，汉族，住上海市徐汇区淮海中路200号，联系电话：18700187000，职业：企业总经理`,
    aiResponse: {
      extractedData: {
        parties: [
          {
            type: 'plaintiff',
            name: '王小红',
            role: '原告',
            contact: '18600186000',
            address: '上海市浦东新区陆家嘴环路100号',
          },
          {
            type: 'defendant',
            name: '张大伟',
            role: '被告',
            contact: '18700187000',
            address: '上海市徐汇区淮海中路200号',
          },
        ],
      },
    },
    expectedParties: {
      shouldKeep: ['王小红', '张大伟'],
      shouldFilter: [],
    },
  },
];

// =============================================================================
// 法定代表人过滤逻辑
// =============================================================================

function filterLegalRepresentatives(text: string, parties: Party[]): Party[] {
  const legalRepKeywords = [
    '法定代表人',
    '法定代表',
    '法人代表',
    '负责人',
    '执行事务合伙人',
  ];
  const independentRoles = [
    '原告',
    '被告',
    '第三人',
    '申请人',
    '被申请人',
    '上诉人',
    '被上诉人',
  ];

  return parties.filter((party: Party) => {
    // 如果角色包含独立角色关键词，直接保留
    if (
      party.role &&
      independentRoles.some(role => party.role!.includes(role))
    ) {
      return true;
    }

    // 如果角色包含法定代表人关键词，过滤掉
    if (
      party.role &&
      legalRepKeywords.some(keyword => party.role!.includes(keyword))
    ) {
      return false;
    }

    // 检查名称在上下文中是否紧跟法定代表人关键词
    const patterns = legalRepKeywords.map(
      keyword => new RegExp(`${keyword}[:：]?\\s*${party.name}`, 'g')
    );

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return false;
      }
    }

    // 检查名称是否是典型的法定代表人的短名称
    if (party.name.length <= 3 && !party.address && !party.contact) {
      // 如果名称很短且没有详细地址和联系方式，可能是法定代表人
      // 检查这个名称是否有独立的角色
      const hasIndependentRole = parties.some(
        p =>
          p.name === party.name &&
          p.type !== 'other' &&
          p.role &&
          independentRoles.some(role => p.role!.includes(role))
      );

      if (!hasIndependentRole) {
        return false;
      }
    }

    return true;
  });
}

// =============================================================================
// 测试逻辑
// =============================================================================

async function runTests(): Promise<void> {
  console.log('========================================');
  console.log('法定代表人过滤功能测试');
  console.log('========================================');
  console.log(`测试用例数量: ${testCases.length}\n`);

  let totalCases = 0;
  let totalParties = 0;
  let correctKept = 0;
  let correctFiltered = 0;
  let incorrectFiltered = 0;
  let incorrectKept = 0;

  for (const testCase of testCases) {
    console.log(`\n测试案例 ${testCase.id}: ${testCase.name}`);
    console.log('---');

    const startTime = Date.now();

    // 获取AI响应中的当事人
    const extractedParties = testCase.aiResponse.extractedData.parties;
    const allExtractedNames = extractedParties.map((p: Party) => p.name);

    // 过滤法定代表人
    const filteredParties = filterLegalRepresentatives(
      testCase.content,
      extractedParties
    );
    const actualPartyNames = filteredParties.map((p: Party) => p.name);

    const processingTime = Date.now() - startTime;

    console.log(`提取的当事人: ${allExtractedNames.join(', ')}`);
    console.log(`过滤后的当事人: ${actualPartyNames.join(', ')}`);
    console.log(`处理时间: ${processingTime}ms`);

    // 评估结果
    const caseCorrectKept = testCase.expectedParties.shouldKeep.filter(name =>
      actualPartyNames.includes(name)
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

    const totalExpected =
      testCase.expectedParties.shouldKeep.length +
      testCase.expectedParties.shouldFilter.length;
    const caseCorrect = caseCorrectKept.length + caseCorrectFiltered.length;
    const accuracy =
      totalExpected > 0 ? (caseCorrect / totalExpected) * 100 : 0;

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
  }

  // 打印汇总
  const overallAccuracy =
    totalParties > 0
      ? ((correctKept + correctFiltered) / totalParties) * 100
      : 0;
  const keepAccuracy =
    correctKept + incorrectKept > 0
      ? (correctKept / (correctKept + incorrectKept)) * 100
      : 0;
  const filterAccuracy =
    correctFiltered + incorrectFiltered > 0
      ? (correctFiltered / (correctFiltered + incorrectFiltered)) * 100
      : 0;

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
