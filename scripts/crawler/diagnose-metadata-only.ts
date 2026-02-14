/**
 * 诊断仅有元数据的原因
 * 找出那些内容不完整的记录并分析原因
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';

const prisma = new PrismaClient();

async function diagnoseRecord(law: any) {
  console.log(`\n>>> ${law.lawName}`);
  console.log(`    ID: ${law.articleNumber}`);
  console.log(`    数据源: ${law.dataSource}`);
  console.log(`    当前内容长度: ${law.fullText.length} 字符`);
  console.log(`    当前内容: ${law.fullText.substring(0, 100)}...`);

  // 尝试重新获取
  const API_DETAIL = 'https://flk.npc.gov.cn/law-search/search/flfgDetails';
  const API_DOWNLOAD = 'https://flk.npc.gov.cn/law-search/download/pc';

  try {
    // 1. 获取详情
    const detailResponse = await fetch(`${API_DETAIL}?bbbs=${encodeURIComponent(law.articleNumber)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://flk.npc.gov.cn/',
      },
    });

    const detail = await detailResponse.json();
    if (detail.code !== 200) {
      console.log(`    ⚠ API 失败: ${detail.msg}`);
      return;
    }

    console.log(`    ✓ API 详情获取成功`);
    console.log(`    - 有 content: ${!!detail.data.content}`);
    console.log(`    - 有 ossFile: ${!!detail.data.ossFile}`);

    if (detail.data.ossFile) {
      console.log(`    - ossWordPath: ${detail.data.ossFile.ossWordPath || '无'}`);
    }

    // 2. 尝试下载 DOCX
    const downloadUrl = `${API_DOWNLOAD}?format=docx&bbbs=${encodeURIComponent(law.articleNumber)}`;
    console.log(`\n    尝试下载 DOCX...`);

    const downloadResponse = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://flk.npc.gov.cn/',
      },
    });

    const downloadData = await downloadResponse.json();
    console.log(`    - HTTP 状态: ${downloadResponse.status}`);
    console.log(`    - API 响应: code=${downloadData.code}, msg=${downloadData.msg}`);

    if (downloadData.code === 200 && downloadData.data?.url) {
      console.log(`    ✓ 获取下载 URL 成功`);

      // 下载文件
      const fileResponse = await fetch(downloadData.data.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
        },
      });

      console.log(`    - 文件 HTTP 状态: ${fileResponse.status}`);

      if (fileResponse.ok) {
        const buffer = Buffer.from(await fileResponse.arrayBuffer());
        console.log(`    ✓ 文件下载成功: ${buffer.length} bytes`);

        // 检查文件类型
        const header = buffer.subarray(0, 4).toString('hex');
        const isDocx = header === '504b0304';
        console.log(`    - 文件类型: ${isDocx ? 'DOCX (ZIP)' : header}`);

        if (isDocx) {
          // 解析
          const result = await mammoth.extractRawText({ buffer });
          console.log(`    ✓ 文件解析成功: ${result.value.length} 字符`);

          if (result.value.length > 100) {
            console.log(`    ✓ 内容完整!`);

            // 保存到文件
            const outputDir = path.resolve('data/crawled/flk/diagnosis');
            fs.mkdirSync(outputDir, { recursive: true });
            fs.writeFileSync(
              path.join(outputDir, `${law.articleNumber}.docx`),
              buffer
            );

            return {
                success: true,
                contentLength: result.value.length,
                contentPreview: result.value.substring(0, 200),
            };
          } else {
            console.log(`    ⚠ 解析后内容不足100字符`);
          }
        } else {
          console.log(`    ⚠ 下载的不是 DOCX 文件`);
          console.log(`    - 文件内容前100字符: ${buffer.toString('utf-8', 0, 100)}`);
        }
      } else {
        console.log(`    ⚠ 文件下载失败`);
      }
    } else {
      console.log(`    ⚠ 无法获取下载 URL`);
      console.log(`    - 完整响应: ${JSON.stringify(downloadData).substring(0, 200)}`);
    }

  } catch (err: any) {
    console.log(`    ❌ 诊断失败: ${err.message}`);
  }

  return { success: false };
}

async function main() {
  console.log('='.repeat(70));
  console.log('元数据记录诊断');
  console.log('='.repeat(70));

  // 找出所有仅有元数据的记录
  const metadataOnlyLaws = await prisma.lawArticle.findMany({
    where: {
      dataSource: 'flk',
      fullText: {
        startsWith: '[元数据]',
      },
    },
    take: 10,  // 先诊断前10条
  });

  console.log(`\n找到 ${metadataOnlyLaws.length} 条仅有元数据的记录\n`);

  let successCount = 0;

  for (const law of metadataOnlyLaws) {
    const result = await diagnoseRecord(law);
    if (result.success) {
      successCount++;
    }
    
    // 延迟避免被限流
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log('\n' + '='.repeat(70));
  console.log('诊断完成');
  console.log('='.repeat(70));
  console.log(`✅ 成功恢复: ${successCount}/${metadataOnlyLaws.length}`);
  console.log(`⚠ 仍需处理: ${metadataOnlyLaws.length - successCount}`);
  console.log('='.repeat(70));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
