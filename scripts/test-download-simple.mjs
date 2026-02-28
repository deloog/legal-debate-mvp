/**
 * Simple DOCX Download Test
 */

const TEST_BBBS = 'ff8081819c230fa1019c4551f8c8511b';
const API_DOWNLOAD = 'https://flk.npc.gov.cn/law-search/download/pc';

async function downloadDocx(bbbs) {
  const url = `${API_DOWNLOAD}?format=docx&bbbs=${encodeURIComponent(bbbs)}`;
  console.log('URL:', url);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/octet-stream, */*',
        Referer: `https://flk.npc.gov.cn/detail?bbbs=${bbbs}`,
      },
    });

    console.log('HTTP Status:', response.status, response.statusText);
    console.log('Content-Type:', response.headers.get('content-type'));
    console.log('Content-Length:', response.headers.get('content-length'));

    if (!response.ok) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log('Downloaded:', buffer.length.toLocaleString(), 'bytes');

    if (buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
      console.log('Valid DOCX format (ZIP)');
    }

    return buffer;
  } catch (err) {
    console.error('Error:', err.message);
    return null;
  }
}

async function main() {
  console.log('=== Testing DOCX Download ===\n');

  const buffer = await downloadDocx(TEST_BBBS);

  if (buffer) {
    console.log('\n[SUCCESS] Download successful!');
    console.log('File size:', buffer.length.toLocaleString(), 'bytes');
  } else {
    console.log('\n[FAILED] Download failed');
  }
}

main();
