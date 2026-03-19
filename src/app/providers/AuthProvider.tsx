'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  username?: string;
  name?: string;
  role: string;
  avatar?: string;
  createdAt: Date;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const checkAuth = async () => {
    try {
      setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch('/api/auth/me', {
        credentials: 'include', // 包含cookie
        cache: 'no-store', // 不缓存，确保获取最新状态
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // 检查HTTP状态码
      if (!response.ok) {
        // 401 未认证或403 禁止访问
        console.warn(`[AuthProvider] 认证检查失败: ${response.status}`);
        setUser(null);
        sessionStorage.removeItem('user');
        return;
      }

      // 检查响应是否为JSON
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        // 如果返回的不是JSON（如HTML重定向），视为未认证
        console.warn('收到非JSON响应，可能是重定向');
        setUser(null);
        sessionStorage.removeItem('user');
        return;
      }

      const result = await response.json();
      console.log('[AuthProvider] API响应:', {
        success: result.success,
        hasUser: !!result.data?.user,
      });

      if (result.success && result.data?.user) {
        console.log('[AuthProvider] 用户已认证:', result.data.user.email);
        setUser(result.data.user);
        // 同时更新sessionStorage以保持向后兼容
        sessionStorage.setItem('user', JSON.stringify(result.data.user));
      } else {
        console.log('[AuthProvider] 未获取到用户信息');
        setUser(null);
        sessionStorage.removeItem('user');
      }
    } catch (error) {
      console.error('[AuthProvider] 检查认证状态失败:', error);
      setUser(null);
      sessionStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('登出失败:', error);
    } finally {
      setUser(null);
      sessionStorage.removeItem('user');
      router.push('/login');
    }
  };

  useEffect(() => {
    // 初始化时检查认证状态
    checkAuth();

    // 监听自定义事件，用于跨标签页同步登录状态
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'user') {
        if (event.newValue) {
          try {
            setUser(JSON.parse(event.newValue));
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    };

    // 监听登录成功事件
    const handleLoginSuccess = () => {
      console.log('[AuthProvider] 收到登录成功事件，延迟100ms后检查认证');
      // 延迟一点时间，确保cookie已经设置
      setTimeout(() => {
        checkAuth();
      }, 100);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('login-success', handleLoginSuccess);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('login-success', handleLoginSuccess);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, checkAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }
  return context;
}
