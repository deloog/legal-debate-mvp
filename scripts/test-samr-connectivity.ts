/**
 * 测试SAMR合同示范文本库连通性
 * 更新记录 (2026-02-18):
 * - cont.12315.cn 无法访问 (DNS解析失败)
 * - 切换到 samr.gov.cn 作为主要数据源
 */

import axios from 'axios';

const TEST_URLS = [
  // 主要数据源: samr.gov.cn 官网
  'https://www.samr.gov.cn/',
  // 合同服务网
  'https://htsfwb.samr.gov.cn/',
  // 旧数据源 (已失效)
  'https://cont.12315.cn/',
];

async function testConnection(url: string): Promise<{ url: string; status: number; accessible: boolean; error?: string }> {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      validateStatus: () => true, // 允许任何状态码
    });
    return {
      url,
      status: response.status,
      accessible: response.status < 500, // 5xx视为不可访问
    };
  } catch (error: any) {
    return {
      url,
      status: 0,
      accessible: false,
      error: error.message,
    };
  }
}

async function main() {
  console.log('================================');
  console.log('SAMR合同示范文本库连通性测试');
  console.log('========================================\n');

  for (const url of TEST_URLS) {
    console.log(`测试: ${url}`);
    const result = await testConnection(url);
    console.log(`  状态: ${result.status || 'N/A'}`);
    console.log(`  可访问: ${result.accessible ? '✅' : '❌'}`);
    if (result.error) {
      console.log(`  错误: ${result.error}`);
    }
    console.log('');
  }

  console.log('========================================');
}

main().catch(console.error);
