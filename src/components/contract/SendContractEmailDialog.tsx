/**
 * 发送合同邮件对话框组件
 */
'use client';

import { useState } from 'react';

interface SendContractEmailDialogProps {
  contractId: string;
  defaultEmail?: string;
  defaultName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function SendContractEmailDialog({
  contractId,
  defaultEmail = '',
  defaultName = '',
  onClose,
  onSuccess,
}: SendContractEmailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    recipientEmail: defaultEmail,
    recipientName: defaultName,
    subject: '',
    message: '',
    attachPDF: true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/contracts/${contractId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        alert('邮件发送成功！');
        onSuccess?.();
        onClose();
      } else {
        setError(result.error?.message || '发送失败');
      }
    } catch (err) {
      console.error('发送邮件失败:', err);
      setError('发送邮件失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            📧 发送合同邮件
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              收件人邮箱 <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.recipientEmail}
              onChange={e =>
                setFormData({ ...formData, recipientEmail: e.target.value })
              }
              required
              placeholder="example@email.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              收件人姓名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.recipientName}
              onChange={e =>
                setFormData({ ...formData, recipientName: e.target.value })
              }
              required
              placeholder="张三"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              邮件主题（可选）
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={e =>
                setFormData({ ...formData, subject: e.target.value })
              }
              placeholder="留空则使用默认主题"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              附加消息（可选）
            </label>
            <textarea
              value={formData.message}
              onChange={e =>
                setFormData({ ...formData, message: e.target.value })
              }
              rows={4}
              placeholder="在邮件中添加自定义消息..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.attachPDF}
              onChange={e =>
                setFormData({ ...formData, attachPDF: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label className="ml-2 text-sm text-gray-700">
              附带合同PDF文件
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '发送中...' : '发送邮件'}
            </button>
          </div>
        </form>

        <div className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
          <p className="font-medium">提示：</p>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            <li>邮件将包含合同详情和在线查看链接</li>
            <li>如勾选附带PDF，将自动生成并附加合同PDF文件</li>
            <li>邮件发送后无法撤回，请确认信息无误</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
