/**
 * 立案材料服务
 * 根据案件类型生成所需材料清单
 */

/**
 * 立案材料接口
 */
export interface FilingMaterial {
  id: string;
  name: string;
  description: string;
  required: boolean;
  copies: number;
  templateUrl?: string;
  category: 'identity' | 'evidence' | 'legal' | 'other';
}

/**
 * 立案材料清单结果
 */
export interface FilingMaterialsResult {
  caseType: string;
  courtLevel: string;
  materials: FilingMaterial[];
  notes: string[];
}

/**
 * 案件类型材料配置
 */
const CASE_TYPE_MATERIALS: Record<string, FilingMaterial[]> = {
  // 劳动争议案件
  LABOR_DISPUTE: [
    {
      id: 'labor-1',
      name: '起诉状',
      description: '起诉状正本1份，副本按被告人数提供',
      required: true,
      copies: 1,
      category: 'legal',
      templateUrl: '/templates/complaint-labor.docx',
    },
    {
      id: 'labor-2',
      name: '原告身份证明',
      description: '原告身份证复印件',
      required: true,
      copies: 1,
      category: 'identity',
    },
    {
      id: 'labor-3',
      name: '被告主体资格证明',
      description: '被告企业营业执照或工商登记信息',
      required: true,
      copies: 1,
      category: 'identity',
    },
    {
      id: 'labor-4',
      name: '劳动合同',
      description: '劳动合同复印件（如有）',
      required: false,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'labor-5',
      name: '工资流水',
      description: '银行工资流水或工资条（近12个月）',
      required: true,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'labor-6',
      name: '社保缴纳证明',
      description: '社保缴纳记录或证明',
      required: false,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'labor-7',
      name: '考勤记录',
      description: '考勤记录、打卡记录等',
      required: false,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'labor-8',
      name: '解除劳动关系证明',
      description: '解除或终止劳动合同证明书',
      required: false,
      copies: 1,
      category: 'evidence',
    },
  ],

  // 合同纠纷案件
  CONTRACT_DISPUTE: [
    {
      id: 'contract-1',
      name: '起诉状',
      description: '起诉状正本1份，副本按被告人数提供',
      required: true,
      copies: 1,
      category: 'legal',
      templateUrl: '/templates/complaint-contract.docx',
    },
    {
      id: 'contract-2',
      name: '原告身份证明',
      description: '原告身份证或营业执照复印件',
      required: true,
      copies: 1,
      category: 'identity',
    },
    {
      id: 'contract-3',
      name: '被告主体资格证明',
      description: '被告身份证或营业执照复印件',
      required: true,
      copies: 1,
      category: 'identity',
    },
    {
      id: 'contract-4',
      name: '合同原件',
      description: '涉案合同原件或复印件',
      required: true,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'contract-5',
      name: '履行证明',
      description: '合同履行情况的证明材料',
      required: true,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'contract-6',
      name: '付款凭证',
      description: '转账记录、收据等付款凭证',
      required: false,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'contract-7',
      name: '催告函',
      description: '催告履行的函件及送达证明',
      required: false,
      copies: 1,
      category: 'evidence',
    },
  ],

  // 婚姻家庭案件
  MARRIAGE_FAMILY: [
    {
      id: 'marriage-1',
      name: '起诉状',
      description: '起诉状正本1份，副本1份',
      required: true,
      copies: 1,
      category: 'legal',
      templateUrl: '/templates/complaint-marriage.docx',
    },
    {
      id: 'marriage-2',
      name: '原告身份证',
      description: '原告身份证复印件',
      required: true,
      copies: 1,
      category: 'identity',
    },
    {
      id: 'marriage-3',
      name: '被告身份证',
      description: '被告身份证复印件或户籍信息',
      required: true,
      copies: 1,
      category: 'identity',
    },
    {
      id: 'marriage-4',
      name: '结婚证',
      description: '结婚证复印件',
      required: true,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'marriage-5',
      name: '子女出生证明',
      description: '子女出生证明或户口本（如涉及子女抚养）',
      required: false,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'marriage-6',
      name: '财产证明',
      description: '房产证、车辆登记证、存款证明等',
      required: false,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'marriage-7',
      name: '感情破裂证据',
      description: '证明夫妻感情破裂的证据材料',
      required: false,
      copies: 1,
      category: 'evidence',
    },
  ],

  // 侵权责任案件
  TORT_LIABILITY: [
    {
      id: 'tort-1',
      name: '起诉状',
      description: '起诉状正本1份，副本按被告人数提供',
      required: true,
      copies: 1,
      category: 'legal',
      templateUrl: '/templates/complaint-tort.docx',
    },
    {
      id: 'tort-2',
      name: '原告身份证明',
      description: '原告身份证复印件',
      required: true,
      copies: 1,
      category: 'identity',
    },
    {
      id: 'tort-3',
      name: '被告主体资格证明',
      description: '被告身份证或营业执照复印件',
      required: true,
      copies: 1,
      category: 'identity',
    },
    {
      id: 'tort-4',
      name: '侵权事实证明',
      description: '证明侵权行为发生的证据材料',
      required: true,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'tort-5',
      name: '损害结果证明',
      description: '医疗费票据、鉴定意见等损害证明',
      required: true,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'tort-6',
      name: '因果关系证明',
      description: '证明侵权行为与损害结果之间因果关系的材料',
      required: false,
      copies: 1,
      category: 'evidence',
    },
  ],
};

/**
 * 案件类型注意事项
 */
const CASE_TYPE_NOTES: Record<string, string[]> = {
  LABOR_DISPUTE: [
    '劳动争议案件需先经劳动仲裁，持仲裁裁决书起诉',
    '如未签订书面劳动合同，需提供其他证明劳动关系的材料',
    '工资流水建议提供银行盖章的完整流水',
    '社保记录可到社保局打印缴费明细',
  ],
  CONTRACT_DISPUTE: [
    '合同原件应加盖双方公章或签字',
    '如合同约定仲裁条款，应先申请仲裁',
    '注意合同约定的管辖法院条款',
    '保留所有履行合同的证据材料',
  ],
  MARRIAGE_FAMILY: [
    '离婚案件需提供结婚证原件',
    '如涉及子女抚养，需提供子女出生证明',
    '财产分割需提供完整的财产清单和证明',
    '第一次起诉离婚如对方不同意，法院可能不判离',
  ],
  TORT_LIABILITY: [
    '及时固定证据，包括现场照片、视频等',
    '医疗费票据需保留原件',
    '如需鉴定，应申请法院委托鉴定',
    '注意诉讼时效，一般为3年',
  ],
};

/**
 * 立案材料服务类
 */
export class FilingMaterialsService {
  /**
   * 获取立案材料清单
   * @param caseType 案件类型
   * @param courtLevel 法院级别（基层/中级/高级）
   * @returns 立案材料清单
   */
  getFilingMaterials(
    caseType: string,
    courtLevel: string = '基层'
  ): FilingMaterialsResult {
    // 获取案件类型对应的材料清单
    const materials =
      CASE_TYPE_MATERIALS[caseType] || this.getDefaultMaterials();

    // 获取注意事项
    const notes = CASE_TYPE_NOTES[caseType] || this.getDefaultNotes();

    // 根据法院级别调整材料要求
    const adjustedMaterials = this.adjustMaterialsByCourtLevel(
      materials,
      courtLevel
    );

    return {
      caseType,
      courtLevel,
      materials: adjustedMaterials,
      notes,
    };
  }

  /**
   * 获取默认材料清单（通用）
   */
  private getDefaultMaterials(): FilingMaterial[] {
    return [
      {
        id: 'default-1',
        name: '起诉状',
        description: '起诉状正本1份，副本按被告人数提供',
        required: true,
        copies: 1,
        category: 'legal',
      },
      {
        id: 'default-2',
        name: '原告身份证明',
        description: '原告身份证或营业执照复印件',
        required: true,
        copies: 1,
        category: 'identity',
      },
      {
        id: 'default-3',
        name: '被告主体资格证明',
        description: '被告身份证或营业执照复印件',
        required: true,
        copies: 1,
        category: 'identity',
      },
      {
        id: 'default-4',
        name: '证据材料',
        description: '支持诉讼请求的证据材料',
        required: true,
        copies: 1,
        category: 'evidence',
      },
    ];
  }

  /**
   * 获取默认注意事项
   */
  private getDefaultNotes(): string[] {
    return [
      '所有材料需提供原件及复印件',
      '复印件需加盖公章或签字确认',
      '注意诉讼时效，及时提起诉讼',
      '如有管辖约定，需向约定法院起诉',
    ];
  }

  /**
   * 根据法院级别调整材料要求
   * @param materials 原材料清单
   * @param courtLevel 法院级别
   * @returns 调整后的材料清单
   */
  private adjustMaterialsByCourtLevel(
    materials: FilingMaterial[],
    courtLevel: string
  ): FilingMaterial[] {
    // 中级法院和高级法院可能需要额外材料
    if (courtLevel === '中级' || courtLevel === '高级') {
      return [
        ...materials,
        {
          id: 'appeal-1',
          name: '一审判决书',
          description: '一审法院判决书或裁定书',
          required: true,
          copies: 1,
          category: 'legal',
        },
        {
          id: 'appeal-2',
          name: '送达证明',
          description: '一审判决书送达证明',
          required: true,
          copies: 1,
          category: 'legal',
        },
      ];
    }

    return materials;
  }

  /**
   * 获取所有支持的案件类型
   * @returns 案件类型列表
   */
  getSupportedCaseTypes(): Array<{ code: string; name: string }> {
    return [
      { code: 'LABOR_DISPUTE', name: '劳动争议' },
      { code: 'CONTRACT_DISPUTE', name: '合同纠纷' },
      { code: 'MARRIAGE_FAMILY', name: '婚姻家庭' },
      { code: 'TORT_LIABILITY', name: '侵权责任' },
    ];
  }
}

// 导出单例
export const filingMaterialsService = new FilingMaterialsService();
