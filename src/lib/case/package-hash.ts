import { createHash } from 'crypto';

const VALID_SECTION_KEYS = [
  's1_case_summary',
  's2_dispute_focus',
  's3_argument_analysis',
  's4_evidence',
  's5_risk_assessment',
  's6_expert_opinion',
  's7_ai_declaration',
] as const;

export type SectionKey = (typeof VALID_SECTION_KEYS)[number];

export function isValidSectionKeys(keys: unknown[]): keys is SectionKey[] {
  return keys.every(k => VALID_SECTION_KEYS.includes(k as SectionKey));
}

function stripGeneratedAt(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripGeneratedAt);
  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'generatedAt') continue;
    result[k] = stripGeneratedAt(v);
  }
  return result;
}

export function computePackageHash(
  sections: Record<string, unknown>,
  selectedSections: SectionKey[],
  templateVersion: string
): string {
  const stable: Record<string, unknown> = {};
  for (const key of [...selectedSections].sort()) {
    if (key in sections) {
      stable[key] = stripGeneratedAt(sections[key]);
    }
  }
  // templateVersion 纳入 hash：模板升级后旧复核记录不会误匹配新导出
  const payload = { templateVersion, sections: stable };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
