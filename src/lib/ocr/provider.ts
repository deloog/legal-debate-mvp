import { logger } from '@/lib/logger';
import type {
  OcrDocumentRequest,
  OcrDocumentResult,
  OcrProvider,
} from './types';

export function getConfiguredOcrProvider(): OcrProvider {
  const value = (process.env.OCR_PROVIDER || 'disabled').toLowerCase();
  if (value === 'tencent') return 'tencent';
  if (value === 'zhipu-vision') return 'zhipu-vision';
  return 'disabled';
}

export function isOcrEnabled(): boolean {
  return getConfiguredOcrProvider() !== 'disabled';
}

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
    logger.warn('Tencent OCR provider is not implemented yet', {
      fileName: request.fileName,
    });
    return {
      success: false,
      provider,
      text: '',
      pages: [],
      pageCount: 0,
      error: 'Tencent OCR provider not implemented yet',
    };
  }

  if (provider === 'zhipu-vision') {
    logger.warn('Zhipu vision OCR provider is not implemented for PDF yet', {
      fileName: request.fileName,
    });
    return {
      success: false,
      provider,
      text: '',
      pages: [],
      pageCount: 0,
      error: 'Zhipu vision OCR provider not implemented for PDF yet',
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
