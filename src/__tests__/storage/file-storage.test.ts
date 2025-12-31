import { FileStorage } from "@/lib/storage/file-storage";

jest.mock("fs/promises");
jest.mock("fs");

describe("FileStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validateFileSize", () => {
    it("应该验证通过小文件", () => {
      expect(FileStorage.validateFileSize(1024)).toBeTruthy();
      expect(FileStorage.validateFileSize(5 * 1024 * 1024)).toBeTruthy();
    });

    it("应该拒绝超大文件", () => {
      expect(FileStorage.validateFileSize(11 * 1024 * 1024)).toBeFalsy();
    });

    it("应该使用自定义大小限制", () => {
      expect(
        FileStorage.validateFileSize(5 * 1024 * 1024, 5 * 1024 * 1024),
      ).toBeTruthy();
      expect(
        FileStorage.validateFileSize(6 * 1024 * 1024, 5 * 1024 * 1024),
      ).toBeFalsy();
    });
  });

  describe("validateFileType", () => {
    it("应该验证通过允许的文件类型", () => {
      expect(FileStorage.validateFileType("pdf")).toBeTruthy();
      expect(FileStorage.validateFileType("doc")).toBeTruthy();
      expect(FileStorage.validateFileType("docx")).toBeTruthy();
      expect(FileStorage.validateFileType("txt")).toBeTruthy();
    });

    it("应该拒绝不允许的文件类型", () => {
      expect(FileStorage.validateFileType("exe")).toBeFalsy();
      expect(FileStorage.validateFileType("bat")).toBeFalsy();
      expect(FileStorage.validateFileType("sh")).toBeFalsy();
    });

    it("应该使用自定义允许类型", () => {
      const customTypes = ["pdf", "jpg", "png"];
      expect(FileStorage.validateFileType("pdf", customTypes)).toBeTruthy();
      expect(FileStorage.validateFileType("jpg", customTypes)).toBeTruthy();
      expect(FileStorage.validateFileType("doc", customTypes)).toBeFalsy();
    });
  });

  describe("formatFileSize", () => {
    it("应该正确格式化字节", () => {
      expect(FileStorage.formatFileSize(0)).toBe("0 B");
      expect(FileStorage.formatFileSize(500)).toBe("500 B");
      expect(FileStorage.formatFileSize(1023)).toBe("1023 B");
    });

    it("应该正确格式化KB", () => {
      expect(FileStorage.formatFileSize(1024)).toBe("1 KB");
      expect(FileStorage.formatFileSize(2048)).toBe("2 KB");
      expect(FileStorage.formatFileSize(1536)).toBe("1.5 KB");
    });

    it("应该正确格式化MB", () => {
      expect(FileStorage.formatFileSize(1024 * 1024)).toBe("1 MB");
      expect(FileStorage.formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
    });

    it("应该正确格式化GB", () => {
      expect(FileStorage.formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
    });
  });
});
