/**
 * DOCX 文档解析器 - TypeScript 实现版
 *
 * 支持多种 DOCX 版本和格式：
 * 1. DOCX (2007+): 标准 OpenXML 格式 - 使用 mammoth 解析
 * 2. DOC (Office 97-2003): OLE 二进制格式 - 使用系统工具（catdoc/antiword）
 * 3. DOC XML (Word 2003 XML): WordprocessingML 格式
 *
 * 解析策略：
 * 1. 正则表达式提取元数据
 * 2. 模式识别
 * 3. AI 辅助解析（可选）
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import mammoth from 'mammoth';
import * as jszip from 'jszip';
import * as xml2js from 'xml2js';
import crypto from 'crypto';

const execAsync = promisify(exec);

/**
 * 简单的日志函数
 */
function debug(message: string): void {
  if (process.env.DEBUG === 'true') {
    console.log(`[DEBUG] DOCXParser: ${message}`);
  }
}

function warn(message: string): void {
  console.log(`[WARN] DOCXParser: ${message}`);
}

/**
 * 文档类型枚举
 */
export enum DocumentType {
  LAW = 'law',
  REGULATION = 'regulation',
  LOCAL_RULE = 'local_rule',
  JUDICIAL_INTERPRETATION = 'judicial_interpretation',
  DEPARTMENTAL_RULE = 'departmental_rule',
  REPLY = 'reply',
  OPINION = 'opinion',
  INTERPRETATION = 'interpretation',
  MEASURE = 'measure',
  REGULATION_DOC = 'regulation_doc',
  DECISION = 'decision',
  OTHER = 'other',
}

/**
 * 法律类别枚举
 */
export enum LawCategory {
  CIVIL = 'CIVIL',
  CRIMINAL = 'CRIMINAL',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  COMMERCIAL = 'COMMERCIAL',
  LABOR = 'LABOR',
  PROCEDURE = 'PROCEDURE',
  INTELLECTUAL_PROPERTY = 'INTELLECTUAL_PROPERTY',
  OTHER = 'OTHER',
}

/**
 * 采集配置接口
 */
export interface DOCXParserConfig {
  baseUrl?: string;
  rateLimitDelay?: number;
  maxRetries?: number;
  retryBackoff?: number;
  timeout?: number;
  outputDir?: string;

  // AI 辅助解析配置
  aiEnabled?: boolean;
  aiApiKey?: string;
  aiModel?: string;

  // 兼容性选项
  enableOleParser?: boolean;
  enableXmlParser?: boolean;

  // OLE 工具路径
  catdocPath?: string;
  antiwordPath?: string;
}

/**
 * 法律文档数据结构
 */
export interface LawDocument {
  sourceId: string;
  sourceUrl: string;
  title: string;
  documentNumber: string;
  documentType: DocumentType;
  category: LawCategory;
  issuingAuthority: string;
  publishDate: string;
  effectiveDate: string;
  fullText: string;
  amendments: Array<{
    amendmentNumber: string;
    amendmentDate: string;
    description: string;
    previousText?: string;
  }>;
  sourceHash: string;
  crawledAt: string;
  parseStatus: 'success' | 'failed' | 'partial';
  parseError?: string;
  retryCount: number;
  docFormat: string;
}

/**
 * DOCX 解析器类
 */
export class DOCXParser {
  private config: DOCXParserConfig;

  private readonly typePatterns: Record<DocumentType, RegExp[]> = {
    [DocumentType.REPLY]: [/关于.*批复/, /.*批复/, /.*函/],
    [DocumentType.OPINION]: [/关于.*意见/, /.*若干意见/, /.*指导意见/],
    [DocumentType.INTERPRETATION]: [/关于.*解释/, /.*解释/, /最高人民法院关于/],
    [DocumentType.MEASURE]: [/.*办法/, /管理办法/, /实施办法/],
    [DocumentType.REGULATION_DOC]: [/.*规定/, /.*若干规定/, /.*规定.*/],
    [DocumentType.DECISION]: [/.*决定/, /.*若干决定/, /.*处理决定/],
    [DocumentType.LAW]: [],
    [DocumentType.REGULATION]: [],
    [DocumentType.LOCAL_RULE]: [],
    [DocumentType.JUDICIAL_INTERPRETATION]: [],
    [DocumentType.DEPARTMENTAL_RULE]: [],
    [DocumentType.OTHER]: [],
  };

  private readonly categoryKeywords: Record<LawCategory, string[]> = {
    [LawCategory.CIVIL]: [
      '民法典',
      '婚姻',
      '继承',
      '收养',
      '合同',
      '侵权',
      '物权',
      '人格权',
    ],
    [LawCategory.CRIMINAL]: [
      '刑法',
      '犯罪',
      '刑事',
      '诈骗',
      '盗窃',
      '抢劫',
      '杀人',
    ],
    [LawCategory.ADMINISTRATIVE]: ['行政', '处罚', '复议', '许可', '强制'],
    [LawCategory.COMMERCIAL]: ['公司', '企业', '合同', '合伙', '证券', '保险'],
    [LawCategory.LABOR]: ['劳动', '工资', '社保', '工伤', '劳动合同'],
    [LawCategory.PROCEDURE]: ['程序', '审理', '判决', '裁定', '执行'],
    [LawCategory.INTELLECTUAL_PROPERTY]: [
      '专利',
      '商标',
      '版权',
      '著作权',
      '知识产权',
    ],
    [LawCategory.OTHER]: [],
  };

  constructor(config?: DOCXParserConfig) {
    const isWindows = process.platform === 'win32';
    this.config = {
      baseUrl: 'https://flk.npc.gov.cn',
      rateLimitDelay: 3.0,
      maxRetries: 5,
      retryBackoff: 2.0,
      timeout: 30,
      outputDir: 'data/crawled',
      aiEnabled: false,
      aiModel: 'gpt-3.5-turbo',
      enableOleParser: true,
      enableXmlParser: true,
      catdocPath: isWindows ? '' : '/usr/bin/catdoc', // Windows 下默认不使用
      antiwordPath: isWindows ? '' : '/usr/bin/antiword', // Windows 下默认不使用
      ...config,
    };
  }

  /**
   * 判断是否可以解析此文档
   */
  canParse(content: Buffer | string, fileExt: string): boolean {
    if (Buffer.isBuffer(content)) {
      // 检查文件头
      if (content.length >= 4) {
        const header = content.subarray(0, 4);
        if (header.toString('hex') === '504b0304') {
          // ZIP (DOCX)
          return true;
        }
        if (content.length >= 8) {
          const oleHeader = content.subarray(0, 8);
          if (oleHeader.toString('hex') === 'd0cf11e0a1b11ae1') {
            // OLE (DOC)
            return true;
          }
        }
      }
      return false;
    } else if (typeof content === 'string') {
      return fileExt.toLowerCase().match(/\.(docx|doc|xml)$/) !== null;
    }
    return false;
  }

  /**
   * 主解析方法 - 多种解析方式的降级
   */
  async parse(
    content: Buffer | string,
    sourceUrl: string = ''
  ): Promise<LawDocument | null> {
    // 1. 尝试使用 mammoth 解析（推荐）
    try {
      const doc = await this.parseWithMammoth(content, sourceUrl);
      if (doc) {
        doc.docFormat = 'docx';
        return doc;
      }
    } catch (error) {
      debug(`mammoth 解析失败: ${String(error)}`);
    }

    // 2. 尝试直接 XML 解析
    if (this.config.enableXmlParser) {
      try {
        const doc = await this.parseWithXml(content, sourceUrl);
        if (doc) {
          doc.docFormat = 'xml';
          return doc;
        }
      } catch (error) {
        debug(`XML 解析失败: ${String(error)}`);
      }
    }

    // 3. 尝试 OLE 解析（仅支持 Buffer）
    if (this.config.enableOleParser && Buffer.isBuffer(content)) {
      try {
        const doc = await this.parseWithOle(content, sourceUrl);
        if (doc) {
          doc.docFormat = 'ole';
          return doc;
        }
      } catch (error) {
        debug(`OLE 解析失败: ${String(error)}`);
      }
    }

    // 4. 降级：纯文本提取
    try {
      const doc = await this.extractPlainText(content, sourceUrl);
      if (doc) {
        doc.docFormat = 'plain';
        return doc;
      }
    } catch (error) {
      throw new ParseError(`所有解析方式都失败: ${error}`);
    }

    return null;
  }

  /**
   * 使用 mammoth 解析 DOCX
   */
  private async parseWithMammoth(
    content: Buffer | string,
    sourceUrl: string
  ): Promise<LawDocument | null> {
    let result: mammoth.ExtractRawResult;

    if (Buffer.isBuffer(content)) {
      result = await mammoth.extractRawText({ buffer: content });
    } else {
      // 文件路径
      result = await mammoth.extractRawText({ path: content });
    }

    const textContent = result.value;
    const paragraphs = textContent.split('\n').filter(p => p.trim());

    if (!paragraphs.length) {
      throw new ParseError('无法提取文本');
    }

    // 验证解析结果 - 检测"题注+条款列表"模式
    if (this.isParsingFailure(textContent)) {
      throw new ParseError('解析结果不完整 - 只提取了标题和目录');
    }

    const documentType = this.detectDocumentType(textContent, paragraphs);
    const parsed = await this.parseByStrategy(
      textContent,
      documentType,
      sourceUrl
    );

    return parsed;
  }

  /**
   * 检测解析失败 - "题注+条款列表"模式
   */
  private isParsingFailure(text: string): boolean {
    // 特征：包含"题注"或"第一条\n第二条"但内容很短
    const hasHeaders = text.includes('题注') || text.includes('第一条\n第二条');
    const isShort = text.length < 500;
    return hasHeaders && isShort;
  }

  /**
   * 直接解析 DOCX XML
   */
  private async parseWithXml(
    content: Buffer | string,
    sourceUrl: string
  ): Promise<LawDocument | null> {
    let xmlContent: Buffer;

    if (Buffer.isBuffer(content)) {
      // DOCX 是 ZIP 文件
      const zip = await jszip.loadAsync(content);
      let documentXml = zip.file('word/document.xml');

      if (!documentXml) {
        // 尝试其他可能的位置
        const files = Object.keys(zip.files);
        documentXml = files
          .filter(name => name.toLowerCase().includes('document'))
          .map(name => zip.file(name))[0];
      }

      if (!documentXml) {
        throw new ParseError('无法在 DOCX 中找到 document.xml');
      }

      const asyncContent = await documentXml.async('nodebuffer');
      xmlContent = asyncContent;
    } else {
      // 已经是 XML 字符串
      xmlContent = Buffer.from(content);
    }

    // 解析 XML
    const parser = new xml2js.Parser({ explicitArray: false });
    const root = await parser.parseStringPromise(xmlContent);

    // 提取文本 - 使用更强大的方法
    const textContent = this.extractTextFromXmlEnhanced(root);
    const paragraphs = textContent.split('\n').filter(p => p.trim());

    if (!paragraphs.length) {
      throw new ParseError('无法提取文本');
    }

    // 验证解析结果
    if (this.isParsingFailure(textContent)) {
      throw new ParseError('解析结果不完整 - 只提取了标题和目录');
    }

    const documentType = this.detectDocumentType(textContent, paragraphs);
    const parsed = await this.parseByStrategy(
      textContent,
      documentType,
      sourceUrl
    );

    return parsed;
  }

  /**
   * 从 XML 提取文本 - 增强版，支持旧格式
   */
  private extractTextFromXmlEnhanced(root: any): string {
    const textParts: string[] = [];

    const extractText = (element: any, depth: number = 0): void => {
      // 限制递归深度，防止栈溢出
      if (depth > 100) return;

      // 直接文本
      if (element.text && typeof element.text === 'string') {
        const text = element.text.trim();
        if (text.length > 0) {
          textParts.push(text);
        }
      }

      // 查找 w:t 标签（Word 文本标签）
      if (element['w:t'] || element.t) {
        const text = element['w:t'] || element.t;
        if (typeof text === 'string' && text.trim()) {
          textParts.push(text.trim());
        }
      }

      // 查找 w:r 标签（Word 文本运行）
      if (element['w:r'] || element.r) {
        const runs = Array.isArray(element['w:r'])
          ? element['w:r']
          : [element['w:r']];
        const runs2 = Array.isArray(element.r) ? element.r : [element.r];
        [...runs, ...runs2].forEach((run: any) => {
          if (run) extractText(run, depth + 1);
        });
      }

      // 查找 w:p 标签（Word 段落）
      if (element['w:p'] || element.p) {
        const paragraphs = Array.isArray(element['w:p'])
          ? element['w:p']
          : [element['w:p']];
        const paragraphs2 = Array.isArray(element.p) ? element.p : [element.p];
        [...paragraphs, ...paragraphs2].forEach((para: any) => {
          if (para) {
            const paraText = this.extractTextFromParagraph(para);
            if (paraText) {
              textParts.push(paraText);
            }
          }
        });
      }

      // 递归遍历子元素
      if (element.$$ && Array.isArray(element.$$)) {
        element.$$.forEach((child: any) => extractText(child, depth + 1));
      }

      // 查找所有可能的子元素
      for (const key of Object.keys(element)) {
        if (key !== '$$' && key !== '$' && key !== 'text') {
          const child = element[key];
          if (Array.isArray(child)) {
            child.forEach((c: any) => extractText(c, depth + 1));
          } else if (typeof child === 'object' && child !== null) {
            extractText(child, depth + 1);
          }
        }
      }
    };

    extractText(root);

    // 过滤空行和过短的行
    return textParts.filter(t => t.trim().length >= 2).join('\n');
  }

  /**
   * 从段落提取文本
   */
  private extractTextFromParagraph(para: any): string {
    const textParts: string[] = [];

    const extractFromRun = (run: any): void => {
      if (!run) return;

      // w:t 文本
      if (run['w:t'] || run.t) {
        const text = run['w:t'] || run.t;
        if (typeof text === 'string') {
          textParts.push(text);
        }
      }

      // 递归
      if (run['w:r'] || run.r) {
        const runs = Array.isArray(run['w:r']) ? run['w:r'] : [run['w:r']];
        const runs2 = Array.isArray(run.r) ? run.r : [run.r];
        [...runs, ...runs2].forEach((r: any) => extractFromRun(r));
      }

      if (run.$$ && Array.isArray(run.$$)) {
        run.$$.forEach((child: any) => extractFromRun(child));
      }
    };

    extractFromRun(para);

    return textParts.join('');
  }

  /**
   * 从 XML 提取文本
   */
  private __extractTextFromXml(root: any): string {
    const textParts: string[] = [];

    const extractText = (element: any): void => {
      if (element.text) {
        textParts.push(element.text);
      }
      if (element.$$ && Array.isArray(element.$$)) {
        element.$$.forEach((child: any) => extractText(child));
      }
    };

    extractText(root);

    // 过滤空行
    return textParts.filter(t => t.trim()).join('\n');
  }

  /**
   * 解析旧版 DOC 文件（OLE 格式）
   */
  private async parseWithOle(
    content: Buffer,
    sourceUrl: string
  ): Promise<LawDocument | null> {
    // 检查文件头确认是 OLE 格式
    if (content.length < 8) {
      throw new ParseError('文件太小，不是有效的 OLE 格式');
    }

    const header = content.subarray(0, 8).toString('hex');
    if (header !== 'd0cf11e0a1b11ae1') {
      throw new ParseError('不是有效的 OLE 格式');
    }

    // 尝试使用 catdoc 或 antiword
    let text: string | null = null;

    // 方法1: 使用 catdoc - 写入临时文件
    try {
      if (this.config.catdocPath) {
        const tempPath = path.join(os.tmpdir(), `temp_${Date.now()}.doc`);
        await fs.promises.writeFile(tempPath, content);

        try {
          const { stdout } = await execAsync(
            `${this.config.catdocPath} ${tempPath}`,
            { encoding: 'utf-8', timeout: 30000 }
          );
          text = stdout;
        } finally {
          // 清理临时文件
          try {
            await fs.promises.unlink(tempPath);
          } catch {
            // 忽略清理错误
          }
        }
      }
    } catch (error) {
      debug(`catdoc 执行失败: ${String(error)}`);
    }

    // 方法2: 使用 antiword
    if (!text || !text.trim()) {
      try {
        if (this.config.antiwordPath) {
          const tempPath = path.join(os.tmpdir(), `temp_${Date.now()}.doc`);
          await fs.promises.writeFile(tempPath, content);

          try {
            const { stdout } = await execAsync(
              `${this.config.antiwordPath} ${tempPath}`,
              { encoding: 'utf-8', timeout: 30000 }
            );
            text = stdout;
          } finally {
            // 清理临时文件
            try {
              await fs.promises.unlink(tempPath);
            } catch {
              // 忽略清理错误
            }
          }
        }
      } catch (error) {
        debug(`antiword 执行失败: ${String(error)}`);
      }
    }

    // 方法3: 手动提取文本（备选方案）
    if (!text || !text.trim()) {
      text = this.extractTextFromOleManual(content);
    }

    if (!text || !text.trim()) {
      throw new ParseError('无法从 OLE 文件提取文本');
    }

    const paragraphs = text.split('\n').filter(p => p.trim());
    const documentType = this.detectDocumentType(text, paragraphs);
    const parsed = await this.parseByStrategy(text, documentType, sourceUrl);

    return parsed;
  }

  /**
   * 从 OLE 二进制数据手动提取文本（备选方案）
   */
  private extractTextFromOleManual(data: Buffer): string {
    // 尝试 UTF-16LE 解码
    try {
      const text = data.toString('utf-16le', 0, data.length);
      const lines = text.split('\n').filter(l => l.trim().length > 5);
      if (lines.length > 0) {
        return lines.join('\n').substring(0, 50000);
      }
    } catch {
      // 继续尝试其他方法
    }

    // 尝试 UTF-8 解码
    try {
      const text = data.toString('utf-8', 0, data.length);
      const lines = text.split('\n').filter(l => l.trim().length > 5);
      if (lines.length > 0) {
        return lines.join('\n').substring(0, 50000);
      }
    } catch {
      // 继续
    }

    // 尝试 latin1 解码（可以捕获部分二进制数据中的文本）
    try {
      const text = data.toString('latin1', 0, data.length);
      const lines = text.split('\n').filter(l => l.trim().length > 5);
      return lines.join('\n').substring(0, 50000);
    } catch {
      return '';
    }
  }

  /**
   * 降级：提取纯文本
   */
  private async extractPlainText(
    content: Buffer | string,
    sourceUrl: string
  ): Promise<LawDocument> {
    let text: string;

    if (Buffer.isBuffer(content)) {
      // 尝试多种编码
      let decoded = false;
      const encodings: BufferEncoding[] = ['utf-8', 'latin1'];
      for (const encoding of encodings) {
        try {
          text = content.toString(encoding);
          // 检查是否包含有效内容
          if (text && text.trim().length > 0) {
            decoded = true;
            break;
          }
        } catch {
          // 继续尝试下一个编码
        }
      }
      if (!decoded) {
        // 最后尝试 latin1（可以解码任何字节）
        text = content.toString('latin1');
      }
    } else if (typeof content === 'string') {
      text = content;
    } else {
      throw new ParseError(`无法解析的内容类型: ${typeof content}`);
    }

    // 清理 HTML 标签
    text = text.replace(/<[^>]+>/g, '');

    // 提取文本块
    const paragraphs = text
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .slice(0, 500);

    if (!paragraphs.length) {
      throw new ParseError('无法提取任何文本');
    }

    const fullText = paragraphs.join('\n');
    const documentType = this.detectDocumentType(fullText, paragraphs);
    const parsed = await this.parseByStrategy(
      fullText,
      documentType,
      sourceUrl
    );

    return parsed;
  }

  /**
   * 检测文档类型
   */
  private detectDocumentType(
    textContent: string,
    paragraphs: string[]
  ): DocumentType {
    const title = paragraphs[0] || '';

    // 文号检测
    const docNumberPatterns: Record<DocumentType, RegExp[]> = {
      [DocumentType.JUDICIAL_INTERPRETATION]: [
        /法释\[\d+\]\s*\d+号/,
        /法释字\[\d+\]\s*\d+号/,
      ],
      [DocumentType.LAW]: [/中华人民共和国.*法/],
      [DocumentType.REGULATION]: [/国务院令第\d+号/, /\d+号\s*国务院令/],
      [DocumentType.LOCAL_RULE]: [],
      [DocumentType.DEPARTMENTAL_RULE]: [],
      [DocumentType.REPLY]: [],
      [DocumentType.OPINION]: [],
      [DocumentType.INTERPRETATION]: [],
      [DocumentType.MEASURE]: [],
      [DocumentType.REGULATION_DOC]: [],
      [DocumentType.DECISION]: [],
      [DocumentType.OTHER]: [],
    };

    for (const [docType, patterns] of Object.entries(docNumberPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(textContent)) {
          return docType as DocumentType;
        }
      }
    }

    // 标题检测
    for (const [docType, patterns] of Object.entries(this.typePatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(title)) {
          return docType as DocumentType;
        }
      }
    }

    return DocumentType.OTHER;
  }

  /**
   * 三层解析策略
   */
  private async parseByStrategy(
    textContent: string,
    documentType: DocumentType,
    sourceUrl: string
  ): Promise<LawDocument | null> {
    // 策略1: 正则表达式
    try {
      const parsed = this.parseByRegex(textContent, documentType, sourceUrl);
      if (parsed) {
        return parsed;
      }
    } catch (error) {
      debug(`正则解析失败: ${String(error)}`);
    }

    // 策略2: 模式识别
    try {
      const parsed = this.parseByPattern(textContent, documentType, sourceUrl);
      if (parsed) {
        return parsed;
      }
    } catch (error) {
      debug(`模式解析失败: ${String(error)}`);
    }

    // 策略3: AI 辅助（如果启用）
    if (this.config.aiEnabled && this.config.aiApiKey) {
      try {
        const parsed = await this.parseByAI(
          textContent,
          documentType,
          sourceUrl
        );
        if (parsed) {
          return parsed;
        }
      } catch (error) {
        warn(`AI 解析失败: ${String(error)}`);
      }
    }

    return null;
  }

  /**
   * 正则表达式解析
   */
  private parseByRegex(
    textContent: string,
    documentType: DocumentType,
    sourceUrl: string
  ): LawDocument | null {
    const patterns: Record<string, RegExp> = {
      title: /^(.+?)(?:\n|$)/,
      documentNumber: /(?:文号|发文字号|编号)[:：\s]*([^\n]+)/,
      publishDate:
        /(?:发布日期|公布日期|发布时间)[:：\s]*(\d{4}[-年]\d{1,2}[-月]\d{1,2}日?)/,
      effectiveDate:
        /(?:生效日期|施行日期|实施日期)[:：\s]*(\d{4}[-年]\d{1,2}[-月]\d{1,2}日?)/,
      issuingAuthority: /(?:发布机关|发布单位|发文机关)[:：\s]*([^\n]+)/,
    };

    const result: Record<string, string> = {};
    for (const [field, pattern] of Object.entries(patterns)) {
      const match = pattern.exec(textContent);
      if (match) {
        result[field] = match[1].trim();
      }
    }

    if (!result.title) {
      throw new ParseError('无法提取标题');
    }

    const sourceHash = crypto
      .createHash('md5')
      .update(textContent)
      .digest('hex');

    return {
      sourceId: sourceHash.substring(0, 16),
      sourceUrl,
      title: result.title || '',
      documentNumber: result.documentNumber || '',
      documentType,
      category: this.inferCategory(result.title || ''),
      issuingAuthority: result.issuingAuthority || '未知',
      publishDate: result.publishDate || '',
      effectiveDate: result.effectiveDate || '',
      fullText: textContent.substring(0, 100000), // 限制长度
      amendments: [],
      sourceHash,
      crawledAt: new Date().toISOString(),
      parseStatus: 'success',
      retryCount: 0,
      docFormat: '',
    };
  }

  /**
   * 模式识别解析
   */
  private parseByPattern(
    textContent: string,
    documentType: DocumentType,
    sourceUrl: string
  ): LawDocument | null {
    const lines = textContent
      .split('\n')
      .map(l => l.trim())
      .filter(l => l);

    if (!lines.length) {
      throw new ParseError('文档为空');
    }

    const title = lines[0];
    const metadata: Record<string, string> = {};

    for (const line of lines.slice(1, 50)) {
      // 日期模式
      const dateMatch = /(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/.exec(line);
      if (dateMatch && !metadata.publishDate) {
        metadata.publishDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      }

      // 发布机关模式
      const authorityMatch = /(.+?)(?:令|发|公布)/.exec(line);
      if (authorityMatch && !metadata.issuingAuthority) {
        const authority = authorityMatch[1].trim();
        if (authority.length < 20) {
          metadata.issuingAuthority = authority;
        }
      }

      // 文号模式
      const numberMatch = /((?:法释|国发|司发)?\[\d+\]\s*\d+号?)/.exec(line);
      if (numberMatch && !metadata.documentNumber) {
        metadata.documentNumber = numberMatch[1];
      }
    }

    const sourceHash = crypto
      .createHash('md5')
      .update(textContent)
      .digest('hex');

    return {
      sourceId: sourceHash.substring(0, 16),
      sourceUrl,
      title,
      documentNumber: metadata.documentNumber || '',
      documentType,
      category: this.inferCategory(title),
      issuingAuthority: metadata.issuingAuthority || '未知',
      publishDate: metadata.publishDate || '',
      effectiveDate: metadata.publishDate || '',
      fullText: textContent.substring(0, 100000),
      amendments: [],
      sourceHash,
      crawledAt: new Date().toISOString(),
      parseStatus: 'success',
      retryCount: 0,
      docFormat: '',
    };
  }

  /**
   * AI 辅助解析
   */
  private async parseByAI(
    textContent: string,
    documentType: DocumentType,
    sourceUrl: string
  ): Promise<LawDocument | null> {
    if (!this.config.aiApiKey) {
      throw new ParseError('AI API 密钥未配置');
    }

    // 动态导入 OpenAI（避免在非 AI 模式下加载）
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: this.config.aiApiKey });

    const prompt = `
从以下法律文档中提取结构化信息，返回 JSON 格式：

文档类型: ${documentType}
文档内容（前2000字符）: ${textContent.substring(0, 2000)}

提取字段:
- title: 文档标题
- document_number: 文号
- publish_date: 发布日期 (YYYY-MM-DD)
- effective_date: 生效日期 (YYYY-MM-DD)
- issuing_authority: 发布机关

只返回 JSON，不要其他内容。
`;

    const response = await client.chat.completions.create({
      model: this.config.aiModel || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new ParseError('AI 返回为空');
    }

    const data = JSON.parse(content);
    const sourceHash = crypto
      .createHash('md5')
      .update(textContent)
      .digest('hex');

    return {
      sourceId: sourceHash.substring(0, 16),
      sourceUrl,
      title: data.title || '',
      documentNumber: data.document_number || '',
      documentType,
      category: this.inferCategory(data.title || ''),
      issuingAuthority: data.issuing_authority || '未知',
      publishDate: data.publish_date || '',
      effectiveDate: data.effective_date || '',
      fullText: textContent.substring(0, 100000),
      amendments: [],
      sourceHash,
      crawledAt: new Date().toISOString(),
      parseStatus: 'success',
      retryCount: 0,
      docFormat: '',
    };
  }

  /**
   * 推断法律类别
   */
  private inferCategory(title: string): LawCategory {
    const lowerTitle = title.toLowerCase();

    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      for (const keyword of keywords) {
        if (lowerTitle.includes(keyword.toLowerCase())) {
          return category as LawCategory;
        }
      }
    }

    return LawCategory.OTHER;
  }
}

/**
 * 解析错误类
 */
export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * 可重试错误类
 */
export class RetryableError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'RetryableError';
    this.statusCode = statusCode;
  }
}

/**
 * 默认解析器实例
 */
export const docxParser = new DOCXParser();
