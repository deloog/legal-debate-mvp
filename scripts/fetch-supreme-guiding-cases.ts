/**
 * 最高人民法院指导性案例 Playwright 爬虫
 *
 * 抓取 court.gov.cn 官网全部指导性案例，提取：
 *   - 案例编号、名称、批次、发布年份
 *   - 裁判要旨
 *   - 相关法条（法律名称 + 条文号）
 *
 * 输出：scripts/data/supreme-guiding-cases-fetched.json
 *
 * 运行方式：
 *   npx ts-node --project scripts/tsconfig.json scripts/fetch-supreme-guiding-cases.ts
 *
 * 注意：需在可访问 court.gov.cn 的网络环境下运行
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium, Page } from '@playwright/test';

// eslint-disable-next-line no-console
const log = (msg: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

interface GuidingCaseArticle {
  lawName: string;
  articleNumber: string;
}

interface GuidingCase {
  caseNumber: string;
  name: string;
  batch: number;
  year: number;
  keyPrinciple: string;
  articles: GuidingCaseArticle[];
  sourceUrl?: string;
}

// 法条引用正则：匹配 "第XXX条" 前的法律名称
const LAW_ARTICLE_PATTERN = /《([^》]+)》第([一二三四五六七八九十百千零]+)条/g;

// 中文数字 → "第X条" 格式（用于规范化）
function normalizeArticleNumber(chineseNum: string): string {
  return `第${chineseNum}条`;
}

// 从页面文本中提取法条引用
function extractArticleRefs(text: string): GuidingCaseArticle[] {
  const articles: GuidingCaseArticle[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  // 重置 lastIndex
  LAW_ARTICLE_PATTERN.lastIndex = 0;

  while ((match = LAW_ARTICLE_PATTERN.exec(text)) !== null) {
    const lawName = match[1].trim();
    const articleNumber = normalizeArticleNumber(match[2].trim());
    const key = `${lawName}::${articleNumber}`;
    if (!seen.has(key)) {
      seen.add(key);
      articles.push({ lawName, articleNumber });
    }
  }

  return articles;
}

// 从文本提取批次号
function extractBatch(text: string): number {
  const m = text.match(/第(\d+)批/);
  return m ? parseInt(m[1], 10) : 0;
}

// 从案例编号提取序号（"指导案例3号" → 3）
function extractCaseSeq(caseNumber: string): number {
  const m = caseNumber.match(/(\d+)号/);
  return m ? parseInt(m[1], 10) : 0;
}

async function scrapeCaseListPage(page: Page, url: string): Promise<{ title: string; url: string }[]> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // 抓取列表中所有指导案例链接
  const items = await page.evaluate(() => {
    const links: { title: string; url: string }[] = [];
    // court.gov.cn 典型列表结构：<ul class="news-list"> <li> <a>
    const anchors = document.querySelectorAll('a[href]');
    anchors.forEach(a => {
      const text = a.textContent?.trim() ?? '';
      const href = (a as HTMLAnchorElement).href;
      // 指导案例链接特征：包含"指导案例"或"号"
      if ((text.includes('指导案例') || text.match(/\d+号/)) && href) {
        links.push({ title: text, url: href });
      }
    });
    return links;
  });

  return items;
}

async function scrapeCaseDetail(page: Page, url: string): Promise<Partial<GuidingCase>> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const content = await page.evaluate(() => {
      // 获取主体内容区域
      const mainEl = document.querySelector('.article-content, .content, #articleContent, main, article') ??
                     document.body;
      return mainEl?.innerText ?? '';
    });

    // 提取案例编号
    const numMatch = content.match(/(指导案例\s*\d+\s*号)/);
    const caseNumber = numMatch ? numMatch[1].replace(/\s+/g, '') : '';

    // 提取裁判要旨
    const principleMatch = content.match(/裁判要旨[：:]\s*([^\n]+(?:\n(?!关键词|相关法条|基本案情|裁判结果)[^\n]+)*)/);
    const keyPrinciple = principleMatch
      ? principleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 500)
      : '';

    // 提取年份
    const yearMatch = content.match(/(\d{4})年/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

    // 提取批次
    const batch = extractBatch(content);

    // 提取法条引用
    const articles = extractArticleRefs(content);

    // 提取案例名称（通常是页面标题或第一个大标题）
    const titleEl = await page.$('h1, h2, .article-title, .title');
    const name = titleEl ? (await titleEl.textContent())?.trim() ?? '' : caseNumber;

    return { caseNumber, name, batch, year, keyPrinciple, articles, sourceUrl: url };
  } catch (e) {
    log(`  抓取详情失败: ${url} — ${e}`);
    return {};
  }
}

async function fetchFromCourtGov(): Promise<GuidingCase[]> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results: GuidingCase[] = [];

  try {
    // 官网指导性案例列表（多页）
    const LIST_URLS = [
      'https://www.court.gov.cn/shenpan-gengduo-77.html',
      'https://www.court.gov.cn/fabu-gengduo-77.html',
    ];

    let caseLinks: { title: string; url: string }[] = [];

    for (const listUrl of LIST_URLS) {
      try {
        log(`  尝试列表页: ${listUrl}`);
        const links = await scrapeCaseListPage(page, listUrl);
        if (links.length > 0) {
          caseLinks = [...caseLinks, ...links];
          log(`  获取到 ${links.length} 个案例链接`);
          break;
        }
      } catch {
        log(`  列表页不可用: ${listUrl}`);
      }
    }

    // 去重
    const seen = new Set<string>();
    caseLinks = caseLinks.filter(l => {
      if (seen.has(l.url)) return false;
      seen.add(l.url);
      return true;
    });

    log(`  共找到 ${caseLinks.length} 个案例链接，开始抓取详情...`);

    for (let i = 0; i < caseLinks.length; i++) {
      const link = caseLinks[i];
      log(`  [${i + 1}/${caseLinks.length}] ${link.title}`);

      const detail = await scrapeCaseDetail(page, link.url);
      if (detail.caseNumber && detail.articles && detail.articles.length > 0) {
        results.push({
          caseNumber: detail.caseNumber,
          name: detail.name ?? link.title,
          batch: detail.batch ?? 0,
          year: detail.year ?? 0,
          keyPrinciple: detail.keyPrinciple ?? '',
          articles: detail.articles,
          sourceUrl: link.url,
        });
      }

      // 礼貌延迟
      await page.waitForTimeout(500);
    }
  } finally {
    await browser.close();
  }

  return results;
}

async function main() {
  const outPath = path.join(__dirname, 'data', 'supreme-guiding-cases-fetched.json');

  log('开始抓取最高人民法院指导性案例...');

  let cases: GuidingCase[] = [];

  try {
    cases = await fetchFromCourtGov();
    log(`抓取完成，共获取 ${cases.length} 个有效案例`);
  } catch (e) {
    log(`抓取失败: ${e}`);
    log('请检查网络是否可访问 court.gov.cn');
    process.exit(1);
  }

  if (cases.length === 0) {
    log('未抓取到任何案例，请检查网站结构是否变更');
    process.exit(1);
  }

  // 按案例编号排序
  cases.sort((a, b) => extractCaseSeq(a.caseNumber) - extractCaseSeq(b.caseNumber));

  fs.writeFileSync(outPath, JSON.stringify(cases, null, 2), 'utf-8');
  log(`已保存至: ${outPath}`);
  log('接下来运行：npx ts-node --project scripts/tsconfig.json scripts/import-data/import-supreme-guiding-cases.ts');
}

main().catch(err => {
  log(`FATAL: ${err}`);
  process.exit(1);
});
