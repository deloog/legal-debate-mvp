/**
 * 测试下载 - 较新的监察法规
 */
import * as https from 'https';
import * as fs from 'fs';

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

async function testDownload() {
  // 2025年的监察法实施条例
  const testCases = [
    'prod/20250601/bb9f86ff535d414097f13246b40a0a67.docx', // 2025年6月
  ];

  for (const path of testCases) {
    const url = `https://wb.flk.npc.gov.cn/${path}`;
    console.log(`\n测试: ${path}`);

    await new Promise(resolve => {
      https
        .get(
          url,
          { agent: insecureAgent, headers: { 'User-Agent': 'Mozilla/5.0' } },
          res => {
            console.log(`  HTTP: ${res.statusCode}`);
            const chunks: Buffer[] = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
              const buf = Buffer.concat(chunks);
              console.log(`  Size: ${buf.length} bytes`);
              console.log(`  Header: ${buf.subarray(0, 6).toString('hex')}`);
              if (buf.length > 100) {
                fs.writeFileSync(`data/download-${path.split('/').pop()}`, buf);
                console.log(`  Saved!`);
              }
              resolve(true);
            });
          }
        )
        .on('error', e => {
          console.log(`  Error: ${e.message}`);
          resolve(true);
        });
    });
  }
}

testDownload().then(() => console.log('\n完成'));
