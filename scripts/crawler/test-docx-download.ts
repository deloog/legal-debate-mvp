/**
 * 测试 FLK API 的 DOCX 下载功能
 */

import * as https from 'https';

const API_BASE = 'https://flk.npc.gov.cn';
const API_DETAIL = `${API_BASE}/law-search/search/flfgDetails`;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
        'Referer': API_BASE + '/',
      },
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`解析失败: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

async function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': UA,
        'Accept': '*/*',
        'Referer': API_BASE + '/',
      },
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

// 测试几个法规的下载
const testCases = [
  {
    bbbs: '2c909fdd678bf17901678bf59da8002d',
    name: '中华人民共和国宪法修正案（2018年）',
  },
  {
    bbbs: 'f77ee28fe50241918f872785b51904f4',
    name: '中华人民共和国国家通用语言文字法',
  },
];

async function main() {
  console.log('='.repeat(70));
  console.log('FLK DOCX 下载测试');
  console.log('='.repeat(70));

  for (const testCase of testCases) {
    console.log(`\n>>> 测试: ${testCase.name}`);
    console.log(`    ID: ${testCase.bbbs}`);

    try {
      // 获取详情
      const detailUrl = `${API_DETAIL}?bbbs=${encodeURIComponent(testCase.bbbs)}`;
      const detail = await fetchJson(detailUrl);

      if (detail.code !== 200) {
        console.log(`    ⚠ API 失败: ${detail.msg}`);
        continue;
      }

      console.log(`    ✓ API 成功`);

      const data = detail.data;
      console.log(`    - 有 content: ${!!data.content}`);
      console.log(`    - 有 ossFile: ${!!data.ossFile}`);

      if (data.ossFile) {
        console.log(`    - ossWordPath: ${data.ossFile.ossWordPath || '无'}`);
        console.log(`    - ossPdfPath: ${data.ossFile.ossPdfPath || '无'}`);
      }

      // 尝试下载 DOCX
      if (data.ossFile?.ossWordPath) {
        try {
          const docxBuffer = await downloadFile(data.ossFile.ossWordPath);
          console.log(`    ✓ DOCX 下载成功: ${docxBuffer.length} bytes`);

          // 检查文件头
          const header = docxBuffer.subarray(0, 4).toString('hex');
          const isDocx = header === '504b0304';
          console.log(`    - 文件类型: ${isDocx ? 'DOCX (ZIP)' : header}`);
        } catch (err: any) {
          console.log(`    ⚠ DOCX 下载失败: ${err.message}`);
        }
      } else {
        console.log(`    ⚠ 无 DOCX 下载链接`);
      }

      // 如果有 content，检查长度
      if (data.content) {
        const contentStr = JSON.stringify(data.content);
        console.log(`    - content 长度: ${contentStr.length} 字符`);
      }

    } catch (err: any) {
      console.log(`    ⚠ 测试失败: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('测试完成');
  console.log('='.repeat(70));
}

main().catch(console.error);
