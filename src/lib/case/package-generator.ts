import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx';
import type { SectionKey } from './package-hash';
import type { ReviewMatchStatus } from './review-matcher';

// ── 导出 Payload 类型 ──────────────────────────────────────────────────────────

export interface ExportPackagePayload {
  caseId: string;
  templateVersion: string;
  selectedSections: SectionKey[];
  sections: Record<string, { tier: string; available: boolean; data: unknown }>;
  reviewMatch: {
    status: ReviewMatchStatus;
    reviewerName?: string;
    reviewedAt?: string;
  };
}

// ── 产品章节固定顺序（hash 用字母序，文档用此顺序）─────────────────────────────

const SECTION_ORDER: SectionKey[] = [
  's1_case_summary',
  's2_dispute_focus',
  's3_argument_analysis',
  's4_evidence',
  's5_risk_assessment',
  's6_expert_opinion',
  's7_ai_declaration',
];

const SECTION_TITLES: Record<SectionKey, string> = {
  s1_case_summary: '§1 案情摘要',
  s2_dispute_focus: '§2 争议焦点',
  s3_argument_analysis: '§3 论点分析',
  s4_evidence: '§4 证据清单',
  s5_risk_assessment: '§5 风险评估',
  s6_expert_opinion: '§6 专业意见',
  s7_ai_declaration: '§7 AI 声明',
};

// ── 辅助段落构建 ───────────────────────────────────────────────────────────────

function heading1(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 120 },
  });
}

function heading2(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
  });
}

function body(text: string, bold = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold, font: '宋体', size: 24 })],
    spacing: { before: 60, after: 60 },
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: '宋体', size: 24 })],
    bullet: { level: 0 },
    spacing: { before: 40, after: 40 },
  });
}

function divider(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
    text: '',
    spacing: { before: 60, after: 60 },
  });
}

function fallbackNote(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: `【${text}】`,
        color: '888888',
        italics: true,
        font: '宋体',
        size: 22,
      }),
    ],
    spacing: { before: 60, after: 60 },
  });
}

// ── 封面 ──────────────────────────────────────────────────────────────────────

function buildCover(payload: ExportPackagePayload): Paragraph[] {
  const { reviewMatch } = payload;

  let reviewLine: string;
  if (reviewMatch.status === 'matched') {
    const who = reviewMatch.reviewerName ?? '律师';
    const when = reviewMatch.reviewedAt
      ? new Date(reviewMatch.reviewedAt).toLocaleDateString('zh-CN')
      : '';
    reviewLine = `已由 ${who}${when ? ' 于 ' + when : ''} 复核确认`;
  } else if (reviewMatch.status === 'mismatch') {
    reviewLine = '⚠ 当前内容已变更，需重新复核';
  } else {
    reviewLine = '待律师复核';
  }

  return [
    new Paragraph({ text: '', spacing: { before: 800 } }),
    heading1('整案交付包'),
    new Paragraph({
      children: [
        new TextRun({
          text: reviewLine,
          color: reviewMatch.status === 'matched' ? '1a7f3c' : '888888',
          font: '宋体',
          size: 22,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 480 },
    }),
    divider(),
  ];
}

// ── §1 案情摘要 ────────────────────────────────────────────────────────────────

function buildS1(data: unknown): Paragraph[] {
  if (!data || typeof data !== 'object') {
    return [fallbackNote('案情摘要信息待补充')];
  }
  const d = data as Record<string, unknown>;
  const paragraphs: Paragraph[] = [];

  if (d['title']) paragraphs.push(body(`案件名称：${d['title']}`, true));
  if (d['caseNumber']) paragraphs.push(body(`案号：${d['caseNumber']}`));
  if (d['court']) paragraphs.push(body(`受理法院：${d['court']}`));
  if (d['cause']) paragraphs.push(body(`案由：${d['cause']}`));
  if (d['plaintiffName']) paragraphs.push(body(`原告：${d['plaintiffName']}`));
  if (d['defendantName']) paragraphs.push(body(`被告：${d['defendantName']}`));
  if (d['amount'] != null)
    paragraphs.push(body(`争议金额：¥${Number(d['amount']).toLocaleString()}`));

  const facts = d['established_facts'] as string[] | undefined;
  if (Array.isArray(facts) && facts.length > 0) {
    paragraphs.push(body('已确认事实：', true));
    facts.forEach(f => paragraphs.push(bullet(f)));
  }
  const uncertain = d['uncertain_facts'] as string[] | undefined;
  if (Array.isArray(uncertain) && uncertain.length > 0) {
    paragraphs.push(body('存疑事实：', true));
    uncertain.forEach(f => paragraphs.push(bullet(f)));
  }
  return paragraphs;
}

// ── §2 争议焦点 ────────────────────────────────────────────────────────────────

function buildS2(data: unknown): Paragraph[] {
  if (!data || typeof data !== 'object') {
    return [fallbackNote('争议焦点待进一步分析')];
  }
  const d = data as Record<string, unknown>;
  const paragraphs: Paragraph[] = [];
  const issues = d['keyLegalIssues'] as string[] | undefined;
  if (Array.isArray(issues) && issues.length > 0) {
    paragraphs.push(body('法律争议焦点：', true));
    issues.forEach(i => paragraphs.push(bullet(i)));
  }
  if (d['core_dispute'])
    paragraphs.push(body(`核心争议：${d['core_dispute']}`));
  const openQ = d['open_questions'] as string[] | undefined;
  if (Array.isArray(openQ) && openQ.length > 0) {
    paragraphs.push(body('待厘清问题：', true));
    openQ.forEach(q => paragraphs.push(bullet(q)));
  }
  return paragraphs.length > 0
    ? paragraphs
    : [fallbackNote('争议焦点信息不完整')];
}

// ── §3 论点分析 ────────────────────────────────────────────────────────────────

function buildS3(data: unknown): Paragraph[] {
  if (!data || typeof data !== 'object') {
    return [fallbackNote('论点分析数据待补充')];
  }
  const d = data as Record<string, unknown>;
  const items = d['items'] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(items) || items.length === 0) {
    return [fallbackNote('暂无论点记录')];
  }
  const paragraphs: Paragraph[] = [body(`共 ${d['totalCount']} 条论点`, true)];
  items.forEach((item, idx) => {
    paragraphs.push(body(`${idx + 1}. [${item['side']}] ${item['content']}`));
    const bases = item['legalBasis'] as
      | Array<Record<string, unknown>>
      | undefined;
    if (Array.isArray(bases) && bases.length > 0) {
      bases.forEach(b => {
        let articleStr: string;
        if (
          typeof b['lawName'] === 'string' &&
          typeof b['articleNumber'] === 'string'
        ) {
          articleStr = `《${b['lawName']}》第${b['articleNumber']}条`;
          if (typeof b['explanation'] === 'string' && b['explanation']) {
            articleStr += `（${(b['explanation'] as string).substring(0, 60)}…）`;
          }
        } else if (typeof b['article'] === 'string') {
          articleStr = b['article'];
        } else {
          articleStr = JSON.stringify(b);
        }
        paragraphs.push(bullet(`法律依据：${articleStr}`));
      });
    }
  });
  return paragraphs;
}

// ── §4 证据清单 ────────────────────────────────────────────────────────────────

function buildS4(data: unknown): Paragraph[] {
  if (!data || typeof data !== 'object') {
    return [fallbackNote('证据清单待补充')];
  }
  const d = data as Record<string, unknown>;
  const items = d['items'] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(items) || items.length === 0) {
    return [fallbackNote('暂无证据记录')];
  }
  const paragraphs: Paragraph[] = [
    body(`共 ${d['totalCount']} 份证据（预览 ${items.length} 份）`, true),
  ];
  items.forEach((ev, idx) => {
    const score =
      ev['relevanceScore'] != null ? `  相关度：${ev['relevanceScore']}` : '';
    paragraphs.push(
      body(`${idx + 1}. [${ev['status']}] ${ev['name']}${score}`)
    );
    if (ev['description']) paragraphs.push(bullet(String(ev['description'])));
  });
  return paragraphs;
}

// ── §5 风险评估 ────────────────────────────────────────────────────────────────

function buildS5(data: unknown): Paragraph[] {
  if (!data || typeof data !== 'object') {
    return [fallbackNote('风险评估数据待生成')];
  }
  const d = data as Record<string, unknown>;
  const paragraphs: Paragraph[] = [];
  if (d['winRate'] != null)
    paragraphs.push(
      body(`胜诉概率：${Math.round(Number(d['winRate']) * 100)}%`)
    );
  if (d['riskLevel']) paragraphs.push(body(`风险等级：${d['riskLevel']}`));
  if (d['difficulty']) paragraphs.push(body(`难度系数：${d['difficulty']}`));
  const ai = d['aiAssessment'] as Record<string, unknown> | undefined;
  if (ai) {
    if (ai['summary']) paragraphs.push(body(`AI 评估：${ai['summary']}`));
    const risks = ai['keyRisks'] as string[] | undefined;
    if (Array.isArray(risks) && risks.length > 0) {
      paragraphs.push(body('主要风险点：', true));
      risks.forEach(r => paragraphs.push(bullet(r)));
    }
  }
  return paragraphs.length > 0
    ? paragraphs
    : [fallbackNote('风险评估信息不完整')];
}

// ── §6 专业意见 ────────────────────────────────────────────────────────────────

function buildS6(data: unknown): Paragraph[] {
  if (!data || typeof data !== 'object') {
    return [fallbackNote('律师专业意见待补充')];
  }
  const d = data as Record<string, unknown>;
  const paragraphs: Paragraph[] = [];
  if (d['verdict']) paragraphs.push(body(`综合判断：${d['verdict']}`));
  if (d['recommendation'])
    paragraphs.push(body(`建议：${d['recommendation']}`));
  const ps = d['plaintiffStrengths'] as string[] | undefined;
  if (Array.isArray(ps) && ps.length > 0) {
    paragraphs.push(body('原告优势：', true));
    ps.forEach(s => paragraphs.push(bullet(s)));
  }
  const ds = d['defendantStrengths'] as string[] | undefined;
  if (Array.isArray(ds) && ds.length > 0) {
    paragraphs.push(body('被告优势：', true));
    ds.forEach(s => paragraphs.push(bullet(s)));
  }
  return paragraphs.length > 0
    ? paragraphs
    : [fallbackNote('专业意见信息不完整')];
}

// ── §7 AI 声明 ────────────────────────────────────────────────────────────────

function buildS7(
  reviewMatch: ExportPackagePayload['reviewMatch']
): Paragraph[] {
  let reviewText: string;
  if (reviewMatch.status === 'matched') {
    const who = reviewMatch.reviewerName ?? '律师';
    const when = reviewMatch.reviewedAt
      ? new Date(reviewMatch.reviewedAt).toLocaleDateString('zh-CN')
      : '';
    reviewText = `已由 ${who}${when ? ' 于 ' + when : ''} 复核确认，内容与复核时一致。`;
  } else if (reviewMatch.status === 'mismatch') {
    reviewText =
      '⚠ 注意：当前文档内容自上次复核后已发生变更，请在正式使用前重新复核。';
  } else {
    reviewText = '本文档尚未经过律师复核，请在正式使用前完成复核流程。';
  }

  return [
    body('本文档由 AI 辅助生成，仅供参考，不构成正式法律意见。'),
    body(
      '最终法律判断和建议应由具备执业资格的律师作出，并由当事人审阅确认后方可使用。'
    ),
    body(reviewText, true),
    body('律伴 AI 法律辅助系统 · 智能仅辅，专业当先', false),
  ];
}

// ── 章节分派 ──────────────────────────────────────────────────────────────────

function renderSection(
  key: SectionKey,
  section: { tier: string; available: boolean; data: unknown },
  reviewMatch: ExportPackagePayload['reviewMatch']
): Paragraph[] {
  const title = heading2(SECTION_TITLES[key]);
  let content: Paragraph[];

  if (key === 's7_ai_declaration') {
    content = buildS7(reviewMatch);
  } else if (!section.available || section.data == null) {
    content = [fallbackNote('该章节暂无数据')];
  } else {
    switch (key) {
      case 's1_case_summary':
        content = buildS1(section.data);
        break;
      case 's2_dispute_focus':
        content = buildS2(section.data);
        break;
      case 's3_argument_analysis':
        content = buildS3(section.data);
        break;
      case 's4_evidence':
        content = buildS4(section.data);
        break;
      case 's5_risk_assessment':
        content = buildS5(section.data);
        break;
      case 's6_expert_opinion':
        content = buildS6(section.data);
        break;
      default:
        content = [fallbackNote('未知章节')];
    }
  }

  return [title, ...content, divider()];
}

// ── 主函数 ────────────────────────────────────────────────────────────────────

export async function generateCasePackageDocx(
  payload: ExportPackagePayload
): Promise<Buffer> {
  const { selectedSections, sections, reviewMatch } = payload;
  const selectedSet = new Set(selectedSections);

  const children: Paragraph[] = [...buildCover(payload)];

  for (const key of SECTION_ORDER) {
    if (!selectedSet.has(key)) continue;
    const section = sections[key] ?? {
      tier: 'none',
      available: false,
      data: null,
    };
    children.push(...renderSection(key, section, reviewMatch));
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: '宋体', size: 24 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1800, right: 1800 },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
