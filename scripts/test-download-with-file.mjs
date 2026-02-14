/**
 * DOCX Download Test - Output to file
 */

import { writeFileSync } from 'fs';

const TEST_BBBS = 'ff8081819c230fa1019c4551f8c8511b';
const API_DOWNLOAD = 'https://flk.npc.gov.cn/law-search/download/pc';
const OUTPUT_FILE = 'test-download-result.txt';

async function downloadDocx(bbbs) {
  const url = `${API_DOWNLOAD}?format=docx&bbbs=${encodeURIComponent(bbbs)}`;
  const lines = [];

  lines.push(`URL: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/octet-stream, */*',
        'Referer': `https://flk.npc.gov.cn/detail?bbbs=${bbbs}`,
      },
    });

    lines.push(`HTTP Status: ${response.status} ${response.statusText}`);
    lines.push(`Content-Type: ${response.headers.get('content-type')}`);
    lines.push(`Content-Length: ${response.headers.get('content-length')}`);

    if (!response.ok) {
      lines.push('Download failed - HTTP error');
      return { success: false, lines };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    lines.push(`Downloaded: ${buffer.length.toLocaleString()} bytes`);

    if (buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4B) {
      lines.push('Valid DOCX format (ZIP) - SUCCESS!');
      return { success: true, buffer, lines };
    } else {
      lines.push('Invalid format - not a DOCX file');
      return { success: false, lines };
    }
  } catch (err) {
    lines.push(`Error: ${err.message}`);
    return { success: false, lines };
  }
}

async function main() {
  const lines = [];
  lines.push('=== Testing DOCX Download ===\n');

  const result = await downloadDocx(TEST_BBBS);

  lines.push(...result.lines);

  if (result.success) {
    lines.push('\n[SUCCESS] Download successful!');
    lines.push(`File size: ${result.buffer.length.toLocaleString()} bytes`);

    // Save DOCX file
    writeFileSync('downloaded-law.docx', result.buffer);
    lines.push('Saved to: downloaded-law.docx');
  } else {
    lines.push('\n[FAILED] Download failed');
  }

  // Write results to file
  const output = lines.join('\n');
  writeFileSync(OUTPUT_FILE, output);
  console.log('Results written to:', OUTPUT_FILE);
}

main();
