'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';

export function AdminLogoutButton() {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <button
      onClick={async () => {
        await logout();
        router.push('/login');
      }}
      className='text-sm text-gray-600 hover:text-red-600 transition-colors'
    >
      退出登录
    </button>
  );
}
