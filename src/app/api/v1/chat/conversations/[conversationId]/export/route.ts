/**
 * GET /api/v1/chat/conversations/[conversationId]/export/annotations
 * 导出对话全部批注为 Word 文档（按类型分组）
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
} from 'docx';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

type Params = { params: Promise<{ conversationId: string }> };

const TYPE_LABELS: Record<string, string> = {
  CONFIRM: '✅ 已确认',
  IMPORTANT: '⭐ 重要标记',
  QUESTION: '❓ 存疑',
  REJECT: '❌ 否定',
  USE_IN_DOC: '📄 已入文书',
};

const TYPE_ORDER = ['IMPORTANT', 'CONFIRM', 'QUESTION', 'REJECT', 'USE_IN_DOC'];

export async function GET(request: NextRequest, { params }: Params) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const { conversationId } = await params;

    // 验证归属
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: authUser.userId },
      select: { id: true, title: true },
    });
    if (!conv) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '对话不存在' } },
        { status: 404 }
      );
    }

    // 查询该对话下所有批注（含消息序号）
    const annotations = await prisma.annotation.findMany({
      where: {
        userId: authUser.userId,
        message: { conversationId },
      },
      include: {
        message: { select: { role: true, createdAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (annotations.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'EMPTY', message: '该对话暂无批注' } },
        { status: 400 }
      );
    }

    // 按类型分组
    const groups: Record<string, typeof annotations> = {};
    for (const ann of annotations) {
      const t = ann.type;
      if (!groups[t]) groups[t] = [];
      groups[t].push(ann);
    }

    const date = new Date().toLocaleDateString('zh-CN');
    const children: Paragraph[] = [
      new Paragraph({
        children: [
          new TextRun({
            text: `《${conv.title}》批注报告`,
            bold: true,
            size: 36,
            font: '黑体',
          }),
        ],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `生成日期：${date}　共 ${annotations.length} 条批注`,
            color: '888888',
            size: 20,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ text: '' }),
    ];

    for (const type of TYPE_ORDER) {
      const items = groups[type];
      if (!items?.length) continue;

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: TYPE_LABELS[type] ?? type,
              bold: true,
              size: 26,
              font: '黑体',
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400 },
        }),
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' },
          },
          text: '',
        })
      );

      for (const ann of items) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: '原文：', bold: true }),
              new TextRun({
                text: ann.selectedText,
                italics: true,
                color: '444444',
              }),
            ],
            spacing: { before: 200 },
            shading: {
              type: ShadingType.SOLID,
              color: 'F5F5F5',
              fill: 'F5F5F5',
            },
          })
        );
        if (ann.note) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: '备注：', bold: true }),
                new TextRun({ text: ann.note }),
              ],
            })
          );
        }
        const createdAt = new Date(ann.createdAt).toLocaleString('zh-CN');
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: createdAt, color: 'AAAAAA', size: 18 }),
            ],
            spacing: { after: 200 },
          })
        );
      }
    }

    // 统计汇总表
    children.push(
      new Paragraph({ text: '' }),
      new Paragraph({
        children: [
          new TextRun({ text: '统计汇总', bold: true, size: 26, font: '黑体' }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400 },
      })
    );

    const tableRows: TableRow[] = [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: '类型', bold: true })],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: '数量', bold: true })],
              }),
            ],
          }),
        ],
        tableHeader: true,
      }),
      ...TYPE_ORDER.filter(t => groups[t]?.length).map(
        t =>
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ text: TYPE_LABELS[t] ?? t })],
              }),
              new TableCell({
                children: [new Paragraph({ text: String(groups[t].length) })],
              }),
            ],
          })
      ),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: '合计', bold: true })],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: String(annotations.length), bold: true }),
                ],
              }),
            ],
          }),
        ],
      }),
    ];

    children.push(
      new Table({
        rows: tableRows,
        width: { size: 5000, type: WidthType.DXA },
      }) as unknown as Paragraph
    );

    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: '宋体', size: 24 } },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1440, bottom: 1440, left: 1800, right: 1800 },
            },
          },
          children,
        },
      ],
    });

    const buffer = Buffer.from(await Packer.toBuffer(doc));
    const fileName = encodeURIComponent(
      `批注报告_${conv.title.slice(0, 20)}_${date.replace(/\//g, '-')}`
    );

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${fileName}.docx`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    logger.error('导出批注报告失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}
