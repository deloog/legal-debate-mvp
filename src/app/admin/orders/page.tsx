import { AdminOrderList } from '@/components/admin/AdminOrderList';

export const metadata = {
  title: '订单管理',
  description: '管理系统订单',
};

export default function OrdersPage(): React.ReactElement {
  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='mb-6'>
        <h1 className='text-3xl font-bold text-gray-900'>订单管理</h1>
        <p className='text-gray-600 mt-2'>管理系统订单信息</p>
      </div>

      <AdminOrderList />
    </div>
  );
}
