import { logger } from '@/lib/logger';
import type {
  OcrDocumentRequest,
  OcrDocumentResult,
  OcrProvider,
} from './types';
import { inspectPdfText } from './pdf';

export function getConfiguredOcrProvider(): OcrProvider {
  const value = (process.env.OCR_PROVIDER ?? 'disabled').toLowerCase();
  if (value === 'tencent') return 'tencent';
  if (value === 'zhipu-vision') return 'zhipu-vision';
  return 'disabled';
}

export function isOcrEnabled(): boolean {
  return getConfiguredOcrProvider() !== 'disabled';
}

// ── Tencent OCR ───────────────────────────────────────────────────────────────

interface TencentOcrClient {
  GeneralAccurateOCR(req: {
    ImageBase64: string;
    IsPdf?: boolean;
    PdfPageNumber?: number;
  }): Promise<{ TextDetections: { DetectedText: string }[] }>;
}

interface TencentOcrSdk {
  ocr: {
    v20181119: {
      Client: new (config: {
        credential: { secretId: string; secretKey: string };
        region: string;
        profile?: { httpProfile?: { endpoint?: string } };
      }) => TencentOcrClient;
    };
  };
}

function buildTencentClient(): TencentOcrClient {
  const secretId = process.env.TENCENT_OCR_SECRET_ID ?? '';
  const secretKey = process.env.TENCENT_OCR_SECRET_KEY ?? '';
  if (!secretId || !secretKey) {
    throw new Error(
      'TENCENT_OCR_SECRET_ID or TENCENT_OCR_SECRET_KEY not configured'
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sdk = require('tencentcloud-sdk-nodejs-ocr') as TencentOcrSdk;
  return new sdk.ocr.v20181119.Client({
    credential: { secretId, secretKey },
    region: process.env.TENCENT_OCR_REGION ?? 'ap-beijing',
    profile: {
      httpProfile: {
        endpoint: process.env.TENCENT_OCR_ENDPOINT ?? 'ocr.tencentcloudapi.com',
      },
    },
  });
}

async function extractWithTencent(
  request: OcrDocumentRequest
): Promise<OcrDocumentResult> {
  let pageInputs: Array<{
    page: number;
    payloadBase64: string;
    isPdf: boolean;
  }>;
  if (request.mimeType === 'application/pdf') {
    const inspection = await inspectPdfText(request.fileBuffer);
    const maxPages = Math.max(
      1,
      parseInt(process.env.OCR_MAX_PAGES ?? '20', 10)
    );
    const pageCount = Math.min(inspection.pageCount, maxPages);
    const pdfBase64 = request.fileBuffer.toString('base64');
    pageInputs = Array.from({ length: pageCount }, (_, index) => ({
      page: index + 1,
      payloadBase64: pdfBase64,
      isPdf: true,
    }));
  } else {
    pageInputs = [
      {
        page: 1,
        payloadBase64: request.fileBuffer.toString('base64'),
        isPdf: false,
      },
    ];
  }

  const client = buildTencentClient();
  const pageResults: { page: number; text: string }[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < pageInputs.length; i++) {
    const pageInput = pageInputs[i];
    try {
      const res = await client.GeneralAccurateOCR({
        ImageBase64: pageInput.payloadBase64,
        ...(pageInput.isPdf
          ? {
              IsPdf: true,
              PdfPageNumber: pageInput.page,
            }
          : {}),
      });
      const pageText = (res.TextDetections ?? [])
        .map(d => d.DetectedText)
        .join('\n');
      pageResults.push({ page: pageInput.page, text: pageText });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[OCR] Tencent OCR failed on page ${pageInput.page}`, {
        err,
      });
      warnings.push(`第 ${pageInput.page} 页识别失败: ${msg}`);
      pageResults.push({ page: pageInput.page, text: '' });
    }
  }

  const text = pageResults
    .map(p => p.text)
    .filter(Boolean)
    .join('\n\n');

  logger.info('[OCR] Tencent OCR completed', {
    fileName: request.fileName,
    pages: pageResults.length,
    chars: text.length,
    mode: request.mimeType === 'application/pdf' ? 'pdf-direct' : 'image',
  });

  return {
    success: text.length > 0,
    provider: 'tencent',
    text,
    pages: pageResults,
    pageCount: pageResults.length,
    ...(warnings.length > 0 && { warnings }),
    ...(!text && { error: 'OCR produced no text' }),
  };
}

// ── 主入口 ────────────────────────────────────────────────────────────────────

export async function extractTextWithOcr(
  request: OcrDocumentRequest
): Promise<OcrDocumentResult> {
  const provider = getConfiguredOcrProvider();

  if (provider === 'disabled') {
    return {
      success: false,
      provider,
      text: '',
      pages: [],
      pageCount: 0,
      error: 'OCR provider is disabled',
    };
  }

  if (provider === 'tencent') {
    return extractWithTencent(request);
  }

  if (provider === 'zhipu-vision') {
    logger.warn('[OCR] Zhipu vision provider not implemented for PDF', {
      fileName: request.fileName,
    });
    return {
      success: false,
      provider,
      text: '',
      pages: [],
      pageCount: 0,
      error: 'Zhipu vision OCR not implemented for PDF yet',
    };
  }

  return {
    success: false,
    provider: 'disabled',
    text: '',
    pages: [],
    pageCount: 0,
    error: 'Unknown OCR provider',
  };
}
