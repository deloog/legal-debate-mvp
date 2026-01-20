import { LawArticleDetail } from '@/components/admin/LawArticleDetail';

export const metadata = {
  title: '法条详情',
  description: '查看和编辑法条详情',
};

export default async function LawArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;

  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='mb-6'>
        <h1 className='text-3xl font-bold text-gray-900'>法条详情</h1>
        <p className='text-gray-600 mt-2'>查看和编辑法条详情信息</p>
      </div>

      <LawArticleDetail id={id} />
    </div>
  );
}
