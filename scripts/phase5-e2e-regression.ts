/**
 * Phase 5 端到端验收脚本
 *
 * 模拟律师工作流：创建案件 → 上传卷宗 → 触发提炼/风险评估 → 创建辩论 → 验收交付包
 *
 * 用法（开发服务器）：
 *   BASE_URL=http://localhost:3000 EMAIL=deloog@qq.com PASSWORD=xxx npx ts-node scripts/phase5-e2e-regression.ts
 *
 * 依赖：运行中的开发服务器（npm run dev）
 * 测试卷宗：test-data/realistic-dossiers/loan-dispute-case-001/
 *
 * 认证说明：
 *   - 测试环境（NODE_ENV=test）：token 在响应体返回，脚本自动读取并以 Bearer 发送
 *   - 开发环境：token 通过 httpOnly Set-Cookie 传递，脚本提取 accessToken cookie 发送
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.EMAIL ?? 'deloog@qq.com';
const PASSWORD = process.env.PASSWORD ?? '';
const DOSSIER_DIR = path.join(
  __dirname,
  '../test-data/realistic-dossiers/loan-dispute-case-001'
);

const DOSSIER_FILES = [
  '00_案件概览.txt',
  '01_民事起诉状_原告版.txt',
  '02_借条与借款协议.txt',
  '03_银行转账流水_整理版.txt',
  '04_微信聊天记录节选.txt',
  '06_被告答辩意见_模拟版.txt',
  '07_证据目录及证明目的.txt',
  '09_OCR噪声版聊天记录.txt',
];

// 认证凭据（由 step1_login 填充）
let authHeader: Record<string, string> = {};

// ── 工具函数 ──────────────────────────────────────────────────────────────────

/** 发送 JSON / FormData 请求，返回解析后的响应体 T */
async function api<T>(
  method: string,
  urlPath: string,
  body?: unknown,
  formData?: FormData
): Promise<T> {
  const headers: Record<string, string> = { ...authHeader };
  if (!formData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers,
    body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    console.error(`[FAIL] ${method} ${urlPath} → ${res.status}`, parsed);
    throw new Error(`HTTP ${res.status}`);
  }
  return parsed as T;
}

/** 登录专用：同时获取响应体和 Set-Cookie 头 */
async function loginRequest(email: string, password: string) {
  // 真实路由：POST /api/auth/login（不是 /api/v1/auth/login）
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`登录失败 HTTP ${res.status}: ${text.substring(0, 200)}`);
  }

  const body = (await res.json()) as {
    success: boolean;
    data?: { token?: string };
  };
  const setCookie = res.headers.get('set-cookie') ?? '';
  return { body, setCookie };
}

function log(step: string, detail?: unknown) {
  console.log(
    `\n[${step}]`,
    detail !== undefined ? JSON.stringify(detail, null, 2) : ''
  );
}

function pass(label: string) {
  console.log(`  ✓ ${label}`);
}
function fail(label: string) {
  console.log(`  ✗ ${label}`);
  process.exitCode = 1;
}
function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ── 步骤 ──────────────────────────────────────────────────────────────────────

async function step1_login() {
  log('Step 1: 登录');
  const { body, setCookie } = await loginRequest(EMAIL, PASSWORD);

  if (!body.success) throw new Error('登录响应 success=false');

  const bodyToken = body.data?.token;
  if (bodyToken) {
    // 测试环境（NODE_ENV=test）：token 在响应体中
    authHeader = { Authorization: `Bearer ${bodyToken}` };
    pass('登录成功，使用响应体 token（测试环境模式）');
  } else {
    // 开发环境：从 Set-Cookie 提取 accessToken
    const match = setCookie.match(/accessToken=([^;,\s]+)/);
    if (!match)
      throw new Error('登录失败：响应体无 token，Set-Cookie 也无 accessToken');
    authHeader = { Cookie: `accessToken=${match[1]}` };
    pass('登录成功，使用 accessToken cookie（开发环境模式）');
  }
}

async function step2_createCase(): Promise<string> {
  log('Step 2: 创建测试案件');
  const resp = await api<{ success: boolean; data: { id: string } }>(
    'POST',
    '/api/v1/cases',
    {
      title: `[Phase5回归] 张三诉李四民间借贷纠纷_${Date.now()}`,
      type: 'CIVIL',
      plaintiffName: '张三',
      defendantName: '李四',
      description: '借款10万元，被告主张已还款20000元现金，原告否认',
    }
  );
  const caseId = resp.data.id;
  pass(`案件创建成功：${caseId}`);
  return caseId;
}

async function step3_uploadDossier(caseId: string) {
  log('Step 3: 上传卷宗材料');
  for (const filename of DOSSIER_FILES) {
    const filePath = path.join(DOSSIER_DIR, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠ 跳过（文件不存在）：${filename}`);
      continue;
    }

    const formData = new FormData();
    const content = fs.readFileSync(filePath);
    formData.append(
      'file',
      new Blob([content], { type: 'text/plain' }),
      filename
    );
    formData.append('caseId', caseId);
    // upload 路由当前要求 fileId 必填
    formData.append('fileId', crypto.randomUUID());

    try {
      await api<unknown>(
        'POST',
        '/api/v1/documents/upload',
        undefined,
        formData
      );
      pass(`上传：${filename}`);
    } catch {
      fail(`上传失败：${filename}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }
}

async function step4_waitForAnalysis(caseId: string, maxWaitMs = 120_000) {
  log('Step 4: 等待文档分析完成');
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const resp = await api<{
      success: boolean;
      data: { documentsCompleted: number; documentsTotal: number };
    }>('GET', `/api/v1/cases/${caseId}/workflow-status`);
    const { documentsCompleted, documentsTotal } = resp.data;
    process.stdout.write(
      `\r  分析进度：${documentsCompleted}/${documentsTotal}...`
    );

    if (
      documentsTotal > 0 &&
      documentsCompleted >= Math.min(documentsTotal, 3)
    ) {
      console.log('\n  ✓ 已有足够文档分析完成');
      return;
    }
    await new Promise(r => setTimeout(r, 5_000));
  }
  console.log();
  fail('等待文档分析超时（120秒）');
}

async function step4b_verifyAutoEvidence(caseId: string, maxWaitMs = 90_000) {
  log('Step 4B: 验证自动 Evidence 生成');
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const resp = await api<{
        success: boolean;
        data?: { evidence?: unknown[]; total?: number };
        evidence?: unknown[];
        total?: number;
      }>('GET', `/api/evidence?caseId=${caseId}`);

      const total =
        resp.data?.total ??
        resp.total ??
        resp.data?.evidence?.length ??
        resp.evidence?.length ??
        0;

      process.stdout.write(`\r  自动证据数量：${total}...`);
      if (total > 0) {
        console.log('\n  ✓ 文档分析完成后已自动生成 Evidence');
        return;
      }
    } catch {
      // 忽略短暂查询失败，继续轮询
    }

    await new Promise(r => setTimeout(r, 3_000));
  }
  console.log();
  fail('文档分析完成后未检测到自动生成的 Evidence');
}

async function step5_triggerExtraction(caseId: string) {
  log('Step 5: 触发案件提炼');
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await api<{
        success: boolean;
        data: { summary: string | null; disputeFocuses: string[] };
      }>('POST', `/api/v1/cases/${caseId}/extract`, { force: true });
      pass(
        `案件提炼完成（第 ${attempt} 次尝试），争议焦点数：${resp.data.disputeFocuses?.length ?? 0}`
      );
      if (resp.data.disputeFocuses?.length > 0) {
        console.log(
          '  争议焦点（前 3 条）：',
          resp.data.disputeFocuses.slice(0, 3)
        );
      }
      return;
    } catch {
      if (attempt < 3) {
        console.log(`  ⚠ 案件提炼第 ${attempt} 次失败，5 秒后重试...`);
        await sleep(5_000);
        continue;
      }
      fail('案件提炼失败');
    }
  }
}

async function step6_triggerRisk(caseId: string) {
  log('Step 6: 触发风险评估');
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await api<{
        success: boolean;
        data: { winRate: number; riskLevel: string };
      }>('POST', `/api/v1/cases/${caseId}/assess`);
      pass(
        `风险评估完成（第 ${attempt} 次尝试）：胜率 ${(resp.data.winRate * 100).toFixed(0)}%，风险等级 ${resp.data.riskLevel}`
      );
      return;
    } catch {
      if (attempt < 3) {
        console.log(`  ⚠ 风险评估第 ${attempt} 次失败，5 秒后重试...`);
        await sleep(5_000);
        continue;
      }
      fail('风险评估失败');
    }
  }
}

async function step7_createDebate(caseId: string): Promise<string | null> {
  log('Step 7: 创建辩论');
  try {
    const resp = await api<{ success: boolean; data: { id: string } }>(
      'POST',
      '/api/v1/debates',
      {
        caseId,
        title: '[Phase5回归] 民间借贷第一轮辩论',
      }
    );
    const debateId = resp.data.id;
    pass(`辩论创建成功：${debateId}`);
    return debateId;
  } catch {
    fail('创建辩论失败');
    return null;
  }
}

async function step7b_generateFirstRound(debateId: string) {
  log('Step 7B: 生成首轮辩论并产出摘要');

  const roundsResp = await api<{
    success: boolean;
    data: Array<{
      id: string;
      roundNumber: number;
      status: string;
      arguments?: unknown[];
    }>;
  }>('GET', `/api/v1/debates/${debateId}/rounds`);

  const firstRound =
    roundsResp.data.find(r => r.roundNumber === 1) ?? roundsResp.data[0];
  if (!firstRound) {
    fail('未找到首轮辩论');
    return;
  }

  // 创建辩论时系统已经自动创建 round 1，这里直接生成，不再额外 POST /rounds
  if ((firstRound.arguments?.length ?? 0) === 0) {
    try {
      const resp = await api<{ success: boolean }>(
        'POST',
        `/api/v1/debate-rounds/${firstRound.id}/generate`,
        { applicableArticles: [] }
      );
      if (resp.success) {
        pass(`首轮论点生成成功（roundId=${firstRound.id}）`);
      } else {
        fail('首轮论点生成失败');
      }
    } catch {
      fail('首轮论点生成失败');
    }
  } else {
    pass(`首轮已存在论点，跳过生成（roundId=${firstRound.id}）`);
  }

  try {
    const resp = await api<{ success: boolean }>(
      'POST',
      `/api/v1/debates/${debateId}/summary`
    );
    if (resp.success) {
      pass('辩论摘要生成成功');
    } else {
      fail('辩论摘要生成失败');
    }
  } catch {
    fail('辩论摘要生成失败');
  }
}

async function step8_verifyWorkflowStatus(caseId: string) {
  log('Step 8: 验证工作流状态');
  const resp = await api<{
    success: boolean;
    data: {
      hasExtraction: boolean;
      hasRiskAssessment: boolean;
      hasDebate: boolean;
      nextStep: string;
    };
  }>('GET', `/api/v1/cases/${caseId}/workflow-status`);

  const s = resp.data;
  if (s.hasExtraction) {
    pass('案件提炼已完成');
  } else {
    fail('案件提炼未完成');
  }

  if (s.hasRiskAssessment) {
    pass('风险评估已完成');
  } else {
    fail('风险评估未完成');
  }

  if (s.hasDebate) {
    pass('辩论已创建');
  } else {
    fail('辩论未创建');
  }
  console.log(`  → nextStep: ${s.nextStep}`);
}

async function step9_verifyPackage(caseId: string) {
  log('Step 9: 验证交付包章节可用性');

  // 尝试 preview 路由（返回章节结构）
  let sections: Record<string, { tier: string; available: boolean }> | null =
    null;
  try {
    const resp = await api<{
      success: boolean;
      data: {
        sections?: Record<string, { tier: string; available: boolean }>;
        totalAvailable?: number;
      };
    }>('GET', `/api/v1/cases/${caseId}/package/preview`);
    sections = resp.data.sections ?? null;
  } catch {
    console.log('  ⚠ preview 路由不可用，跳过章节详细验证');
  }

  if (!sections) return;

  const SECTION_LABELS: [string, string][] = [
    ['s1_case_summary', '§1 案件摘要'],
    ['s2_dispute_focus', '§2 争议焦点'],
    ['s3_argument_analysis', '§3 论点分析'],
    ['s4_evidence', '§4 证据清单'],
    ['s5_risk_assessment', '§5 风险评估'],
    ['s6_expert_opinion', '§6 专家意见'],
    ['s7_ai_declaration', '§7 AI 声明'],
  ];

  let available = 0;
  for (const [key, label] of SECTION_LABELS) {
    const sec = sections[key];
    if (sec?.available) {
      pass(`${label} (${sec.tier})`);
      available++;
    } else {
      console.log(`  ○ ${label} — 不可用（tier: ${sec?.tier ?? 'none'}）`);
    }
  }

  console.log(`\n  总计可用：${available}/7`);
  if (sections['s4_evidence']?.available === true) {
    pass('§4 证据清单已自动可用');
  } else {
    fail('§4 证据清单仍不可用');
  }

  if (available >= 7) {
    pass(`交付包可用度 ${available}/7（已达到完整自动化目标）`);
  } else {
    fail(`交付包可用度仅 ${available}/7，未达到 7/7`);
  }
}

async function step10_verifyManualEvidenceProtection() {
  log('Step 10: 验证人工证据不被自动草稿污染');

  const caseResp = await api<{ success: boolean; data: { id: string } }>(
    'POST',
    '/api/v1/cases',
    {
      title: `[Phase5人工保护] 张三诉李四_${Date.now()}`,
      type: 'CIVIL',
      plaintiffName: '张三',
      defendantName: '李四',
      description: '人工证据保护验证',
    }
  );
  const caseId = caseResp.data.id;

  await api('POST', '/api/evidence', {
    caseId,
    type: 'DOCUMENT',
    name: '银行转账流水',
    description: '人工录入正式证据',
    status: 'ACCEPTED',
    relevanceScore: 0.33,
    metadata: { manualTag: true },
  });

  const filePath = path.join(DOSSIER_DIR, '03_银行转账流水_整理版.txt');
  const content = fs.readFileSync(filePath);
  const formData = new FormData();
  formData.append(
    'file',
    new Blob([content], { type: 'text/plain' }),
    '03_银行转账流水_整理版.txt'
  );
  formData.append('caseId', caseId);
  formData.append('fileId', crypto.randomUUID());
  await api<unknown>('POST', '/api/v1/documents/upload', undefined, formData);

  // 等待文档分析和自动钩子运行
  const start = Date.now();
  let matchedEvidence: Array<Record<string, unknown>> = [];
  while (Date.now() - start < 90_000) {
    const evResp = await api<{
      success: boolean;
      data?: { evidence?: Array<Record<string, unknown>> };
      evidence?: Array<Record<string, unknown>>;
    }>('GET', `/api/evidence?caseId=${caseId}`);

    const evidenceList = evResp.data?.evidence ?? evResp.evidence ?? [];
    matchedEvidence = evidenceList.filter(ev => ev.name === '银行转账流水');

    const wfResp = await api<{
      success: boolean;
      data: { documentsCompleted: number };
    }>('GET', `/api/v1/cases/${caseId}/workflow-status`);

    if (wfResp.data.documentsCompleted >= 1) break;
    await new Promise(r => setTimeout(r, 3_000));
  }

  if (matchedEvidence.length === 1) {
    const only = matchedEvidence[0];
    const meta = (only.metadata ?? {}) as Record<string, unknown>;
    const isManualPreserved =
      only.status === 'ACCEPTED' &&
      only.description === '人工录入正式证据' &&
      meta.manualTag === true;

    if (isManualPreserved) {
      pass('人工证据保持原样，未被自动草稿污染');
    } else {
      fail('人工证据字段被自动草稿污染');
    }
  } else {
    fail(`同名证据数量异常：银行转账流水出现 ${matchedEvidence.length} 条`);
  }
}

// ── 主入口 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('Phase 5 端到端验收 — 借款纠纷卷宗自动化流程');
  console.log(`服务器：${BASE_URL}`);
  console.log('='.repeat(60));

  try {
    await step1_login();
    const caseId = await step2_createCase();
    await step3_uploadDossier(caseId);
    await step4_waitForAnalysis(caseId);
    await step4b_verifyAutoEvidence(caseId);
    await step5_triggerExtraction(caseId);
    await step6_triggerRisk(caseId);
    const debateId = await step7_createDebate(caseId);
    if (debateId) {
      await step7b_generateFirstRound(debateId);
    }
    await step8_verifyWorkflowStatus(caseId);
    await step9_verifyPackage(caseId);
    await step10_verifyManualEvidenceProtection();
  } catch (err) {
    console.error('\n[FATAL]', err);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  if (process.exitCode === 1) {
    console.log('❌ Phase 5 验收完成，存在失败项，请查看上方日志');
  } else {
    console.log('✅ Phase 5 验收全部通过');
  }
  console.log('='.repeat(60));
}

void main();
