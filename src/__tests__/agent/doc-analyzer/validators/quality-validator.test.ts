/**
 * 质量验证器单元测试
 */

import { QualityValidator } from "@/lib/agent/doc-analyzer/validators/quality-validator";
import type {
  ExtractedData,
  Party,
  Claim,
} from "@/lib/agent/doc-analyzer/core/types";

describe("QualityValidator", () => {
  let validator: QualityValidator;
  const mockValidParties: Party[] = [
    { type: "plaintiff", name: "张三" },
    { type: "defendant", name: "李四" },
  ];
  const mockValidClaims: Claim[] = [
    {
      type: "PAY_PRINCIPAL",
      content: "判令被告偿还本金100万元",
      amount: 1000000,
      currency: "CNY",
    },
    {
      type: "LITIGATION_COST",
      content: "诉讼费用由被告承担",
      currency: "CNY",
    },
  ];
  const mockValidData: ExtractedData = {
    parties: mockValidParties,
    claims: mockValidClaims,
  };

  beforeEach(() => {
    validator = new QualityValidator();
  });

  describe("validate", () => {
    it("should pass validation for valid data with good confidence", () => {
      const result = validator.validate(mockValidData, 0.9);
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(80);
      expect(result.issues.length).toBe(0);
    });

    it("should fail validation when parties are empty", () => {
      const data = { ...mockValidData, parties: [] };
      const result = validator.validate(data, 0.9);
      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.category === "当事人")).toBe(true);
    });

    it("should fail validation when claims are empty", () => {
      const data = { ...mockValidData, claims: [] };
      const result = validator.validate(data, 0.9);
      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.category === "诉讼请求")).toBe(true);
    });

    it("should fail validation when confidence is too low", () => {
      const result = validator.validate(mockValidData, 0.3);
      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.category === "置信度")).toBe(true);
      expect(result.issues.some((i) => i.severity === "ERROR")).toBe(true);
    });

    it("should warn when confidence is low but acceptable", () => {
      const result = validator.validate(mockValidData, 0.75);
      expect(result.passed).toBe(true);
      expect(result.issues.some((i) => i.category === "置信度")).toBe(true);
      expect(result.issues.some((i) => i.severity === "WARNING")).toBe(true);
    });

    it("should warn when plaintiff is missing", () => {
      const data: ExtractedData = {
        ...mockValidData,
        parties: [{ type: "defendant", name: "李四" }],
      };
      const result = validator.validate(data, 0.9);
      expect(result.issues.some((i) => i.message.includes("缺少原告"))).toBe(
        true,
      );
    });

    it("should warn when defendant is missing", () => {
      const data: ExtractedData = {
        ...mockValidData,
        parties: [{ type: "plaintiff", name: "张三" }],
      };
      const result = validator.validate(data, 0.9);
      expect(result.issues.some((i) => i.message.includes("缺少被告"))).toBe(
        true,
      );
    });

    it("should info when litigation cost is missing", () => {
      const data: ExtractedData = {
        ...mockValidData,
        claims: [{ ...mockValidData.claims[0] }],
      };
      const result = validator.validate(data, 0.9);
      expect(result.issues.some((i) => i.message.includes("诉讼费用"))).toBe(
        true,
      );
      expect(result.issues.some((i) => i.severity === "INFO")).toBe(true);
    });

    it("should fail when claim content is empty", () => {
      const data = {
        parties: [...mockValidData.parties],
        claims: mockValidData.claims.map((c) => ({ ...c })),
      };
      data.claims[0].content = "";
      const result = validator.validate(data, 0.9);
      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.category === "诉讼请求")).toBe(true);
    });

    it("should fail when amount is negative", () => {
      const data = {
        parties: [...mockValidData.parties],
        claims: mockValidData.claims.map((c) => ({ ...c })),
      };
      data.claims[0].amount = -1000;
      const result = validator.validate(data, 0.9);
      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.category === "金额")).toBe(true);
    });

    it("should warn when amount is too large", () => {
      const data = {
        parties: [...mockValidData.parties],
        claims: mockValidData.claims.map((c) => ({ ...c })),
      };
      data.claims[0].amount = 2e9;
      const result = validator.validate(data, 0.9);
      expect(
        result.issues.some(
          (i) => i.category === "金额" && i.severity === "WARNING",
        ),
      ).toBe(true);
    });

    it("should return correct metrics", () => {
      const result = validator.validate(mockValidData, 0.85);
      expect(result.metrics.partyCount).toBe(2);
      expect(result.metrics.claimCount).toBe(2);
      expect(result.metrics.confidence).toBe(0.85);
      expect(result.metrics.hasPlaintiff).toBe(true);
      expect(result.metrics.hasDefendant).toBe(true);
    });

    it("should calculate score correctly", () => {
      const result = validator.validate(mockValidData, 0.9);
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("should penalize errors more heavily than warnings", () => {
      const dataWithErrors = { ...mockValidData, parties: [], claims: [] };
      const resultWithError = validator.validate(dataWithErrors, 0.9);

      const resultWithWarning = validator.validate(mockValidData, 0.7);

      expect(resultWithError.score).toBeLessThan(resultWithWarning.score);
    });
  });

  describe("quickValidate", () => {
    it("should pass quick validation for valid data", () => {
      const result = validator.quickValidate(mockValidData, 0.9);
      expect(result.passed).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should fail quick validation with errors", () => {
      const data = { ...mockValidData, parties: [] };
      const result = validator.quickValidate(data, 0.9);
      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should ignore warnings in quick validation", () => {
      const result = validator.quickValidate(mockValidData, 0.75);
      expect(result.passed).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should ignore info messages in quick validation", () => {
      const result = validator.quickValidate(mockValidData, 0.9);
      expect(result.passed).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should only include errors in result", () => {
      const data: ExtractedData = {
        ...mockValidData,
        parties: [{ type: "plaintiff", name: "张三" }],
        claims: [{ ...mockValidData.claims[0] }],
      };
      const fullResult = validator.validate(data, 0.9);
      const quickResult = validator.quickValidate(data, 0.9);

      expect(quickResult.errors.length).toBeLessThan(fullResult.issues.length);
      expect(quickResult.errors.every((e) => e.severity === "ERROR")).toBe(
        true,
      );
    });
  });
});
