import { RoleDetail } from '@/components/admin/RoleDetail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: '编辑角色',
  description: '编辑角色权限配置',
};

export default async function RoleEditPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { id } = await params;

  return (
    <div className='container mx-auto px-4 py-8'>
      <RoleDetail roleId={id} />
    </div>
  );
}
