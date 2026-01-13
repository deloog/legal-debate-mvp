import { RoleList } from '@/components/admin/RoleList';

export const metadata = {
  title: '角色管理',
  description: '管理系统角色和权限',
};

export default function RolesPage(): React.ReactElement {
  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='mb-6'>
        <h1 className='text-3xl font-bold text-gray-900'>角色管理</h1>
        <p className='text-gray-600 mt-2'>管理系统角色和权限配置</p>
      </div>

      <RoleList />
    </div>
  );
}
