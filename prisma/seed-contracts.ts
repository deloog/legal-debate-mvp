import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 合同模板种子数据
 * 包含委托代理合同和法律顾问合同模板
 */
export async function seedContractTemplates() {
  console.log('开始创建合同模板种子数据...');

  // 1. 委托代理合同模板
  const delegationTemplate = await prisma.contractTemplate.upsert({
    where: { code: 'DELEGATION_CONTRACT' },
    update: {},
    create: {
      name: '委托代理合同',
      code: 'DELEGATION_CONTRACT',
      category: '委托代理',
      isDefault: true,
      isActive: true,
      variables: [
        { name: 'clientName', label: '委托人姓名', type: 'text', required: true },
        { name: 'clientIdNumber', label: '身份证号', type: 'text', required: true },
        { name: 'clientAddress', label: '联系地址', type: 'text', required: false },
        { name: 'clientPhone', label: '联系电话', type: 'text', required: true },
        { name: 'caseType', label: '案件类型', type: 'text', required: true },
        { name: 'caseSummary', label: '案情简述', type: 'textarea', required: true },
        { name: 'scope', label: '委托范围', type: 'text', required: true },
        { name: 'totalFee', label: '律师费总额', type: 'number', required: true },
        { name: 'feePaymentTerms', label: '付款方式', type: 'textarea', required: true },
        { name: 'lawFirmName', label: '律所名称', type: 'text', required: true },
        { name: 'lawyerName', label: '承办律师', type: 'text', required: true },
        { name: 'signDate', label: '签约日期', type: 'date', required: true },
      ],
      content: `
委托代理合同

甲方（委托人）：{{clientName}}
身份证号：{{clientIdNumber}}
联系地址：{{clientAddress}}
联系电话：{{clientPhone}}

乙方（受托人）：{{lawFirmName}}
承办律师：{{lawyerName}}

根据《中华人民共和国民法典》《中华人民共和国律师法》及相关法律法规的规定，甲乙双方在平等自愿的基础上，就甲方委托乙方代理法律事务达成如下协议：

一、委托事项

1.1 案件类型：{{caseType}}

1.2 案情简述：
{{caseSummary}}

1.3 委托范围：
{{scope}}

二、律师费用及支付方式

2.1 律师费总额：人民币 {{totalFee}} 元（大写：{{totalFeeChinese}}）

2.2 付款方式：
{{feePaymentTerms}}

2.3 除律师费外，办理本案所需的诉讼费、鉴定费、公证费、差旅费等实际支出费用由甲方承担。

三、甲方的权利和义务

3.1 甲方有权了解委托事项的进展情况，乙方应及时向甲方通报。

3.2 甲方应如实陈述案件事实，提供真实、完整的证据材料。

3.3 甲方应按约定支付律师费及其他费用。

3.4 甲方有权随时解除合同，但应支付已完成工作的律师费。

四、乙方的权利和义务

4.1 乙方应按照法律规定和职业道德，认真履行代理职责。

4.2 乙方应及时向甲方通报案件进展情况。

4.3 乙方应对甲方的商业秘密和个人隐私保密。

4.4 乙方有权拒绝甲方提出的违法要求。

4.5 因甲方原因导致合同无法履行的，乙方有权要求甲方支付已完成工作的律师费。

五、合同的变更和解除

5.1 双方协商一致可以变更或解除本合同。

5.2 甲方单方解除合同的，应支付已完成工作的律师费。

5.3 乙方单方解除合同的，应退还未完成工作部分的律师费。

六、违约责任

6.1 甲方未按约定支付律师费的，应按日支付未付金额千分之五的违约金。

6.2 乙方未尽职履行代理职责造成甲方损失的，应承担相应赔偿责任。

七、争议解决

因本合同引起的争议，双方应协商解决；协商不成的，可向乙方所在地人民法院提起诉讼。

八、其他约定

8.1 本合同一式两份，甲乙双方各执一份，具有同等法律效力。

8.2 本合同自双方签字（盖章）之日起生效。

甲方（签字）：________________    日期：{{signDate}}

乙方（盖章）：________________    日期：{{signDate}}

承办律师（签字）：________________
      `.trim(),
    },
  });

  console.log('委托代理合同模板创建完成');

  // 2. 法律顾问合同模板
  const legalCounselTemplate = await prisma.contractTemplate.upsert({
    where: { code: 'LEGAL_COUNSEL_CONTRACT' },
    update: {},
    create: {
      name: '法律顾问合同',
      code: 'LEGAL_COUNSEL_CONTRACT',
      category: '法律顾问',
      isDefault: false,
      isActive: true,
      variables: [
        { name: 'clientName', label: '委托人名称', type: 'text', required: true },
        { name: 'clientIdNumber', label: '统一社会信用代码', type: 'text', required: true },
        { name: 'clientAddress', label: '联系地址', type: 'text', required: false },
        { name: 'clientPhone', label: '联系电话', type: 'text', required: true },
        { name: 'serviceScope', label: '服务范围', type: 'textarea', required: true },
        { name: 'servicePeriod', label: '服务期限', type: 'text', required: true },
        { name: 'annualFee', label: '年度顾问费', type: 'number', required: true },
        { name: 'feePaymentTerms', label: '付款方式', type: 'textarea', required: true },
        { name: 'lawFirmName', label: '律所名称', type: 'text', required: true },
        { name: 'lawyerName', label: '承办律师', type: 'text', required: true },
        { name: 'signDate', label: '签约日期', type: 'date', required: true },
      ],
      content: `
法律顾问合同

甲方（委托人）：{{clientName}}
统一社会信用代码：{{clientIdNumber}}
联系地址：{{clientAddress}}
联系电话：{{clientPhone}}

乙方（受托人）：{{lawFirmName}}
承办律师：{{lawyerName}}

根据《中华人民共和国民法典》《中华人民共和国律师法》及相关法律法规的规定，甲乙双方在平等自愿的基础上，就甲方聘请乙方担任常年法律顾问事宜达成如下协议：

一、服务内容

1.1 服务范围：
{{serviceScope}}

1.2 服务期限：{{servicePeriod}}

1.3 服务方式：
（1）提供日常法律咨询服务；
（2）审查、修改各类合同及法律文件；
（3）参与重大经营决策的法律论证；
（4）协助处理劳动人事法律事务；
（5）协助处理知识产权法律事务；
（6）出具法律意见书；
（7）提供法律培训服务；
（8）其他双方约定的法律服务。

二、顾问费用及支付方式

2.1 年度顾问费：人民币 {{annualFee}} 元（大写：{{annualFeeChinese}}）

2.2 付款方式：
{{feePaymentTerms}}

2.3 本合同约定的顾问费不包括以下费用：
（1）代理诉讼、仲裁案件的律师费；
（2）办理非诉讼法律事务的专项律师费；
（3）差旅费、公证费、鉴定费等实际支出费用。

三、甲方的权利和义务

3.1 甲方有权就经营管理中的法律问题向乙方咨询。

3.2 甲方应如实向乙方提供与法律服务相关的资料和信息。

3.3 甲方应按约定支付顾问费。

3.4 甲方应为乙方提供必要的工作条件。

3.5 甲方有权对乙方的服务质量进行监督和评价。

四、乙方的权利和义务

4.1 乙方应按照法律规定和职业道德，认真履行法律顾问职责。

4.2 乙方应及时、准确地解答甲方的法律咨询。

4.3 乙方应对甲方的商业秘密和敏感信息保密。

4.4 乙方应定期向甲方通报法律服务情况。

4.5 乙方有权拒绝甲方提出的违法要求。

4.6 乙方有权按约定收取顾问费。

五、保密条款

5.1 乙方对在提供法律服务过程中知悉的甲方商业秘密、技术秘密及其他敏感信息负有保密义务。

5.2 保密义务在本合同终止后继续有效。

5.3 因乙方违反保密义务给甲方造成损失的，应承担赔偿责任。

六、合同的变更和解除

6.1 双方协商一致可以变更或解除本合同。

6.2 任何一方提前解除合同的，应提前30日书面通知对方。

6.3 甲方提前解除合同的，已支付的顾问费不予退还。

6.4 乙方提前解除合同的，应按比例退还未服务期间的顾问费。

七、违约责任

7.1 甲方未按约定支付顾问费的，应按日支付未付金额千分之五的违约金。

7.2 乙方未尽职履行顾问职责造成甲方损失的，应承担相应赔偿责任。

八、争议解决

因本合同引起的争议，双方应协商解决；协商不成的，可向乙方所在地人民法院提起诉讼。

九、其他约定

9.1 本合同一式两份，甲乙双方各执一份，具有同等法律效力。

9.2 本合同自双方签字（盖章）之日起生效。

9.3 本合同到期后，如双方无异议，可自动续期一年。

甲方（盖章）：________________    日期：{{signDate}}
法定代表人（签字）：________________

乙方（盖章）：________________    日期：{{signDate}}

承办律师（签字）：________________
      `.trim(),
    },
  });

  console.log('法律顾问合同模板创建完成');

  console.log('合同模板种子数据创建完成！');
  console.log(`- 委托代理合同模板: ${delegationTemplate.name}`);
  console.log(`- 法律顾问合同模板: ${legalCounselTemplate.name}`);
}

// 如果直接运行此文件
if (require.main === module) {
  seedContractTemplates()
    .catch(e => {
      console.error('合同模板种子数据创建失败:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
