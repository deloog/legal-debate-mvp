/**
 * 调试 API 返回数据
 */

const API_DETAIL = 'https://flk.npc.gov.cn/law-search/search/flfgDetails';

async function fetchDetail(bbbs: string): Promise<any> {
  const response = await fetch(`${API_DETAIL}?bbbs=${encodeURIComponent(bbbs)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Referer': 'https://flk.npc.gov.cn/',
    },
  });

  return response.json();
}

async function main() {
  // 测试几个不同的 bbbs
  const testIds = [
    'fl4b6g7f3b4c3g4g5h6', // 宪法修正案（2018年）- 空的
    'b7c4d5e6f7a8b9c0d1e', // 公司法 - 有内容的
  ];

  // 从之前采集的数据中获取真实的 bbbs
  const realIds = [
    '5b55fa6e908b437a94aca8f6138123c6', // 中华人民共和国公司法
    '827f65fcb68f40cb941eed996c5212b0', // 中华人民共和国民法典
  ];

  for (const bbbs of realIds) {
    console.log(`\n>>> 测试 bbbs: ${bbbs}`);

    try {
      const detail = await fetchDetail(bbbs);
      console.log('code:', detail.code);
      console.log('msg:', detail.msg);

      if (detail.data) {
        console.log('title:', detail.data.title);
        console.log('content 类型:', typeof detail.data.content);
        console.log('content 长度:', detail.data.content ? JSON.stringify(detail.data.content).length : 0);

        if (detail.data.ossFile) {
          console.log('DOCX 路径:', detail.data.ossFile.ossWordPath);
        }

        // 显示 content 结构
        if (detail.data.content) {
          console.log('content 结构:', JSON.stringify(detail.data.content).substring(0, 500));
        }
      }
    } catch (err) {
      console.log('错误:', err);
    }

    await new Promise(r => setTimeout(r, 2000));
  }
}

main().catch(console.error);
