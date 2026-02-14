/**
 * 法律法规采集器测试脚本 (无需数据库)
 * 
 * 这个脚本测试：
 * 1. API 列表调用
 * 2. 断点保存
 * 3. 元数据采集
 */

import * as fs from 'fs';
import * as path from 'path';

// 简化的采集逻辑 (无数据库依赖)
const API_BASE = 'https://flk.npc.gov.cn';
const API_LIST = `${API_BASE}/law-search/search/list`;
const API_DETAIL = `${API_BASE}/law-search/search/flfgDetails`;

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function randomUA(): string {
  return UA_POOL[0];
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url: string, options?: RequestInit): Promise<any> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': randomUA(),
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json;charset=utf-8',
      'Referer': 'https://flk.npc.gov.cn/',
      'Origin': 'https://flk.npc.gov.cn',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

async function fetchList(typeCode: number, page: number, pageSize: number): Promise<any> {
  const body = {
    searchRange: 1,
    sxrq: [],
    gbrq: [],
    searchType: 2,
    sxx: [],
    gbrqYear: [],
    flfgCodeId: [typeCode],
    zdjgCodeId: [],
    searchContent: '',
    pageNum: page,
    pageSize,
  };
  
  return fetchJson(API_LIST, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function fetchDetail(bbbs: string): Promise<any> {
  return fetchJson(`${API_DETAIL}?bbbs=${encodeURIComponent(bbbs)}`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('法律法规采集器测试 (无需数据库)');
  console.log('='.repeat(60));
  console.log();
  
  const outputDir = path.resolve('data/crawled/flk-test');
  const checkpointPath = path.join(outputDir, 'checkpoint.json');
  
  // 确保目录存在
  fs.mkdirSync(outputDir, { recursive: true });
  
  // 加载或创建断点
  let checkpoint = { version: '2.0', items: [], types: {}, startedAt: '', lastUpdatedAt: '', status: 'in_progress' };
  if (fs.existsSync(checkpointPath)) {
    try {
      checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
      console.log('已加载现有断点');
    } catch (e) {
      console.log('创建新断点');
    }
  }
  
  // 测试分类
  const testTypes = [
    { code: 220, label: '监察法规' },
    { code: 100, label: '宪法' },
  ];
  
  const allItems: any[] = [];
  
  for (const type of testTypes) {
    console.log(`\n>>> 测试分类: ${type.label} (code: ${type.code})`);
    
    try {
      const response = await fetchList(type.code, 1, 5);
      
      if (response.code === 200 && response.rows) {
        console.log(`  列表 API 成功: ${response.total} 条数据`);
        
        for (const item of response.rows) {
          console.log(`  - ${item.title} (公布: ${item.gbrq})`);
          
          // 获取详情
          try {
            const detail = await fetchDetail(item.bbbs);
            if (detail.code === 200 && detail.data?.ossFile?.ossWordPath) {
              console.log(`    DOCX 路径: ${detail.data.ossFile.ossWordPath}`);
            } else {
              console.log(`    详情返回: ${JSON.stringify(detail.data).substring(0, 100)}...`);
            }
          } catch (e) {
            console.log(`    详情获取失败: ${e}`);
          }
          
          // 保存元数据
          allItems.push({
            bbbs: item.bbbs,
            title: item.title,
            flfgCodeId: item.flfgCodeId,
            gbrq: item.gbrq,
            sxrq: item.sxrq,
            sxx: item.sxx,
            zdjgName: item.zdjgName,
            flxz: item.flxz,
          });
          
          await delay(1000); // 避免请求过快
        }
      } else {
        console.log(`  列表 API 失败: code=${response.code}, msg=${response.msg}`);
      }
    } catch (e) {
      console.log(`  列表 API 异常: ${e}`);
    }
  }
  
  // 保存断点
  checkpoint.items = allItems;
  checkpoint.lastUpdatedAt = new Date().toISOString();
  checkpoint.status = 'completed';
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
  
  console.log('\n' + '='.repeat(60));
  console.log(`测试完成: 采集到 ${allItems.length} 条元数据`);
  console.log('断点已保存到:', checkpointPath);
  console.log('='.repeat(60));
  
  // 打印保存的数据
  console.log('\n已保存的元数据:');
  for (const item of allItems.slice(0, 5)) {
    console.log(`  - ${item.title} (${item.flxz})`);
  }
}

main().catch(console.error);
