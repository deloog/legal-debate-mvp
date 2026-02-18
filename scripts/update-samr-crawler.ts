/**
 * SAMR采集器更新脚本
 * 2026-02-18: 将数据源从 cont.12315.cn 切换到 samr.gov.cn
 */

import * as fs from 'fs';
import * as path from 'path';

const CRAWLER_FILE = 'src/lib/crawler/samr-crawler.ts';

interface Update {
  oldString: string;
  newString: string;
}

const updates: Update[] = [
  // 1. 更新注释说明
  {
    oldString: `/**
 * 国家市场监督管理总局合同示范文本库采集器
 * 数据源:
 * - 主要: https://cont.12315.cn/ (12315.cn 合同模板库)
 * - 备用: https://htsfwb.samr.gov.cn/ (SAMR官网)
 *
 * URL规律:
 * - 列表页: https://cont.12315.cn/list (或分类页面)
 * - 详情页: https://cont.12315.cn/View?id=xxxxx
 *
 * 采集策略：
 * 1. 访问全国合同示范文本库
 * 2. 获取合同文本列表及分类
 * 3. 采集合同模板内容、条款结构、风险提示
 *
 * 注意：由于网站API可能不稳定，本采集器支持：
 * - 真实API模式（当网站可用时）
 * - 模拟数据模式（用于开发和测试）
 */`,
    newString: `/**
 * 国家市场监督管理总局合同示范文本库采集器
 * 数据源:
 * - 主要: https://www.samr.gov.cn/ (国家市场监督管理总局官网)
 * - 备用: https://htsfwb.samr.gov.cn/ (合同服务网)
 *
 * URL规律:
 * - 合同示范文本库入口: samr.gov.cn 相关页面
 * - 详情页: samr.gov.cn/View?id=xxxxx
 *
 * 采集策略：
 * 1. 访问国家市场监督管理总局官网
 * 2. 获取合同文本列表及分类
 * 3. 采集合同模板内容、条款结构、风险提示
 *
 * 注意：由于网站API可能不稳定，本采集器支持：
 * - 真实API模式（当网站可用时）
 * - 模拟数据模式（用于开发和测试）
 *
 * 更新记录 (2026-02-18):
 * - cont.12315.cn 无法访问(DNS解析失败)
 * - 切换到 samr.gov.cn 作为主要数据源
 */`,
  },
  // 2. 更新配置
  {
    oldString: `// 数据源配置
export const SAMR_CONFIG = {
  name: 'SAMRCrawler',
  // 主要数据源: 12315.cn 合同模板库
  baseUrl: 'https://cont.12315.cn',
  apiBaseUrl: 'https://cont.12315.cn',
  // 备用数据源: SAMR官网
  fallbackBaseUrl: 'https://htsfwb.samr.gov.cn',
  fallbackApiBase: 'https://htsfwb.samr.gov.cn',
  source: 'samr' as ContractTemplateSource,
  requestTimeout: 30000,
  maxRetries: 3,
  rateLimitDelay: 2000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};`,
    newString: `// 数据源配置
export const SAMR_CONFIG = {
  name: 'SAMRCrawler',
  // 主要数据源: 国家市场监督管理总局官网 (2026-02-18 更新)
  // 由于 cont.12315.cn 无法访问，切换到 samr.gov.cn
  baseUrl: 'https://www.samr.gov.cn',
  apiBaseUrl: 'https://www.samr.gov.cn',
  // 备用数据源: 合同服务网
  fallbackBaseUrl: 'https://htsfwb.samr.gov.cn',
  fallbackApiBase: 'https://htsfwb.samr.gov.cn',
  source: 'samr' as ContractTemplateSource,
  requestTimeout: 30000,
  maxRetries: 3,
  rateLimitDelay: 2000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};`,
  },
  // 3. 更新模板注释
  {
    oldString: `/**
 * 基于已知SAMR合同示范文本的完整列表
 * 数据来源：国家市场监督管理总局全国合同示范文本库公开信息
 * 新地址: https://cont.12315.cn/
 * URL规律: https://cont.12315.cn/View?id=xxxxx
 */`,
    newString: `/**
 * 基于已知SAMR合同示范文本的完整列表
 * 数据来源：国家市场监督管理总局全国合同示范文本库公开信息
 * 数据源: https://www.samr.gov.cn (2026-02-18 更新)
 * 备用: https://htsfwb.samr.gov.cn
 */`,
  },
  // 4. 更新类定义
  {
    oldString: `export class SAMRCrawler extends BaseCrawler {
  // 主要数据源: 12315.cn
  private readonly PRIMARY_API_BASE = 'https://cont.12315.cn';
  // 备用数据源: SAMR官网
  private readonly FALLBACK_API_BASE = 'https://htsfwb.samr.gov.cn';
  private readonly DEFAULT_OUTPUT_DIR = path.resolve('data/crawled/samr');`,
    newString: `export class SAMRCrawler extends BaseCrawler {
  // 主要数据源: samr.gov.cn (2026-02-18 更新)
  private readonly PRIMARY_API_BASE = 'https://www.samr.gov.cn';
  // 备用数据源: 合同服务网
  private readonly FALLBACK_API_BASE = 'https://htsfwb.samr.gov.cn';
  private readonly DEFAULT_OUTPUT_DIR = path.resolve('data/crawled/samr');`,
  },
];

async function applyUpdates(): Promise<void> {
  console.log('开始更新 SAMR 采集器...\n');

  const filePath = path.resolve(CRAWLER_FILE);
  console.log(`读取文件: ${filePath}`);

  let content = fs.readFileSync(filePath, 'utf-8');
  let updateCount = 0;

  for (const update of updates) {
    if (content.includes(update.oldString)) {
      content = content.replace(update.oldString, update.newString);
      updateCount++;
      console.log(`✅ 更新 ${updateCount}: 成功`);
    } else {
      console.log(`⚠️  更新 ${updateCount + 1}: 未找到匹配内容`);
    }
  }

  // 批量替换 URL
  const urlCount = (content.match(/cont\.12315\.cn/g) || []).length;
  if (urlCount > 0) {
    content = content.replace(/https:\/\/cont\.12315\.cn\//g, 'https://www.samr.gov.cn/');
    console.log(`✅ 替换了 ${urlCount} 个 cont.12315.cn URL`);
  }

  // 写入文件
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`\n✅ 更新完成！共应用 ${updateCount + (urlCount > 0 ? 1 : 0)} 个更改`);

  // 验证更新
  const updatedContent = fs.readFileSync(filePath, 'utf-8');
  const hasSamr = updatedContent.includes('www.samr.gov.cn');
  const hasOld = updatedContent.includes('cont.12315.cn');

  console.log(`\n验证结果:`);
  console.log(`  - 包含新数据源 (samr.gov.cn): ${hasSamr ? '✅' : '❌'}`);
  console.log(`  - 旧数据源已替换: ${!hasOld ? '✅' : '❌'}`);
}

applyUpdates().catch(console.error);
