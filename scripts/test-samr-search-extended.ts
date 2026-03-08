/**
 * 调试脚本 - 测试SAMR搜索功能和分页
 */

/// <reference lib="dom" />

import { Browser, chromium } from 'playwright';

const KEYWORDS = [
  '买卖',
  '租赁',
  '建设',
  '服务',
  '运输',
  '承揽',
  '委托',
  '合作',
  '借款',
  '担保',
  '保险',
  '房地产',
  '广告',
  '物业',
  '公用事业',
  '劳动合同',
  '技术合同',
];

async function testSearchKeyword(
  browser: Browser,
  keyword: string
): Promise<number> {
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  try {
    await page.goto('https://htsfwb.samr.gov.cn/', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // 关闭弹窗
    try {
      const closeBtn = await page.$('.samr-modal-close');
      if (closeBtn) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    } catch {
      // ignore
    }

    // 使用搜索框搜索
    const searchInput = await page.$('#search-box');
    if (searchInput) {
      await searchInput.fill(keyword);
      await page.waitForTimeout(500);

      const searchBtn = await page.$('.search-btn');
      if (searchBtn) {
        await searchBtn.click();
        await page.waitForTimeout(3000);
      }
    }

    // 获取搜索结果
    const results = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href*="/View?id="]')
      );
      return links
        .map(a => ({
          href: a.getAttribute('href'),
          text: a.textContent?.trim(),
        }))
        .filter((l): l is { href: string; text: string } =>
          Boolean(l.href && l.text)
        );
    });

    // 检查分页
    const hasNextPage = await page.$('a:has-text("下一页")');

    // 如果有分页，获取更多
    if (hasNextPage) {
      // 尝试获取总页数信息
      const pageInfo = await page.evaluate(() => {
        const pagination = document.querySelector<HTMLElement>(
          '.pagination, .page-list, [class*="page"]'
        );
        return pagination?.textContent || '';
      });
      console.log(`   分页信息: ${pageInfo}`);
    }

    console.log(`   关键词 "${keyword}": ${results.length} 个结果`);
    if (results.length > 0) {
      console.log(`   第一个: ${results[0].text?.substring(0, 40)}`);
    }

    return results.length;
  } finally {
    await page.close();
  }
}

async function main() {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });

    console.log('='.repeat(70));
    console.log('测试 SAMR 搜索功能 - 多关键词');
    console.log('='.repeat(70));
    console.log();

    const results: Record<string, number> = {};
    let totalContracts = 0;

    for (const keyword of KEYWORDS) {
      try {
        const count = await testSearchKeyword(browser!, keyword);
        results[keyword] = count;
        totalContracts += count;

        // 避免请求过快
        await new Promise(r => setTimeout(r, 1000));
      } catch (error) {
        console.error(`   关键词 "${keyword}" 出错:`, error);
        results[keyword] = 0;
      }
    }

    console.log();
    console.log('='.repeat(70));
    console.log('搜索结果汇总');
    console.log('='.repeat(70));

    for (const [keyword, count] of Object.entries(results)) {
      if (count > 0) {
        console.log(`  ${keyword}: ${count} 个`);
      }
    }

    console.log();
    console.log(`总计: 约 ${totalContracts} 个合同模板`);
    console.log('='.repeat(70));
  } catch (error) {
    console.error('错误:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main().catch(console.error);
