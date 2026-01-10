/**
 * 当事人信息验证器
 * 验证原告、被告信息的有效性和一致性
 */
import {
  PartyVerification,
  IssueType,
  IssueSeverity,
  VerificationIssue,
  IssueCategory,
} from "../types";

/**
 * 源数据接口（用于对比验证）
 */
interface SourceData {
  parties?: {
    plaintiff?: { name?: string; id?: string };
    defendant?: { name?: string; id?: string };
  };
}

/**
 * 待验证数据接口
 */
interface DataToVerify {
  parties?: {
    plaintiff?: string | { name: string };
    defendant?: string | { name: string };
  };
}

/**
 * 当事人验证器类
 */
export class PartyVerifier {
  /**
   * 代理人关键词列表
   */
  private readonly AGENT_KEYWORDS = [
    "代理人",
    "律师",
    "委托代理",
    "诉讼代理",
    "法定代理",
    "指定代理",
    "法律工作者",
  ];

  /**
   * 法定代表人关键词列表
   */
  private readonly LEGAL_REP_KEYWORDS = [
    "法定代表人",
    "法人代表",
    "总经理",
    "执行董事",
    "董事长",
    "监事",
    "董事",
  ];

  /**
   * 常见排除词汇（非当事人）
   */
  private readonly EXCLUDE_KEYWORDS = [
    "对方",
    "被告方",
    "原告方",
    "被申请人",
    "申请人",
    "上诉人",
    "被上诉人",
    "涉案",
    "本案",
  ];

  /**
   * 验证当事人信息
   */
  async verify(
    data: DataToVerify,
    source?: SourceData,
  ): Promise<PartyVerification> {
    const issues: string[] = [];
    const details = {
      plaintiffValid: true,
      defendantValid: true,
      rolesMatch: true,
    };

    // 验证原告信息
    if (data.parties?.plaintiff) {
      const plaintiffName =
        typeof data.parties.plaintiff === "string"
          ? data.parties.plaintiff
          : data.parties.plaintiff.name;

      if (!plaintiffName || plaintiffName.trim().length < 2) {
        details.plaintiffValid = false;
        issues.push("原告姓名无效或过短");
      }

      // 检查原告是否包含代理人关键词
      if (this.isAgent(plaintiffName)) {
        details.plaintiffValid = false;
        issues.push(`"${plaintiffName}"包含代理人关键词，不应作为原告`);
      }

      // 检查原告是否包含法定代表人关键词
      if (this.isLegalRep(plaintiffName)) {
        details.plaintiffValid = false;
        issues.push(`"${plaintiffName}"包含法定代表人关键词，不应作为原告`);
      }

      // 检查原告是否包含常见排除词汇
      if (this.isExcludeWord(plaintiffName)) {
        details.plaintiffValid = false;
        issues.push(`"${plaintiffName}"包含常见排除词汇，不应作为原告`);
      }

      // 检查名称长度是否合理
      if (plaintiffName.length < 2) {
        details.plaintiffValid = false;
        issues.push("原告姓名过短，可能为误识别");
      }

      // 检查是否为公司名称（公司名称应更严格）
      if (
        this.isCompany(plaintiffName) &&
        !this.isValidCompanyName(plaintiffName)
      ) {
        details.plaintiffValid = false;
        issues.push(`原告公司名称"${plaintiffName}"格式可能不正确`);
      }

      // 与源数据对比
      if (source?.parties?.plaintiff) {
        const sourceName =
          typeof source.parties.plaintiff === "string"
            ? source.parties.plaintiff
            : source.parties.plaintiff.name;

        if (plaintiffName !== sourceName) {
          details.plaintiffValid = false;
          issues.push(
            `原告姓名不一致：期望"${sourceName}"，实际"${plaintiffName}"`,
          );
        }
      }
    } else {
      details.plaintiffValid = false;
      issues.push("缺少原告信息");
    }

    // 验证被告信息
    if (data.parties?.defendant) {
      const defendantName =
        typeof data.parties.defendant === "string"
          ? data.parties.defendant
          : data.parties.defendant.name;

      if (!defendantName || defendantName.trim().length < 2) {
        details.defendantValid = false;
        issues.push("被告姓名无效或过短");
      }

      // 检查被告是否包含代理人关键词
      if (this.isAgent(defendantName)) {
        details.defendantValid = false;
        issues.push(`"${defendantName}"包含代理人关键词，不应作为被告`);
      }

      // 检查被告是否包含法定代表人关键词
      if (this.isLegalRep(defendantName)) {
        details.defendantValid = false;
        issues.push(`"${defendantName}"包含法定代表人关键词，不应作为被告`);
      }

      // 检查被告是否包含常见排除词汇
      if (this.isExcludeWord(defendantName)) {
        details.defendantValid = false;
        issues.push(`"${defendantName}"包含常见排除词汇，不应作为被告`);
      }

      // 检查名称长度是否合理
      if (defendantName.length < 2) {
        details.defendantValid = false;
        issues.push("被告姓名过短，可能为误识别");
      }

      // 检查是否为公司名称（公司名称应更严格）
      if (
        this.isCompany(defendantName) &&
        !this.isValidCompanyName(defendantName)
      ) {
        details.defendantValid = false;
        issues.push(`被告公司名称"${defendantName}"格式可能不正确`);
      }

      // 与源数据对比
      if (source?.parties?.defendant) {
        const sourceName =
          typeof source.parties.defendant === "string"
            ? source.parties.defendant
            : source.parties.defendant.name;

        if (defendantName !== sourceName) {
          details.defendantValid = false;
          issues.push(
            `被告姓名不一致：期望"${sourceName}"，实际"${defendantName}"`,
          );
        }
      }
    } else {
      details.defendantValid = false;
      issues.push("缺少被告信息");
    }

    // 检查角色匹配（原被告不能相同）
    if (
      typeof data.parties?.plaintiff === "string" &&
      typeof data.parties?.defendant === "string" &&
      this.normalizeName(data.parties.plaintiff) ===
        this.normalizeName(data.parties.defendant)
    ) {
      details.rolesMatch = false;
      issues.push("原告和被告不能是同一人");
    }

    const passed =
      issues.length === 0 && details.plaintiffValid && details.defendantValid;

    return {
      passed,
      details,
      issues,
    };
  }

  /**
   * 检查是否为代理人
   */
  private isAgent(name: string): boolean {
    return this.AGENT_KEYWORDS.some((keyword) => name.includes(keyword));
  }

  /**
   * 检查是否为法定代表人
   */
  private isLegalRep(name: string): boolean {
    return this.LEGAL_REP_KEYWORDS.some((keyword) => name.includes(keyword));
  }

  /**
   * 检查是否为常见排除词汇
   */
  private isExcludeWord(name: string): boolean {
    return this.EXCLUDE_KEYWORDS.some((keyword) => name.includes(keyword));
  }

  /**
   * 检查是否为公司名称
   */
  private isCompany(name: string): boolean {
    const companyKeywords = [
      "公司",
      "企业",
      "集团",
      "有限",
      "股份",
      "责任",
      "合伙",
      "个体",
      "厂",
      "店",
      "中心",
      "工作室",
    ];
    return companyKeywords.some((keyword) => name.includes(keyword));
  }

  /**
   * 检查是否为有效的公司名称
   */
  private isValidCompanyName(name: string): boolean {
    // 公司名称至少包含"公司"或"企业"
    if (!name.includes("公司") && !name.includes("企业")) {
      return false;
    }

    // 公司名称长度应在3-50个字之间
    if (name.length < 3 || name.length > 50) {
      return false;
    }

    // 公司名称不应包含特殊字符（除标点符号外）
    const specialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,<>\/?]/;
    if (specialChars.test(name)) {
      return false;
    }

    return true;
  }

  /**
   * 标准化姓名（用于比较）
   */
  private normalizeName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, "")
      .replace(/[，。；；、,;]/g, "");
  }

  /**
   * 创建空的当事人验证结果
   */
  async getEmptyResult(): Promise<PartyVerification> {
    return {
      passed: true,
      details: {
        plaintiffValid: true,
        defendantValid: true,
        rolesMatch: true,
      },
      issues: [],
    };
  }

  /**
   * 将验证结果转换为问题列表
   */
  convertToIssues(result: PartyVerification): VerificationIssue[] {
    const issues: VerificationIssue[] = [];

    for (const issue of result.issues) {
      issues.push({
        id: `factual-party-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.INCORRECT_DATA,
        severity: IssueSeverity.HIGH,
        category: IssueCategory.FACTUAL,
        message: issue,
        detectedBy: "factual",
      });
    }

    return issues;
  }
}
