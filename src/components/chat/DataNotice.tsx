'use client';

/**
 * 数据使用知情通知
 *
 * 律师首次使用对话功能时显示。明确告知：
 *  1. 对话内容发往哪些 AI 服务商
 *  2. 我们签署了哪些合规承诺
 *  3. 哪些信息会被自动脱敏
 *  4. 如何保护高度敏感的案件
 *
 * 确认后记入 localStorage，之后不再显示。
 */

import { useEffect, useState, startTransition } from 'react';
import { ShieldCheckIcon, AlertTriangleIcon, EyeOffIcon } from 'lucide-react';

const STORAGE_KEY = 'luban_privacy_acknowledged_v1';

export function DataNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const acknowledged = localStorage.getItem(STORAGE_KEY);
    if (!acknowledged) startTransition(() => setVisible(true));
  }, []);

  const handleAcknowledge = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4'>
      <div className='bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden'>
        {/* 标题 */}
        <div className='bg-slate-900 px-6 py-4 flex items-center gap-3'>
          <ShieldCheckIcon className='w-5 h-5 text-emerald-400 shrink-0' />
          <div>
            <h2 className='text-sm font-semibold text-white'>数据使用说明</h2>
            <p className='text-xs text-slate-400 mt-0.5'>首次使用前请阅读</p>
          </div>
        </div>

        <div className='px-6 py-5 space-y-4 text-sm text-slate-700'>
          {/* 数据流向 */}
          <section>
            <h3 className='font-medium text-slate-900 mb-1.5 flex items-center gap-1.5'>
              <span className='w-4 h-4 rounded-full bg-amber-100 text-amber-600 text-[10px] font-bold flex items-center justify-center'>
                !
              </span>
              您的对话内容将发往以下 AI 服务商处理
            </h3>
            <div className='rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 space-y-1.5'>
              <ProviderRow name='智谱清言（GLM-4）' region='中国大陆' />
              <ProviderRow name='DeepSeek（备用）' region='中国大陆' />
            </div>
            <p className='text-xs text-slate-500 mt-1.5'>
              上述服务商均为中国企业，数据存储在中国大陆服务器，适用《个人信息保护法》。
            </p>
          </section>

          {/* 合规承诺 */}
          <section>
            <h3 className='font-medium text-slate-900 mb-1.5 flex items-center gap-1.5'>
              <ShieldCheckIcon className='w-3.5 h-3.5 text-emerald-500' />
              我们与服务商的合规承诺
            </h3>
            <ul className='space-y-1 text-xs text-slate-600'>
              <CommitItem text='对话数据不用于 AI 模型训练' />
              <CommitItem text='不向第三方披露您的对话内容' />
              <CommitItem text='传输全程 TLS 加密' />
              <CommitItem text='正在与服务商推进数据处理协议（DPA）签署' />
            </ul>
          </section>

          {/* 自动脱敏 */}
          <section>
            <h3 className='font-medium text-slate-900 mb-1.5 flex items-center gap-1.5'>
              <EyeOffIcon className='w-3.5 h-3.5 text-blue-500' />
              发送前自动脱敏的信息类型
            </h3>
            <div className='flex flex-wrap gap-1.5'>
              {[
                '身份证号',
                '手机号',
                '固定电话',
                '统一社会信用代码',
                '银行卡号（含上下文）',
              ].map(t => (
                <span
                  key={t}
                  className='text-[11px] bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2.5 py-0.5'
                >
                  {t}
                </span>
              ))}
            </div>
            <p className='text-xs text-slate-500 mt-1.5'>
              以上信息在发给 AI
              前会被替换为占位符，您自己的对话记录中仍保留原始内容。
              <strong className='text-slate-700'>
                姓名、地址等非结构化信息暂无法自动识别，请您酌情处理。
              </strong>
            </p>
          </section>

          {/* 高度敏感案件建议 */}
          <section className='rounded-lg border border-slate-200 bg-slate-50 px-4 py-3'>
            <p className='text-xs text-slate-600 flex items-start gap-2'>
              <AlertTriangleIcon className='w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5' />
              <span>
                对于<strong>涉密、刑事辩护或高净值案件</strong>
                ，建议仅在对话中描述法律问题，
                避免直接输入当事人完整身份信息。我们正在研发本地 AI
                部署方案以实现零数据出境。
              </span>
            </p>
          </section>
        </div>

        {/* 操作区 */}
        <div className='px-6 pb-5 flex items-center justify-between gap-3'>
          <span className='text-xs text-slate-400'>如有疑问请联系律伴团队</span>
          <button
            onClick={handleAcknowledge}
            className='flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors'
          >
            <ShieldCheckIcon className='w-4 h-4' />
            我已了解，继续使用
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 子组件 ──────────────────────────────────────────────────────────────────

function ProviderRow({ name, region }: { name: string; region: string }) {
  return (
    <div className='flex items-center justify-between'>
      <span className='text-xs font-medium text-amber-800'>{name}</span>
      <span className='text-[10px] text-amber-600 bg-amber-100 rounded-full px-2 py-0.5'>
        {region}
      </span>
    </div>
  );
}

function CommitItem({ text }: { text: string }) {
  return (
    <li className='flex items-center gap-1.5'>
      <span className='w-3.5 h-3.5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[9px] font-bold shrink-0'>
        ✓
      </span>
      {text}
    </li>
  );
}
