import { LawArticleList } from '@/components/admin/LawArticleList';

export const metadata = {
  title: '法条管理',
  description: '管理系统法条库',
};

export default function LawArticlesPage(): React.ReactElement {
  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='mb-6'>
        <h1 className='text-3xl font-bold text-gray-900'>法条管理</h1>
        <p className='text-gray-600 mt-2'>管理系统法条库数据</p>
      </div>

      <LawArticleList />
    </div>
  );
}
