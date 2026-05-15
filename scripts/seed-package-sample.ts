/**
 * P 阶段补样本脚本
 * 目标案件：王五诉赵六民间借贷纠纷案
 * 补充：Debate.summary、Conversation.caseContext（CaseCrystal）、Case.metadata（风险快照）
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CASE_ID = 'cmn7dw1j1000hpw7b9vks3rf8';
const DEBATE_ID = 'cmn8b8kqa000339v8vt6vn3qt'; // currentRound=3, status=COMPLETED
const USER_ID = 'cmmtg9kwb000hdyozqgr0gcwf';

// ── Debate.summary（§2 争议焦点 / §4 论点分析数据源）──────────────────────────
const DEBATE_SUMMARY = {
  verdict:
    '原告王五主张的借款事实清楚，证据链完整，被告赵六还款义务成立。原告胜诉概率较高，但利息主张存在调低风险。',
  plaintiffStrengths: [
    '借款合同书面证据完备，金额与转账记录一致',
    '被告在微信记录中明确承认欠款本金',
    '诉讼时效未过，程序合法',
  ],
  defendantStrengths: [
    '部分还款已发生，金额存在争议',
    '约定利率（月利率 2.5%）超过 LPR 四倍，法院可能调低',
    '无书面约定还款期限，宽限期抗辩有一定空间',
  ],
  keyLegalIssues: [
    '借款合同效力认定（民法典第六百六十七条）',
    '约定利率是否超过司法保护上限（民间借贷司法解释第二十五条）',
    '部分还款的性质认定（先还本金还是先还利息）',
  ],
  recommendation:
    '建议原告接受法院调整后利率，重点在本金及法定利率部分争取全额支持；被告应准备书面还款凭证防止双重计算。',
};

// ── CaseCrystal（§1 案情摘要 / §2 争议焦点增强数据源）─────────────────────────
const CASE_CRYSTAL = {
  version: 3,
  updatedAt: new Date().toISOString(),
  case_type: '民间借贷纠纷',
  parties: {
    plaintiff: '王五（出借方，自然人）',
    defendant: '赵六（借款方，自然人）',
  },
  core_dispute:
    '被告是否应偿还借款本金 15 万元及约定利息，约定利率是否受司法保护',
  established_facts: [
    '2022 年 3 月 15 日，原告通过银行转账向被告出借 15 万元',
    '借款合同签署于同日，约定月利率 2.5%，还款期限一年',
    '被告于 2022 年 12 月已还款 3 万元',
    '被告在微信对话中承认剩余欠款 12 万元',
  ],
  uncertain_facts: [
    '被告主张另有现金还款 2 万元，原告否认，无书面凭证',
    '还款 3 万元中本金与利息的比例分配尚有争议',
  ],
  applicable_law_areas: [
    '合同法/民法典合同编',
    '民间借贷司法解释',
    '利率上限规定',
  ],
  current_position: '原告立场',
  open_questions: [
    '约定利率超过 LPR 四倍部分的处理方式',
    '现金还款 2 万元的举证责任归属',
  ],
};

// ── Case.metadata 风险快照（§6 风险评估数据源）─────────────────────────────────
const RISK_METADATA = {
  winRate: 0.78,
  difficulty: 'MEDIUM',
  riskLevel: 'LOW',
  aiAssessment: {
    summary: '案件事实清晰，主要风险来自利率调整，本金部分胜诉把握较大',
    keyRisks: [
      '约定利率超过 LPR 四倍，法院可能将利息调至年利率 15.4%',
      '被告现金还款抗辩若被认可，本金主张可能减少 2 万元',
    ],
    generatedAt: new Date().toISOString(),
  },
};

async function main() {
  console.log('── 开始补充 P 阶段样本数据 ──');

  // 1. 更新 Debate.summary：优先写入最新的非软删除 debate，若无则写入 DEBATE_ID
  const activeDebate = await prisma.debate.findFirst({
    where: { caseId: CASE_ID, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  const targetDebateId = activeDebate?.id ?? DEBATE_ID;
  await prisma.debate.update({
    where: { id: targetDebateId },
    data: { summary: DEBATE_SUMMARY },
  });
  console.log(`✓ Debate.summary 已写入 (debate: ${targetDebateId})`);

  // 2. 创建 Conversation + CaseCrystal（若已存在则跳过）
  const existingConv = await prisma.conversation.findFirst({
    where: { caseId: CASE_ID, userId: USER_ID },
  });
  if (!existingConv) {
    await prisma.conversation.create({
      data: {
        title: '民间借贷纠纷分析对话',
        userId: USER_ID,
        caseId: CASE_ID,
        caseContext: CASE_CRYSTAL,
      },
    });
    console.log('✓ Conversation + CaseCrystal 已创建');
  } else {
    await prisma.conversation.update({
      where: { id: existingConv.id },
      data: { caseContext: CASE_CRYSTAL },
    });
    console.log('✓ 已有 Conversation，CaseCrystal 已更新');
  }

  // 3. 更新 Case.metadata（风险快照）
  await prisma.case.update({
    where: { id: CASE_ID },
    data: { metadata: RISK_METADATA },
  });
  console.log('✓ Case.metadata 风险快照已写入');

  // 4. 验证
  const verify = await prisma.case.findUnique({
    where: { id: CASE_ID },
    include: {
      debates: { where: { id: targetDebateId }, select: { summary: true } },
      conversations: {
        where: { userId: USER_ID },
        select: { caseContext: true },
        take: 1,
      },
    },
  });
  const summaryOk = verify?.debates[0]?.summary !== null;
  const crystalOk = verify?.conversations[0]?.caseContext !== null;
  const metadataOk =
    verify?.metadata !== null &&
    typeof verify?.metadata === 'object' &&
    'winRate' in (verify.metadata as object);

  console.log('\n── 验证结果 ──');
  console.log(`P-1 Debate.summary:     ${summaryOk ? '✓ 通过' : '✗ 失败'}`);
  console.log(`P-2 CaseCrystal:        ${crystalOk ? '✓ 通过' : '✗ 失败'}`);
  console.log(`P-3 风险快照 metadata:  ${metadataOk ? '✓ 通过' : '✗ 失败'}`);

  if (summaryOk && crystalOk && metadataOk) {
    console.log('\nP 阶段三项全部通过，可进入阶段 1。');
  } else {
    console.log('\n部分未通过，请检查上方错误。');
    process.exit(1);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
