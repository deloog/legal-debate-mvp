/**
 * 测试脚本：分析 cont.12315.cn 网站API结构
 * 用途：探索新数据源的API端点和数据格式
 */

const BASE_URL = 'https://cont.12315.cn';
const OUTPUT_DIR = 'data/crawled/12315-test';

async function testEndpoint(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/html, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': BASE_URL,
        ...options.headers,
      },
      signal: AbortSignal.timeout(30000),
    });

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      return { ok: response.ok, status: response.status, data };
    } else {
      const text = await response.text();
      return { ok: response.ok, status: response.status, data: { html: text.substring(0, 500) } };
    }
  } catch (error) {
    return { ok: false, status: 0, error: String(error) };
  }
}

async function analyzeApiStructure() {
  console.log('=== 分析 cont.12315.cn 网站API结构 ===\n');

  const results = {};

  // 1. 测试主页
  console.log('1. 测试主页...');
  const homeResult = await testEndpoint(BASE_URL);
  results['home'] = {
    url: BASE_URL,
    method: 'GET',
    description: '网站主页',
    status: homeResult.ok ? 'success' : 'failed',
    response: homeResult.data,
    error: homeResult.error,
  };
  console.log(`   状态: ${homeResult.ok ? '✓ 成功' : '✗ 失败'} (${homeResult.status})`);

  // 2. 测试URL规律: View页面
  console.log('\n2. 测试View页面URL规律...');
  const testIds = ['WTT20240612001', 'HT20240101001', 'test-001', '1001', '2024'];
  for (const id of testIds) {
    const url = `${BASE_URL}/View?id=${id}`;
    const result = await testEndpoint(url);
    results[`view-${id}`] = {
      url,
      method: 'GET',
      description: `View页面?id=${id}`,
      status: result.ok ? 'success' : 'failed',
      response: result.data,
      error: result.error,
    };
    console.log(`   ${id}: ${result.ok ? '✓' : '✗'} (${result.status})`);
  }

  // 3. 猜测可能的API端点
  console.log('\n3. 测试可能的API端点...');

  const possibleEndpoints = [
    // 合同列表API
    { url: `${BASE_URL}/api/contract/list`, method: 'POST', desc: '合同列表API' },
    { url: `${BASE_URL}/api/contracts`, method: 'GET', desc: '合同列表' },
    { url: `${BASE_URL}/api/list`, method: 'POST', desc: '通用列表API' },
    { url: `${BASE_URL}/api/templates`, method: 'GET', desc: '模板列表' },
    { url: `${BASE_URL}/api/template/list`, method: 'POST', desc: '模板列表' },

    // 详情API
    { url: `${BASE_URL}/api/contract/detail?id=WTT20240612001`, method: 'GET', desc: '合同详情API' },
    { url: `${BASE_URL}/api/detail?id=WTT20240612001`, method: 'GET', desc: '详情API' },
    { url: `${BASE_URL}/api/template?id=WTT20240612001`, method: 'GET', desc: '模板详情' },

    // 分类API
    { url: `${BASE_URL}/api/category/list`, method: 'GET', desc: '分类列表' },
    { url: `${BASE_URL}/api/categories`, method: 'GET', desc: '分类' },
    { url: `${BASE_URL}/api/types`, method: 'GET', desc: '类型' },

    // 下载API
    { url: `${BASE_URL}/api/download?id=WTT20240612001&format=docx`, method: 'GET', desc: '下载DOCX' },
    { url: `${BASE_URL}/api/download?id=WTT20240612001&format=pdf`, method: 'GET', desc: '下载PDF' },
    { url: `${BASE_URL}/api/export?id=WTT20240612001`, method: 'GET', desc: '导出' },

    // 搜索API
    { url: `${BASE_URL}/api/search?keyword=劳动合同`, method: 'GET', desc: '搜索' },
    { url: `${BASE_URL}/api/search`, method: 'POST', desc: '搜索Post' },
  ];

  for (const endpoint of possibleEndpoints) {
    const result = await testEndpoint(endpoint.url, { method: endpoint.method });
    results[endpoint.url] = {
      url: endpoint.url,
      method: endpoint.method,
      description: endpoint.desc,
      status: result.ok ? 'success' : 'failed',
      response: result.data,
      error: result.error,
    };
    console.log(`   ${endpoint.desc}: ${result.ok ? '✓' : '✗'} ${endpoint.url}`);
  }

  // 4. 保存结果
  console.log('\n4. 保存分析结果...');
  const outputPath = `${OUTPUT_DIR}/api-analysis.json`;
  await import('fs').then(fs => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const summary = {
      baseUrl: BASE_URL,
      analyzedAt: new Date().toISOString(),
      results: Object.values(results).map(r => ({
        url: r.url,
        method: r.method,
        description: r.description,
        status: r.status,
        hasData: !!r.response,
        hasError: !!r.error,
      })),
    };
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
  });
  console.log(`   结果已保存到: ${outputPath}`);

  // 5. 总结
  console.log('\n=== 分析结果总结 ===');
  const successCount = Object.values(results).filter(r => r.status === 'success').length;
  const totalCount = Object.values(results).length;
  console.log(`成功: ${successCount}/${totalCount}`);

  const successfulApis = Object.values(results).filter(r => r.status === 'success');
  if (successfulApis.length > 0) {
    console.log('\n可用的API端点:');
    for (const api of successfulApis) {
      console.log(`  - ${api.method} ${api.url}`);
      console.log(`    ${api.description}`);
    }
  } else {
    console.log('\n未发现可用的API端点。');
    console.log('建议使用浏览器开发者工具手动检查网络请求。');
  }
}

// 运行分析
analyzeApiStructure()
  .then(() => {
    console.log('\n分析完成!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('分析失败:', error);
    process.exit(1);
  });
