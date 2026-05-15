import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '@/lib/logger';

const execFileAsync = promisify(execFile);

const OCR_MAX_PAGES = Math.max(
  1,
  parseInt(process.env.OCR_MAX_PAGES ?? '20', 10)
);
const OCR_DPI = Math.max(72, parseInt(process.env.OCR_DPI ?? '150', 10));

/**
 * Convert PDF pages to JPEG buffers using Ghostscript.
 * Requires `gs` to be installed on the host (apt install ghostscript).
 * Returns one Buffer per page, limited to OCR_MAX_PAGES pages.
 */
export async function pdfToJpegBuffers(pdfBuffer: Buffer): Promise<Buffer[]> {
  const workDir = await mkdtemp(join(tmpdir(), 'ocr-'));
  try {
    const inputPath = join(workDir, 'input.pdf');
    const outputPattern = join(workDir, 'page_%03d.jpg');

    await writeFile(inputPath, pdfBuffer);

    await execFileAsync(
      'gs',
      [
        '-dNOPAUSE',
        '-dBATCH',
        '-dSAFER',
        '-sDEVICE=jpeg',
        `-r${OCR_DPI}`,
        `-dLastPage=${OCR_MAX_PAGES}`,
        `-sOutputFile=${outputPattern}`,
        inputPath,
      ],
      { timeout: 90_000 }
    );

    const pageFiles = (await readdir(workDir))
      .filter(f => f.startsWith('page_') && f.endsWith('.jpg'))
      .sort();

    if (pageFiles.length === 0) {
      throw new Error(
        'Ghostscript produced no output images — PDF may be encrypted or malformed'
      );
    }

    logger.info(`[OCR] PDF→JPEG: ${pageFiles.length} pages`, { dpi: OCR_DPI });
    return Promise.all(pageFiles.map(f => readFile(join(workDir, f))));
  } catch (err) {
    logger.error('[OCR] PDF→JPEG conversion failed', { err });
    throw err;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
