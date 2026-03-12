import * as fs from 'fs';
import * as path from 'path';
import { extractRawText } from 'mammoth';

async function main() {
  console.log('=== 检查 DOCX 文件 ===\n');

  const docxFiles = [
    'data/download-bb9f86ff535d414097f13246b40a0a67.docx',
    'data/test-xianfa.docx',
    'data/test-download.docx',
    'data/test-download2.docx',
  ];

  for (const file of docxFiles) {
    if (!fs.existsSync(file)) {
      console.log(`❌ ${file} 不存在`);
      continue;
    }

    const buffer = fs.readFileSync(file);
    console.log(`\n📄 ${path.basename(file)}`);
    console.log(`   大小: ${buffer.length.toLocaleString()} bytes`);

    try {
      const result = await extractRawText({ buffer });
      const text = result.value || '';
      console.log(`   解析: ${text.length.toLocaleString()} 字符`);
      console.log(`   预览: ${text.substring(0, 200).replace(/\n/g, ' ')}...`);
    } catch (err) {
      console.log(`   ❌ 解析失败: ${err}`);
    }
  }
}

main().catch(console.error);
