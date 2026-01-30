/**
 * 证据分类配置
 *
 * 功能：
 * - 按案件类型提供标准证据分类模板
 * - 支持分类树形结构
 * - 每个分类包含描述和子分类
 * - 提供常见证据示例
 */

/**
 * 证据分类接口
 */
export interface EvidenceCategory {
  code: string; // 分类代码
  name: string; // 分类名称
  description: string; // 分类描述
  subCategories?: EvidenceCategory[]; // 子分类
  examples?: string[]; // 证据示例
}

/**
 * 证据分类配置（按案件类型）
 */
export const EVIDENCE_CATEGORIES: Record<string, EvidenceCategory[]> = {
  // 劳动争议案件
  LABOR_DISPUTE: [
    {
      code: 'IDENTITY',
      name: '主体资格证据',
      description: '证明劳动关系主体身份',
      subCategories: [
        {
          code: 'ID_CARD',
          name: '身份证明',
          description: '劳动者身份证复印件',
          examples: ['身份证', '护照', '户口本'],
        },
        {
          code: 'COMPANY_LICENSE',
          name: '企业证照',
          description: '用人单位营业执照等',
          examples: ['营业执照', '组织机构代码证', '统一社会信用代码证'],
        },
      ],
    },
    {
      code: 'LABOR_RELATION',
      name: '劳动关系证据',
      description: '证明存在劳动关系',
      subCategories: [
        {
          code: 'CONTRACT',
          name: '劳动合同',
          description: '书面劳动合同',
          examples: ['劳动合同原件', '劳动合同复印件', '电子劳动合同'],
        },
        {
          code: 'SOCIAL_SECURITY',
          name: '社保记录',
          description: '社保缴纳证明',
          examples: ['社保缴费明细', '社保参保证明', '社保卡'],
        },
        {
          code: 'SALARY_PROOF',
          name: '工资凭证',
          description: '工资条、银行流水',
          examples: ['工资条', '银行流水', '工资发放记录', '工资表'],
        },
        {
          code: 'WORK_PERMIT',
          name: '工作证件',
          description: '工作证、工牌等',
          examples: ['工作证', '工牌', '员工卡', '门禁卡'],
        },
      ],
    },
    {
      code: 'WORK_CONTENT',
      name: '工作内容证据',
      description: '证明工作岗位和职责',
      subCategories: [
        {
          code: 'JOB_DESCRIPTION',
          name: '岗位说明',
          description: '岗位职责说明书',
          examples: ['岗位说明书', '职位描述', '工作职责文件'],
        },
        {
          code: 'WORK_RECORD',
          name: '工作记录',
          description: '工作日志、邮件等',
          examples: ['工作日志', '工作邮件', '工作报告', '考勤记录'],
        },
      ],
    },
    {
      code: 'TERMINATION',
      name: '解除/终止证据',
      description: '证明劳动关系解除或终止',
      subCategories: [
        {
          code: 'TERMINATION_NOTICE',
          name: '解除通知',
          description: '解除劳动合同通知书',
          examples: ['解除劳动合同通知书', '终止劳动合同通知书', '辞退通知'],
        },
        {
          code: 'RESIGNATION',
          name: '辞职材料',
          description: '辞职申请、离职证明',
          examples: ['辞职申请', '离职证明', '离职交接单'],
        },
      ],
    },
    {
      code: 'COMPENSATION',
      name: '赔偿依据证据',
      description: '证明经济损失和赔偿依据',
      subCategories: [
        {
          code: 'SALARY_ARREARS',
          name: '工资拖欠',
          description: '工资拖欠证明',
          examples: ['工资条', '银行流水', '工资发放记录'],
        },
        {
          code: 'OVERTIME',
          name: '加班证据',
          description: '加班时间和加班费',
          examples: ['考勤记录', '加班审批单', '工作记录'],
        },
      ],
    },
  ],

  // 合同纠纷案件
  CONTRACT_DISPUTE: [
    {
      code: 'CONTRACT_FORMATION',
      name: '合同订立证据',
      description: '证明合同成立',
      subCategories: [
        {
          code: 'CONTRACT_TEXT',
          name: '合同文本',
          description: '书面合同原件或复印件',
          examples: ['合同原件', '合同复印件', '电子合同'],
        },
        {
          code: 'NEGOTIATION_RECORD',
          name: '磋商记录',
          description: '合同磋商过程记录',
          examples: ['邮件往来', '会议纪要', '聊天记录'],
        },
      ],
    },
    {
      code: 'CONTRACT_PERFORMANCE',
      name: '合同履行证据',
      description: '证明合同履行情况',
      subCategories: [
        {
          code: 'DELIVERY_PROOF',
          name: '交付凭证',
          description: '货物或服务交付证明',
          examples: ['送货单', '签收单', '验收单', '发票'],
        },
        {
          code: 'PAYMENT_PROOF',
          name: '付款凭证',
          description: '款项支付证明',
          examples: ['银行转账记录', '收据', '发票', '付款凭证'],
        },
      ],
    },
    {
      code: 'CONTRACT_BREACH',
      name: '违约证据',
      description: '证明对方违约',
      subCategories: [
        {
          code: 'BREACH_FACT',
          name: '违约事实',
          description: '违约行为证明',
          examples: ['催告函', '违约通知', '质量检测报告'],
        },
        {
          code: 'LOSS_PROOF',
          name: '损失证明',
          description: '因违约造成的损失',
          examples: ['损失清单', '财务报表', '评估报告'],
        },
      ],
    },
  ],

  // 婚姻家庭案件
  MARRIAGE_FAMILY: [
    {
      code: 'MARRIAGE_STATUS',
      name: '婚姻状况证据',
      description: '证明婚姻关系',
      subCategories: [
        {
          code: 'MARRIAGE_CERTIFICATE',
          name: '结婚证',
          description: '结婚登记证明',
          examples: ['结婚证', '结婚登记证明'],
        },
        {
          code: 'HOUSEHOLD_REGISTER',
          name: '户口本',
          description: '户籍证明',
          examples: ['户口本', '户籍证明'],
        },
      ],
    },
    {
      code: 'MARITAL_PROPERTY',
      name: '夫妻财产证据',
      description: '证明夫妻共同财产',
      subCategories: [
        {
          code: 'REAL_ESTATE',
          name: '不动产',
          description: '房产、土地等',
          examples: ['房产证', '购房合同', '土地证'],
        },
        {
          code: 'MOVABLE_PROPERTY',
          name: '动产',
          description: '车辆、存款等',
          examples: ['车辆登记证', '银行存款证明', '股票账户'],
        },
      ],
    },
    {
      code: 'CHILD_CUSTODY',
      name: '子女抚养证据',
      description: '证明子女抚养情况',
      subCategories: [
        {
          code: 'BIRTH_CERTIFICATE',
          name: '出生证明',
          description: '子女出生证明',
          examples: ['出生证明', '户口本'],
        },
        {
          code: 'CUSTODY_CONDITION',
          name: '抚养条件',
          description: '抚养能力证明',
          examples: ['收入证明', '住房证明', '健康证明'],
        },
      ],
    },
  ],
};

/**
 * 按案件类型获取证据分类
 */
export function getEvidenceCategoriesByCaseType(
  caseType: string
): EvidenceCategory[] {
  if (!caseType || typeof caseType !== 'string') {
    return [];
  }

  return EVIDENCE_CATEGORIES[caseType] || [];
}

/**
 * 获取所有案件类型
 */
export function getAllCaseTypes(): string[] {
  return Object.keys(EVIDENCE_CATEGORIES);
}

/**
 * 按代码获取分类（支持递归查找子分类）
 */
export function getCategoryByCode(
  caseType: string,
  code: string
): EvidenceCategory | null {
  if (!caseType || !code) {
    return null;
  }

  const categories = getEvidenceCategoriesByCaseType(caseType);

  const findCategory = (cats: EvidenceCategory[]): EvidenceCategory | null => {
    for (const cat of cats) {
      if (cat.code === code) {
        return cat;
      }

      if (cat.subCategories) {
        const found = findCategory(cat.subCategories);
        if (found) {
          return found;
        }
      }
    }

    return null;
  };

  return findCategory(categories);
}

/**
 * 搜索分类（按名称或描述）
 */
export function searchCategories(
  caseType: string,
  keyword: string
): EvidenceCategory[] {
  if (!caseType) {
    return [];
  }

  const categories = getEvidenceCategoriesByCaseType(caseType);

  if (!keyword || typeof keyword !== 'string') {
    // 返回所有分类（包括子分类）
    const flattenCategories = (
      cats: EvidenceCategory[]
    ): EvidenceCategory[] => {
      const result: EvidenceCategory[] = [];

      for (const cat of cats) {
        result.push(cat);

        if (cat.subCategories) {
          result.push(...flattenCategories(cat.subCategories));
        }
      }

      return result;
    };

    return flattenCategories(categories);
  }

  const lowerKeyword = keyword.toLowerCase();
  const results: EvidenceCategory[] = [];

  const searchInCategories = (cats: EvidenceCategory[]) => {
    for (const cat of cats) {
      const nameMatch = cat.name.toLowerCase().includes(lowerKeyword);
      const descMatch = cat.description.toLowerCase().includes(lowerKeyword);

      if (nameMatch || descMatch) {
        results.push(cat);
      }

      if (cat.subCategories) {
        searchInCategories(cat.subCategories);
      }
    }
  };

  searchInCategories(categories);

  return results;
}

/**
 * 验证分类结构
 */
export function validateCategoryStructure(category: EvidenceCategory): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 验证必要字段
  if (!category.code || typeof category.code !== 'string') {
    errors.push('缺少或无效的code字段');
  }

  if (!category.name || typeof category.name !== 'string') {
    errors.push('缺少或无效的name字段');
  }

  if (!category.description || typeof category.description !== 'string') {
    errors.push('缺少或无效的description字段');
  }

  // 验证子分类
  if (category.subCategories) {
    if (!Array.isArray(category.subCategories)) {
      errors.push('subCategories必须是数组');
    } else {
      for (let i = 0; i < category.subCategories.length; i++) {
        const subResult = validateCategoryStructure(category.subCategories[i]);
        if (!subResult.isValid) {
          errors.push(`子分类[${i}]验证失败: ${subResult.errors.join(', ')}`);
        }
      }
    }
  }

  // 验证示例
  if (category.examples) {
    if (!Array.isArray(category.examples)) {
      errors.push('examples必须是数组');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 获取分类树的深度
 */
export function getCategoryDepth(category: EvidenceCategory): number {
  if (!category.subCategories || category.subCategories.length === 0) {
    return 1;
  }

  const subDepths = category.subCategories.map(sub => getCategoryDepth(sub));
  return 1 + Math.max(...subDepths);
}

/**
 * 统计分类数量（包括子分类）
 */
export function countCategories(categories: EvidenceCategory[]): number {
  let count = 0;

  const countRecursive = (cats: EvidenceCategory[]) => {
    count += cats.length;

    for (const cat of cats) {
      if (cat.subCategories) {
        countRecursive(cat.subCategories);
      }
    }
  };

  countRecursive(categories);

  return count;
}
