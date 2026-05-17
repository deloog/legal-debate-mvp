import { redirect } from 'next/navigation';
import { getOrder } from '@/lib/order/order-service';
import { InvoiceApplyForm } from '@/components/invoice/InvoiceApplyForm';
import { getServerAuthUser } from '@/lib/auth/server-session';

/**
 * 发票申请页面
 * 用户可以在此页面申请发票
 */
export default async function InvoiceApplyPage({
  searchParams,
}: {
  searchParams: { orderId?: string };
}) {
  const user = await getServerAuthUser();

  // 未登录则跳转到登录页
  if (!user?.id) {
    redirect(
      `/login?callbackUrl=/invoices/apply?orderId=${searchParams.orderId}`
    );
  }

  const orderId = searchParams.orderId;

  // 验证订单ID
  if (!orderId) {
    redirect('/orders');
  }

  // 查询订单
  const order = await getOrder(orderId);

  // 订单不存在
  if (!order) {
    return (
      <div className='container mx-auto min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8'>
        <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-center'>
          <h1 className='mb-2 text-2xl font-bold text-red-900'>订单不存在</h1>
          <p className='mb-4 text-red-700'>您访问的订单不存在或已被删除</p>
          <button
            onClick={() => redirect('/orders')}
            className='rounded-lg bg-red-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-red-700'
          >
            返回订单列表
          </button>
        </div>
      </div>
    );
  }

  // 验证订单所有权
  if (order.userId !== user.id) {
    return (
      <div className='container mx-auto min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8'>
        <div className='rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center'>
          <h1 className='mb-2 text-2xl font-bold text-yellow-900'>无权访问</h1>
          <p className='mb-4 text-yellow-700'>
            您无权申请该订单的发票，这可能是因为您不是订单的所有者
          </p>
          <button
            onClick={() => redirect('/orders')}
            className='rounded-lg bg-yellow-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-yellow-700'
          >
            返回订单列表
          </button>
        </div>
      </div>
    );
  }

  // 验证订单状态（只有已支付的订单才能申请发票）
  if (order.status !== 'PAID') {
    return (
      <div className='container mx-auto min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8'>
        <div className='rounded-lg border border-orange-200 bg-orange-50 p-6 text-center'>
          <h1 className='mb-2 text-2xl font-bold text-orange-900'>
            订单状态异常
          </h1>
          <p className='mb-4 text-orange-700'>
            只有已支付的订单才能申请发票，当前订单状态：{order.status}
          </p>
          <button
            onClick={() => redirect(`/orders/${orderId}`)}
            className='rounded-lg bg-orange-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-orange-700'
          >
            返回订单详情
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='container mx-auto min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8'>
      <div className='mx-auto max-w-2xl'>
        <InvoiceApplyForm orderId={orderId} orderAmount={order.amount} />
      </div>
    </div>
  );
}
