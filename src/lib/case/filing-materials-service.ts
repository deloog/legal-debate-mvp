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
 * 中文案件类型 → 内部 key 映射（页面传中文，服务用英文 key）
 */
const CASE_TYPE_ALIAS: Record<string, string> = {
  民事: 'CIVIL',
  刑事: 'CRIMINAL',
  行政: 'ADMINISTRATIVE',
  商事: 'COMMERCIAL',
  劳动: 'LABOR_DISPUTE',
  知识产权: 'IP',
  // 保留英文 key 向后兼容
  LABOR_DISPUTE: 'LABOR_DISPUTE',
  CONTRACT_DISPUTE: 'CIVIL',
  MARRIAGE_FAMILY: 'CIVIL',
  TORT_LIABILITY: 'CIVIL',
};

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

  // 民事案件（通用，涵盖合同、侵权、婚姻等）
  CIVIL: [
    {
      id: 'civil-1',
      name: '起诉状',
      description: '起诉状正本1份，副本按被告人数提供',
      required: true,
      copies: 1,
      category: 'legal',
    },
    {
      id: 'civil-2',
      name: '原告身份证明',
      description: '原告身份证复印件；企业提供营业执照复印件',
      required: true,
      copies: 1,
      category: 'identity',
    },
    {
      id: 'civil-3',
      name: '被告主体资格证明',
      description: '被告身份证复印件或企业营业执照复印件、工商登记信息',
      required: true,
      copies: 1,
      category: 'identity',
    },
    {
      id: 'civil-4',
      name: '授权委托书',
      description: '委托代理人出庭时需提供（个人签字，企业加盖公章）',
      required: false,
      copies: 1,
      category: 'legal',
    },
    {
      id: 'civil-5',
      name: '证据材料',
      description: '支持诉讼请求的书证、物证、电子证据等，每份证据需编号',
      required: true,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'civil-6',
      name: '证据清单',
      description: '列明所有证据名称、来源、证明内容的清单',
      required: true,
      copies: 1,
      category: 'legal',
    },
  ],

  // 刑事自诉案件
  CRIMINAL: [
    {
      id: 'criminal-1',
      name: '刑事自诉状',
      description: '刑事自诉状正本1份，副本按被告人数提供',
      required: true,
      copies: 1,
      category: 'legal',
    },
    {
      id: 'criminal-2',
      name: '自诉人身份证明',
      description: '自诉人身份证复印件',
      required: true,
      copies: 1,
      category: 'identity',
    },
    {
      id: 'criminal-3',
      name: '被告人基本信息',
      description: '被告人姓名、住址等基本情况（尽量提供身份证号）',
      required: true,
      copies: 1,
      category: 'identity',
    },
    {
      id: 'criminal-4',
      name: '犯罪事实证明材料',
      description: '证明被告人实施犯罪行为的书证、物证、证人证词等',
      required: true,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'criminal-5',
      name: '损害结果证明',
      description: '受到损害的医疗记录、财产损失证明等',
      required: false,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'criminal-6',
      name: '报案记录（如有）',
      description: '已向公安机关报案但不予立案的不予立案通知书',
      required: false,
      copies: 1,
      category: 'legal',
    },
  ],

  // 行政诉讼案件
  ADMINISTRATIVE: [
    {
      id: 'admin-1',
      name: '行政起诉状',
      description: '起诉状正本1份，副本1份',
      required: true,
      copies: 1,
      category: 'legal',
    },
    {
      id: 'admin-2',
      name: '原告身份证明',
      description: '原告身份证复印件；企业提供营业执照复印件',
      required: true,
      copies: 1,
      category: 'identity',
    },
    {
      id: 'admin-3',
      name: '行政行为证明材料',
      description: '被诉行政行为的决定书、通知书、批文等',
      required: true,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'admin-4',
      name: '行政复议决定书（如有）',
      description: '已申请行政复议的，需提供复议决定书',
      required: false,
      copies: 1,
      category: 'legal',
    },
    {
      id: 'admin-5',
      name: '原告资格证明',
      description: '证明原告与被诉行政行为有利害关系的材料',
      required: true,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'admin-6',
      name: '送达地址确认书',
      description: '法院要求填写的送达地址确认书',
      required: true,
      copies: 1,
      category: 'legal',
    },
  ],

  // 商事案件
  COMMERCIAL: [
    {
      id: 'commercial-1',
      name: '起诉状',
      description: '起诉状正本1份，副本按被告数量提供',
      required: true,
      copies: 1,
      category: 'legal',
    },
    {
      id: 'commercial-2',
      name: '原告主体资格证明',
      description: '营业执照复印件、法定代表人身份证明',
      required: true,
      copies: 1,
      category: 'identity',
    },
    {
      id: 'commercial-3',
      name: '被告主体资格证明',
      description: '被告营业执照复印件或工商登记信息',
      required: true,
      copies: 1,
      category: 'identity',
    },
    {
      id: 'commercial-4',
      name: '授权委托书',
      description: '法定代表人授权委托书，加盖公章',
      required: true,
      copies: 1,
      category: 'legal',
    },
    {
      id: 'commercial-5',
      name: '合同或协议原件',
      description: '涉案合同、协议、章程等商事文书',
      required: true,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'commercial-6',
      name: '往来函件及凭证',
      description: '付款凭证、发票、交货记录、往来邮件等',
      required: true,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'commercial-7',
      name: '仲裁协议（如有）',
      description: '合同约定仲裁条款或单独仲裁协议（用于申请财产保全）',
      required: false,
      copies: 1,
      category: 'legal',
    },
  ],

  // 知识产权案件
  IP: [
    {
      id: 'ip-1',
      name: '起诉状',
      description: '起诉状正本1份，副本按被告人数提供',
      required: true,
      copies: 1,
      category: 'legal',
    },
    {
      id: 'ip-2',
      name: '原告主体资格证明',
      description: '身份证复印件或营业执照复印件',
      required: true,
      copies: 1,
      category: 'identity',
    },
    {
      id: 'ip-3',
      name: '权利证明',
      description: '专利证书、商标注册证、著作权登记证书、版权证书等',
      required: true,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'ip-4',
      name: '侵权证据',
      description: '被告侵权行为的证据，如侵权产品、宣传材料、公证书等',
      required: true,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'ip-5',
      name: '损失证明材料',
      description: '权利人损失或被告获利的相关财务数据、鉴定意见',
      required: false,
      copies: 1,
      category: 'evidence',
    },
    {
      id: 'ip-6',
      name: '授权委托书（如有）',
      description: '独占许可权人起诉需提供授权文件',
      required: false,
      copies: 1,
      category: 'legal',
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
  CIVIL: [
    '所有材料需提供原件及复印件各1份',
    '注意民事诉讼时效，一般为3年，从知道权利受损之日起算',
    '合同纠纷须注意合同中约定的管辖法院或仲裁条款',
    '起诉前可申请财产保全，需提供相应担保',
  ],
  CRIMINAL: [
    '刑事自诉仅适用于告诉才处理的案件（如侮辱、诽谤、轻伤等）',
    '公诉案件由检察院起诉，个人不能自行起诉',
    '注意追诉时效，轻罪5年，10年以下有期徒刑罪名10年',
    '证据不足时法院可能不予受理，建议先向公安机关报案',
  ],
  ADMINISTRATIVE: [
    '行政诉讼起诉期限：知道行政行为之日起6个月内',
    '可先申请行政复议，复议不服再提起行政诉讼',
    '起诉必须明确被告行政机关，不能起诉个人',
    '行政复议期间不停止被诉行政行为的执行',
  ],
  COMMERCIAL: [
    '商事案件标的额较大时需缴纳诉讼费，可申请缓缴',
    '涉及公司决议等事项，建议同步申请股东权利保护措施',
    '合同有仲裁条款的，应先申请仲裁，不能直接向法院起诉',
    '对外贸易纠纷注意适用法律和管辖约定',
  ],
  IP: [
    '专利侵权案件需由专利权人或利害关系人起诉',
    '著作权纠纷一般向被告住所地或侵权行为地法院起诉',
    '商标侵权可向工商行政管理部门举报，也可直接诉讼',
    '及时申请证据保全，侵权产品可能被销毁',
    '注意知识产权专属管辖，应向知识产权法院或专门法庭起诉',
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
    // 将中文案件类型映射到内部 key（向后兼容英文 key）
    const internalKey = CASE_TYPE_ALIAS[caseType] ?? caseType;

    // 获取案件类型对应的材料清单
    const materials =
      CASE_TYPE_MATERIALS[internalKey] || this.getDefaultMaterials();

    // 获取注意事项
    const notes = CASE_TYPE_NOTES[internalKey] || this.getDefaultNotes();

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
