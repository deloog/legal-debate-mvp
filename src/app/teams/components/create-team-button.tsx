'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

/**
 * 创建团队按钮组件
 * 功能：点击跳转到创建团队页面
 */
export function CreateTeamButton() {
  const router = useRouter();

  function goToCreateTeam() {
    router.push('/teams/create');
  }

  return <Button onClick={goToCreateTeam}>创建团队</Button>;
}
