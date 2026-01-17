import { AdminOrderDetail } from '@/components/admin/AdminOrderDetail';

export const metadata = {
  title: '订单详情',
  description: '查看和管理订单详细信息',
};

export default function OrderDetailPage(): React.ReactElement {
  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='mb-6'>
        <h1 className='text-3xl font-bold text-gray-900'>订单详情</h1>
        <p className='text-gray-600 mt-2'>查看和管理订单详细信息</p>
      </div>

      <AdminOrderDetail />
    </div>
  );
}
