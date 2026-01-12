import { getUnifiedAIService } from '../src/lib/ai/unified-service';

async function testZhipuSpeed() {
  try {
    console.log('开始测试智谱AI响应时间...');

    // 测试1: 简单问题
    console.log('\n=== 测试1: 简单问题 ===');
    const startTime1 = Date.now();

    const unifiedService = await getUnifiedAIService();
    const response1 = await unifiedService.chatCompletion({
      model: 'glm-4-flash',
      provider: 'zhipu',
      messages: [
        {
          role: 'user',
          content: '请简单回答：1+1等于几？',
        },
      ],
      temperature: 0.1,
      maxTokens: 100,
    });

    const endTime1 = Date.now();
    console.log('响应内容:', response1.choices[0].message.content);
    console.log('响应时间:', endTime1 - startTime1, 'ms');

    // 测试2: 中等复杂度问题
    console.log('\n=== 测试2: 中等复杂度问题 ===');
    const startTime2 = Date.now();

    const response2 = await unifiedService.chatCompletion({
      model: 'glm-4-flash',
      provider: 'zhipu',
      messages: [
        {
          role: 'user',
          content:
            '请分析以下文本并提取关键信息：张三向李四借款50000元，约定年利率6%，借款期限为1年。请提取借款人、出借人、借款金额、利率和期限。',
        },
      ],
      temperature: 0.1,
      maxTokens: 500,
    });

    const endTime2 = Date.now();
    console.log('响应内容:', response2.choices[0].message.content);
    console.log('响应时间:', endTime2 - startTime2, 'ms');

    // 测试3: 复杂法律文档分析（类似我们的优化版提示词）
    console.log('\n=== 测试3: 复杂法律文档分析 ===');
    const startTime3 = Date.now();

    const legalPrompt = `你是一个专业的法律文档分析专家。请对以下法律文档进行分析：

文档内容：
原告张三，男，1980年5月15日出生，汉族，住北京市朝阳区建国门外大街1号，联系电话13800138000，职业：软件工程师。
被告李四，男，1982年8月20日出生，汉族，住北京市海淀区中关村大街2号，联系电话13900139000，职业：公司经理。

诉讼请求：
1. 请求判令被告返还借款本金人民币500,000元；
2. 请求判令被告支付逾期利息（以500,000元为基数，自2023年1月1日起至实际付清之日止，按年利率6%计算）；
3. 请求判令被告承担本案全部诉讼费用。

请按照JSON格式返回分析结果，包含当事人信息和诉讼请求。`;

    const response3 = await unifiedService.chatCompletion({
      model: 'glm-4-flash',
      provider: 'zhipu',
      messages: [
        {
          role: 'system',
          content:
            '你是一个专业的法律文档分析专家，专门从法律文档中提取结构化信息。',
        },
        {
          role: 'user',
          content: legalPrompt,
        },
      ],
      temperature: 0.1,
      maxTokens: 2000,
    });

    const endTime3 = Date.now();
    console.log(
      '响应内容长度:',
      response3.choices[0].message.content.length,
      '字符'
    );
    console.log('响应时间:', endTime3 - startTime3, 'ms');

    // 测试4: 使用优化版提示词（完整版本）
    console.log('\n=== 测试4: 优化版完整提示词 ===');
    const startTime4 = Date.now();

    const optimizedPrompt = `你是一个专业的法律文档分析专家。请对以下法律文档进行分析，完成以下任务：

分析任务：当事人信息提取、诉讼请求识别

文档内容：
原告张三，男，1980年5月15日出生，汉族，住北京市朝阳区建国门外大街1号，联系电话13800138000，职业：软件工程师。
被告李四，男，1982年8月20日出生，汉族，住北京市海淀区中关村大街2号，联系电话13900139000，职业：公司经理。

诉讼请求：
1. 请求判令被告返还借款本金人民币500,000元；
2. 请求判令被告支付逾期利息（以500,000元为基数，自2023年1月1日起至实际付清之日止，按年利率6%计算）；
3. 请求判令被告承担本案全部诉讼费用。

【思维链分析过程 - 严格遵守以下6个步骤】

**第1步：OCR修正检查**
请先阅读全文，指出可能存在的OCR错误：
- 数字识别错误（如"1"识别为"l"）
- 中文识别错误（如"张三"识别为"张二"）
- 格式混乱导致的理解困难

**第2步：实体罗列**
列出文档中出现的所有人名、公司名、金额信息：
- 人名：[张三、李四...]
- 公司名：[XX公司、YY企业...]
- 金额：[500000元、6%...]

**第3步：角色判定**
根据法律文书惯例和上下文线索，判定每个实体的确切角色：
- 原告识别标志：明确出现"原告"、"申请人"、"起诉人"字样
- 被告识别标志：明确出现"被告"、"被申请人"、"被起诉人"字样
- 关键约束：法定代表人不是当事人，而是原告/被告的属性

**第4步：诉讼请求原子化拆解**
将复合长句拆解为原子化的短句：
- PAY_PRINCIPAL：偿还本金
- PAY_INTEREST：支付利息
- LITIGATION_COST：诉讼费用

**第5步：金额标准化处理**
将所有金额转换为统一格式：
- "500,000元" → 500000.00
- "年利率6%" → 6%

**第6步：自我验证检查**
在输出前进行以下检查：
- 没有重复的当事人姓名
- 每个当事人的法律角色正确
- 所有诉讼请求都被提取且分类正确

【严格输出要求】
请按照以下JSON格式返回分析结果：

{
  "extractedData": {
    "parties": [
      {
        "type": "plaintiff|defendant|other",
        "name": "当事人姓名",
        "role": "职务或角色",
        "contact": "联系方式",
        "address": "地址"
      }
    ],
    "claims": [
      {
        "type": "PAY_PRINCIPAL|PAY_INTEREST|PAY_PENALTY|PAY_DAMAGES|LITIGATION_COST|PERFORMANCE|TERMINATION|OTHER",
        "content": "请求内容描述",
        "amount": 金额(数字),
        "currency": "CNY",
        "evidence": ["证据描述"],
        "legalBasis": "法律依据"
      }
    ]
  },
  "confidence": 0.95
}`;

    const response4 = await unifiedService.chatCompletion({
      model: 'glm-4-flash',
      provider: 'zhipu',
      messages: [
        {
          role: 'system',
          content:
            '你是一个专业的法律文档分析专家，专门从法律文档中提取结构化信息。',
        },
        {
          role: 'user',
          content: optimizedPrompt,
        },
      ],
      temperature: 0.1,
      maxTokens: 4000,
    });

    const endTime4 = Date.now();
    console.log(
      '响应内容长度:',
      response4.choices[0].message.content.length,
      '字符'
    );
    console.log('响应时间:', endTime4 - startTime4, 'ms');
  } catch (error) {
    console.error('测试失败:', error.message);
    console.error('错误详情:', error);
  }
}

testZhipuSpeed();
