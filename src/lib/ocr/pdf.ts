import type { PdfTextExtractionResult } from './types';

export const SCANNED_PDF_MIN_CHARS_PER_PAGE = 50;

export async function inspectPdfText(
  buffer: Buffer
): Promise<PdfTextExtractionResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (
    buf: Buffer
  ) => Promise<{ text: string; numpages?: number }>;
  const result = await pdfParse(buffer);
  const text = result.text?.trim() ?? '';
  const pageCount = Math.max(result.numpages ?? 1, 1);
  const avgCharsPerPage = text.length / pageCount;

  return {
    text,
    pageCount,
    avgCharsPerPage,
    scannedLike: !text || avgCharsPerPage < SCANNED_PDF_MIN_CHARS_PER_PAGE,
  };
}
