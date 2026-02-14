/**
 * 完整下载和解析测试
 * 使用正确的下载 API
 */

import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';

const API_BASE = 'https://flk.npc.gov.cn';
const API_DOWNLOAD = `${API_BASE}/law-search/download/pc`;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function downloadDocx(bbbs: string): Promise<Buffer | null> {
  const url = `${API_DOWNLOAD}?format=docx&bbbs=${encodeURIComponent(bbbs)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': '*/*',
        'Referer': API_BASE + '/',
      },
    });

    if (!response.ok) {
      console.log(`    ⚠ HTTP ${response.status}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  } catch (err: any) {
    console.log(`    ⚠ 下载失败: ${err.message}`);
    return null;
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  } catch (err) {
    console.log(`    ⚠ 解析失败: ${err}`);
    return '';
  }
}

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
  console.log('完整下载和解析测试');
  console.log('='.repeat(70));

  const outputDir = path.resolve('data/test-downloads');
  fs.mkdirSync(outputDir, { recursive: true });

  for (const testCase of testCases) {
    console.log(`\n>>> ${testCase.name}`);
    console.log(`    ID: ${testCase.bbbs}`);

    // 下载
    const buffer = await downloadDocx(testCase.bbbs);

    if (!buffer) {
      console.log(`    ✗ 下载失败\n`);
      continue;
    }

    console.log(`    ✓ 下载成功: ${buffer.length} bytes`);

    // 检查文件类型
    const header = buffer.subarray(0, 4).toString('hex');
    const isDocx = header === '504b0304';
    console.log(`    - 文件类型: ${isDocx ? 'DOCX (ZIP)' : header}`);

    // 保存文件
    const filePath = path.join(outputDir, `${testCase.bbbs}.docx`);
    fs.writeFileSync(filePath, buffer);
    console.log(`    - 已保存: ${filePath}`);

    // 解析
    const text = await parseDocx(buffer);
    console.log(`    ✓ 解析成功: ${text.length} 字符`);

    // 显示前200字符
    if (text.length > 0) {
      console.log(`    - 内容预览: ${text.substring(0, 200)}...`);
    } else {
      console.log(`    - 内容为空`);
    }

    console.log();
  }

  console.log('='.repeat(70));
  console.log('测试完成');
  console.log('='.repeat(70));
}

main().catch(console.error);
