import { UserList } from '@/components/admin/UserList';

export const metadata = {
  title: '用户管理',
  description: '管理系统用户',
};

export default function UsersPage(): React.ReactElement {
  return (
    <div>
      <div className='mb-6'>
        <h2 className='text-2xl font-bold text-gray-900'>用户管理</h2>
        <p className='text-gray-600 mt-2'>管理系统用户信息</p>
      </div>

      <UserList />
    </div>
  );
}
