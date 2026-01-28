/**
 * 创建咨询按钮组件
 * 功能：跳转到创建咨询页面
 */
'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';

export function CreateConsultationButton() {
  return (
    <Link
      href='/consultations/create'
      className='flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
    >
      <Plus className='h-4 w-4' />
      创建咨询
    </Link>
  );
}
