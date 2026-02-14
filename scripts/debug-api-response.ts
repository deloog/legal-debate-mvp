/**
 * 调试 API 响应 - 检查为什么返回 23 bytes
 */

import { FLKCrawler } from '../src/lib/crawler/flk-crawler';

async function main() {
  console.log('='.repeat(70));
  console.log('调试 API 响应');
  console.log('='.repeat(70));
  console.log();

  const crawler = new FLKCrawler();

  // 测试记录：全国人民代表大会常务委员会组成人员守则
  // articleNumber: ff80818187217f6e0187bdc93b514030
  const testId = 'ff80818187217f6e0187bdc93b514030';

  console.log(`测试 ID: ${testId}`);
  console.log();

  try {
    // 1. 获取详情
    console.log('步骤 1: 获取详情...');
    const detail = await crawler['fetchDetail'](testId);
    
    console.log('详情响应:');
    console.log(`  Code: ${detail.code}`);
    console.log(`  Msg: ${detail.msg}`);
    console.log(`  Data: ${JSON.stringify(detail.data, null, 2)}`);
    console.log();

    if (!detail?.data?.ossFile?.ossWordPath) {
      console.log('❌ 无法获取 DOCX 下载路径');
      console.log();
      return;
    }

    // 2. 下载 DOCX
    console.log('步骤 2: 下载 DOCX...');
    console.log(`  下载路径: ${detail.data.ossFile.ossWordPath}`);
    
    const docxBuffer = await crawler['downloadDocx'](testId, detail.data.ossFile.ossWordPath);
    
    console.log(`  下载大小: ${docxBuffer.length} bytes`);
    console.log();

    // 3. 显示前 100 bytes
    console.log('步骤 3: 分析内容...');
    console.log(`  前 100 bytes (hex): ${docxBuffer.subarray(0, 100).toString('hex')}`);
    console.log(`  前 100 bytes (text): ${docxBuffer.subarray(0, 100).toString('utf-8')}`);
    console.log();

    // 4. 检查是否是有效的 DOCX
    if (docxBuffer.length >= 4) {
      const header = docxBuffer.subarray(0, 4).toString('hex');
      console.log(`  文件头: ${header}`);
      
      if (header === '504b0304') {
        console.log('  ✅ 有效的 ZIP/DOCX 文件');
      } else if (header === 'd0cf11e0') {
        console.log('  ⚠️  旧的 DOC 文件 (OLE 格式)');
      } else if (docxBuffer.subarray(0, 5).toString() === '<?xml') {
        console.log('  ⚠️  XML 格式文档');
      } else {
        console.log('  ❌ 无效的文件格式');
      }
    }
    console.log();

    // 5. 如果是 HTML 错误页面
    const text = docxBuffer.toString('utf-8');
    if (text.includes('<html>') || text.includes('<!DOCTYPE')) {
      console.log('⚠️  API 返回了 HTML 页面（可能是错误页面）');
      console.log();
      console.log('HTML 内容:');
      console.log(text);
    } else if (text.includes('{') && text.includes('}')) {
      console.log('⚠️  API 返回了 JSON 响应');
      console.log();
      console.log('JSON 内容:');
      console.log(JSON.stringify(JSON.parse(text), null, 2));
    } else {
      console.log('❓ 无法识别的响应格式');
      console.log();
      console.log('完整内容:');
      console.log(text);
    }

  } catch (error) {
    console.log('❌ 错误:');
    console.log(error);
  }

  console.log();
  console.log('='.repeat(70));
  console.log('调试完成');
  console.log('='.repeat(70));
}

main().catch(error => {
  console.error('错误:', error);
  process.exit(1);
});
