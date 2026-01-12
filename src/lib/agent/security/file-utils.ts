import * as fs from 'fs';
import * as path from 'path';
import { SecurityError } from './errors';

// =============================================================================
// 文件操作安全工具类
// =============================================================================

export class SecureFileUtils {
  // 允许的基础路径白名单
  private static readonly ALLOWED_BASE_PATHS = [
    process.cwd(),
    path.join(process.cwd(), 'temp'),
    path.join(process.cwd(), 'uploads'),
    path.join(process.cwd(), 'test-data'),
  ];

  // 允许的文件扩展名
  private static readonly ALLOWED_EXTENSIONS = new Set([
    '.pdf',
    '.docx',
    '.doc',
    '.txt',
    '.jpg',
    '.jpeg',
    '.png',
    '.bmp',
    '.tiff',
  ]);

  // 最大文件大小 (50MB)
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024;

  /**
   * 验证文件路径是否安全
   */
  static validateFilePath(filePath: string): void {
    if (!filePath || typeof filePath !== 'string') {
      throw new SecurityError('文件路径不能为空', { filePath });
    }

    // 规范化路径
    const normalizedPath = path.resolve(filePath);

    // 检查路径是否在允许的基础路径内
    const isAllowed = this.ALLOWED_BASE_PATHS.some(basePath =>
      normalizedPath.startsWith(path.resolve(basePath))
    );

    if (!isAllowed) {
      throw new SecurityError('文件路径不在允许的目录范围内', {
        filePath: normalizedPath,
        allowedPaths: this.ALLOWED_BASE_PATHS,
      });
    }

    // 检查文件扩展名
    const ext = path.extname(normalizedPath).toLowerCase();
    if (!this.ALLOWED_EXTENSIONS.has(ext)) {
      throw new SecurityError(`不支持的文件类型: ${ext}`, {
        filePath: normalizedPath,
        allowedExtensions: Array.from(this.ALLOWED_EXTENSIONS),
      });
    }

    // 检查文件是否存在
    if (!fs.existsSync(normalizedPath)) {
      throw new SecurityError('文件不存在', { filePath: normalizedPath });
    }

    // 检查文件大小
    try {
      const stats = fs.statSync(normalizedPath);
      if (stats.size > this.MAX_FILE_SIZE) {
        throw new SecurityError(
          `文件过大: ${stats.size} bytes (最大允许: ${this.MAX_FILE_SIZE} bytes)`,
          {
            filePath: normalizedPath,
            fileSize: stats.size,
            maxFileSize: this.MAX_FILE_SIZE,
          }
        );
      }
    } catch (error) {
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new SecurityError('无法读取文件信息', {
        filePath: normalizedPath,
        error,
      });
    }
  }

  /**
   * 安全地读取文件
   */
  static async readFileSecurely(filePath: string): Promise<Buffer> {
    this.validateFilePath(filePath);

    return new Promise((resolve, reject) => {
      fs.readFile(filePath, (err, data) => {
        if (err) {
          reject(
            new SecurityError(`读取文件失败: ${err.message}`, {
              filePath,
              error: err,
            })
          );
        } else {
          resolve(data);
        }
      });
    });
  }

  /**
   * 安全地读取文本文件
   */
  static async readTextFileSecurely(
    filePath: string,
    encoding: BufferEncoding = 'utf-8'
  ): Promise<string> {
    const buffer = await this.readFileSecurely(filePath);
    return buffer.toString(encoding);
  }

  /**
   * 安全地执行外部命令（用于DOC文件处理）
   */
  static async executeCommandSecurely(
    command: string,
    args: string[],
    options: {
      maxBuffer?: number;
      timeout?: number;
    } = {}
  ): Promise<string> {
    const { execSync } = require('child_process');

    // 验证命令是否在允许列表中
    const allowedCommands = ['antiword', 'file', 'ls'];
    if (!allowedCommands.includes(command)) {
      throw new SecurityError(`不允许执行的命令: ${command}`, {
        command,
        allowedCommands,
      });
    }

    // 验证参数
    for (const arg of args) {
      if (typeof arg !== 'string') {
        throw new SecurityError('命令参数必须是字符串', { command, args });
      }

      // 检查参数中的危险字符
      const dangerousPatterns = /[;&|`$(){}[\]]/;
      if (dangerousPatterns.test(arg)) {
        throw new SecurityError('命令参数包含危险字符', { command, arg });
      }
    }

    try {
      const result = execSync(command, args, {
        encoding: 'utf8',
        maxBuffer: options.maxBuffer || 10 * 1024 * 1024,
        timeout: options.timeout || 30000,
      });

      return result;
    } catch (error) {
      throw new SecurityError(
        `命令执行失败: ${error instanceof Error ? error.message : String(error)}`,
        {
          command,
          args,
          error,
        }
      );
    }
  }

  /**
   * 获取文件大小
   */
  static async getFileSizeSecurely(filePath: string): Promise<number> {
    this.validateFilePath(filePath);

    return new Promise((resolve, reject) => {
      fs.stat(filePath, (err, stats) => {
        if (err) {
          reject(
            new SecurityError(`获取文件信息失败: ${err.message}`, {
              filePath,
              error: err,
            })
          );
        } else {
          resolve(stats.size);
        }
      });
    });
  }
}
