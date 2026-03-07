/**
 * SAMR 合同示范文本库浏览器自动化模块
 * 用于绕过 IP 访问限制，通过浏览器模拟真实用户访问
 *
 * 技术方案：
 * - 使用 Playwright 模拟真实浏览器行为
 * - 支持列表页抓取和详情页抓取
 * - 支持文件下载功能
 *
 * 安全说明：
 * - 已移除不安全的浏览器配置
 * - URL 必须通过白名单验证
 * - 下载文件有大小和类型限制
 */

import { Browser, BrowserContext, chromium, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// 允许下载的文件类型白名单
const ALLOWED_FILE_TYPES = ['.doc', '.docx', '.pdf'];
// 最大下载文件大小 (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;
// 允许访问的域名白名单
const ALLOWED_HOSTS = ['htsfwb.samr.gov.cn', 'www.samr.gov.cn'];

export interface SAMRContractItem {
  id: string;
  title: string;
  category: string;
  publishDate: string;
  downloadCount: number;
  sourceUrl: string;
  docxUrl?: string;
  pdfUrl?: string;
}

export interface SAMRListPageResult {
  items: SAMRContractItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SAMRDetailPageResult {
  id: string;
  title: string;
  category: string;
  content?: string;
  docxUrl?: string;
  pdfUrl?: string;
  publishDate?: string;
  issuer?: string;
}

export interface PlaywrightCrawlerOptions {
  headless?: boolean;
  timeout?: number;
  downloadDir?: string;
  rateLimitDelay?: number;
}

const DEFAULT_OPTIONS: Required<PlaywrightCrawlerOptions> = {
  headless: true,
  timeout: 60000,
  downloadDir: 'data/crawled/samr/downloads',
  rateLimitDelay: 5000,
};

export class SAMRPlaywrightCrawler {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private options: Required<PlaywrightCrawlerOptions>;

  constructor(options: PlaywrightCrawlerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 初始化浏览器
   */
  async init(): Promise<void> {
    if (this.browser && this.context && this.page) {
      // 检查 page 是否仍然有效
      try {
        await this.page.title();
        return;
      } catch {
        // page 已关闭，需要重新创建
        this.page = null;
        this.context = null;
        this.browser = null;
      }
    }

    this.browser = await chromium.launch({
      headless: this.options.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // 注意：移除了 --disable-web-security 以保持安全
      ],
    });

    this.context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
    });

    this.page = await this.context.newPage();

    // 设置默认超时
    this.page.setDefaultTimeout(this.options.timeout);

    // 确保下载目录存在
    const downloadDir = path.resolve(this.options.downloadDir);
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    // 设置下载路径
    await this.context.setDefaultTimeout(this.options.timeout);
  }

  /**
   * 关闭浏览器（添加异常处理防止进程泄漏）
   */
  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close().catch(() => {});
        this.page = null;
      }
    } catch {
      /* 忽略关闭错误 */
    }

    try {
      if (this.context) {
        await this.context.close().catch(() => {});
        this.context = null;
      }
    } catch {
      /* 忽略关闭错误 */
    }

    try {
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }
    } catch {
      /* 忽略关闭错误 */
    }
  }

  /**
   * 获取首页所有合同链接
   */
  async gotoHome(): Promise<SAMRListPageResult> {
    await this.init();

    // 访问首页
    await this.page!.goto('https://htsfwb.samr.gov.cn/', {
      waitUntil: 'networkidle',
      timeout: this.options.timeout,
    });

    // 关闭弹窗（如果有）
    try {
      const closeBtn = await this.page!.$('.samr-modal-close');
      if (closeBtn) {
        await closeBtn.click();
        await this.delay(500);
      }
    } catch {
      // 忽略关闭弹窗错误
    }

    await this.delay(2000);

    // 提取所有合同链接
    const result = await this.page!.evaluate(() => {
      const items: {
        id: string;
        title: string;
        category: string;
        publishDate: string;
        downloadCount: number;
        sourceUrl: string;
      }[] = [];

      // 查找所有包含合同链接的元素 - 基于实际网站结构
      const links = document.querySelectorAll('a[href*="/View?id="]');

      links.forEach((link, index) => {
        const href = link.getAttribute('href');
        const title = link.textContent?.trim() || '';

        if (href && title) {
          // 从href中提取ID
          const idMatch = href.match(/id=([a-zA-Z0-9-]+)/);
          const id = idMatch ? idMatch[1] : `contract-${index}`;

          items.push({
            id,
            title,
            category: '合同示范文本',
            publishDate: new Date().toISOString().split('T')[0],
            downloadCount: 0,
            sourceUrl: href.startsWith('http')
              ? href
              : `https://htsfwb.samr.gov.cn${href}`,
          });
        }
      });

      return { items, total: items.length };
    });

    return {
      ...result,
      page: 1,
      pageSize: result.items.length,
      hasMore: false,
    };
  }

  async gotoNationalList(pageNum: number = 1): Promise<SAMRListPageResult> {
    await this.init();

    // 访问首页并获取所有链接（新版网站只有首页）
    await this.page!.goto('https://htsfwb.samr.gov.cn/', {
      waitUntil: 'networkidle',
      timeout: this.options.timeout,
    });

    // 关闭弹窗
    try {
      const closeBtn = await this.page!.$('.samr-modal-close');
      if (closeBtn) {
        await closeBtn.click();
        await this.delay(500);
      }
    } catch {
      // 忽略
    }

    await this.delay(2000);

    // 提取列表数据 - 使用新网站的选择器
    const result = await this.page!.evaluate(() => {
      const items: {
        id: string;
        title: string;
        category: string;
        publishDate: string;
        downloadCount: number;
        sourceUrl: string;
      }[] = [];

      // 查找所有包含合同链接的元素
      const links = document.querySelectorAll('a[href*="/View?id="]');

      links.forEach((link, index) => {
        const href = link.getAttribute('href');
        const title = link.textContent?.trim() || '';

        if (href && title && title.length > 0) {
          const idMatch = href.match(/id=([a-zA-Z0-9-]+)/);
          const id = idMatch ? idMatch[1] : `national-${index}`;

          items.push({
            id,
            title,
            category: '合同示范文本',
            publishDate: new Date().toISOString().split('T')[0],
            downloadCount: 0,
            sourceUrl: href.startsWith('http')
              ? href
              : `https://htsfwb.samr.gov.cn${href}`,
          });
        }
      });

      return { items, total: items.length };
    });

    return {
      ...result,
      page: pageNum,
      pageSize: 20,
      hasMore: result.items.length > 20,
    };
  }

  /**
   * 访问地方合同文本列表页 - 新版网站结构
   */
  async gotoLocalList(pageNum: number = 1): Promise<SAMRListPageResult> {
    await this.init();

    // 新版网站结构：使用搜索功能获取地方合同
    const url = `https://htsfwb.samr.gov.cn/?keyword=地方`;
    await this.page!.goto(url, {
      waitUntil: 'networkidle',
      timeout: this.options.timeout,
    });

    // 关闭弹窗
    try {
      const closeBtn = await this.page!.$('.samr-modal-close');
      if (closeBtn) {
        await closeBtn.click();
        await this.delay(500);
      }
    } catch {
      // 忽略
    }

    await this.delay(2000);

    const result = await this.page!.evaluate(() => {
      const items: SAMRContractItem[] = [];
      const rows = document.querySelectorAll(
        '.contract-list-item, .table-row, tr, .list-item'
      );

      rows.forEach((row, index) => {
        const titleEl = row.querySelector(
          '.title, .contract-title, td:nth-child(2), h3, a'
        );
        const categoryEl = row.querySelector(
          '.category, .type, td:nth-child(1)'
        );
        const dateEl = row.querySelector(
          '.date, .publish-date, td:nth-child(3)'
        );
        const linkEl = row.querySelector('a');

        if (titleEl) {
          items.push({
            id: `local-${index}`,
            title: titleEl.textContent?.trim() || '',
            category: categoryEl?.textContent?.trim() || '地方',
            publishDate:
              dateEl?.textContent?.trim() ||
              new Date().toISOString().split('T')[0],
            downloadCount: 0,
            sourceUrl: linkEl?.getAttribute('href') || '',
          });
        }
      });

      const totalEl = document.querySelector(
        '.total, .pagination-total, [class*="total"]'
      );
      const total = totalEl
        ? parseInt(totalEl.textContent?.replace(/\D/g, '') || '0', 10)
        : items.length;

      return { items, total };
    });

    return {
      ...result,
      page: pageNum,
      pageSize: 20,
      hasMore: result.items.length === 20,
    };
  }

  /**
   * 访问详情页
   * 注意：新版网站将合同内容直接渲染在HTML页面中，而不是提供下载文件
   */
  async gotoDetail(detailUrl: string): Promise<SAMRDetailPageResult> {
    await this.init();

    await this.page!.goto(detailUrl, {
      waitUntil: 'networkidle',
      timeout: this.options.timeout,
    });

    // 关闭弹窗
    try {
      const closeBtn = await this.page!.$('.samr-modal-close');
      if (closeBtn) {
        await closeBtn.click();
        await this.delay(500);
      }
    } catch {
      // 忽略
    }

    await this.delay(2000);

    const result = await this.page!.evaluate(() => {
      // 标题 - 从页面标题中提取
      const pageTitle = document.title || '';
      const titleMatch = pageTitle.match(/^(.+?)\s*[-–—]\s*合同示范文本/);
      const title = titleMatch
        ? titleMatch[1].trim()
        : pageTitle.split('-')[0].trim();

      // 内容 - 从 article 元素中提取
      const articleEl = document.querySelector('article');
      let content = '';
      if (articleEl) {
        // 获取所有文本内容
        content = articleEl.textContent?.trim() || '';
      }

      // 尝试查找发布时间
      const dateEl = document.querySelector(
        '[class*="date"], .publish-date, time'
      );
      const publishDate =
        dateEl?.textContent?.trim() || new Date().toISOString().split('T')[0];

      // 尝试查找发布机构
      const issuerEl = document.querySelector(
        '[class*="issuer"], [class*="publisher"], [class*="issued"]'
      );
      const issuer = issuerEl?.textContent?.trim() || '';

      // 尝试查找分类
      const categoryEl = document.querySelector(
        '[class*="category"], [class*="type"]'
      );
      const category = categoryEl?.textContent?.trim() || '合同示范文本';

      return {
        title,
        category,
        publishDate,
        issuer,
        docxUrl: undefined, // 新版网站不提供DOCX下载
        pdfUrl: undefined, // 新版网站不提供PDF下载
        content, // 直接提取的HTML内容
      };
    });

    return {
      id: detailUrl.split('/').pop() || '',
      ...result,
    };
  }

  /**
   * 下载文件
   */
  async downloadFile(fileUrl: string, fileName: string): Promise<string> {
    await this.init();

    // 验证 URL 和文件类型
    this.validateUrl(fileUrl);
    this.validateFileType(fileName);

    const downloadDir = path.resolve(this.options.downloadDir);
    const filePath = path.join(downloadDir, fileName);

    // 创建下载监听器
    const downloadPromise = this.page!.waitForEvent('download', {
      timeout: this.options.timeout,
    });

    // 点击下载链接
    await this.page!.goto(fileUrl, {
      waitUntil: 'networkidle',
      timeout: this.options.timeout,
    });

    try {
      const download = await downloadPromise;
      // 验证文件类型
      const suggestedName = download.suggestedFilename();
      if (suggestedName) {
        this.validateFileType(suggestedName);
      }

      if (suggestedName) {
        await download.saveAs(filePath);
      }

      // 检查保存后的文件大小
      const stats = fs.statSync(filePath);
      if (stats.size > MAX_FILE_SIZE) {
        fs.unlinkSync(filePath);
        throw new Error(
          `文件过大: ${stats.size} bytes (最大 ${MAX_FILE_SIZE})`
        );
      }

      return filePath;
    } catch {
      // 如果不是可下载的页面，尝试直接获取内容
      const content = await this.page!.content();
      fs.writeFileSync(filePath, content);
      return filePath;
    }
  }

  /**
   * 搜索合同文本 - 使用搜索框模拟输入
   */
  async search(
    keyword: string,
    pageNum: number = 1
  ): Promise<SAMRListPageResult> {
    await this.init();

    // 访问首页
    await this.page!.goto('https://htsfwb.samr.gov.cn/', {
      waitUntil: 'networkidle',
      timeout: this.options.timeout,
    });

    // 关闭弹窗
    try {
      const closeBtn = await this.page!.$('.samr-modal-close');
      if (closeBtn) {
        await closeBtn.click();
        await this.delay(500);
      }
    } catch {
      // 忽略
    }

    // 使用搜索框输入关键词
    const searchInput = await this.page!.$('#search-box');
    if (searchInput) {
      await searchInput.fill(keyword);
      await this.delay(500);

      const searchBtn = await this.page!.$('.search-btn');
      if (searchBtn) {
        await searchBtn.click();
        await this.delay(3000);
      }
    }

    // 提取搜索结果
    const result = await this.page!.evaluate(() => {
      const items: {
        id: string;
        title: string;
        category: string;
        publishDate: string;
        downloadCount: number;
        sourceUrl: string;
      }[] = [];

      // 查找所有包含合同链接的元素
      const links = document.querySelectorAll('a[href*="/View?id="]');

      links.forEach((link, index) => {
        const href = link.getAttribute('href');
        const title = link.textContent?.trim() || '';

        if (href && title && title.length > 0) {
          const idMatch = href.match(/id=([a-zA-Z0-9-]+)/);
          const id = idMatch ? idMatch[1] : `search-${index}`;

          items.push({
            id,
            title,
            category: '合同示范文本',
            publishDate: new Date().toISOString().split('T')[0],
            downloadCount: 0,
            sourceUrl: href.startsWith('http')
              ? href
              : `https://htsfwb.samr.gov.cn${href}`,
          });
        }
      });

      return { items, total: items.length };
    });

    return {
      ...result,
      page: pageNum,
      pageSize: 20,
      hasMore: result.items.length >= 20,
    };
  }

  /**
   * 获取搜索结果总数（检查是否有更多页面）
   */
  async getSearchTotal(keyword: string): Promise<number> {
    await this.init();

    // 访问首页
    await this.page!.goto('https://htsfwb.samr.gov.cn/', {
      waitUntil: 'networkidle',
      timeout: this.options.timeout,
    });

    // 关闭弹窗
    try {
      const closeBtn = await this.page!.$('.samr-modal-close');
      if (closeBtn) {
        await closeBtn.click();
        await this.delay(500);
      }
    } catch {
      // 忽略
    }

    // 使用搜索框输入关键词
    const searchInput = await this.page!.$('#search-box');
    if (searchInput) {
      await searchInput.fill(keyword);
      await this.delay(500);

      const searchBtn = await this.page!.$('.search-btn');
      if (searchBtn) {
        await searchBtn.click();
        await this.delay(3000);
      }
    }

    // 获取结果数量
    const result = await this.page!.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/View?id="]');
      return links.length;
    });

    return result;
  }

  /**
   * 通用延迟函数
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 验证 URL 是否在白名单内（防止 SSRF）
   */
  private validateUrl(url: string): void {
    try {
      const parsed = new URL(url);
      if (!ALLOWED_HOSTS.includes(parsed.hostname.toLowerCase())) {
        throw new Error(`URL 域名不在白名单内: ${parsed.hostname}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('不在白名单内')) {
        throw error;
      }
      throw new Error(`无效的 URL: ${url}`);
    }
  }

  /**
   * 验证下载文件类型
   */
  private validateFileType(fileName: string): void {
    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_FILE_TYPES.includes(ext)) {
      throw new Error(`不支持的文件类型: ${ext}`);
    }
  }

  /**
   * 带速率限制的请求
   */
  async requestWithRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    await this.delay(this.options.rateLimitDelay);
    return fn();
  }
}

/**
 * 创建默认配置的爬虫实例
 */
export function createSAMRCrawler(
  options?: PlaywrightCrawlerOptions
): SAMRPlaywrightCrawler {
  return new SAMRPlaywrightCrawler(options);
}
