import { RoleDetail } from '@/components/admin/RoleDetail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: '角色详情',
  description: '查看和管理角色详情',
};

export default async function RoleDetailPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { id } = await params;

  return (
    <div className='container mx-auto px-4 py-8'>
      <RoleDetail roleId={id} />
    </div>
  );
}
