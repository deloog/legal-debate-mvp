import { UserList } from '@/components/admin/UserList';

export const metadata = {
  title: '用户管理',
  description: '管理系统用户',
};

export default function UsersPage(): React.ReactElement {
  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='mb-6'>
        <h1 className='text-3xl font-bold text-gray-900'>用户管理</h1>
        <p className='text-gray-600 mt-2'>管理系统用户信息</p>
      </div>

      <UserList />
    </div>
  );
}
