import { QualificationReview } from '@/components/admin/QualificationReview';

export const metadata = {
  title: '律师资格审核',
  description: '审核律师资格认证申请',
};

export default function QualificationsPage(): React.ReactElement {
  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='mb-6'>
        <h1 className='text-3xl font-bold text-gray-900'>律师资格审核</h1>
        <p className='text-gray-600 mt-2'>审核律师资格认证申请</p>
      </div>

      <QualificationReview />
    </div>
  );
}
