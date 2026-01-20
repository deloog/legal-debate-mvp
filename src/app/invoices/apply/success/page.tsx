import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, ArrowRight, Home, FileText } from 'lucide-react';

/**
 * 发票申请成功页面
 * 显示发票申请成功信息
 */
export default function InvoiceApplySuccessPage({
  searchParams,
}: {
  searchParams: { invoiceId?: string };
}) {
  const invoiceId = searchParams.invoiceId;

  // 验证发票ID
  if (!invoiceId) {
    redirect('/orders');
  }

  const handleViewOrder = (): void => {
    redirect('/orders');
  };

  const handleViewInvoice = (): void => {
    redirect(`/invoices/${invoiceId}`);
  };

  return (
    <div className='container mx-auto min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8'>
      <div className='mx-auto max-w-2xl'>
        {/* 成功提示卡片 */}
        <Card className='mb-6'>
          <div className='p-8 text-center'>
            <div className='mb-6 flex justify-center'>
              <div className='rounded-full bg-green-100 p-4'>
                <CheckCircle className='h-16 w-16 text-green-600' />
              </div>
            </div>

            <h1 className='mb-3 text-3xl font-bold text-gray-900'>
              发票申请成功
            </h1>

            <p className='mb-6 text-lg text-gray-600'>
              感谢您的申请，我们正在为您开具发票
            </p>

            <div className='mb-6 rounded-md bg-blue-50 p-4'>
              <p className='text-sm font-semibold text-blue-900 mb-2'>
                发票编号
              </p>
              <p className='text-lg font-mono text-blue-700'>{invoiceId}</p>
            </div>

            <div className='rounded-md bg-gray-50 p-4 text-left'>
              <p className='mb-3 text-sm font-semibold text-gray-900'>
                后续流程
              </p>
              <ul className='space-y-2 text-sm text-gray-700'>
                <li className='flex items-start space-x-2'>
                  <ArrowRight className='mt-1 h-4 w-4 shrink-0 text-gray-500' />
                  <span>发票将在1-3个工作日内开具完成</span>
                </li>
                <li className='flex items-start space-x-2'>
                  <ArrowRight className='mt-1 h-4 w-4 shrink-0 text-gray-500' />
                  <span>发票将以PDF格式发送到您的邮箱</span>
                </li>
                <li className='flex items-start space-x-2'>
                  <ArrowRight className='mt-1 h-4 w-4 shrink-0 text-gray-500' />
                  <span>您可以随时在发票管理页面查看发票状态</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>

        {/* 温馨提示卡片 */}
        <Card className='mb-6'>
          <div className='p-6'>
            <h2 className='mb-4 text-xl font-bold text-gray-900'>温馨提示</h2>
            <div className='space-y-3 text-sm text-gray-600'>
              <div className='flex items-start space-x-2'>
                <span className='font-semibold text-gray-900'>1.</span>
                <p>请确保接收邮箱地址正确，发票将发送到此邮箱</p>
              </div>
              <div className='flex items-start space-x-2'>
                <span className='font-semibold text-gray-900'>2.</span>
                <p>如需修改发票信息，请重新申请（原发票将自动取消）</p>
              </div>
              <div className='flex items-start space-x-2'>
                <span className='font-semibold text-gray-900'>3.</span>
                <p>如有任何问题，请联系客服：support@example.com</p>
              </div>
            </div>
          </div>
        </Card>

        {/* 操作按钮 */}
        <Card>
          <div className='p-6'>
            <div className='flex flex-col space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0'>
              <Button
                onClick={handleViewOrder}
                variant='outline'
                className='flex-1'
              >
                <Home className='mr-2 h-4 w-4' />
                返回首页
              </Button>
              <Button onClick={handleViewInvoice} className='flex-1'>
                <FileText className='mr-2 h-4 w-4' />
                查看发票
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
