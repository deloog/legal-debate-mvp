export type OcrProvider = 'disabled' | 'tencent' | 'zhipu-vision';

export interface PdfTextExtractionResult {
  text: string;
  pageCount: number;
  avgCharsPerPage: number;
  scannedLike: boolean;
}

export interface OcrPageResult {
  page: number;
  text: string;
}

export interface OcrDocumentResult {
  success: boolean;
  provider: OcrProvider;
  text: string;
  pages: OcrPageResult[];
  pageCount: number;
  warnings?: string[];
  error?: string;
}

export interface OcrDocumentRequest {
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
}
