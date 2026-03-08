/**
 * 调试脚本 - 测试SAMR搜索功能
 */

import { Browser, chromium } from 'playwright';

async function main() {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.setDefaultTimeout(60000);

    console.log('='.repeat(70));
    console.log('测试 SAMR 搜索功能');
    console.log('='.repeat(70));
    console.log();

    // 1. 访问首页
    console.log('1. 访问首页...');
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
    } catch {}

    console.log('   标题:', await page.title());
    console.log();

    // 2. 测试搜索功能
    console.log('2. 测试搜索功能 - 搜索"买卖"...');

    // 方法1: 使用搜索框
    const searchInput = await page.$('#search-box');
    if (searchInput) {
      await searchInput.fill('买卖');
      await page.waitForTimeout(500);

      // 点击搜索按钮
      const searchBtn = await page.$('.search-btn');
      if (searchBtn) {
        await searchBtn.click();
        await page.waitForTimeout(3000);
      }
    }

    console.log('   搜索后标题:', await page.title());

    // 获取搜索结果
    const searchResults = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll('a[href*="/View?id="]')
      );
      return links
        .map(a => ({
          href: a.getAttribute('href'),
          text: a.textContent?.trim().substring(0, 50),
        }))
        .filter(l => l.href && l.text);
    });

    console.log(`   找到 ${searchResults.length} 个搜索结果`);
    searchResults.slice(0, 10).forEach((link, i) => {
      console.log(`   ${i + 1}. ${link.text} -> ${link.href}`);
    });
    console.log();

    // 3. 测试关键词点击
    console.log('3. 测试关键词点击...');
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
    } catch {}

    // 点击"买卖"关键词
    const keywordLink = await page.$('a:has-text("买卖")');
    if (keywordLink) {
      await keywordLink.click();
      await page.waitForTimeout(3000);
    }

    console.log('   关键词点击后标题:', await page.title());

    const keywordResults = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll('a[href*="/View?id="]')
      );
      return links
        .map(a => ({
          href: a.getAttribute('href'),
          text: a.textContent?.trim().substring(0, 50),
        }))
        .filter(l => l.href && l.text);
    });

    console.log(`   找到 ${keywordResults.length} 个结果`);
    keywordResults.slice(0, 10).forEach((link, i) => {
      console.log(`   ${i + 1}. ${link.text} -> ${link.href}`);
    });
    console.log();

    console.log('='.repeat(70));
    console.log('测试完成');
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
