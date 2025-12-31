import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";

export interface FileMetadata {
  filename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileType: string;
}

/**
 * 文件存储工具类
 * 负责文件的物理存储管理
 */
export class FileStorage {
  private static readonly UPLOAD_DIR = join(process.cwd(), "public", "uploads");

  /**
   * 保存文件到指定路径
   */
  static async saveFile(
    buffer: Buffer,
    caseId: string,
    originalFilename: string,
  ): Promise<FileMetadata> {
    const uploadDir = join(this.UPLOAD_DIR, caseId);

    // 创建目录
    await mkdir(uploadDir, { recursive: true });

    // 生成文件名（避免冲突）
    const extension = this.getExtension(originalFilename);
    const fileName = `${this.generateFileName()}.${extension}`;
    const filePath = join(uploadDir, fileName);

    // 写入文件
    await writeFile(filePath, buffer);

    return {
      filename: originalFilename,
      filePath: `/uploads/${caseId}/${fileName}`,
      fileSize: buffer.length,
      mimeType: this.getMimeType(extension),
      fileType: extension,
    };
  }

  /**
   * 删除文件
   */
  static async deleteFile(relativePath: string): Promise<void> {
    const fullPath = join(process.cwd(), "public", relativePath);
    try {
      await unlink(fullPath);
    } catch (error) {
      console.warn(`删除文件失败: ${fullPath}`, error);
    }
  }

  /**
   * 获取文件扩展名
   */
  private static getExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex === -1) {
      return "";
    }
    return filename.substring(lastDotIndex + 1).toLowerCase();
  }

  /**
   * 生成唯一的文件名
   */
  private static generateFileName(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 根据扩展名获取MIME类型
   */
  private static getMimeType(extension: string): string {
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
    };

    return mimeMap[extension.toLowerCase()] || "application/octet-stream";
  }

  /**
   * 验证文件大小
   */
  static validateFileSize(
    size: number,
    maxSize: number = 10 * 1024 * 1024,
  ): boolean {
    return size <= maxSize;
  }

  /**
   * 验证文件类型
   */
  static validateFileType(
    extension: string,
    allowedTypes: string[] = ["pdf", "doc", "docx", "txt"],
  ): boolean {
    return allowedTypes.includes(extension.toLowerCase());
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
}
