/**
 * Excel生成工具
 * 提供Excel文件的生成和导出功能
 * 注意：当前实现使用CSV格式，可以被Excel正确打开
 * 如需生成真正的.xlsx格式，需要安装xlsx库
 */

import { CsvGenerator } from './csv-generator';
import { ExportFormat } from '@/types/stats';

/**
 * Excel生成器类
 */
export class ExcelGenerator {
  private data: Record<string, unknown>[];
  private headers: string[];
  private title: string;

  /**
   * 构造函数
   * @param headers 表头
   * @param data 数据行
   * @param title 标题
   */
  constructor(
    headers: string[],
    data: Record<string, unknown>[],
    title: string = 'Export Data'
  ) {
    this.headers = headers;
    this.data = data;
    this.title = title;
  }

  /**
   * 转义Excel字段
   * 防止CSV/Excel公式注入攻击
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

    // 如果包含逗号、双引号或换行符，需要转义
    if (
      stringValue.includes(',') ||
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
   * 格式化数字
   * @param value 数字值
   * @returns 格式化后的字符串
   */
  private formatNumber(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    return String(value);
  }

  /**
   * 格式化日期
   * @param date 日期值
   * @returns 格式化后的字符串
   */
  private formatDate(date: unknown): string {
    if (date === null || date === undefined) {
      return '';
    }
    const d = typeof date === 'string' ? new Date(date) : (date as Date);
    if (isNaN(d.getTime())) {
      return String(date);
    }
    return d.toISOString().split('T')[0];
  }

  /**
   * 生成Excel内容（CSV格式）
   * @returns CSV字符串（带BOM）
   */
  generate(): string {
    const rows: string[] = [];

    // 添加BOM以支持Excel正确显示中文
    rows.push('\uFEFF');

    // 添加标题行
    rows.push(this.escapeField(this.title));

    // 添加表头
    const headerRow = this.headers
      .map(header => this.escapeField(header))
      .join(',');
    rows.push(headerRow);

    // 添加数据行
    for (const rowData of this.data) {
      const values = this.headers.map(header => {
        const value = rowData[header];
        if (value === null || value === undefined) {
          return this.escapeField('');
        }
        if (
          header.toLowerCase().includes('date') ||
          header.endsWith('At') ||
          header.endsWith('Time')
        ) {
          return this.escapeField(this.formatDate(value));
        }
        if (
          header.toLowerCase().includes('count') ||
          header.toLowerCase().includes('amount') ||
          header.toLowerCase().includes('rate') ||
          header.toLowerCase().includes('score') ||
          header.toLowerCase().includes('time')
        ) {
          return this.escapeField(this.formatNumber(value));
        }
        return this.escapeField(value);
      });
      rows.push(values.join(','));
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
   * 静态方法：从对象数组创建Excel生成器
   * @param data 数据数组
   * @param headers 可选的表头（如果未提供，使用第一个对象的键）
   * @param sheetName 工作表名称
   * @returns Excel生成器实例
   */
  static fromArray(
    data: Record<string, unknown>[],
    headers?: string[],
    title: string = 'Export Data'
  ): ExcelGenerator {
    const excelHeaders = headers ?? Object.keys(data[0] ?? {});
    return new ExcelGenerator(excelHeaders, data, title);
  }

  /**
   * 转换为CSV生成器
   * @returns CSV生成器实例
   */
  toCsvGenerator(): CsvGenerator {
    return new CsvGenerator(this.headers, this.data, ',');
  }
}

/**
 * 验证导出类型是否安全（防止路径遍历）
 * @param exportType 导出类型
 * @returns 是否安全
 */
function isSafeExportType(exportType: string): boolean {
  // 只允许字母、数字、下划线和连字符
  return /^[a-zA-Z0-9_-]+$/.test(exportType);
}

/**
 * 清理文件名中的危险字符
 * @param filename 原始文件名
 * @returns 清理后的文件名
 */
function sanitizeFilename(filename: string): string {
  // 移除路径分隔符和危险字符
  return filename
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\.\./g, '')
    .replace(/^[\s.]+|[\s.]+$/g, '');
}

/**
 * 辅助函数：生成导出文件名
 * @param exportType 导出类型
 * @param format 导出格式
 * @returns 文件名
 */
export function generateExportFilename(
  exportType: string,
  format: ExportFormat
): string {
  // 验证导出类型安全性
  if (!isSafeExportType(exportType)) {
    exportType = 'export';
  }

  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS

  const extensionMap: Record<ExportFormat, string> = {
    CSV: 'csv',
    EXCEL: 'csv',
    JSON: 'json',
    PDF: 'pdf',
  };

  const extension = extensionMap[format] || 'csv';
  const filename = `${exportType}_${date}_${time}.${extension}`;
  
  return sanitizeFilename(filename);
}

/**
 * 辅助函数：生成中文表头映射
 * @param headers 英文表头
 * @returns 中文表头映射
 */
export function getChineseHeaders(headers: string[]): Record<string, string> {
  const headerMap: Record<string, string> = {
    id: 'ID',
    title: '标题',
    description: '描述',
    type: '类型',
    status: '状态',
    amount: '金额',
    caseNumber: '案号',
    cause: '案由',
    court: '法院',
    plaintiffName: '原告',
    defendantName: '被告',
    createdAt: '创建时间',
    updatedAt: '更新时间',
    debateCount: '辩论数量',
    documentCount: '文档数量',
    date: '日期',
    count: '数量',
    percentage: '占比',
    totalCases: '总案件数',
    completedCases: '已完成案件',
    activeCases: '活跃案件',
    averageCompletionTime: '平均完成时间(小时)',
    medianCompletionTime: '中位数完成时间(小时)',
    fastestCompletionTime: '最快完成时间(小时)',
    slowestCompletionTime: '最慢完成时间(小时)',
    totalUsers: '总用户数',
    newUsers: '新增用户数',
    growthRate: '增长率(%)',
    averageDaily: '日均新增',
    activeUsers: '活跃用户数',
    activeRate: '活跃率(%)',
    totalDebates: '总辩论数',
    totalArguments: '总论点数',
    averageArgumentsPerDebate: '平均论点数',
    averageScore: '平均评分',
    medianScore: '中位数评分',
    minScore: '最低评分',
    maxScore: '最高评分',
    totalRequests: '总请求数',
    averageResponseTime: '平均响应时间(ms)',
    p95ResponseTime: 'P95响应时间(ms)',
    p99ResponseTime: 'P99响应时间(ms)',
    errorRate: '错误率(%)',
    successCount: '成功请求数',
    errorCount: '错误请求数',
  };

  const result: Record<string, string> = {};
  for (const header of headers) {
    result[header] = headerMap[header] || header;
  }
  return result;
}

/**
 * 辅助函数：将数据转换为中文表头格式
 * @param data 原始数据
 * @param headers 表头
 * @returns 转换后的数据
 */
export function translateHeaders(
  data: Record<string, unknown>[],
  headers: string[]
): {
  headers: string[];
  data: Record<string, unknown>[];
} {
  const headerMap = getChineseHeaders(headers);
  const translatedHeaders = headers.map(h => headerMap[h] || h);

  const translatedData = data.map(row => {
    const newRow: Record<string, unknown> = {};
    headers.forEach(h => {
      newRow[headerMap[h] || h] = row[h];
    });
    return newRow;
  });

  return {
    headers: translatedHeaders,
    data: translatedData,
  };
}
