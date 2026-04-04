/**
 * 聊天文件内容提取
 * 支持：PDF / DOCX / DOC / TXT
 * 用于 chat 上传文件后提取可供 AI 阅读的纯文本
 */

import { logger } from '@/lib/logger';

const MAX_CHARS = 15000; // 单文件最多提取 15000 字，避免超 token 限制

// ── PDF ──────────────────────────────────────────────────────────────────────

async function extractPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (
    buf: Buffer
  ) => Promise<{ text: string }>;
  const result = await pdfParse(buffer);
  return result.text?.trim() ?? '';
}

// ── DOCX ─────────────────────────────────────────────────────────────────────

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value?.trim() ?? '';
}

// ── TXT ──────────────────────────────────────────────────────────────────────

function extractTxt(buffer: Buffer): string {
  return buffer.toString('utf-8').trim();
}

// ── 主入口 ───────────────────────────────────────────────────────────────────

export async function extractFileText(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  try {
    let text = '';

    if (mimeType === 'application/pdf') {
      text = await extractPdf(buffer);
    } else if (
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword' ||
      fileName.endsWith('.docx') ||
      fileName.endsWith('.doc')
    ) {
      text = await extractDocx(buffer);
    } else if (mimeType === 'text/plain' || fileName.endsWith('.txt')) {
      text = extractTxt(buffer);
    } else {
      logger.warn('不支持的文件类型，跳过提取', { mimeType, fileName });
      return '';
    }

    if (!text) return '';

    // 截断 + 提示
    if (text.length > MAX_CHARS) {
      text =
        text.slice(0, MAX_CHARS) +
        `\n\n[文件内容过长，已截取前 ${MAX_CHARS} 字]`;
    }

    return text;
  } catch (err) {
    logger.error('文件内容提取失败', { fileName, mimeType, err });
    return '';
  }
}

// ── 安全校验（magic bytes） ───────────────────────────────────────────────────

const MAGIC: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'application/msword': [0xd0, 0xcf, 0x11, 0xe0],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    0x50, 0x4b, 0x03, 0x04,
  ],
};

export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const magic = MAGIC[mimeType];
  if (!magic) return true; // txt 等无固定 magic，放行
  return magic.every((byte, i) => buffer[i] === byte);
}

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
