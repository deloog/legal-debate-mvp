import { UserDetail } from '@/components/admin/UserDetail';

interface PageProps {
  params: { id: string };
}

export const metadata = {
  title: '用户详情',
  description: '查看和管理用户详细信息',
};

export default function UserDetailPage({
  params,
}: PageProps): React.ReactElement {
  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='mb-6'>
        <h1 className='text-3xl font-bold text-gray-900'>用户详情</h1>
        <p className='text-gray-600 mt-2'>查看和管理用户详细信息</p>
      </div>

      <UserDetail userId={params.id} />
    </div>
  );
}
