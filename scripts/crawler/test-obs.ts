/**
 * 测试 OBS 下载
 */

import * as fs from 'fs';
import * as https from 'https';

async function download(url: string): Promise<Buffer | null> {
  console.log(`尝试: ${url.substring(0, 80)}...`);

  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`  ✅ 成功: ${buffer.length.toLocaleString()} bytes`);
          resolve(buffer);
        });
      } else {
        console.log(`  ❌ HTTP ${res.statusCode}`);
        resolve(null);
      }
    }).on('error', (err) => {
      console.log(`  ❌ ${err.message}`);
      resolve(null);
    });
  });
}

async function main() {
  console.log('=== 测试 OBS 下载 ===\n');

  // 从浏览器日志看到的真实 URL
  const ossPath = 'prod/20260203/0db573fb888d4a3c9406c9871d2d2a0d.docx';
  const baseUrl = 'https://flkoss.obs-bj2.cucloud.cn';

  // 测试不同格式
  const urls = [
    `${baseUrl}/${ossPath}`,
    `${baseUrl}/${ossPath.split('?')[0]}`,
  ];

  for (const url of urls) {
    const buffer = await download(url);
    if (buffer) {
      fs.writeFileSync('data/test-obs.docx', buffer);
      console.log(`已保存到 data/test-obs.docx`);
      break;
    }
    console.log();
  }
}

main().catch(console.error);
