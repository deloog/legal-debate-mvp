/**
 * 文本提取器
 *
 * 负责从不同格式的文档中提取文本内容
 */

import { SecureFileUtils } from '../../../agent/security/file-utils';
import { AnalysisError } from '../../../agent/security/errors';
import { logger } from '../../../agent/security/logger';
import { ERROR_MESSAGES } from '../core/constants';

export class TextExtractor {
  /**
   * 根据文件类型提取文本
   */
  async extractText(filePath: string, fileType: string): Promise<string> {
    try {
      // 首先验证文件是否存在
      SecureFileUtils.validateFilePath(filePath);

      // 转换为大写以实现大小写不敏感的匹配
      const fileTypeUpper = fileType.toUpperCase();

      switch (fileTypeUpper) {
        case 'PDF':
          return await this.extractPDFText(filePath);

        case 'DOCX':
          return await this.extractDOCXText(filePath);

        case 'DOC':
          return await this.extractDOCText(filePath);

        case 'TXT':
          return await this.extractTXTText(filePath);

        case 'IMAGE':
          return await this.extractImageText(filePath);

        default:
          throw new Error(
            `${ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE}: ${fileType}`
          );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new AnalysisError(
        `${ERROR_MESSAGES.OCR_FAILURE}: ${errorMsg}`,
        error instanceof Error ? error : new Error(errorMsg),
        { filePath, fileType }
      );
    }
  }

  /**
   * 提取PDF文本
   */
  private async extractPDFText(filePath: string): Promise<string> {
    try {
      SecureFileUtils.validateFilePath(filePath);

      const pdfParseModule = await import('pdf-parse');
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const buffer = await SecureFileUtils.readFileSecurely(filePath);

      const data = await (
        pdfParse as unknown as (buffer: Buffer) => Promise<{ text: string }>
      )(buffer);
      return data.text;
    } catch (error) {
      throw new AnalysisError(
        'PDF文件解析失败',
        error instanceof Error ? error : new Error(String(error)),
        { filePath }
      );
    }
  }

  /**
   * 提取DOCX文本
   */
  private async extractDOCXText(filePath: string): Promise<string> {
    try {
      SecureFileUtils.validateFilePath(filePath);

      const mammothModule = await import('mammoth');
      const mammoth = mammothModule.default || mammothModule;
      const buffer = await SecureFileUtils.readFileSecurely(filePath);
      const result = await mammoth.extractRawText({ buffer });

      return result.value;
    } catch (error) {
      throw new AnalysisError(
        'DOCX文件解析失败',
        error instanceof Error ? error : new Error(String(error)),
        { filePath }
      );
    }
  }

  /**
   * 提取DOC文本
   */
  private async extractDOCText(filePath: string): Promise<string> {
    try {
      SecureFileUtils.validateFilePath(filePath);

      // 首先尝试使用antiword（安全版本）
      try {
        return await SecureFileUtils.executeCommandSecurely('antiword', [
          filePath,
        ]);
      } catch (antiwordError) {
        logger.warn('antiword不可用，尝试使用textract', {
          filePath,
          error: antiwordError,
        });
        return await this.extractDOCWithTextract(filePath);
      }
    } catch (error) {
      throw new AnalysisError(
        'DOC文件解析失败',
        error instanceof Error ? error : new Error(String(error)),
        { filePath }
      );
    }
  }

  /**
   * 使用textract提取DOC文本
   */
  private async extractDOCWithTextract(filePath: string): Promise<string> {
    try {
      // @ts-expect-error - textract lacks TypeScript definitions
      const textractModule = await import('textract');
      const textract = textractModule.default || textractModule;

      return new Promise((resolve, reject) => {
        (
          textract as unknown as {
            fromFileWithPath: (
              filePath: string,
              callback: (error: Error | null, text: string) => void
            ) => void;
          }
        ).fromFileWithPath(filePath, (error: Error | null, text: string) => {
          if (error) {
            reject(new AnalysisError('Textract解析失败', error, { filePath }));
          } else {
            resolve(text.trim());
          }
        });
      });
    } catch (error) {
      throw new AnalysisError(
        'Textract不可用',
        error instanceof Error ? error : new Error(String(error)),
        { filePath }
      );
    }
  }

  /**
   * 提取TXT文本
   */
  private async extractTXTText(filePath: string): Promise<string> {
    try {
      return await SecureFileUtils.readTextFileSecurely(filePath);
    } catch (error) {
      throw new AnalysisError(
        'TXT文件读取失败',
        error instanceof Error ? error : new Error(String(error)),
        { filePath }
      );
    }
  }

  /**
   * 提取图片OCR文本
   */
  private async extractImageText(filePath: string): Promise<string> {
    try {
      // @ts-expect-error - tesseract.js lacks TypeScript definitions
      const tesseractModule = await import('tesseract.js');
      const Tesseract = tesseractModule.default || tesseractModule;

      const {
        data: { text },
      } = await Tesseract.recognize(filePath, 'chi_sim+eng');

      return text.trim();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Cannot find module')
      ) {
        throw new Error(
          'OCR功能需要安装tesseract.js库，请运行: npm install tesseract.js'
        );
      }
      throw new Error(
        `图片OCR识别失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 统计文本词数
   */
  countWords(text: string): number {
    if (!text || text.trim().length === 0) return 0;

    // 中英文混合词数统计
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const numbers = (text.match(/\d+/g) || []).length;

    return chineseChars + englishWords + numbers;
  }

  /**
   * 智能文本分块（按句子边界）
   */
  splitTextSmart(
    text: string,
    maxChunkSize: number
  ): Array<{ text: string; start: number; end: number }> {
    const chunks: Array<{ text: string; start: number; end: number }> = [];
    let currentPos = 0;

    while (currentPos < text.length) {
      let endPos = Math.min(currentPos + maxChunkSize, text.length);

      if (endPos < text.length) {
        // 寻找最近的句子结束符
        const sentenceEnders = /[。！？；\n]/g;
        let match;
        let lastMatchPos = -1;

        while (
          (match = sentenceEnders.exec(text.substring(currentPos, endPos))) !==
          null
        ) {
          lastMatchPos = currentPos + match.index + 1;
        }

        if (lastMatchPos > currentPos) {
          endPos = lastMatchPos;
        }
      }

      chunks.push({
        text: text.substring(currentPos, endPos),
        start: currentPos,
        end: endPos,
      });

      currentPos = endPos;
    }

    return chunks;
  }

  /**
   * 获取文件大小
   */
  async getFileSize(filePath: string): Promise<number> {
    return await SecureFileUtils.getFileSizeSecurely(filePath);
  }
}
