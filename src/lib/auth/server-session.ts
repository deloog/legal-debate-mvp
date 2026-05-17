import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { verifyToken } from '@/lib/auth/jwt';

export interface ServerAuthUser {
  id: string;
  email?: string | null;
  role?: string | null;
}

export async function getServerAuthUser(): Promise<ServerAuthUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;

  if (accessToken) {
    const tokenResult = verifyToken(accessToken);
    if (tokenResult.valid && tokenResult.payload?.userId) {
      return {
        id: tokenResult.payload.userId,
        email: tokenResult.payload.email,
        role: tokenResult.payload.role,
      };
    }
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  };
}
