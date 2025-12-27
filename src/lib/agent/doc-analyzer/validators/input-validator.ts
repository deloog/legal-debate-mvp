/**
 * 输入验证器 - 验证文档分析输入参数
 * 
 * 核心功能：
 * - 验证文档ID、文件路径、文件类型
 * - 验证文件格式支持
 * - 验证选项参数有效性
 */

import type {
  DocumentAnalysisInput,
  DocumentAnalysisOptions
} from '../core/types';
import {
  ERROR_MESSAGES
} from '../core/constants';

const SUPPORTED_FILE_TYPES = ['PDF', 'DOCX', 'DOC', 'TXT', 'IMAGE'] as const;

export class InputValidationError extends Error {
  constructor(field: string, message: string) {
    super(`输入验证失败 [${field}]: ${message}`);
    this.name = 'InputValidationError';
  }
}

/**
 * 验证文档ID
 */
function validateDocumentId(documentId: string): void {
  if (!documentId || typeof documentId !== 'string') {
    throw new InputValidationError('documentId', ERROR_MESSAGES.INVALID_DOCUMENT_ID);
  }
  
  if (documentId.trim().length === 0) {
    throw new InputValidationError('documentId', '文档ID不能为空字符串');
  }
  
  if (documentId.length > 100) {
    throw new InputValidationError('documentId', '文档ID长度不能超过100个字符');
  }
}

/**
 * 验证文件路径（可选，如果有content则不需要filePath）
 */
function validateFilePath(filePath?: string): void {
  // 如果提供了filePath，验证其有效性
  if (filePath !== undefined && filePath !== null && filePath !== '') {
    if (typeof filePath !== 'string') {
      throw new InputValidationError('filePath', ERROR_MESSAGES.INVALID_FILE_PATH);
    }
    if (filePath.trim().length === 0) {
      throw new InputValidationError('filePath', '文件路径不能为空');
    }
  }
}

/**
 * 验证文件类型（可选）
 */
function validateFileType(fileType?: string): void {
  if (fileType !== undefined && fileType !== null && fileType !== '') {
    if (typeof fileType !== 'string') {
      throw new InputValidationError('fileType', ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE);
    }
    const upperFileType = fileType.toUpperCase() as typeof SUPPORTED_FILE_TYPES[number];
    if (!SUPPORTED_FILE_TYPES.includes(upperFileType)) {
      throw new InputValidationError(
        'fileType',
        ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE
      );
    }
  }
}

/**
 * 验证选项参数
 */
function validateOptions(options?: DocumentAnalysisOptions): void {
  if (!options) {
    return;
  }
  
  if (typeof options !== 'object') {
    throw new InputValidationError('options', '选项必须是对象类型');
  }
  
  if (
    options.extractParties !== undefined &&
    typeof options.extractParties !== 'boolean'
  ) {
    throw new InputValidationError('options.extractParties', '必须是布尔值');
  }
  
  if (
    options.extractClaims !== undefined &&
    typeof options.extractClaims !== 'boolean'
  ) {
    throw new InputValidationError('options.extractClaims', '必须是布尔值');
  }
  
  if (
    options.extractTimeline !== undefined &&
    typeof options.extractTimeline !== 'boolean'
  ) {
    throw new InputValidationError('options.extractTimeline', '必须是布尔值');
  }
  
  if (
    options.generateSummary !== undefined &&
    typeof options.generateSummary !== 'boolean'
  ) {
    throw new InputValidationError('options.generateSummary', '必须是布尔值');
  }
}

/**
 * 验证直接提供的内容
 */
function validateContent(content?: string): void {
  if (!content) {
    return;
  }
  
  if (typeof content !== 'string') {
    throw new InputValidationError('content', '内容必须是字符串类型');
  }
  
  if (content.trim().length === 0) {
    throw new InputValidationError('content', ERROR_MESSAGES.EMPTY_DOCUMENT);
  }
  
  if (content.length > 500000) {
    throw new InputValidationError('content', '内容长度不能超过500000个字符');
  }
}

/**
 * 验证完整的文档分析输入
 */
export function validateInput(input: DocumentAnalysisInput): void {
  validateDocumentId(input.documentId);
  
  // 验证至少有filePath或content之一
  const hasFilePath = input.filePath && input.filePath.trim().length > 0;
  const hasContent = input.content && input.content.trim().length > 0;
  
  if (!hasFilePath && !hasContent) {
    throw new InputValidationError(
      'input',
      '必须提供filePath或content之一'
    );
  }
  
  validateFilePath(input.filePath);
  validateFileType(input.fileType);
  validateOptions(input.options);
  validateContent(input.content);
}

/**
 * 输入验证器类
 */
export class InputValidator {
  /**
   * 验证输入并返回验证结果
   */
  public validate(input: DocumentAnalysisInput): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    try {
      validateInput(input);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof InputValidationError) {
        return { valid: false, errors: [error.message] };
      }
      return { valid: false, errors: ['未知验证错误'] };
    }
  }
  
  /**
   * 检查文件类型是否支持
   */
  public isFileTypeSupported(fileType: string): boolean {
    return SUPPORTED_FILE_TYPES.includes(
      fileType.toUpperCase() as typeof SUPPORTED_FILE_TYPES[number]
    );
  }
}
