/**
 * 输入验证器单元测试
 */

import {
  validateInput,
  InputValidator,
  InputValidationError,
} from "@/lib/agent/doc-analyzer/validators/input-validator";
import type { DocumentAnalysisInput } from "@/lib/agent/doc-analyzer/core/types";

describe("InputValidator", () => {
  let validator: InputValidator;

  beforeEach(() => {
    validator = new InputValidator();
  });

  describe("validateInput", () => {
    const validInput: DocumentAnalysisInput = {
      documentId: "test-doc-123",
      filePath: "/path/to/document.pdf",
      fileType: "PDF",
      options: {
        extractParties: true,
        extractClaims: true,
        extractTimeline: false,
        generateSummary: false,
      },
    };

    it("should validate valid input", () => {
      expect(() => validateInput(validInput)).not.toThrow();
    });

    it("should throw error for empty documentId", () => {
      const input = { ...validInput, documentId: "" };
      expect(() => validateInput(input)).toThrow(InputValidationError);
      expect(() => validateInput(input)).toThrow("documentId");
    });

    it("should throw error for missing documentId", () => {
      const input = { ...validInput, documentId: "" as any };
      expect(() => validateInput(input)).toThrow(InputValidationError);
    });

    it("should throw error for documentId exceeding max length", () => {
      const input = { ...validInput, documentId: "a".repeat(101) };
      expect(() => validateInput(input)).toThrow(InputValidationError);
      expect(() => validateInput(input)).toThrow("长度不能超过");
    });

    it("should throw error for empty filePath", () => {
      const input = { ...validInput, filePath: "" };
      expect(() => validateInput(input)).toThrow(InputValidationError);
      expect(() => validateInput(input)).toThrow("filePath");
    });

    it("should throw error for unsupported file type", () => {
      const input = { ...validInput, fileType: "HTML" as any };
      expect(() => validateInput(input)).toThrow(InputValidationError);
      expect(() => validateInput(input)).toThrow("不支持的文档格式");
    });

    it("should accept all supported file types", () => {
      const supportedTypes = ["PDF", "DOCX", "DOC", "TXT", "IMAGE"];
      supportedTypes.forEach((type) => {
        const input = { ...validInput, fileType: type as any };
        expect(() => validateInput(input)).not.toThrow();
      });
    });

    it("should throw error for invalid boolean options", () => {
      const input = {
        ...validInput,
        options: { ...validInput.options, extractParties: "yes" as any },
      };
      expect(() => validateInput(input)).toThrow(InputValidationError);
      expect(() => validateInput(input)).toThrow("extractParties");
    });

    it("should throw error for empty content", () => {
      const input = { ...validInput, content: "   " };
      expect(() => validateInput(input)).toThrow(InputValidationError);
      expect(() => validateInput(input)).toThrow("文档内容为空");
    });

    it("should throw error for content exceeding max length", () => {
      const input = { ...validInput, content: "a".repeat(500001) };
      expect(() => validateInput(input)).toThrow(InputValidationError);
      expect(() => validateInput(input)).toThrow("长度不能超过");
    });

    it("should accept valid content", () => {
      const input = { ...validInput, content: "测试内容" };
      expect(() => validateInput(input)).not.toThrow();
    });
  });

  describe("InputValidator class", () => {
    describe("validate", () => {
      it("should return valid result for valid input", () => {
        const input: DocumentAnalysisInput = {
          documentId: "test-doc-123",
          filePath: "/path/to/document.pdf",
          fileType: "PDF",
        };
        const result = validator.validate(input);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it("should return invalid result for invalid input", () => {
        const input: DocumentAnalysisInput = {
          documentId: "",
          filePath: "/path/to/document.pdf",
          fileType: "PDF",
        };
        const result = validator.validate(input);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain("documentId");
      });
    });

    describe("isFileTypeSupported", () => {
      it("should return true for supported file types", () => {
        expect(validator.isFileTypeSupported("PDF")).toBe(true);
        expect(validator.isFileTypeSupported("pdf")).toBe(true);
        expect(validator.isFileTypeSupported("DOCX")).toBe(true);
        expect(validator.isFileTypeSupported("docx")).toBe(true);
        expect(validator.isFileTypeSupported("DOC")).toBe(true);
        expect(validator.isFileTypeSupported("TXT")).toBe(true);
        expect(validator.isFileTypeSupported("IMAGE")).toBe(true);
      });

      it("should return false for unsupported file types", () => {
        expect(validator.isFileTypeSupported("HTML")).toBe(false);
        expect(validator.isFileTypeSupported("XLSX")).toBe(false);
        expect(validator.isFileTypeSupported("PPT")).toBe(false);
      });
    });
  });
});
