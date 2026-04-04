/**
 * /chat/[conversationId]/print
 * 对话打印页：仅含对话内容，无导航栏，打开后自动调起打印对话框
 */

import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db';

type Props = { params: Promise<{ conversationId: string }> };

export default async function PrintPage({ params }: Props) {
  const { conversationId } = await params;

  // 服务端读取 JWT cookie 进行认证
  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken')?.value;
  const authResult = token ? verifyToken(token) : null;
  if (!authResult?.valid || !authResult.payload) {
    return (
      <html lang='zh-CN'>
        <body
          style={{ fontFamily: '宋体, serif', padding: '2rem', color: '#333' }}
        >
          <p>请先登录后再访问此页面。</p>
        </body>
      </html>
    );
  }

  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: authResult.payload.userId },
    include: {
      messages: {
        where: { isDeleted: false },
        orderBy: { createdAt: 'asc' },
        include: {
          attachments: { select: { fileName: true, fileType: true } },
        },
      },
    },
  });

  if (!conv) notFound();

  return (
    <html lang='zh-CN'>
      <head>
        <meta charSet='utf-8' />
        <title>{conv.title} — 律伴对话记录</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: '宋体', 'SimSun', serif;
            font-size: 14px;
            line-height: 1.8;
            color: #333;
            padding: 40px 60px;
            max-width: 900px;
            margin: 0 auto;
          }
          h1 { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
          .meta { font-size: 12px; color: #888; margin-bottom: 24px; }
          .message { margin-bottom: 20px; }
          .message-header { font-size: 12px; color: #888; margin-bottom: 4px; }
          .user-content {
            background: #f5f5f5;
            border-radius: 8px;
            padding: 10px 14px;
            display: inline-block;
            max-width: 80%;
            float: right;
            clear: both;
            font-size: 14px;
          }
          .ai-content {
            padding: 8px 0;
            clear: both;
          }
          .ai-content p { margin-bottom: 8px; }
          .ai-content h2 { font-size: 16px; font-weight: bold; margin: 12px 0 6px; }
          .ai-content h3 { font-size: 15px; font-weight: bold; margin: 10px 0 4px; }
          .ai-content ul, .ai-content ol { padding-left: 1.5em; margin-bottom: 8px; }
          .ai-content li { margin-bottom: 2px; }
          .ai-content strong { font-weight: bold; }
          .ai-content em { font-style: italic; }
          .attachments { font-size: 12px; color: #666; margin-top: 4px; }
          .divider { border: none; border-top: 1px solid #eee; margin: 16px 0; }
          @media print {
            body { padding: 20px 40px; }
            .no-print { display: none; }
          }
        `}</style>
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: 'window.onload = () => window.print();',
          }}
        />

        <h1>{conv.title}</h1>
        <p className='meta'>
          导出时间：{new Date().toLocaleString('zh-CN')} | 共{' '}
          {conv.messages.length} 条消息
        </p>
        <hr className='divider' />

        {conv.messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const time = new Date(msg.createdAt).toLocaleString('zh-CN');
          // 去掉文书标记
          const displayContent = msg.content
            .replace(
              /:::DOCUMENT_START:::[\s\S]*?:::DOCUMENT_END:::/g,
              '[文书已另行生成]'
            )
            .trim();

          return (
            <div key={msg.id} className='message'>
              <p className='message-header'>
                {isUser ? '用户' : '律伴 AI'} · {time}
              </p>
              {isUser ? (
                <div style={{ textAlign: 'right' }}>
                  <span className='user-content'>{displayContent}</span>
                  <div style={{ clear: 'both' }} />
                </div>
              ) : (
                <div
                  className='ai-content'
                  dangerouslySetInnerHTML={{
                    __html: markdownToHtml(displayContent),
                  }}
                />
              )}
              {msg.attachments.length > 0 && (
                <p className='attachments'>
                  附件：{msg.attachments.map(a => a.fileName).join('、')}
                </p>
              )}
              {i < conv.messages.length - 1 && <hr className='divider' />}
            </div>
          );
        })}
      </body>
    </html>
  );
}

// 极简 Markdown → HTML（服务端，不用 ReactMarkdown）
// 先 strip 危险标签（script/iframe/object 等），再做 Markdown 转换
function markdownToHtml(md: string): string {
  // 移除潜在危险标签和 javascript: 链接
  const sanitized = md
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '');

  return sanitized
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^[-*+] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, s => `<ul>${s}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^---+$/gm, '<hr/>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/^(?!<[hulo]|<\/[hulo])(.+)$/gm, '$1')
    .replace(/^(.+)$/gm, line => {
      if (line.startsWith('<')) return line;
      return `<p>${line}</p>`;
    });
}
