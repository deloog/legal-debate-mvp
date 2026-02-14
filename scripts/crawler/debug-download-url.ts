/**
 * 调试 API 返回的下载 URL
 */

async function main() {
  const API_DETAIL = 'https://flk.npc.gov.cn/law-search/search/flfgDetails';

  const bbbs = '5b55fa6e908b437a94aca8f6138123c6';

  console.log(`=== bbbs: ${bbbs} ===\n`);

  const response = await fetch(`${API_DETAIL}?bbbs=${bbbs}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });

  console.log('Status:', response.status);
  console.log('Headers:', response.headers.get('content-type'));

  const text = await response.text();
  console.log('\n原始响应 (前3000字符):');
  console.log(text.substring(0, 3000));
}

main().catch(console.error);
