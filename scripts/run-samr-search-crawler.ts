/**
 * SAMR合同示范文本库搜索采集器
 * 使用搜索功能获取所有合同模板
 *
 * 运行方式: npx tsx scripts/run-samr-search-crawler.ts
 */

/// <reference lib="dom" />

import * as fs from 'fs';
import * as path from 'path';
import { Browser, chromium } from 'playwright';

// 搜索关键词列表 - 扩展版本，覆盖更多分类
const KEYWORDS = [
  // 基础关键词
  '买卖',
  '租赁',
  '建设',
  '服务',
  '运输',
  '承揽',
  '委托',
  '担保',
  '保险',
  '房地产',
  '广告',
  '物业',
  // 劳动人事 (重要遗漏)
  '劳动',
  '聘用',
  '劳务',
  '派遣',
  '竞业',
  '实习',
  '退休',
  '人事',
  '劳动合同',
  '雇佣',
  // 技术与知识产权
  '技术',
  '专利',
  '商标',
  '著作权',
  '软件',
  '开发',
  '转让',
  '知识产权',
  // 金融
  '借款',
  '贷款',
  '抵押',
  '质押',
  '股权',
  '债权',
  '金融',
  '投资',
  // 农林与土地
  '农村',
  '农业',
  '土地',
  '林地',
  '承包',
  '养殖',
  '种植',
  // 能源
  '电力',
  '煤炭',
  '石油',
  '天然气',
  '能源',
  '矿产',
  // 旅游与服务
  '旅游',
  '餐饮',
  '住宿',
  '健身',
  '美容',
  '医疗',
  // 地方合同 - 34个省级行政区
  '北京',
  '上海',
  '天津',
  '重庆',
  '广东',
  '江苏',
  '浙江',
  '山东',
  '河南',
  '四川',
  '湖北',
  '湖南',
  '河北',
  '福建',
  '安徽',
  '陕西',
  '辽宁',
  '江西',
  '云南',
  '山西',
  '广西',
  '贵州',
  '吉林',
  '黑龙江',
  '内蒙古',
  '新疆',
  '甘肃',
  '海南',
  '宁夏',
  '青海',
  '西藏',
  '省会',
  '市区',
  '县级',
  '城镇',
  '乡村',
  // 政府采购与招标投标
  '招标',
  '投标',
  '中标',
  '采购',
  '招标代理',
  '竞争性',
  '询价',
  '框架协议',
  '政府采购',
  // 教育培训
  '培训',
  '校外培训',
  '托管',
  '幼儿园',
  '学历教育',
  '职业培训',
  '技能培训',
  '家教',
  // 文化体育旅游
  '演出',
  '展览',
  '场馆',
  '景区',
  '旅行社',
  '体育',
  '健身',
  '游泳',
  '电影',
  // 市政与公用事业
  '供水',
  '供气',
  '供热',
  '污水处理',
  '垃圾处理',
  '公共交通',
  '路灯',
  '园林',
  '绿化',
  '市政',
  // 医疗卫生
  '药品',
  '医疗器械',
  '诊所',
  '医院',
  '药店',
  '保健品',
  '防疫',
  '疫苗',
  // 邮政通信
  '邮政',
  '电信',
  '快递',
  '物流',
  '宽带',
  '通讯',
  // 安全生产
  '安全',
  '生产',
  '应急',
  '救援',
  '消防',
  '防汛',
  '危险化学品',
  '矿山',
  // 环境保护
  '环保',
  '环境',
  '节能',
  '减排',
  '碳排放',
  '再生能源',
  '资源综合利用',
  // 市场监管
  '消费者',
  '行业协会',
  '商会',
  '个体工商户',
  '企业',
  // 综合类
  '示范文本',
  '格式合同',
  '备案',
  '登记',
  '认定',
  '资质',
  '许可',
  '特许经营',
  // 深度调研补充 - 数据经济
  '数据提供',
  '数据委托',
  '数据融合',
  '数据中介',
  '数据流通',
  // 深度调研补充 - 养老与消费
  '养老机构',
  '养老服务',
  '预付式消费',
  '家庭服务',
  '家居装饰',
  '装修施工',
  // 深度调研补充 - 民法典新增
  '物业服务',
  '中介合同',
  '委托合同',
  '保管合同',
  '保理',
  // 深度调研补充 - 能源电力
  '购售电',
  '并网调度',
  '储能电站',
  '新能源',
  // 深度调研补充 - 房地产
  '商品房买卖',
  '新建商品房',
  '存量房',
  // 深度调研补充 - 农业农村
  '土地承包',
  '土地流转',
  '经营权流转',
  '订单农业',
  '农业托管',
  '农机作业',
  // 深度调研补充 - 知识产权
  '专利许可',
  '商标许可',
  '技术秘密',
  // 深度调研补充 - 交通运输
  '网约车',
  '网络货运',
  '多式联运',
  '客运',
  '货运',
  '船舶',
  '航空',
  // 深度调研补充 - 文化体育
  '运动员',
  '经纪',
  '场馆租赁',
  '文艺演出',
  '出版',
  '发行',
  '版权',
  '影视',
  // 深度调研补充 - 地方特色
  '黑龙江',
  '山东',
  '杭州',
  '深圳',
  // GF编号
  'GF-2025',
  'GF-2026',
];

// 数据输出目录
const OUTPUT_DIR = 'data/crawled/samr-search';
const TEMP_DIR = path.join(OUTPUT_DIR, 'temp');

// 合同项接口
interface ContractItem {
  id: string;
  title: string;
  category: string;
  publishDate: string;
  downloadCount: number;
  sourceUrl: string;
}

// 确保目录存在
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 随机延迟
function randomDelay(min: number = 2000, max: number = 5000): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 保存已采集的URL集合（用于去重）
async function loadCollectedUrls(): Promise<Set<string>> {
  const filePath = path.join(OUTPUT_DIR, 'collected-urls.json');
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf-8');
    return new Set(JSON.parse(data));
  }
  return new Set();
}

// 保存已采集的URL集合
async function saveCollectedUrls(urls: Set<string>): Promise<void> {
  const filePath = path.join(OUTPUT_DIR, 'collected-urls.json');
  fs.writeFileSync(filePath, JSON.stringify([...urls], null, 2));
}

// 保存采集结果
async function saveResults(
  keyword: string,
  items: ContractItem[],
  outputDir: string
): Promise<void> {
  const filePath = path.join(outputDir, `${keyword}-results.json`);
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2));
}

// 搜索功能 - 与samr-playwright.ts中相同
async function searchWithKeyword(
  page: import('playwright').Page,
  keyword: string
): Promise<ContractItem[]> {
  // 访问首页
  await page.goto('https://htsfwb.samr.gov.cn/', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });

  // 关闭弹窗
  try {
    const closeBtn = await page.$('.samr-modal-close');
    if (closeBtn) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  } catch {
    // 忽略
  }

  // 使用搜索框输入关键词
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

  // 提取搜索结果
  const items: ContractItem[] = await page.evaluate(() => {
    const result: ContractItem[] = [];
    const links = document.querySelectorAll<HTMLAnchorElement>(
      'a[href*="/View?id="]'
    );

    links.forEach((link, index) => {
      const href = link.getAttribute('href');
      const title = link.textContent?.trim() || '';

      if (href && title && title.length > 0) {
        const idMatch = href.match(/id=([a-zA-Z0-9-]+)/);
        const id = idMatch ? idMatch[1] : `search-${index}`;

        result.push({
          id,
          title,
          category: '合同示范文本',
          publishDate: new Date().toISOString().split('T')[0],
          downloadCount: 0,
          sourceUrl: href.startsWith('http')
            ? href
            : `https://htsfwb.samr.gov.cn${href}`,
        });
      }
    });

    return result;
  });

  return items;
}

// 采集详情页内容
async function crawlDetail(
  browser: Browser,
  item: ContractItem
): Promise<void> {
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  try {
    await page.goto(item.sourceUrl, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // 关闭弹窗
    try {
      const closeBtn = await page.$('.samr-modal-close');
      if (closeBtn) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    } catch {
      // 忽略
    }

    // 提取详情
    const detail = await page.evaluate(() => {
      const pageTitle = document.title || '';
      const titleMatch = pageTitle.match(/^(.+?)\s*[-–—]\s*合同示范文本/);
      const title = titleMatch
        ? titleMatch[1].trim()
        : pageTitle.split('-')[0].trim();

      const articleEl = document.querySelector('article');
      const content = articleEl?.textContent?.trim() || '';

      const dateEl = document.querySelector(
        '[class*="date"], .publish-date, time'
      );
      const publishDate =
        dateEl?.textContent?.trim() || new Date().toISOString().split('T')[0];

      const issuerEl = document.querySelector(
        '[class*="issuer"], [class*="publisher"]'
      );
      const issuer = issuerEl?.textContent?.trim() || '';

      return { title, content, publishDate, issuer };
    });

    // 保存详情内容
    const detailDir = path.join(TEMP_DIR, 'details');
    ensureDir(detailDir);

    const detailFile = path.join(detailDir, `${item.id}.json`);
    fs.writeFileSync(
      detailFile,
      JSON.stringify(
        {
          ...item,
          content: detail.content,
          publishDate: detail.publishDate,
          issuer: detail.issuer,
        },
        null,
        2
      )
    );

    console.log(`    详情已保存: ${item.title.substring(0, 20)}...`);
  } catch (error) {
    console.error(`    详情采集失败: ${item.title}`, error);
  } finally {
    await page.close();
  }
}

// 尝试访问分类页面
async function crawlCategoryPage(
  browser: Browser,
  category: string
): Promise<ContractItem[]> {
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  const items: ContractItem[] = [];

  try {
    // 尝试直接访问分类URL
    const categoryUrl = `https://htsfwb.samr.gov.cn/?category=${encodeURIComponent(category)}`;
    await page.goto(categoryUrl, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // 关闭弹窗
    try {
      const closeBtn = await page.$('.samr-modal-close');
      if (closeBtn) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    } catch {
      /* ignore */
    }

    await page.waitForTimeout(2000);

    // 提取链接
    const pageItems = await page.evaluate(() => {
      const result: ContractItem[] = [];
      const links = document.querySelectorAll<HTMLAnchorElement>(
        'a[href*="/View?id="]'
      );

      links.forEach((link, index) => {
        const href = link.getAttribute('href');
        const title = link.textContent?.trim() || '';

        if (href && title && title.length > 0) {
          const idMatch = href.match(/id=([a-zA-Z0-9-]+)/);
          const id = idMatch ? idMatch[1] : `cat-${index}`;

          result.push({
            id,
            title,
            category: '合同示范文本',
            publishDate: new Date().toISOString().split('T')[0],
            downloadCount: 0,
            sourceUrl: href.startsWith('http')
              ? href
              : `https://htsfwb.samr.gov.cn${href}`,
          });
        }
      });

      return result;
    });

    items.push(...pageItems);
  } catch (error) {
    console.error(`  分类 "${category}" 访问失败:`, error);
  } finally {
    await page.close();
  }

  return items;
}

async function main() {
  console.log('='.repeat(70));
  console.log('SAMR 合同示范文本库 - 搜索采集器 (增强版)');
  console.log('='.repeat(70));
  console.log();

  // 初始化目录
  ensureDir(OUTPUT_DIR);
  ensureDir(TEMP_DIR);
  ensureDir(path.join(TEMP_DIR, 'details'));

  // 加载已采集的URL
  const collectedUrls = await loadCollectedUrls();
  console.log(`已采集: ${collectedUrls.size} 个合同`);
  console.log();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  let totalItems = 0;
  const allItems: ContractItem[] = [];

  try {
    // 遍历每个关键词进行搜索
    for (const keyword of KEYWORDS) {
      console.log(`\n搜索关键词: "${keyword}"`);
      console.log('-'.repeat(50));

      try {
        // 执行搜索
        const items = await searchWithKeyword(page, keyword);

        // 过滤掉已采集的URL
        const newItems = items.filter(
          item => !collectedUrls.has(item.sourceUrl)
        );

        console.log(`  找到 ${items.length} 个结果`);
        console.log(`  新结果: ${newItems.length} 个`);

        if (newItems.length > 0) {
          // 保存搜索结果
          await saveResults(keyword, newItems, TEMP_DIR);

          // 添加到总列表
          allItems.push(...newItems);
          totalItems += newItems.length;

          // 更新已采集URL集合
          newItems.forEach(item => collectedUrls.add(item.sourceUrl));
          await saveCollectedUrls(collectedUrls);

          // 采集每个合同的详情
          console.log('  采集详情页...');
          for (const item of newItems) {
            await crawlDetail(browser, item);
            await randomDelay(1500, 3000); // 详情页之间延迟
          }
        }

        // 搜索间隔
        await randomDelay(2000, 4000);
      } catch (error) {
        console.error(`  搜索 "${keyword}" 出错:`, error);
      }
    }

    // 策略2: 尝试分类页面
    console.log('\n策略2: 尝试分类页面');
    console.log('-'.repeat(50));

    const categories = [
      '房地产',
      '网络交易',
      '劳动人事',
      '交通运输',
      '建设工程',
      '金融服务',
      '教育培训',
      '医疗卫生',
      '文化旅游',
      '农业农村',
      '能源矿产',
      '环境保护',
    ];

    for (const category of categories) {
      console.log(`\n访问分类: "${category}"`);

      try {
        const items = await crawlCategoryPage(browser, category);
        const newItems = items.filter(
          item => !collectedUrls.has(item.sourceUrl)
        );

        console.log(
          `  找到 ${items.length} 个结果, 新增 ${newItems.length} 个`
        );

        if (newItems.length > 0) {
          allItems.push(...newItems);
          totalItems += newItems.length;

          newItems.forEach(item => collectedUrls.add(item.sourceUrl));
          await saveCollectedUrls(collectedUrls);
        }

        await randomDelay(3000, 5000);
      } catch (error) {
        console.error(`  分类 "${category}" 出错:`, error);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('采集完成');
    console.log('='.repeat(70));
    console.log(`总采集: ${totalItems} 个新合同`);
    console.log(`总已采集: ${collectedUrls.size} 个合同`);

    // 汇总保存
    if (allItems.length > 0) {
      const summaryFile = path.join(OUTPUT_DIR, 'summary.json');
      fs.writeFileSync(
        summaryFile,
        JSON.stringify(
          {
            total: allItems.length,
            keywords: KEYWORDS,
            items: allItems.map(item => ({
              title: item.title,
              sourceUrl: item.sourceUrl,
            })),
          },
          null,
          2
        )
      );
      console.log(`\n汇总已保存: ${summaryFile}`);
    }
  } catch (error) {
    console.error('采集出错:', error);
  } finally {
    await page.close();
    await browser.close();
  }
}

main().catch(console.error);
