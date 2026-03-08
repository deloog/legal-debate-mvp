/**
 * 调试脚本 - 分析SAMR网站当前结构
 */

import { Browser, chromium } from 'playwright';

async function main() {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // 设置更长超时
    page.setDefaultTimeout(60000);

    console.log('='.repeat(70));
    console.log('分析 SAMR 合同服务网结构');
    console.log('='.repeat(70));
    console.log();

    // 1. 访问首页
    console.log('1. 访问 htsfwb.samr.gov.cn 首页...');
    await page.goto('https://htsfwb.samr.gov.cn/', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    console.log('   标题:', await page.title());
    console.log();

    // 2. 获取页面所有链接
    console.log('2. 获取页面所有链接...');
    const allLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      return links
        .map(a => ({
          href: a.getAttribute('href'),
          text: a.textContent?.trim().substring(0, 50),
        }))
        .filter(l => l.href && l.href.includes('samr.gov.cn'));
    });

    console.log(`   找到 ${allLinks.length} 个相关链接`);
    console.log('   示例链接:');
    allLinks.slice(0, 10).forEach((link, i) => {
      console.log(`   ${i + 1}. ${link.text} -> ${link.href}`);
    });
    console.log();

    // 3. 尝试找到合同相关的链接
    console.log('3. 查找合同相关链接...');
    const contractLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      return links
        .filter(a => {
          const href = a.getAttribute('href') || '';
          const text = a.textContent?.trim().toLowerCase() || '';
          return (
            href.includes('View') ||
            text.includes('合同') ||
            text.includes('示范')
          );
        })
        .map(a => ({
          href: a.getAttribute('href'),
          text: a.textContent?.trim().substring(0, 100),
        }));
    });

    console.log(`   找到 ${contractLinks.length} 个可能合同链接`);
    contractLinks.slice(0, 10).forEach((link, i) => {
      console.log(`   ${i + 1}. ${link.text} -> ${link.href}`);
    });
    console.log();

    // 4. 分析页面结构 - 查找列表容器
    console.log('4. 分析页面结构...');
    const containers = await page.evaluate(() => {
      const selectors = [
        '.contract-list',
        '.contract-item',
        '.list-item',
        '.table',
        'table',
        '.grid',
        '.card',
        '[class*="list"]',
        '[class*="contract"]',
        '[class*="item"]',
      ];

      const results: string[] = [];
      for (const sel of selectors) {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) {
          results.push(`${sel}: ${elements.length}个`);
        }
      }
      return results;
    });

    console.log('   找到的容器:');
    containers.forEach(c => console.log(`   - ${c}`));
    console.log();

    // 5. 尝试获取页面内容预览
    console.log('5. 页面HTML预览 (前3000字符):');
    const html = await page.content();
    console.log(html.substring(0, 3000));
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
