/**
 * 测试从 API 提取完整法规内容
 */
import * as https from 'https';

const API_BASE = 'https://flk.npc.gov.cn';

async function fetchDetail(bbbs: string) {
  const url = `${API_BASE}/law-search/search/flfgDetails?bbbs=${bbbs}`;
  
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// 提取纯文本内容
function extractText(content: any): string {
  if (!content) return '';
  
  const texts: string[] = [];
  
  function traverse(node: any) {
    if (node.title) {
      texts.push(node.title);
    }
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  
  traverse(content);
  return texts.join('\n');
}

async function main() {
  console.log('=== 测试从 API 获取完整法规内容 ===\n');
  
  // 测试宪法
  const testCases = [
    { bbbs: '2c909fdd678bf17901678bf5a483004b', name: '中华人民共和国宪法（2018年修正文本）' },
  ];
  
  for (const { bbbs, name } of testCases) {
    console.log(`测试: ${name}`);
    console.log('='.repeat(50));
    
    const detail: any = await fetchDetail(bbbs);
    
    if (detail.code === 200 && detail.data?.content) {
      const text = extractText(detail.data.content);
      console.log(`内容长度: ${text.length} 字符`);
      console.log(`\n前500字符预览:`);
      console.log(text.substring(0, 500));
      console.log(`\n...`);
      console.log(`后500字符:`);
      console.log(text.substring(text.length - 500));
    } else {
      console.log('获取失败');
    }
    console.log();
  }
}

main().catch(console.error);
