/**
 * 快速下载测试
 */
import * as https from 'https';
import * as fs from 'fs';

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

async function testDownload() {
  const fileUrl = 'https://wb.flk.npc.gov.cn/prod/20180311/f7d150ac603e48628fb970321b38a145.docx';
  
  return new Promise((resolve) => {
    https.get(fileUrl, { 
      agent: insecureAgent, 
      headers: { 'User-Agent': 'Mozilla/5.0' } 
    }, (res) => {
      console.log('HTTP Status:', res.statusCode);
      
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log('Size:', buffer.length, 'bytes');
        console.log('Header:', buffer.subarray(0, 10).toString('hex'));
        console.log('Is DOCX:', buffer.subarray(0, 4).toString('hex') === '504b0304');
        
        // 保存测试
        fs.writeFileSync('data/test-download.docx', buffer);
        console.log('Saved to: data/test-download.docx');
        resolve(true);
      });
    }).on('error', (e) => {
      console.log('Error:', e.message);
      resolve(false);
    });
  });
}

testDownload().then(() => console.log('Done'));
