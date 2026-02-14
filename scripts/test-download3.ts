/**
 * 测试下载 - 2018年宪法文件
 */
import * as https from 'https';
import * as fs from 'fs';

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

async function testDownload() {
  // 2018年宪法（已存在）
  const testCases = [
    { path: 'prod/20180311/0193ce7784e64a83b575aadb5e0b8622.docx', name: '2018宪法修正案' },
    { path: 'prod/20180311/f7d150ac603e48628fb970321b38a145.docx', name: '2018宪法文本' },
    { path: 'prod/20040314/dcf90fd833be4e3bb3cc9eb1773fb07d.docx', name: '2004宪法修正案' },
  ];
  
  for (const { path, name } of testCases) {
    const url = `https://wb.flk.npc.gov.cn/${path}`;
    console.log(`\n测试 ${name}: ${path}`);
    
    await new Promise((resolve) => {
      https.get(url, { agent: insecureAgent, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        console.log(`  HTTP: ${res.statusCode}`);
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          console.log(`  Size: ${buf.length} bytes`);
          if (buf.length > 1000 && buf.subarray(0, 4).toString('hex') === '504b0304') {
            console.log(`  ✅ 成功下载!`);
          } else if (buf.toString('utf8').includes('Error')) {
            console.log(`  ❌ OSS错误`);
          }
          resolve(true);
        });
      }).on('error', (e) => { console.log(`  Error: ${e.message}`); resolve(true); });
    });
  }
}

testDownload().then(() => console.log('\n完成'));
