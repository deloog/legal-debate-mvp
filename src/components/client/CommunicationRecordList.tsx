import { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { CommunicationRecordForm } from './CommunicationRecordForm';
import { CommunicationType } from '../../types/client';

interface CommunicationRecord {
  id: string;
  clientId: string;
  userId: string;
  type: CommunicationType;
  summary: string;
  content: string | null;
  nextFollowUpDate: Date | null;
  isImportant: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CommunicationRecordListProps {
  clientId: string;
}

export function CommunicationRecordList({
  clientId,
}: CommunicationRecordListProps) {
  const [communications, setCommunications] = useState<CommunicationRecord[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState<CommunicationType | null>(null);
  const [filterImportant, setFilterImportant] = useState<boolean | null>(null);
  const [editingRecord, setEditingRecord] =
    useState<CommunicationRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const limit = 10;

  const communicationTypes = [
    { value: CommunicationType.PHONE, label: '电话' },
    { value: CommunicationType.EMAIL, label: '邮件' },
    { value: CommunicationType.MEETING, label: '面谈' },
    { value: CommunicationType.WECHAT, label: '微信' },
    { value: CommunicationType.OTHER, label: '其他' },
  ];

  const loadCommunications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        clientId,
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filterType) {
        params.set('type', filterType);
      }

      if (filterImportant !== null) {
        params.set('isImportant', filterImportant.toString());
      }

      const response = await fetch(`/api/communications?${params.toString()}`);

      if (!response.ok) {
        throw new Error('获取沟通记录失败');
      }

      const data = await response.json();
      setCommunications(data.communications);
      setTotal(data.total);
    } catch (error) {
      console.error('获取沟通记录失败:', error);
      alert('获取沟通记录失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [clientId, page, filterType, filterImportant]);

  useEffect(() => {
    loadCommunications();
  }, [loadCommunications]);

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此沟通记录吗？此操作不可恢复。')) {
      return;
    }

    try {
      const response = await fetch(`/api/communications/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除沟通记录失败');
      }

      await loadCommunications();
    } catch (error) {
      console.error('删除沟通记录失败:', error);
      alert('删除沟通记录失败，请重试');
    }
  };

  const handleEdit = (record: CommunicationRecord) => {
    setEditingRecord(record);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingRecord(null);
    loadCommunications();
  };

  const getTypeBadge = (type: CommunicationType): string => {
    const badges: Record<CommunicationType, string> = {
      [CommunicationType.PHONE]: 'bg-blue-100 text-blue-800',
      [CommunicationType.EMAIL]: 'bg-green-100 text-green-800',
      [CommunicationType.MEETING]: 'bg-purple-100 text-purple-800',
      [CommunicationType.WECHAT]: 'bg-yellow-100 text-yellow-800',
      [CommunicationType.OTHER]: 'bg-gray-100 text-gray-800',
    };
    return badges[type];
  };

  const getTypeLabel = (type: CommunicationType): string => {
    const labels: Record<CommunicationType, string> = {
      [CommunicationType.PHONE]: '电话',
      [CommunicationType.EMAIL]: '邮件',
      [CommunicationType.MEETING]: '面谈',
      [CommunicationType.WECHAT]: '微信',
      [CommunicationType.OTHER]: '其他',
    };
    return labels[type];
  };

  return (
    <div className='space-y-4'>
      {/* 工具栏 */}
      <div className='flex flex-wrap gap-4'>
        <select
          value={filterType ?? ''}
          onChange={e =>
            setFilterType(
              e.target.value ? (e.target.value as CommunicationType) : null
            )
          }
          className='rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
        >
          <option value=''>全部类型</option>
          {communicationTypes.map(item => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <select
          value={filterImportant === null ? '' : filterImportant.toString()}
          onChange={e =>
            setFilterImportant(
              e.target.value === '' ? null : e.target.value === 'true'
            )
          }
          className='rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
        >
          <option value=''>全部</option>
          <option value='true'>重要</option>
          <option value='false'>普通</option>
        </select>

        <div className='flex-1' />

        <Button
          variant='primary'
          onClick={() => {
            setEditingRecord(null);
            setShowForm(true);
          }}
        >
          添加记录
        </Button>
      </div>

      {/* 沟通记录列表 */}
      {loading ? (
        <div className='space-y-3'>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className='h-32 animate-pulse rounded-lg border border-gray-200 bg-white'
            />
          ))}
        </div>
      ) : communications.length === 0 ? (
        <div className='rounded-lg border border-gray-200 bg-white py-8 text-center'>
          <p className='text-gray-500'>暂无沟通记录</p>
        </div>
      ) : (
        <div className='space-y-3'>
          {communications.map(record => (
            <div
              key={record.id}
              className='rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md'
            >
              <div className='mb-2 flex items-start justify-between'>
                <div className='flex items-center gap-2'>
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${getTypeBadge(
                      record.type
                    )}`}
                  >
                    {getTypeLabel(record.type)}
                  </span>
                  {record.isImportant && (
                    <span className='rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800'>
                      重要
                    </span>
                  )}
                </div>
                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handleEdit(record)}
                  >
                    编辑
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handleDelete(record.id)}
                    className='text-red-600 hover:bg-red-50'
                  >
                    删除
                  </Button>
                </div>
              </div>

              <p className='mb-2 text-sm font-medium text-gray-900'>
                {record.summary}
              </p>

              {record.content && (
                <p className='mb-3 text-sm text-gray-600'>{record.content}</p>
              )}

              {record.nextFollowUpDate && (
                <div className='mb-3 rounded bg-blue-50 px-3 py-2'>
                  <p className='text-sm text-blue-900'>
                    下次跟进时间:{' '}
                    {new Date(record.nextFollowUpDate).toLocaleString('zh-CN')}
                  </p>
                </div>
              )}

              <div className='flex items-center justify-between text-xs text-gray-500'>
                <p>
                  创建时间: {new Date(record.createdAt).toLocaleString('zh-CN')}
                </p>
                {record.updatedAt !== record.createdAt && (
                  <p>
                    更新时间:{' '}
                    {new Date(record.updatedAt).toLocaleString('zh-CN')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页控件 */}
      {total > limit && (
        <div className='flex items-center justify-between'>
          <p className='text-sm text-gray-600'>
            共 {total} 条记录，第 {page} 页
          </p>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              上一页
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setPage(page + 1)}
              disabled={page * limit >= total}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      {/* 表单对话框 */}
      {showForm && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl'>
            <h2 className='mb-4 text-xl font-semibold'>
              {editingRecord ? '编辑沟通记录' : '添加沟通记录'}
            </h2>
            <div className='mb-4'>
              <CommunicationRecordForm
                clientId={clientId}
                onSuccess={handleFormSuccess}
                onCancel={() => {
                  setShowForm(false);
                  setEditingRecord(null);
                }}
                editingRecord={
                  editingRecord
                    ? {
                        id: editingRecord.id,
                        type: editingRecord.type,
                        summary: editingRecord.summary,
                        content: editingRecord.content,
                        nextFollowUpDate: editingRecord.nextFollowUpDate,
                        isImportant: editingRecord.isImportant,
                      }
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
