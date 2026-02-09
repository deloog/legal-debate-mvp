'use client';

import { useRef, useState } from 'react';

interface LawArticleImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type DataSource =
  | 'local'
  | 'judiciary'
  | 'cail'
  | 'lawgpt'
  | 'lawstar'
  | 'pkulaw';

interface ImportError {
  lawName: string;
  articleNumber: string;
  reason: string;
}

interface ImportProgress {
  total: number;
  current: number;
  success: number;
  failed: number;
}

/**
 * 法条导入对话框组件
 */
export function LawArticleImportDialog({
  open,
  onClose,
  onSuccess,
}: LawArticleImportDialogProps): React.ReactElement {
  const [dataSource, setDataSource] = useState<DataSource>('local');
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [importMode, setImportMode] = useState<'text' | 'file'>('text');
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setSuccess(false);
    setErrors([]);
    setShowErrors(false);

    try {
      let parsedJson;
      let articles;

      if (importMode === 'file') {
        // 文件上传模式
        const fileInput = fileInputRef.current;
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
          throw new Error('请选择文件');
        }

        const file = fileInput.files[0];
        const fileText = await file.text();
        parsedJson = JSON.parse(fileText);

        // 检查是否直接是数组
        if (Array.isArray(parsedJson)) {
          articles = parsedJson;
        } else if (parsedJson.articles && Array.isArray(parsedJson.articles)) {
          articles = parsedJson.articles;
        } else {
          throw new Error('JSON格式错误：必须包含articles数组或直接是数组');
        }
      } else {
        // 文本输入模式
        parsedJson = JSON.parse(jsonText);

        // 检查是否直接是数组
        if (Array.isArray(parsedJson)) {
          articles = parsedJson;
        } else if (parsedJson.articles && Array.isArray(parsedJson.articles)) {
          articles = parsedJson.articles;
        } else {
          throw new Error('JSON格式错误：必须包含articles数组或直接是数组');
        }
      }

      // 初始化进度
      setProgress({
        total: articles.length,
        current: 0,
        success: 0,
        failed: 0,
      });

      const response = await fetch('/api/admin/law-articles/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataSource,
          articles,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '导入法条失败');
      }

      const result = await response.json();

      // 更新最终进度
      setProgress({
        total: result.data.total,
        current: result.data.total,
        success: result.data.success,
        failed: result.data.failed,
      });

      // 保存错误信息
      if (result.data.errors && result.data.errors.length > 0) {
        setErrors(result.data.errors);
        setShowErrors(true);
      }

      setSuccess(true);

      if (result.data.failed > 0) {
        // 不使用alert，改为显示错误列表
        setShowErrors(true);
      } else {
        // 清空输入
        setJsonText('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  // 重试失败的法条
  const handleRetry = async () => {
    if (errors.length === 0) return;

    setError(null);
    setLoading(true);
    setShowErrors(false);

    try {
      // 从原始数据中提取失败的法条
      let parsedJson;
      if (importMode === 'file') {
        const fileInput = fileInputRef.current;
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
          throw new Error('请重新选择文件');
        }
        const file = fileInput.files[0];
        const fileText = await file.text();
        parsedJson = JSON.parse(fileText);
      } else {
        parsedJson = JSON.parse(jsonText);
      }

      const allArticles = Array.isArray(parsedJson)
        ? parsedJson
        : parsedJson.articles;

      // 筛选出失败的法条
      const failedArticles = allArticles.filter(
        (article: { lawName: string; articleNumber: string }) =>
          errors.some(
            err =>
              err.lawName === article.lawName &&
              err.articleNumber === article.articleNumber
          )
      );

      if (failedArticles.length === 0) {
        throw new Error('未找到失败的法条');
      }

      // 重新提交失败的法条
      const response = await fetch('/api/admin/law-articles/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataSource,
          articles: failedArticles,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '重试失败');
      }

      const result = await response.json();

      // 更新错误列表
      if (result.data.errors && result.data.errors.length > 0) {
        setErrors(result.data.errors);
        setShowErrors(true);
      } else {
        setErrors([]);
        setShowErrors(false);
        setSuccess(true);
        // 清空输入
        setJsonText('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        onSuccess();
      }

      // 更新进度
      if (progress) {
        setProgress({
          ...progress,
          success: progress.success + result.data.success,
          failed: result.data.failed,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '重试失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileText = await file.text();
      setJsonText(fileText);
      setError(null);
    } catch {
      setError('读取文件失败');
    }
  };

  if (!open) {
    return <></>;
  }

  const dataSourceOptions: { value: DataSource; label: string }[] = [
    { value: 'local', label: '本地数据' },
    { value: 'judiciary', label: '司法部' },
    { value: 'cail', label: 'CAIL' },
    { value: 'lawgpt', label: 'LaWGPT' },
    { value: 'lawstar', label: '法律之星' },
    { value: 'pkulaw', label: '北大法宝' },
  ];

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto'>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-xl font-bold'>导入法条</h2>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600'
            disabled={loading}
          >
            <svg
              className='h-6 w-6'
              fill='none'
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth='2'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path d='M6 18L18 6M6 6l12 12'></path>
            </svg>
          </button>
        </div>

        {error && (
          <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4'>
            {error}
          </div>
        )}

        {success && !showErrors && (
          <div className='bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4'>
            导入成功
          </div>
        )}

        {/* 进度显示 */}
        {progress && (
          <div className='mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
            <div className='flex justify-between items-center mb-2'>
              <span className='text-sm font-medium text-blue-900'>
                导入进度
              </span>
              <span className='text-sm text-blue-700'>
                {progress.current}/{progress.total} (
                {Math.round((progress.current / progress.total) * 100)}%)
              </span>
            </div>
            <div className='w-full bg-blue-200 rounded-full h-2 mb-2'>
              <div
                className='bg-blue-600 h-2 rounded-full transition-all duration-300'
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                }}
              />
            </div>
            <div className='flex justify-between text-xs text-blue-700'>
              <span>成功: {progress.success}</span>
              <span>失败: {progress.failed}</span>
            </div>
          </div>
        )}

        {/* 错误列表 */}
        {showErrors && errors.length > 0 && (
          <div className='mb-4 p-4 bg-red-50 border border-red-200 rounded-lg'>
            <div className='flex justify-between items-center mb-2'>
              <h3 className='text-sm font-semibold text-red-900'>
                导入失败的法条 ({errors.length})
              </h3>
              <button
                onClick={handleRetry}
                disabled={loading}
                className='text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {loading ? '重试中...' : '重试失败项'}
              </button>
            </div>
            <div className='max-h-48 overflow-y-auto'>
              <table className='w-full text-xs'>
                <thead className='bg-red-100 sticky top-0'>
                  <tr>
                    <th className='px-2 py-1 text-left text-red-900'>
                      法条名称
                    </th>
                    <th className='px-2 py-1 text-left text-red-900'>条号</th>
                    <th className='px-2 py-1 text-left text-red-900'>
                      失败原因
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((err, index) => (
                    <tr key={index} className='border-b border-red-200'>
                      <td className='px-2 py-1 text-red-800'>{err.lawName}</td>
                      <td className='px-2 py-1 text-red-800'>
                        {err.articleNumber}
                      </td>
                      <td className='px-2 py-1 text-red-700'>{err.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 数据源选择 */}
          <div className='mb-4'>
            <label
              htmlFor='dataSource'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              数据来源
            </label>
            <select
              id='dataSource'
              value={dataSource}
              onChange={e => setDataSource(e.target.value as DataSource)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              {dataSourceOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className='text-xs text-gray-500 mt-1'>
              选择数据来源以帮助追踪法条来源
            </p>
          </div>

          {/* 导入模式选择 */}
          <div className='mb-4'>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              导入方式
            </label>
            <div className='flex space-x-4'>
              <label className='flex items-center'>
                <input
                  type='radio'
                  value='text'
                  checked={importMode === 'text'}
                  onChange={() => setImportMode('text')}
                  className='mr-2'
                />
                <span>粘贴JSON</span>
              </label>
              <label className='flex items-center'>
                <input
                  type='radio'
                  value='file'
                  checked={importMode === 'file'}
                  onChange={() => setImportMode('file')}
                  className='mr-2'
                />
                <span>上传文件</span>
              </label>
            </div>
          </div>

          {/* JSON输入或文件上传 */}
          {importMode === 'text' ? (
            <div className='mb-4'>
              <label
                htmlFor='jsonInput'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                JSON数据
              </label>
              <textarea
                id='jsonInput'
                value={jsonText}
                onChange={e => setJsonText(e.target.value)}
                className='w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm'
                placeholder='请输入JSON格式的法条数据...'
                required
              />
              <p className='text-xs text-gray-500 mt-1'>
                JSON格式示例：
                {`{"articles": [{"lawName":"中华人民共和国民法典","articleNumber":"第一条","fullText":"...","lawType":"CIVIL","category":"CIVIL_GENERAL","effectiveDate":"2021-01-01"}]}`}
              </p>
            </div>
          ) : (
            <div className='mb-4'>
              <label
                htmlFor='fileInput'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                选择JSON文件
              </label>
              <input
                ref={fileInputRef}
                type='file'
                id='fileInput'
                accept='.json'
                onChange={handleFileChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                required
              />
              <p className='text-xs text-gray-500 mt-1'>
                支持的文件格式：.json（最大10MB）
              </p>
            </div>
          )}

          {/* 数据格式说明 */}
          <div className='mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
            <h3 className='text-sm font-semibold text-blue-900 mb-2'>
              数据格式说明
            </h3>
            <pre className='text-xs text-blue-800 overflow-x-auto'>
              {`[
  {
    "lawName": "法律名称",
    "articleNumber": "条号",
    "fullText": "法条完整内容",
    "lawType": "LAW | CONSTITUTION | ADMINISTRATIVE_REGULATION | ...",
    "category": "CIVIL | CRIMINAL | ADMINISTRATIVE | ...",
    "subCategory": "子类别（可选）",
    "effectiveDate": "2021-01-01",
    "expiryDate": "2025-01-01（可选）",
    "status": "VALID | AMENDED | REPEALED（可选）",
    "issuingAuthority": "颁布机关（可选）",
    "jurisdiction": "适用地区（可选）",
    "keywords": ["关键词1", "关键词2"]（可选）,
    "tags": ["标签1", "标签2"]（可选）,
    "level": 1（法律层级，可选）,
    "sourceId": "原始数据ID（可选）"
  }
]`}
            </pre>
          </div>

          <div className='flex justify-end space-x-3'>
            <button
              type='button'
              onClick={onClose}
              disabled={loading}
              className='px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              取消
            </button>
            <button
              type='submit'
              disabled={loading || (importMode === 'text' && !jsonText.trim())}
              className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {loading ? '导入中...' : '导入'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
