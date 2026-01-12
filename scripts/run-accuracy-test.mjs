/**
 * 准确性提升验证测试脚本
 * 独立运行，不使用Jest的mock环境，确保真实AI调用
 */

import { config } from 'dotenv';
import { OpenAI } from 'openai';

// 加载环境变量
config({ path: '.env' });

async function runAccuracyTest() {
  console.log('='.repeat(60));
  console.log('准确性提升验证测试');
  console.log('='.repeat(60));

  const testCases = [
    {
      id: 'DOC-001',
      content: `民事起诉状

原告：王小红，女，1985年3月15日出生，汉族，住上海市浦东新区陆家嘴环路100号。
联系方式：18600186000

被告：张大伟，男，1982年8月22日出生，汉族，住上海市徐汇区淮海中路200号。
联系方式：18700187000

第三人：赵明，男，1988年12月10日出生，汉族，住上海市静安区南京西路300号。
联系方式：18800188000

诉讼请求：
1. 判令被告支付拖欠货款人民币800,000元；
2. 判令被告支付违约金（以800,000元为基数，自2023年5月1日起至实际付清之日止，按年利率8%计算）；
3. 判令被告承担本案全部诉讼费用；
4. 判令被告赔偿原告因追讨欠款产生的律师费50,000元。

事实与理由：
2023年3月15日，原告与被告签订《产品销售合同》，约定被告向原告采购一批电子元件，总价值800,000元。合同约定付款期限为发货后30日内。原告于2023年3月20日完成发货，被告于2023年4月10日收到货物。然而，被告至今未按合同约定支付货款。原告多次通过电话、短信、邮件等方式催要，被告均以各种理由推脱，至今已拖欠近10个月。根据《中华人民共和国民法典》第五百七十九条、第五百八十条等相关规定，被告的行为已构成违约，应当承担相应的民事责任。原告为维护自身合法权益，特向贵院提起诉讼。

此致
上海市第一中级人民法院

具状人：王小红
2024年1月15日`,
      expected: {
        parties: [
          { name: '王小红', type: 'plaintiff', role: '原告' },
          { name: '张大伟', type: 'defendant', role: '被告' },
          { name: '赵明', type: 'other', role: '第三人' },
        ],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '支付拖欠货款',
            keywords: ['拖欠货款', '800000'],
          },
          { type: 'PAY_PENALTY', content: '支付违约金', keywords: ['违约金'] },
          {
            type: 'LITIGATION_COST',
            content: '诉讼费用',
            keywords: ['诉讼费用'],
          },
          {
            type: 'PAY_DAMAGES',
            content: '赔偿律师费',
            keywords: ['律师费', '50000'],
          },
        ],
        amounts: [800000, 50000],
      },
    },
  ];

  console.log('正在创建AI客户端...');
  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    timeout: 60000,
  });

  const results = {
    partyRecognitionAccuracy: 0,
    claimExtractionRecall: 0,
    amountExtractionAccuracy: 0,
    overallScore: 0,
    errors: [],
  };

  for (const testCase of testCases) {
    console.log(`\n分析测试文档: ${testCase.id}`);

    try {
      const prompt = `你是专业法律文档分析专家。请严格按照以下要求对文档进行分析。

【核心任务】

1. 当事人角色识别（优先级最高）：
   - 必须提取所有原告、被告、第三人
   - 必须包含姓名和角色描述
   - 区分自然人和法人

2. 诉讼请求提取（优先级最高）：
   - 必须逐条提取"诉讼请求"中的所有内容
   - 保留每个请求的完整表述，不要简化或改写
   - 识别请求类型并标注
   - 如果有金额必须提取并转换为纯数字

3. 金额提取：
   - 提取所有数字金额并转换为纯数字
   - 保留金额的上下文含义

【特别注意】
- 诉讼请求内容必须与原文保持一致，只去掉序号和标点
- 金额必须转换为纯数字，不包含单位或货币符号
- 必须提取诉讼请求中的每一项内容

文档内容：
${testCase.content}

【输出要求】
按以下JSON格式返回，不要包含其他文字：
{
  "extractedData": {
    "parties": [
      {
        "type": "plaintiff|defendant|other",
        "name": "姓名或公司名",
        "role": "角色描述（如法定代表人、原告、被告等）"
      }
    ],
    "claims": [
      {
        "type": "PAY_PRINCIPAL|PAY_INTEREST|PAY_PENALTY|PAY_DAMAGES|LITIGATION_COST|PERFORMANCE|TERMINATION|OTHER",
        "content": "请求的完整描述",
        "amount": 数字金额（如500000）
      }
    ]
  },
  "confidence": 0.95
}`;

      const startTime = Date.now();
      console.log('正在调用DeepSeek API...');
      const response = await client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content:
              '你是一个专业的法律文档分析专家，专门从法律文档中提取结构化信息。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        maxTokens: 4000,
      });

      const responseTime = Date.now() - startTime;
      console.log(`AI响应时间: ${responseTime}ms`);

      // 解析响应
      const aiContent = response.choices[0].message.content;
      console.log(`AI响应长度: ${aiContent?.length || 0} 字符`);

      let cleanedContent = aiContent.trim();

      if (cleanedContent.includes('```json')) {
        cleanedContent = cleanedContent
          .replace(/```json\\s*/, '')
          .replace(/```\\s*$/, '');
      } else if (cleanedContent.includes('```')) {
        cleanedContent = cleanedContent
          .replace(/```\\s*/, '')
          .replace(/```\\s*$/, '');
      }

      const parsedResponse = JSON.parse(cleanedContent);
      const extractedData = parsedResponse.extractedData;

      // 评估当事人识别
      const extractedParties = extractedData.parties.map(p => p.name);
      const expectedParties = testCase.expected.parties.map(p => p.name);
      const partyMatches = extractedParties.filter(name =>
        expectedParties.some(expected => expected.includes(name))
      );
      const partyAccuracy = partyMatches.length / expectedParties.length;

      // 评估诉讼请求提取
      const extractedClaims = extractedData.claims.map(c => c.content);

      // 输出详细对比
      console.log('\n  详细对比:');
      console.log('    提取的请求:');
      extractedClaims.forEach((claim, i) => {
        console.log(`      ${i + 1}. ${claim}`);
      });
      console.log('    预期的请求:');
      testCase.expected.claims.forEach((claim, i) => {
        console.log(`      ${i + 1}. ${claim.content}`);
      });

      // 使用关键词匹配逻辑
      const claimMatches = testCase.expected.claims.filter(expected => {
        return extractedClaims.some(extracted => {
          // 检查是否包含关键词
          if (expected.keywords) {
            return expected.keywords.some(keyword =>
              extracted.includes(keyword)
            );
          }
          // 如果没有关键词，使用内容匹配
          const normalizedExtracted = extracted.replace(/[\s，。、；]/g, '');
          const normalizedExpected = expected.content.replace(
            /[\s，。、；]/g,
            ''
          );
          return (
            normalizedExtracted.includes(normalizedExpected) ||
            normalizedExpected.includes(normalizedExtracted)
          );
        });
      });

      const claimRecall = claimMatches.length / testCase.expected.claims.length;

      // 评估金额提取
      const extractedAmounts = extractedData.claims
        .map(c => c.amount)
        .filter(a => typeof a === 'number' && a > 0);
      const amountMatches = testCase.expected.amounts.filter(expected =>
        extractedAmounts.some(extracted => Math.abs(extracted - expected) < 1)
      );
      const amountAccuracy =
        amountMatches.length / testCase.expected.amounts.length;

      // 综合评分
      const overallScore = (partyAccuracy + claimRecall + amountAccuracy) / 3;

      // 输出结果
      console.log('\n' + '-'.repeat(60));
      console.log('评估结果:');
      console.log(`  当事人识别准确率: ${(partyAccuracy * 100).toFixed(2)}%`);
      console.log(`    提取: ${JSON.stringify(extractedParties)}`);
      console.log(`    预期: ${JSON.stringify(expectedParties)}`);
      console.log(`  诉讼请求提取召回率: ${(claimRecall * 100).toFixed(2)}%`);
      console.log(`    提取: ${extractedClaims.length}个`);
      console.log(`    预期: ${testCase.expected.claims.length}个`);
      console.log(`  金额提取准确率: ${(amountAccuracy * 100).toFixed(2)}%`);
      console.log(`    提取: ${JSON.stringify(extractedAmounts)}`);
      console.log(`    预期: ${JSON.stringify(testCase.expected.amounts)}`);
      console.log(`  综合评分: ${(overallScore * 100).toFixed(2)}%`);
      console.log('-'.repeat(60));

      results.partyRecognitionAccuracy = partyAccuracy;
      results.claimExtractionRecall = claimRecall;
      results.amountExtractionAccuracy = amountAccuracy;
      results.overallScore = overallScore;
    } catch (error) {
      console.error('分析失败:', error.message);
      results.errors.push(error.message);
    }
  }

  // 生成测试报告
  console.log('\n' + '='.repeat(60));
  console.log('测试报告');
  console.log('='.repeat(60));
  console.log(
    `当事人识别准确率: ${(results.partyRecognitionAccuracy * 100).toFixed(2)}%`
  );
  console.log(
    `诉讼请求提取召回率: ${(results.claimExtractionRecall * 100).toFixed(2)}%`
  );
  console.log(
    `金额提取准确率: ${(results.amountExtractionAccuracy * 100).toFixed(2)}%`
  );
  console.log(`综合评分: ${(results.overallScore * 100).toFixed(2)}%`);
  console.log('\n测试结果:');
  console.log(
    `  当事人识别: ${results.partyRecognitionAccuracy >= 0.95 ? '通过' : '未通过'} (目标: >= 95%)`
  );
  console.log(
    `  诉讼请求提取: ${results.claimExtractionRecall >= 0.95 ? '通过' : '未通过'} (目标: >= 95%)`
  );
  console.log(
    `  金额提取: ${results.amountExtractionAccuracy >= 0.95 ? '通过' : '未通过'} (目标: >= 95%)`
  );
  console.log(
    `  综合评分: ${results.overallScore >= 0.95 ? '通过' : '未通过'} (目标: >= 95%)`
  );

  const allPassed =
    results.partyRecognitionAccuracy >= 0.95 &&
    results.claimExtractionRecall >= 0.95 &&
    results.amountExtractionAccuracy >= 0.95 &&
    results.overallScore >= 0.95;

  console.log('\n' + '='.repeat(60));
  console.log(allPassed ? '✓ 所有测试通过！' : '✗ 部分测试未通过');
  console.log('='.repeat(60));

  return { passed: allPassed, results };
}

// 运行测试
runAccuracyTest()
  .then(result => {
    process.exit(result.passed ? 0 : 1);
  })
  .catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
