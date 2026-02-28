/**
 * SAMR合同模板API测试脚本
 * 分析国家市场监督管理总局合同示范文本库API结构
 * 数据源: https://htsfwb.samr.gov.cn/
 */

import * as fs from 'fs';
import * as path from 'path';

const SAMR_BASE_URL = 'https://htsfwb.samr.gov.cn';

// User-Agent池
const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function randomUA(): string {
  return UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 3
): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': randomUA(),
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          Referer: SAMR_BASE_URL,
          Origin: SAMR_BASE_URL,
          ...options?.headers,
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return response.json();
      }
      return { text: await response.text() };
    } catch (error) {
      lastError = error as Error;
      console.log(`  尝试 ${attempt}/${maxRetries} 失败: ${error}`);
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000;
        console.log(`  等待 ${waitTime}ms 后重试...`);
        await delay(waitTime);
      }
    }
  }

  throw lastError;
}

async function analyzeAPI(): Promise<void> {
  console.log('='.repeat(70));
  console.log('SAMR合同示范文本库 API 分析');
  console.log('='.repeat(70));
  console.log();

  const outputDir = path.resolve('data/crawled/samr-api-test');
  fs.mkdirSync(outputDir, { recursive: true });

  const results: Record<string, any> = {
    analyzedAt: new Date().toISOString(),
    baseUrl: SAMR_BASE_URL,
    endpoints: {},
  };

  // 测试可能的API端点
  const possibleEndpoints = [
    // 可能的合同列表API
    '/api/contract/list',
    '/api/htlb/list',
    '/api/template/list',
    '/contract/list',
    '/htlb/list',
    '/api/v1/contracts',
    '/api/v1/templates',
    // 网站页面结构探测
    '',
    '/htlb',
    '/contract',
    '/template',
    // 可能的分页查询API
    '/api/list',
    '/api/page',
    '/search',
  ];

  console.log('1. 测试可能的API端点...');
  console.log();

  for (const endpoint of possibleEndpoints) {
    const url = `${SAMR_BASE_URL}${endpoint}`;
    console.log(`  测试: ${endpoint || '(根路径)'}`);

    try {
      const response = await fetchWithRetry(url, { method: 'GET' });
      results.endpoints[endpoint || 'root'] = {
        status: 'reachable',
        responseType: typeof response,
        sample:
          typeof response === 'object'
            ? JSON.stringify(response).substring(0, 500)
            : response,
      };
      console.log(`    ✓ 可访问`);
    } catch (error) {
      results.endpoints[endpoint || 'root'] = {
        status: 'error',
        error: String(error),
      };
      console.log(`    ✗ 失败: ${error}`);
    }

    await delay(1000);
  }

  console.log();
  console.log('2. 分析页面结构...');

  // 尝试获取首页，分析页面中的API调用
  try {
    const response = await fetchWithRetry(SAMR_BASE_URL, { method: 'GET' });
    const html = typeof response === 'string' ? response : '';

    // 查找页面中的JavaScript API调用
    const apiPatterns = [
      /api["']?\s*:\s*["']?([^"'\s,}]+)/gi,
      /URL\s*[=:]\s*["']?([^"'\s,}]+api[^"'\s,}]*)/gi,
      /fetch\s*\(\s*["']([^"']+)["']/gi,
      /axios\s*\.\s*get\s*\(\s*["']([^"']+)["']/gi,
    ];

    const foundApis: string[] = [];
    for (const pattern of apiPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && !foundApis.includes(match[1])) {
          foundApis.push(match[1]);
        }
      }
    }

    results.pageAnalysis = {
      hasContent: html.length > 0,
      contentLength: html.length,
      foundApis,
    };

    console.log(`  页面长度: ${html.length} 字符`);
    console.log(`  发现的API模式: ${foundApis.length} 个`);
  } catch (error) {
    results.pageAnalysis = {
      status: 'error',
      error: String(error),
    };
  }

  console.log();
  console.log('3. 尝试常见的数据查询参数格式...');

  // 可能的搜索/列表API参数
  const searchPayloads = [
    { pageNum: 1, pageSize: 10, category: '' },
    { pageNo: 1, pageSize: 10 },
    { current: 1, size: 10 },
    { pn: 1, ps: 10 },
    { page: 1, limit: 10 },
  ];

  const searchEndpoints = [
    '/api/htlb/list',
    '/api/contract/list',
    '/api/search',
    '/list',
  ];

  for (const endpoint of searchEndpoints) {
    for (const payload of searchPayloads) {
      const url = `${SAMR_BASE_URL}${endpoint}`;
      console.log(`  POST ${endpoint}`, payload);

      try {
        const response = await fetchWithRetry(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        results.endpoints[`${endpoint}-POST`] = {
          status: 'reachable',
          payload,
          response:
            typeof response === 'object'
              ? JSON.stringify(response).substring(0, 500)
              : response,
        };
        console.log(`    ✓ 响应: ${typeof response}`);
      } catch (error) {
        // 忽略错误，继续测试
      }

      await delay(1000);
    }
  }

  console.log();
  console.log('4. 分析可能的分类接口...');

  // 合同分类
  const categories = [
    '劳动',
    '买卖',
    '租赁',
    '借款',
    '建设',
    '服务',
    '知识产权',
  ];
  for (const category of categories) {
    const url = `${SAMR_BASE_URL}/api/htlb/list?category=${encodeURIComponent(category)}`;
    console.log(`  分类 ${category}:`);

    try {
      const response = await fetchWithRetry(url);
      console.log(`    ✓ 响应类型: ${typeof response}`);
    } catch (error) {
      console.log(`    ✗ ${error}`);
    }

    await delay(500);
  }

  // 保存结果
  const outputPath = path.join(outputDir, 'api-analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log();
  console.log('='.repeat(70));
  console.log(`分析完成！结果已保存到: ${outputPath}`);
  console.log('='.repeat(70));
}

async function main(): Promise<void> {
  try {
    await analyzeAPI();
  } catch (error) {
    console.error('分析过程中发生错误:', error);
    process.exit(1);
  }
}

main();
