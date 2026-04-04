/**
 * PII 脱敏模块
 *
 * 在内容发送给云端 AI 之前，自动识别并替换可规则化的个人敏感信息。
 * 规则说明：
 *   - 只处理可用正则可靠匹配的结构化 PII（身份证、手机、固话、社会信用代码）
 *   - 姓名、地址、金额等非结构化信息无法靠规则识别，不在此处处理
 *   - 脱敏仅用于发送给 AI 的内容，原始内容照常存入数据库
 *   - 同一条消息中多次出现同一个敏感值，替换为同一标签（保持语义一致）
 */

export interface RedactionResult {
  /** 脱敏后的文本（用于发送给 AI） */
  text: string;
  /** 共脱敏了几处 */
  count: number;
  /** 被检测到的 PII 类型列表（去重） */
  types: PiiType[];
}

export type PiiType =
  | '身份证号'
  | '手机号'
  | '固定电话'
  | '统一社会信用代码'
  | '银行卡号';

interface PiiRule {
  type: PiiType;
  pattern: RegExp;
  label: (index: number) => string;
}

// ── 规则表 ────────────────────────────────────────────────────────────────────
// 精度原则：宁可漏报，不可误报（过度替换会破坏 AI 理解案情的能力）

const RULES: PiiRule[] = [
  {
    // 居民身份证：17位数字 + 1位数字或X，前后不能有其他数字
    type: '身份证号',
    pattern: /(?<!\d)\d{17}[\dXx](?!\d)/g,
    label: i => `[身份证${i > 0 ? i + 1 : ''}号]`,
  },
  {
    // 中国大陆手机号：1开头，第二位3-9，共11位，前后不能有其他数字
    type: '手机号',
    pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g,
    label: i => `[手机号${i > 0 ? i + 1 : ''}]`,
  },
  {
    // 固定电话：区号(0xx/0xxx) + 7-8位号码，中间可有连字符或空格
    type: '固定电话',
    pattern: /(?<!\d)0\d{2,3}[-\s]\d{7,8}(?!\d)/g,
    label: i => `[固话${i > 0 ? i + 1 : ''}]`,
  },
  {
    // 统一社会信用代码：18位，特定字符集（较严格的格式）
    // 格式：登记管理部门代码(1) + 机构类别代码(1) + 登记管理机关行政区划码(6) + 主体标识码(9) + 校验码(1)
    type: '统一社会信用代码',
    pattern:
      /(?<![0-9A-Z])[0-9A-HJ-NP-RT-Y]{2}\d{6}[0-9A-HJ-NP-RT-Y]{10}(?![0-9A-Z])/g,
    label: i => `[组织代码${i > 0 ? i + 1 : ''}]`,
  },
  {
    // 银行卡/账号：16-19位连续数字，要求前后有明确的非数字边界
    // 排除已被身份证规则匹配的18位数字（通过规则顺序控制，身份证先匹配）
    // 仅在出现"卡号"/"账号"/"账户"等上下文关键词附近时才替换，避免误伤金额、法条编号等
    type: '银行卡号',
    pattern: /(?:卡号|账号|账户号码?|银行账户)[：:\s]*(?<!\d)\d{16,19}(?!\d)/g,
    label: i => `[银行账号${i > 0 ? i + 1 : ''}]`,
  },
];

// ── 主函数 ────────────────────────────────────────────────────────────────────

export function redactPII(text: string): RedactionResult {
  if (!text.trim()) return { text, count: 0, types: [] };

  let result = text;
  let totalCount = 0;
  const detectedTypes = new Set<PiiType>();

  for (const rule of RULES) {
    // 收集当前规则的所有匹配，去重后编号
    const uniqueMatches = new Map<string, string>(); // 原始值 → 替换标签
    let matchIndex = 0;

    // 重置 lastIndex（全局正则复用时必须）
    rule.pattern.lastIndex = 0;

    // 第一遍：收集所有唯一值
    let m: RegExpExecArray | null;
    const tempPattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    while ((m = tempPattern.exec(result)) !== null) {
      const raw = m[0];
      if (!uniqueMatches.has(raw)) {
        uniqueMatches.set(raw, rule.label(matchIndex++));
      }
    }

    if (uniqueMatches.size === 0) continue;

    // 第二遍：替换（按最长匹配优先，避免部分替换）
    const sortedEntries = [...uniqueMatches.entries()].sort(
      (a, b) => b[0].length - a[0].length
    );
    for (const [raw, label] of sortedEntries) {
      // 使用 split+join 避免正则特殊字符问题
      result = result.split(raw).join(label);
      totalCount++;
    }

    detectedTypes.add(rule.type);
  }

  return {
    text: result,
    count: totalCount,
    types: [...detectedTypes],
  };
}
