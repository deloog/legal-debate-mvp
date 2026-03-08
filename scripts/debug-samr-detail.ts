/**
 * 调试脚本 - 分析SAMR详情页结构
 */

import { Browser, chromium } from 'playwright';

async function main() {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.setDefaultTimeout(60000);

    console.log('='.repeat(70));
    console.log('分析 SAMR 合同详情页结构');
    console.log('='.repeat(70));
    console.log();

    // 访问一个详情页
    const detailUrl =
      'https://htsfwb.samr.gov.cn/View?id=ea53524e-0970-4806-adeb-d98332f7d397';
    console.log('1. 访问详情页:', detailUrl);
    await page.goto(detailUrl, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    console.log('   标题:', await page.title());
    console.log();

    // 获取页面所有链接
    console.log('2. 获取页面所有链接...');
    const allLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      return links
        .map(a => ({
          href: a.getAttribute('href'),
          text: a.textContent?.trim().substring(0, 100),
          class: a.getAttribute('class'),
        }))
        .filter(l => l.href);
    });

    console.log(`   找到 ${allLinks.length} 个链接`);
    console.log('   示例链接:');
    allLinks.slice(0, 20).forEach((link, i) => {
      console.log(`   ${i + 1}. [${link.class}] ${link.text} -> ${link.href}`);
    });
    console.log();

    // 查找可能的下载链接
    console.log('3. 查找可能的下载链接...');
    const downloadLinks = allLinks.filter(
      l =>
        l.href.includes('.doc') ||
        l.href.includes('.docx') ||
        l.href.includes('.pdf') ||
        l.text?.toLowerCase().includes('word') ||
        l.text?.toLowerCase().includes('下载') ||
        l.text?.toLowerCase().includes('doc')
    );

    console.log(`   找到 ${downloadLinks.length} 个可能下载链接`);
    downloadLinks.forEach((link, i) => {
      console.log(`   ${i + 1}. ${link.text} -> ${link.href}`);
    });
    console.log();

    // 获取页面HTML
    console.log('4. 页面HTML预览 (前5000字符):');
    const html = await page.content();
    console.log(html.substring(0, 5000));
    console.log();

    console.log('='.repeat(70));
    console.log('分析完成');
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
