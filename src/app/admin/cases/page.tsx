import { AdminCaseList } from '@/components/admin/AdminCaseList';

export const metadata = {
  title: '案件管理',
  description: '管理系统案件',
};

export default function CasesPage(): React.ReactElement {
  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='mb-6'>
        <h1 className='text-3xl font-bold text-gray-900'>案件管理</h1>
        <p className='text-gray-600 mt-2'>管理系统所有案件信息</p>
      </div>

      <AdminCaseList />
    </div>
  );
}
