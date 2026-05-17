import { redirect } from 'next/navigation';
import { getOrder } from '@/lib/order/order-service';
import type { OrderStatus } from '@/types/payment';
import { OrderDetailHeader } from '@/components/order/OrderDetailHeader';
import { OrderPaymentInfo } from '@/components/order/OrderPaymentInfo';
import { OrderMembershipInfo } from '@/components/order/OrderMembershipInfo';
import { OrderActions } from '@/components/order/OrderActions';
import { getServerAuthUser } from '@/lib/auth/server-session';

/**
 * 订单详情页面
 * 显示订单的完整信息，包括基本信息、支付信息、会员信息和操作按钮
 */
export default async function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getServerAuthUser();

  // 未登录则跳转到登录页
  if (!user?.id) {
    redirect(`/login?callbackUrl=/orders/${params.id}`);
  }

  const orderId = params.id;

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
            您无权查看该订单，这可能是因为您不是订单的所有者
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

  return (
    <div className='container mx-auto min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8'>
      {/* 页面标题 */}
      <div className='mb-6'>
        <h1 className='text-3xl font-bold text-gray-900'>订单详情</h1>
        <p className='mt-2 text-sm text-gray-600'>查看订单的完整信息</p>
      </div>

      {/* 订单详情 */}
      <div className='space-y-6'>
        {/* 订单基本信息 */}
        <OrderDetailHeader order={order} />

        {/* 支付信息 */}
        <OrderPaymentInfo
          order={{
            id: order.id,
            orderNo: order.orderNo,
            amount: order.amount,
            currency: order.currency,
            paymentMethod: order.paymentMethod,
            status: order.status as OrderStatus,
            createdAt: order.createdAt,
            paidAt: order.paidAt,
            paymentRecords: order.paymentRecords,
          }}
        />

        {/* 会员信息 */}
        {order.membershipTier && (
          <OrderMembershipInfo
            tierName={order.membershipTier.name}
            tierDisplayName={order.membershipTier.displayName}
            tierDescription={order.membershipTier.displayName}
            price={order.amount}
          />
        )}

        {/* 订单操作 */}
        <OrderActions orderId={order.id} status={order.status as OrderStatus} />
      </div>
    </div>
  );
}
