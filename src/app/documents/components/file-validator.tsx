export interface ValidationError {
  code: string;
  message: string;
  file?: File;
}

export const VALIDATION_RULES = {
  allowedExtensions: [".pdf", ".doc", ".docx", ".txt"],
  allowedMimeTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 10,
  imageExtensions: [".jpg", ".jpeg", ".png", ".gif"],
} as const;

export class FileValidator {
  /**
   * 验证单个文件
   */
  static validateFile(file: File): ValidationError | null {
    // 验证文件大小
    if (file.size > VALIDATION_RULES.maxFileSize) {
      return {
        code: "FILE_TOO_LARGE",
        message: `文件 ${file.name} 超过最大限制 10MB`,
        file,
      };
    }

    // 验证文件扩展名
    const extension = this.getFileExtension(file.name).toLowerCase();
    const isAllowedType = VALIDATION_RULES.allowedExtensions.includes(
      extension as ".pdf" | ".doc" | ".docx" | ".txt",
    );
    const isImageType = VALIDATION_RULES.imageExtensions.includes(
      extension as ".jpg" | ".jpeg" | ".png" | ".gif",
    );

    if (!isAllowedType && !isImageType) {
      return {
        code: "INVALID_TYPE",
        message: `不支持的文件类型: ${extension}，请上传 PDF、Word 或 TXT 文件`,
        file,
      };
    }

    // 验证MIME类型
    if (
      file.type &&
      !VALIDATION_RULES.allowedMimeTypes.includes(
        file.type as (typeof VALIDATION_RULES.allowedMimeTypes)[number],
      )
    ) {
      return {
        code: "INVALID_MIME",
        message: `无效的文件类型: ${file.type}`,
        file,
      };
    }

    return null;
  }

  /**
   * 批量验证文件
   */
  static validateFiles(files: File[]): ValidationError[] {
    const errors: ValidationError[] = [];

    // 验证文件数量
    if (files.length > VALIDATION_RULES.maxFiles) {
      errors.push({
        code: "TOO_MANY_FILES",
        message: `最多只能上传 ${VALIDATION_RULES.maxFiles} 个文件`,
      });
    }

    // 验证每个文件
    for (const file of files) {
      const error = this.validateFile(file);
      if (error) {
        errors.push(error);
      }
    }

    return errors;
  }

  /**
   * 获取文件扩展名
   */
  private static getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex === -1) {
      return "";
    }
    return filename.substring(lastDotIndex);
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) {
      return "0 B";
    }

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  }

  /**
   * 获取文件类型描述
   */
  static getFileTypeDescription(file: File): string {
    const extension = this.getFileExtension(file.name).toLowerCase();

    const typeMap: Record<string, string> = {
      ".pdf": "PDF 文档",
      ".doc": "Word 文档",
      ".docx": "Word 文档",
      ".txt": "纯文本",
      ".jpg": "图片（需配置OCR）",
      ".jpeg": "图片（需配置OCR）",
      ".png": "图片（需配置OCR）",
    };

    return typeMap[extension] || "未知类型";
  }

  /**
   * 检查是否为图片文件
   */
  static isImageFile(file: File): boolean {
    const extension = this.getFileExtension(file.name).toLowerCase();
    return VALIDATION_RULES.imageExtensions.includes(
      extension as ".jpg" | ".jpeg" | ".png" | ".gif",
    );
  }
}
