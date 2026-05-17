import { redirect } from 'next/navigation';
import { OrderList } from '@/components/order/OrderList';
import { getServerAuthUser } from '@/lib/auth/server-session';

/**
 * 订单列表页面
 * 显示用户的所有订单，支持分页、筛选、排序和搜索
 * 认证优先级：1. JWT accessToken cookie  2. NextAuth session
 */
export default async function OrdersPage() {
  const user = await getServerAuthUser();
  const userId = user?.id;

  // 未登录则跳转到登录页
  if (!userId) {
    redirect('/login?callbackUrl=/orders');
  }

  return (
    <div className='container mx-auto min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8'>
      {/* 页面标题 */}
      <div className='mb-6'>
        <h1 className='text-3xl font-bold text-gray-900'>我的订单</h1>
        <p className='mt-2 text-sm text-gray-600'>查看和管理您的所有订单记录</p>
      </div>

      {/* 订单列表组件 */}
      <OrderList userId={userId} />
    </div>
  );
}
