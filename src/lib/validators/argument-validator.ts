/**
 * Argument验证工具
 * 确保论点数据符合业务规则
 */

export interface ArgumentData {
  content: string;
  side: string;
  type?: string;
  roundId: string;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * 验证论点内容
 */
export function validateArgumentContent(content: string): void {
  if (!content) {
    throw new ValidationError('论点内容不能为空');
  }
  
  // 检查是否只包含空白字符
  if (content.trim().length === 0) {
    throw new ValidationError('论点内容不能只包含空白字符');
  }
  
  // 检查最小长度
  if (content.trim().length < 3) {
    throw new ValidationError('论点内容至少需要3个字符');
  }
  
  // 检查最大长度
  if (content.length > 10000) {
    throw new ValidationError('论点内容不能超过10000个字符');
  }
}

/**
 * 验证论点数据
 */
export function validateArgumentData(data: ArgumentData): void {
  // 验证内容
  validateArgumentContent(data.content);
  
  // 验证roundId
  if (!data.roundId || data.roundId.trim().length === 0) {
    throw new ValidationError('轮次ID不能为空');
  }
  
  // 验证side
  const validSides = ['PLAINTIFF', 'DEFENDANT', 'NEUTRAL'];
  if (!validSides.includes(data.side)) {
    throw new ValidationError(`无效的论点方: ${data.side}`);
  }
  
  // 验证type（如果提供）
  if (data.type) {
    const validTypes = [
      'MAIN_POINT', 'SUPPORTING', 'REBUTTAL', 
      'EVIDENCE', 'LEGAL_BASIS', 'CONCLUSION'
    ];
    if (!validTypes.includes(data.type)) {
      throw new ValidationError(`无效的论点类型: ${data.type}`);
    }
  }
}

/**
 * 清理和标准化论点内容
 */
export function sanitizeArgumentContent(content: string): string {
  return content
    .trim()
    .replace(/\s+/g, ' ') // 将多个空白字符替换为单个空格
    .normalize('NFC'); // Unicode标准化
}
