/**
 * 合同列表页面
 */
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ContractStatus } from '@/types/contract';

interface Contract {
  id: string;
  contractNumber: string;
  clientName: string;
  clientType: string;
  caseType: string;
  totalFee: number;
  paidAmount: number;
  status: ContractStatus;
  signedAt: Date | null;
  createdAt: Date;
  case: {
    id: string;
    title: string;
    caseNumber: string | null;
  } | null;
  paymentCount: number;
  paidPaymentCount: number;
}

interface ContractListResponse {
  success: boolean;
  data: {
    items: Contract[];
    total: number;
    page: number;
    pageSize: number;
  };
}

const statusLabels: Record<ContractStatus, string> = {
  DRAFT: '草稿',
  PENDING: '待签署',
  SIGNED: '已签署',
  EXECUTING: '履行中',
  COMPLETED: '已完成',
  TERMINATED: '已终止',
};

const statusColors: Record<ContractStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  SIGNED: 'bg-blue-100 text-blue-800',
  EXECUTING: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-purple-100 text-purple-800',
  TERMINATED: 'bg-red-100 text-red-800',
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 筛选条件
  const [status, setStatus] = useState<ContractStatus | ''>('');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    loadContracts();
  }, [page, status]);

  async function loadContracts() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (status) params.append('status', status);
      if (keyword) params.append('keyword', keyword);

      const response = await fetch(`/api/contracts?${params}`);
      const result: ContractListResponse = await response.json();

      if (result.success) {
        setContracts(result.data.items);
        setTotal(result.data.total);
      } else {
        setError('加载合同列表失败');
      }
    } catch (err) {
      console.error('加载合同列表失败:', err);
      setError('加载合同列表失败，请刷新页面重试');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    setPage(1);
    loadContracts();
  }

  function getPaymentStatus(contract: Contract) {
    if (contract.paidAmount === 0) {
      return { label: '未付', color: 'text-red-600' };
    } else if (contract.paidAmount >= contract.totalFee) {
      return { label: '全额', color: 'text-green-600' };
    } else {
      return { label: '部分', color: 'text-yellow-600' };
    }
  }

  return (
    <div className='min-h-screen bg-gray-50 p-6'>
      <div className='mx-auto max-w-7xl'>
        {/* 页面标题 */}
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>委托合同</h1>
            <p className='mt-1 text-sm text-gray-500'>
              管理委托合同、付款记录和合同状态
            </p>
          </div>
          <Link
            href='/contracts/new'
            className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
          >
            新建合同
          </Link>
        </div>

        {/* 筛选栏 */}
        <div className='mb-6 rounded-lg bg-white p-4 shadow'>
          <div className='flex flex-wrap gap-4'>
            {/* 状态筛选 */}
            <div className='flex-1 min-w-[200px]'>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                状态
              </label>
              <select
                value={status}
                onChange={e => {
                  setStatus(e.target.value as ContractStatus | '');
                  setPage(1);
                }}
                className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
              >
                <option value=''>全部状态</option>
                <option value='DRAFT'>草稿</option>
                <option value='PENDING'>待签署</option>
                <option value='SIGNED'>已签署</option>
                <option value='EXECUTING'>履行中</option>
                <option value='COMPLETED'>已完成</option>
                <option value='TERMINATED'>已终止</option>
              </select>
            </div>

            {/* 关键词搜索 */}
            <div className='flex-1 min-w-[300px]'>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                搜索
              </label>
              <div className='flex gap-2'>
                <input
                  type='text'
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder='搜索客户名称或合同编号'
                  className='flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
                <button
                  onClick={handleSearch}
                  className='rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
                >
                  搜索
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className='mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800'>
            {error}
          </div>
        )}

        {/* 合同列表 */}
        <div className='rounded-lg bg-white shadow'>
          {loading ? (
            <div className='p-8 text-center text-gray-500'>加载中...</div>
          ) : contracts.length === 0 ? (
            <div className='p-8 text-center text-gray-500'>暂无合同记录</div>
          ) : (
            <>
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead className='bg-gray-50'>
                    <tr>
                      <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                        合同编号
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                        客户
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                        案件类型
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                        总费用
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                        已付金额
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                        状态
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                        签署日期
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-200 bg-white'>
                    {contracts.map(contract => {
                      const paymentStatus = getPaymentStatus(contract);
                      return (
                        <tr key={contract.id} className='hover:bg-gray-50'>
                          <td className='whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900'>
                            {contract.contractNumber}
                          </td>
                          <td className='px-6 py-4 text-sm text-gray-900'>
                            <div>{contract.clientName}</div>
                            <div className='text-xs text-gray-500'>
                              {contract.clientType === 'INDIVIDUAL'
                                ? '个人'
                                : '企业'}
                            </div>
                          </td>
                          <td className='px-6 py-4 text-sm text-gray-900'>
                            {contract.caseType}
                          </td>
                          <td className='whitespace-nowrap px-6 py-4 text-sm text-gray-900'>
                            ¥{contract.totalFee.toLocaleString()}
                          </td>
                          <td className='whitespace-nowrap px-6 py-4 text-sm'>
                            <div className='text-gray-900'>
                              ¥{contract.paidAmount.toLocaleString()}
                            </div>
                            <div className={`text-xs ${paymentStatus.color}`}>
                              {paymentStatus.label}
                            </div>
                          </td>
                          <td className='whitespace-nowrap px-6 py-4 text-sm'>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusColors[contract.status]}`}
                            >
                              {statusLabels[contract.status]}
                            </span>
                          </td>
                          <td className='whitespace-nowrap px-6 py-4 text-sm text-gray-500'>
                            {contract.signedAt
                              ? new Date(contract.signedAt).toLocaleDateString()
                              : '-'}
                          </td>
                          <td className='whitespace-nowrap px-6 py-4 text-sm'>
                            <div className='flex gap-2'>
                              <Link
                                href={`/contracts/${contract.id}`}
                                className='text-blue-600 hover:text-blue-900'
                              >
                                查看
                              </Link>
                              <Link
                                href={`/contracts/${contract.id}/edit`}
                                className='text-gray-600 hover:text-gray-900'
                              >
                                编辑
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              <div className='flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3'>
                <div className='text-sm text-gray-700'>
                  共 {total} 条记录，第 {page} 页
                </div>
                <div className='flex gap-2'>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className='rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50'
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * pageSize >= total}
                    className='rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50'
                  >
                    下一页
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
