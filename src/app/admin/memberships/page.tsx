import { AdminMembershipList } from '@/components/admin/AdminMembershipList';

/**
 * 会员管理页面
 * 功能：
 * - 展示所有会员列表
 * - 支持按等级、状态筛选
 * - 支持搜索用户邮箱、用户名、姓名
 * - 查看会员详情
 * - 分页显示
 */

export default function MembershipManagementPage(): React.ReactElement {
  return (
    <div className='min-h-screen bg-gray-50 py-8 px-4'>
      <div className='max-w-7xl mx-auto'>
        {/* 页面标题 */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-gray-900'>会员管理</h1>
          <p className='mt-2 text-gray-600'>查看和管理所有会员信息</p>
        </div>

        {/* 会员列表 */}
        <AdminMembershipList />
      </div>
    </div>
  );
}
