/**
 * 合规规则种子数据
 * 覆盖六大合规类别：法律、财务、运营、数据隐私、劳动法、环境合规
 * 运行方式：npx ts-node --project scripts/tsconfig.json prisma/seed-compliance.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rules = [
  // ─── 法律合规 ──────────────────────────────────────────────────────────────
  {
    ruleCode: 'LEGAL-001',
    ruleName: '企业营业执照与经营资质合规',
    ruleType: 'REGULATORY' as const,
    source: 'STATE_COUNCIL' as const,
    description: '企业应持有有效营业执照，经营范围与实际业务一致，特许经营资质齐全。',
    effectiveDate: new Date('2020-01-01'),
    businessProcesses: ['legal', 'registration'],
    controlPoints: ['营业执照有效期', '经营范围覆盖', '特许经营证'],
    checklistItems: [
      { id: 'L001-1', title: '营业执照在有效期内', description: '确认营业执照未过期，若临近到期需提前续期', priority: 'critical' },
      { id: 'L001-2', title: '经营范围与实际业务一致', description: '核查营业执照经营范围是否涵盖全部实际业务活动', priority: 'high' },
      { id: 'L001-3', title: '特许经营资质齐全', description: '涉及特许经营行业（金融、医疗、教育等）需持有相应许可证', priority: 'high' },
      { id: 'L001-4', title: '公司章程符合法律规定', description: '公司章程与现行《公司法》规定相符，不存在违法条款', priority: 'medium' },
      { id: 'L001-5', title: '股东/高管信息登记准确', description: '工商登记信息与实际情况一致，变更及时登记', priority: 'medium' },
    ],
  },
  {
    ruleCode: 'LEGAL-002',
    ruleName: '合同管理合规',
    ruleType: 'INTERNAL' as const,
    source: 'INTERNAL' as const,
    description: '企业对外签署的合同应经过合规审查，关键条款完备，履行情况有记录。',
    effectiveDate: new Date('2021-01-01'),
    businessProcesses: ['legal', 'contract'],
    controlPoints: ['合同审查流程', '关键条款', '合同归档'],
    checklistItems: [
      { id: 'L002-1', title: '重大合同经法务审查', description: '超过一定金额或期限的合同应经法务部门或外部律师审查', priority: 'high' },
      { id: 'L002-2', title: '合同关键条款完备', description: '违约责任、争议解决、保密条款等关键内容齐全', priority: 'high' },
      { id: 'L002-3', title: '合同履行情况有追踪记录', description: '建立合同台账，定期核查履行进度', priority: 'medium' },
      { id: 'L002-4', title: '合同到期前及时处理', description: '设置合同到期提醒，避免权利义务因超期而灭失', priority: 'medium' },
    ],
  },

  // ─── 财务合规 ──────────────────────────────────────────────────────────────
  {
    ruleCode: 'FINANCE-001',
    ruleName: '税务合规管理',
    ruleType: 'REGULATORY' as const,
    source: 'MINISTRY' as const,
    description: '企业依法履行纳税申报、发票管理、税款缴纳等税务义务。',
    effectiveDate: new Date('2020-01-01'),
    businessProcesses: ['financial', 'finance', 'tax'],
    controlPoints: ['税务申报', '发票管理', '税款缴纳'],
    checklistItems: [
      { id: 'F001-1', title: '按时完成纳税申报', description: '增值税、企业所得税等各税种按规定期限申报，无逾期', priority: 'critical' },
      { id: 'F001-2', title: '发票开具与取得合规', description: '发票信息真实准确，增值税发票按规定认证抵扣', priority: 'high' },
      { id: 'F001-3', title: '税款及时足额缴纳', description: '各项税款按期缴纳，无欠税记录', priority: 'critical' },
      { id: 'F001-4', title: '享受税收优惠有充分依据', description: '适用税收优惠政策有合法依据，留存相关证明材料', priority: 'high' },
      { id: 'F001-5', title: '关联方交易定价合理', description: '关联交易遵循独立交易原则，有合理商业目的和定价依据', priority: 'medium' },
    ],
  },
  {
    ruleCode: 'FINANCE-002',
    ruleName: '财务报告与信息披露合规',
    ruleType: 'REGULATORY' as const,
    source: 'MINISTRY' as const,
    description: '企业财务报告应真实、完整，依法履行信息披露义务。',
    effectiveDate: new Date('2021-01-01'),
    businessProcesses: ['financial', 'finance', 'reporting'],
    controlPoints: ['财务报告', '审计', '信息披露'],
    checklistItems: [
      { id: 'F002-1', title: '财务报表按会计准则编制', description: '执行企业会计准则，会计政策一致，不存在重大错报', priority: 'critical' },
      { id: 'F002-2', title: '年度财务报告经审计', description: '法定需审计的企业委托注册会计师出具审计报告', priority: 'high' },
      { id: 'F002-3', title: '内控制度健全有效', description: '建立资金审批、对账等内控机制，防范财务舞弊', priority: 'high' },
      { id: 'F002-4', title: '公积金与社保费用合规提取', description: '按规定提取法定公积金，足额缴纳社会保险费', priority: 'medium' },
    ],
  },

  // ─── 运营合规 ──────────────────────────────────────────────────────────────
  {
    ruleCode: 'OPS-001',
    ruleName: '生产经营许可与安全合规',
    ruleType: 'REGULATORY' as const,
    source: 'MINISTRY' as const,
    description: '企业生产经营活动应取得必要许可，符合安全生产标准。',
    effectiveDate: new Date('2020-01-01'),
    businessProcesses: ['operation', 'safety', 'production'],
    controlPoints: ['生产许可', '安全生产', '设备检验'],
    checklistItems: [
      { id: 'O001-1', title: '生产许可证在有效期内', description: '涉及许可证管理的生产活动，许可证未过期且范围覆盖', priority: 'critical' },
      { id: 'O001-2', title: '安全生产制度健全', description: '建立安全生产责任制，定期开展安全培训和演练', priority: 'high' },
      { id: 'O001-3', title: '特种设备定期检验', description: '锅炉、压力容器等特种设备按期检验，检验报告存档', priority: 'high' },
      { id: 'O001-4', title: '职业健康防护措施到位', description: '接触职业危害因素的岗位，防护设施和个人防护用品配备齐全', priority: 'medium' },
      { id: 'O001-5', title: '消防设施合格', description: '消防器材定期检查，疏散通道畅通，消防系统正常运行', priority: 'high' },
    ],
  },
  {
    ruleCode: 'OPS-002',
    ruleName: '知识产权合规管理',
    ruleType: 'INTERNAL' as const,
    source: 'INTERNAL' as const,
    description: '企业应保护自有知识产权，并尊重第三方知识产权。',
    effectiveDate: new Date('2021-06-01'),
    businessProcesses: ['operation', 'ip', 'legal'],
    controlPoints: ['商标注册', '专利保护', '软件正版'],
    checklistItems: [
      { id: 'O002-1', title: '核心商标已注册', description: '企业名称、产品商标在主要类别已完成注册', priority: 'high' },
      { id: 'O002-2', title: '软件正版化', description: '企业使用的商业软件均持有合法授权，无盗版软件', priority: 'high' },
      { id: 'O002-3', title: '员工知识产权协议签署', description: '核心员工签署知识产权归属协议，避免离职后纠纷', priority: 'medium' },
      { id: 'O002-4', title: '专利申请与维权', description: '核心技术及时申请专利，定期监控侵权风险', priority: 'medium' },
    ],
  },

  // ─── 数据隐私合规 ──────────────────────────────────────────────────────────
  {
    ruleCode: 'DATA-001',
    ruleName: '个人信息保护合规',
    ruleType: 'REGULATORY' as const,
    source: 'NPC' as const,
    sourceUrl: 'https://www.npc.gov.cn/npc/c30834/202108/a8c4e3672c74491a80b53a172bb753fe.shtml',
    description: '依据《个人信息保护法》，企业应合法收集、处理个人信息，保障数据主体权利。',
    effectiveDate: new Date('2021-11-01'),
    businessProcesses: ['data', 'privacy', 'technology'],
    controlPoints: ['隐私政策', '数据收集', '用户权利', '数据安全'],
    checklistItems: [
      { id: 'D001-1', title: '隐私政策完整且公开展示', description: '隐私政策清晰说明数据收集目的、范围、保存期限及用户权利', priority: 'critical' },
      { id: 'D001-2', title: '获得用户明确同意', description: '收集个人信息前获取用户单独、明确的同意，不搭载授权', priority: 'critical' },
      { id: 'D001-3', title: '最小化原则落实', description: '仅收集业务必要的个人信息，不过度采集', priority: 'high' },
      { id: 'D001-4', title: '用户权利响应机制', description: '建立用户查阅、更正、删除、可携带等权利的处理流程', priority: 'high' },
      { id: 'D001-5', title: '数据安全保护措施', description: '敏感数据加密存储，访问权限最小化，定期安全评估', priority: 'critical' },
      { id: 'D001-6', title: '数据泄露应急处理', description: '建立数据泄露事件响应预案，发生泄露后72小时内向监管部门报告', priority: 'high' },
    ],
  },
  {
    ruleCode: 'DATA-002',
    ruleName: '网络安全等级保护合规',
    ruleType: 'REGULATORY' as const,
    source: 'MINISTRY' as const,
    description: '依据《网络安全法》及等保2.0标准，重要信息系统应完成等级保护测评。',
    effectiveDate: new Date('2019-12-01'),
    businessProcesses: ['data', 'technology', 'security'],
    controlPoints: ['等保测评', '系统备份', '访问控制'],
    checklistItems: [
      { id: 'D002-1', title: '信息系统完成等保定级', description: '重要信息系统按要求完成等级保护定级备案', priority: 'high' },
      { id: 'D002-2', title: '等保测评结论合格', description: '定级系统按周期完成等保测评，整改整改项已完成', priority: 'high' },
      { id: 'D002-3', title: '数据定期备份', description: '重要数据实施定期备份，异地容灾，定期验证恢复能力', priority: 'high' },
      { id: 'D002-4', title: '网络安全事件应急预案', description: '制定网络安全事件应急预案并定期演练', priority: 'medium' },
    ],
  },

  // ─── 劳动法合规 ────────────────────────────────────────────────────────────
  {
    ruleCode: 'LABOR-001',
    ruleName: '劳动合同与用工合规',
    ruleType: 'REGULATORY' as const,
    source: 'NPC' as const,
    description: '依据《劳动合同法》，企业应依法签订劳动合同，规范用工行为。',
    effectiveDate: new Date('2008-01-01'),
    businessProcesses: ['labor', 'hr', 'employment'],
    controlPoints: ['劳动合同', '工资发放', '工时管理'],
    checklistItems: [
      { id: 'LB001-1', title: '入职一个月内签订劳动合同', description: '员工入职后一个月内完成书面劳动合同签订，不得不签或超期', priority: 'critical' },
      { id: 'LB001-2', title: '工资不低于当地最低工资标准', description: '所有员工（含试用期）实际工资不低于当地最低工资标准', priority: 'critical' },
      { id: 'LB001-3', title: '工资按时足额发放', description: '工资按约定日期发放，不得无故克扣或拖欠', priority: 'critical' },
      { id: 'LB001-4', title: '工时合规，加班依法补偿', description: '执行标准工时或综合工时制，加班按法定标准支付加班费', priority: 'high' },
      { id: 'LB001-5', title: '试用期约定合法', description: '试用期期限和工资符合法律规定，不超期试用', priority: 'high' },
      { id: 'LB001-6', title: '解除劳动合同程序合法', description: '解除或终止劳动合同依法履行告知程序，支付应付经济补偿金', priority: 'critical' },
    ],
  },
  {
    ruleCode: 'LABOR-002',
    ruleName: '社会保险与公积金合规',
    ruleType: 'REGULATORY' as const,
    source: 'STATE_COUNCIL' as const,
    description: '企业应依法为员工缴纳五险一金，缴费基数合规。',
    effectiveDate: new Date('2011-07-01'),
    businessProcesses: ['labor', 'hr', 'social_insurance'],
    controlPoints: ['社保缴纳', '公积金', '缴费基数'],
    checklistItems: [
      { id: 'LB002-1', title: '全员参加社会保险', description: '所有在职员工均依法参加养老、医疗、失业、工伤、生育保险', priority: 'critical' },
      { id: 'LB002-2', title: '社保缴费基数合规', description: '缴费基数以员工实际工资为准，不低报、不漏报', priority: 'high' },
      { id: 'LB002-3', title: '住房公积金按规定缴纳', description: '在设立公积金制度地区依规缴纳公积金，缴存比例符合当地规定', priority: 'high' },
      { id: 'LB002-4', title: '工伤保险及时申报', description: '发生工伤事故后及时向社保机构申报，保障员工权益', priority: 'high' },
    ],
  },

  // ─── 环境合规 ──────────────────────────────────────────────────────────────
  {
    ruleCode: 'ENV-001',
    ruleName: '环境保护许可与排放合规',
    ruleType: 'REGULATORY' as const,
    source: 'MINISTRY' as const,
    description: '企业应依法取得排污许可证，生产活动符合环保标准。',
    effectiveDate: new Date('2021-03-01'),
    businessProcesses: ['environment', 'production', 'operation'],
    controlPoints: ['排污许可', '废弃物处理', '环境监测'],
    checklistItems: [
      { id: 'E001-1', title: '持有有效排污许可证', description: '依法取得排污许可证，排放类型和限值在许可范围内', priority: 'critical' },
      { id: 'E001-2', title: '废水废气达标排放', description: '废水、废气排放浓度和总量不超过许可限值，定期检测', priority: 'critical' },
      { id: 'E001-3', title: '固体废物规范处置', description: '一般固废与危险废物分类收集、规范处置，不随意倾倒', priority: 'high' },
      { id: 'E001-4', title: '危险废物管理台账完整', description: '建立危险废物产生、转移、处置台账，转移联单留存', priority: 'high' },
      { id: 'E001-5', title: '环保设施正常运行', description: '污染处理设施正常运行，不绕过或停用环保设施', priority: 'critical' },
    ],
  },
  {
    ruleCode: 'ENV-002',
    ruleName: '碳排放与绿色发展合规',
    ruleType: 'REGULATORY' as const,
    source: 'STATE_COUNCIL' as const,
    description: '纳入碳交易市场的企业依法履行碳排放配额清缴义务，推进绿色发展。',
    effectiveDate: new Date('2021-07-16'),
    businessProcesses: ['environment', 'carbon', 'sustainability'],
    controlPoints: ['碳排放核查', '配额清缴', 'ESG报告'],
    checklistItems: [
      { id: 'E002-1', title: '碳排放数据核查到位', description: '纳入碳交易市场的企业，碳排放数据经第三方核查机构核查', priority: 'high' },
      { id: 'E002-2', title: '配额清缴按时完成', description: '在规定期限内完成年度碳排放配额清缴，无超额未清缴', priority: 'high' },
      { id: 'E002-3', title: '节能减排目标落实', description: '制定能源消耗和碳排放年度目标，落实节能减排措施', priority: 'medium' },
      { id: 'E002-4', title: 'ESG信息披露（适用时）', description: '上市公司或要求披露ESG信息的企业，按规定格式披露环境、社会、治理信息', priority: 'medium' },
    ],
  },
];

async function main() {
  console.log('开始写入合规规则种子数据...');

  let created = 0;
  let skipped = 0;

  for (const rule of rules) {
    const existing = await prisma.complianceRule.findUnique({
      where: { ruleCode: rule.ruleCode },
    });

    if (existing) {
      console.log(`  跳过（已存在）: ${rule.ruleCode} ${rule.ruleName}`);
      skipped++;
      continue;
    }

    await prisma.complianceRule.create({
      data: {
        ruleCode: rule.ruleCode,
        ruleName: rule.ruleName,
        ruleType: rule.ruleType,
        source: rule.source,
        sourceUrl: rule.sourceUrl,
        description: rule.description,
        effectiveDate: rule.effectiveDate,
        businessProcesses: rule.businessProcesses,
        controlPoints: rule.controlPoints,
        checklistItems: rule.checklistItems,
        status: 'active',
        version: '1.0',
      },
    });

    console.log(`  ✓ 创建: ${rule.ruleCode} ${rule.ruleName}`);
    created++;
  }

  console.log(`\n完成：创建 ${created} 条，跳过 ${skipped} 条`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
