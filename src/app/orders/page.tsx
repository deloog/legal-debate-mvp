import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { verifyToken } from '@/lib/auth/jwt';
import { OrderList } from '@/components/order/OrderList';

/**
 * 订单列表页面
 * 显示用户的所有订单，支持分页、筛选、排序和搜索
 * 认证优先级：1. JWT accessToken cookie  2. NextAuth session
 */
export default async function OrdersPage() {
  // 1. 先尝试从 accessToken cookie 中获取 JWT 用户信息
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  let userId: string | null = null;

  if (accessToken) {
    const tokenResult = verifyToken(accessToken);
    if (tokenResult.valid && tokenResult.payload?.userId) {
      userId = tokenResult.payload.userId;
    }
  }

  // 2. 若 JWT cookie 无效，回退到 NextAuth session
  if (!userId) {
    const session = await getServerSession(authOptions);
    userId = session?.user?.id ?? null;
  }

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
