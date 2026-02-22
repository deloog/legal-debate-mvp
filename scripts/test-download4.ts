/**
 * 测试下载 - 带完整 headers
 */
import * as https from 'https';
import * as fs from 'fs';

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

async function testDownload() {
  const url =
    'https://wb.flk.npc.gov.cn/prod/20180311/f7d150ac603e48628fb970321b38a145.docx';

  console.log('测试: 带完整 headers');

  await new Promise(resolve => {
    const req = https.get(
      url,
      {
        agent: insecureAgent,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          Referer: 'https://flk.npc.gov.cn/',
          Origin: 'https://flk.npc.gov.cn',
        },
      },
      res => {
        console.log(`HTTP: ${res.statusCode}`);
        console.log('Headers:', JSON.stringify(res.headers, null, 2));

        const chunks: Buffer[] = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          console.log(`Size: ${buf.length} bytes`);
          if (buf.length > 100) {
            console.log(`Header: ${buf.subarray(0, 20).toString('hex')}`);
          }
          resolve(true);
        });
      }
    );
    req.on('error', e => {
      console.log(`Error: ${e.message}`);
      resolve(true);
    });
  });
}

testDownload().then(() => console.log('\n完成'));
