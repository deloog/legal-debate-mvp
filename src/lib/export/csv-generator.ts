/**
 * CSV生成工具
 * 提供CSV文件的生成和导出功能
 * 
 * 安全特性：
 * - 防止CSV/Excel公式注入攻击（以=,+,-,@开头的字段前加单引号）
 * - 正确处理包含特殊字符的字段
 * - 添加BOM以支持Excel正确显示中文
 */

/**
 * CSV生成器类
 */
export class CsvGenerator {
  private data: Record<string, unknown>[];
  private headers: string[];
  private separator: string;

  /**
   * 构造函数
   * @param headers CSV表头
   * @param data 数据行
   * @param separator 分隔符（默认逗号）
   */
  constructor(
    headers: string[],
    data: Record<string, unknown>[],
    separator: string = ','
  ) {
    this.headers = headers;
    this.data = data;
    this.separator = separator;
  }

  /**
   * 转义CSV字段
   * @param field 字段值
   * @returns 转义后的字符串
   */
  private escapeField(field: unknown): string {
    if (field === null || field === undefined) {
      return '';
    }

    let stringValue = String(field);

    // 防止CSV/Excel公式注入攻击
    // 如果以=, +, -, @, \t, \r 开头，在前面加单引号
    // 这些字符在Excel中可能被解释为公式
    const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'];
    if (dangerousPrefixes.some(prefix => stringValue.startsWith(prefix))) {
      stringValue = "'" + stringValue;
    }

    // 如果包含分隔符、引号或换行符，需要转义
    if (
      stringValue.includes(this.separator) ||
      stringValue.includes('"') ||
      stringValue.includes('\n') ||
      stringValue.includes('\r')
    ) {
      // 将双引号替换为两个双引号，并用双引号包围
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  /**
   * 生成CSV内容
   * @returns CSV字符串（带BOM）
   */
  generate(): string {
    const rows: string[] = [];

    // 添加BOM以支持Excel正确显示中文
    rows.push('\uFEFF');

    // 添加表头
    const headerRow = this.headers
      .map(header => this.escapeField(header))
      .join(this.separator);
    rows.push(headerRow);

    // 添加数据行
    for (const rowData of this.data) {
      const values = this.headers.map(header => {
        const value = rowData[header];
        return this.escapeField(value);
      });
      rows.push(values.join(this.separator));
    }

    return rows.join('\n');
  }

  /**
   * 生成Blob对象
   * @returns Blob对象
   */
  toBlob(): Blob {
    const content = this.generate();
    return new Blob([content], {
      type: 'text/csv;charset=utf-8;',
    });
  }

  /**
   * 生成下载URL
   * @returns 下载URL
   */
  toDownloadUrl(): string {
    const blob = this.toBlob();
    return URL.createObjectURL(blob);
  }

  /**
   * 触发下载
   * @param filename 文件名
   */
  download(filename: string): void {
    const url = this.toDownloadUrl();
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * 静态方法：从对象数组创建CSV生成器
   * @param data 数据数组
   * @param headers 可选的表头（如果未提供，使用第一个对象的键）
   * @returns CSV生成器实例
   */
  static fromArray(
    data: Record<string, unknown>[],
    headers?: string[]
  ): CsvGenerator {
    const csvHeaders = headers ?? Object.keys(data[0] ?? {});
    return new CsvGenerator(csvHeaders, data);
  }
}

/**
 * 辅助函数：将嵌套对象展开为扁平对象
 * @param obj 原始对象
 * @param prefix 键前缀
 * @returns 扁平化后的对象
 */
export function flattenObject(
  obj: Record<string, unknown>,
  prefix: string = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(
        result,
        flattenObject(value as Record<string, unknown>, newKey)
      );
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * 辅助函数：格式化日期
 * @param date 日期对象或字符串
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }
  return d.toISOString().split('T')[0];
}

/**
 * 辅助函数：格式化数字
 * @param value 数字值
 * @param decimals 小数位数
 * @returns 格式化后的数字字符串
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

/**
 * 检测并清理潜在的CSV注入攻击
 * @param value 要检测的值
 * @returns 清理后的值
 */
export function sanitizeCsvValue(value: string): string {
  if (!value) return value;
  
  // 检测危险前缀
  const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerousPrefixes.some(prefix => value.startsWith(prefix))) {
    return "'" + value;
  }
  
  return value;
}
