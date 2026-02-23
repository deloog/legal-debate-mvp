/**
 * 分析 samr.gov.cn 网站结构
 * 查找合同示范文本入口和数据结构
 * 使用原生 fetch (无需额外依赖)
 */

// 声明为模块以避免重复函数名冲突
export {};

const SAMR_BASE_URL = 'https://www.samr.gov.cn';
const HTSFWB_URL = 'https://htsfwb.samr.gov.cn';

interface PageInfo {
  url: string;
  status: number;
  accessible: boolean;
  title?: string;
  links: Array<{ url: string; text: string }>;
}

async function fetchPage(url: string): Promise<PageInfo> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });

    const html = await response.text();
    const links: Array<{ url: string; text: string }> = [];

    // 简单解析HTML链接
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const text = match[2].trim();
      if (href && text && text.length > 2) {
        // 补全相对路径
        let fullUrl = href;
        if (!href.startsWith('http')) {
          fullUrl = href.startsWith('/')
            ? `${SAMR_BASE_URL}${href}`
            : `${SAMR_BASE_URL}/${href}`;
        }
        links.push({ url: fullUrl, text });
      }
    }

    // 提取标题
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    return {
      url,
      status: response.status,
      accessible: response.ok,
      title,
      links: links.slice(0, 100), // 限制链接数量
    };
  } catch (error: any) {
    console.error(`获取页面失败: ${url} - ${error.message}`);
    return {
      url,
      status: 0,
      accessible: false,
      links: [],
    };
  }
}

async function analyzeHomepage(): Promise<void> {
  console.log('='.repeat(60));
  console.log('分析 samr.gov.cn 首页');
  console.log('='.repeat(60));

  const page = await fetchPage(SAMR_BASE_URL);

  console.log(
    `状态: ${page.status} (${page.accessible ? '✅ 可访问' : '❌ 不可访问'})`
  );
  console.log(`标题: ${page.title || 'N/A'}`);

  // 查找合同相关链接
  const contractLinks = page.links.filter(
    link =>
      link.text.includes('合同') ||
      link.text.includes('示范文本') ||
      link.text.includes('模板') ||
      link.url.includes('htsfwb') ||
      link.url.includes('contract')
  );

  console.log(`\n找到 ${contractLinks.length} 个合同相关链接:`);
  contractLinks.slice(0, 15).forEach((link, index) => {
    console.log(
      `  ${index + 1}. [${link.text}](${link.url.substring(0, 80)}...)`
    );
  });
}

async function analyzeHtsfwb(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('分析 htsfwb.samr.gov.cn (合同服务网)');
  console.log('='.repeat(60));

  const page = await fetchPage(HTSFWB_URL);

  console.log(
    `状态: ${page.status} (${page.accessible ? '✅ 可访问' : '❌ 不可访问'})`
  );
  console.log(`标题: ${page.title || 'N/A'}`);

  if (page.accessible) {
    console.log('\n页面链接示例:');
    page.links.slice(0, 10).forEach((link, index) => {
      const displayText = link.text.substring(0, 30);
      const displayUrl = link.url.substring(0, 60);
      console.log(`  ${index + 1}. ${displayText}: ${displayUrl}...`);
    });
  }
}

async function findContractTemplates(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('搜索合同示范文本相关页面');
  console.log('='.repeat(60));

  const urls = [
    { name: 'SAMR首页', url: SAMR_BASE_URL },
    { name: '合同服务网', url: HTSFWB_URL },
    { name: '合同服务网首页', url: `${HTSFWB_URL}/index.html` },
  ];

  for (const { name, url } of urls) {
    const page = await fetchPage(url);
    console.log(`\n${name}:`);
    console.log(`  状态: ${page.status} (${page.accessible ? '✅' : '❌'})`);
    if (page.accessible) {
      console.log(`  标题: ${page.title}`);
    }
  }
}

async function testCrawlEndpoint(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('测试采集端点');
  console.log('='.repeat(60));

  const testUrls = [
    `${SAMR_BASE_URL}/api/contract/list`,
    `${HTSFWB_URL}/api/htlb/list`,
    `${SAMR_BASE_URL}/search?q=合同`,
  ];

  for (const url of testUrls) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      console.log(`\n${url}`);
      console.log(`  状态: ${response.status}`);
      console.log(`  类型: ${response.headers.get('content-type')}`);

      if (response.ok) {
        const text = await response.text();
        console.log(`  内容预览: ${text.substring(0, 200)}...`);
      }
    } catch (error: any) {
      console.log(`\n${url}`);
      console.log(`  错误: ${error.message}`);
    }
  }
}

async function main(): Promise<void> {
  console.log('SAMR网站结构分析工具');
  console.log(`时间: ${new Date().toISOString()}`);
  console.log('');

  await analyzeHomepage();
  await analyzeHtsfwb();
  await findContractTemplates();
  await testCrawlEndpoint();

  console.log('\n' + '='.repeat(60));
  console.log('分析完成');
  console.log('='.repeat(60));
}

main().catch((error) => console.error(error));
