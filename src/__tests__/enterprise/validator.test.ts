/**
 * 企业验证器单元测试
 */

import {
  validateEnterpriseName,
  validateCreditCode,
  validateLegalPerson,
  validateIndustryType,
  validateEnterpriseRegistration,
} from "@/lib/enterprise/validator";

describe("企业验证器", () => {
  // =============================================================================
  // 企业名称验证测试
  // =============================================================================

  describe("validateEnterpriseName", () => {
    it("应该验证有效的企业名称", () => {
      const result = validateEnterpriseName("北京某某科技有限公司");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("应该验证有效的英文名称", () => {
      const result = validateEnterpriseName("ABC Technology Co., Ltd.");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("应该拒绝空的企业名称", () => {
      const result = validateEnterpriseName("");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("企业名称不能为空");
    });

    it("应该拒绝过短的企业名称", () => {
      const result = validateEnterpriseName("A");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("企业名称至少包含2个字符");
    });

    it("应该拒绝过长的企业名称", () => {
      const result = validateEnterpriseName("A".repeat(101));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("企业名称不能超过100个字符");
    });

    it("应该拒绝包含非法字符的企业名称", () => {
      const result = validateEnterpriseName("北京@科技公司");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("企业名称只能包含中文、英文、数字和括号");
    });
  });

  // =============================================================================
  // 统一社会信用代码验证测试
  // =============================================================================

  describe("validateCreditCode", () => {
    it("应该验证有效的统一社会信用代码", () => {
      // 使用一个简化的测试代码，跳过校验码验证
      const result = validateCreditCode("91110000100006440J");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("应该拒绝空的统一社会信用代码", () => {
      const result = validateCreditCode("");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("统一社会信用代码不能为空");
    });

    it("应该拒绝长度不正确的统一社会信用代码", () => {
      const result = validateCreditCode("9111000010000644");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("统一社会信用代码必须为18位");
    });

    it("应该拒绝格式不正确的统一社会信用代码", () => {
      const result = validateCreditCode("91110000100006440I"); // 包含I
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("统一社会信用代码包含非法字符");
    });

    it("应该拒绝包含非法字符的统一社会信用代码", () => {
      const result = validateCreditCode("91110000100006440I");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("统一社会信用代码包含非法字符");
    });
  });

  // =============================================================================
  // 法人代表验证测试
  // =============================================================================

  describe("validateLegalPerson", () => {
    it("应该验证有效的法人代表姓名", () => {
      const result = validateLegalPerson("张三");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("应该拒绝空的法人代表姓名", () => {
      const result = validateLegalPerson("");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("法人代表姓名不能为空");
    });

    it("应该拒绝过短的法人代表姓名", () => {
      const result = validateLegalPerson("张");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("法人代表姓名至少包含2个字符");
    });

    it("应该拒绝过长的法人代表姓名", () => {
      const result = validateLegalPerson("张".repeat(51));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("法人代表姓名不能超过50个字符");
    });

    it("应该拒绝包含非中文字符的法人代表姓名", () => {
      const result = validateLegalPerson("张三San");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("法人代表姓名只能为中文，2-10个字符");
    });
  });

  // =============================================================================
  // 行业类型验证测试
  // =============================================================================

  describe("validateIndustryType", () => {
    it("应该验证有效的行业类型", () => {
      const result = validateIndustryType("信息技术");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("应该拒绝空的行业类型", () => {
      const result = validateIndustryType("");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("行业类型不能为空");
    });

    it("应该拒绝过长的行业类型", () => {
      const result = validateIndustryType("A".repeat(51));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("行业类型不能超过50个字符");
    });
  });

  // =============================================================================
  // 综合验证测试
  // =============================================================================

  describe("validateEnterpriseRegistration", () => {
    it("应该验证有效的企业注册数据", () => {
      const result = validateEnterpriseRegistration({
        enterpriseName: "北京某某科技有限公司",
        creditCode: "91110000100006440J",
        legalPerson: "张三",
        industryType: "信息技术",
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("应该拒绝无效的企业注册数据", () => {
      const result = validateEnterpriseRegistration({
        enterpriseName: "",
        creditCode: "invalid",
        legalPerson: "张",
        industryType: "",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("应该收集所有验证错误", () => {
      const result = validateEnterpriseRegistration({
        enterpriseName: "A",
        creditCode: "invalid",
        legalPerson: "张",
        industryType: "",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes("企业名称"))).toBe(true);
      expect(result.errors.some((e) => e.includes("统一社会信用代码"))).toBe(
        true,
      );
      expect(result.errors.some((e) => e.includes("法人代表"))).toBe(true);
      expect(result.errors.some((e) => e.includes("行业类型"))).toBe(true);
    });
  });
});
