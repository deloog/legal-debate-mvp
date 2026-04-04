import { NextRequest, NextResponse } from 'next/server';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx';
import { getAuthUser } from '@/lib/middleware/auth';

/**
 * POST /api/v1/chat/export/docx
 * 将 Markdown 文本转换为 Word 文档并返回二进制流
 */
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, message: '未授权' },
      { status: 401 }
    );
  }

  const body = (await request.json()) as { content?: string };
  const content = (body.content ?? '').trim();
  if (!content) {
    return NextResponse.json(
      { success: false, message: '内容不能为空' },
      { status: 400 }
    );
  }

  const paragraphs = markdownToDocxParagraphs(content);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: '宋体', size: 24 }, // 12pt
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1800, right: 1800 },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const buffer = Buffer.from(await Packer.toBuffer(doc));
  const date = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`律伴文书_${date}`)}.docx`,
      'Content-Length': String(buffer.length),
    },
  });
}

// ── Markdown → docx Paragraph 转换 ────────────────────────────────────────

function markdownToDocxParagraphs(markdown: string): Paragraph[] {
  const lines = markdown.split('\n');
  const result: Paragraph[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();

    // 空行
    if (!line.trim()) {
      result.push(new Paragraph({ text: '' }));
      continue;
    }

    // 标题
    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);
    if (h1) {
      result.push(
        new Paragraph({
          text: h1[1],
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        })
      );
      continue;
    }
    if (h2) {
      result.push(
        new Paragraph({ text: h2[1], heading: HeadingLevel.HEADING_2 })
      );
      continue;
    }
    if (h3) {
      result.push(
        new Paragraph({ text: h3[1], heading: HeadingLevel.HEADING_3 })
      );
      continue;
    }

    // 分隔线
    if (/^[-*_]{3,}$/.test(line.trim())) {
      result.push(
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' },
          },
          text: '',
        })
      );
      continue;
    }

    // 无序列表
    const ul = line.match(/^[-*+]\s+(.*)/);
    if (ul) {
      result.push(
        new Paragraph({
          children: parseInline(ul[1]),
          bullet: { level: 0 },
        })
      );
      continue;
    }

    // 有序列表
    const ol = line.match(/^\d+\.\s+(.*)/);
    if (ol) {
      result.push(
        new Paragraph({
          children: parseInline(ol[1]),
          numbering: { reference: 'default-numbering', level: 0 },
        })
      );
      continue;
    }

    // 普通段落（含 inline 格式）
    result.push(new Paragraph({ children: parseInline(line) }));
  }

  return result;
}

// 解析行内格式：**bold**、*italic*、【待填写:...】高亮
function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // 匹配 **bold**、*italic*、【...】三种模式
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|【([^】]+)】)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // 普通文字
    if (match.index > last) {
      runs.push(new TextRun({ text: text.slice(last, match.index) }));
    }
    if (match[2] !== undefined) {
      // **bold**
      runs.push(new TextRun({ text: match[2], bold: true }));
    } else if (match[3] !== undefined) {
      // *italic*
      runs.push(new TextRun({ text: match[3], italics: true }));
    } else if (match[4] !== undefined) {
      // 【待填写...】—— 用下划线突出
      runs.push(
        new TextRun({ text: `【${match[4]}】`, underline: {}, color: '888888' })
      );
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    runs.push(new TextRun({ text: text.slice(last) }));
  }

  return runs.length > 0 ? runs : [new TextRun({ text })];
}
