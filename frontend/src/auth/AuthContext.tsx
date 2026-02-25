import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { authApi } from '../api/client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (userId: string, password: string, remember: boolean) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const clearStorage = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  sessionStorage.clear();
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    // 서버에서 실제 사용자 정보(role 포함)를 검증하여 가져옴.
    // localStorage의 user 객체는 절대 role 판단에 사용하지 않음.
    authApi.me()
      .then((res) => {
        const serverUser: User = res.data;
        setUser(serverUser);
        // 서버 응답으로 캐시 갱신
        localStorage.setItem('user', JSON.stringify(serverUser));
      })
      .catch(() => {
        // 토큰이 만료되었거나 유효하지 않으면 전체 로그아웃 처리
        clearStorage();
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(async (userId: string, password: string, remember: boolean) => {
    const res = await authApi.login(userId, password);
    const { access_token, refresh_token, user: loginData } = res.data;
    localStorage.setItem('access_token', access_token);

    // 로그인 직후 서버에서 실제 user 정보를 다시 조회하여 role을 보장
    let serverUser: User = loginData;
    try {
      const meRes = await authApi.me();
      serverUser = meRes.data;
    } catch {
      // me() 실패 시 로그인 응답 데이터 사용 (토큰은 이미 저장됨)
    }

    if (remember) {
      localStorage.setItem('refresh_token', refresh_token);
    } else {
      sessionStorage.setItem('refresh_token', refresh_token);
    }
    localStorage.setItem('user', JSON.stringify(serverUser));
    setUser(serverUser);
  }, []);

  const logout = useCallback(() => {
    clearStorage();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
        // role은 항상 서버에서 검증된 user 객체 기준으로 판단
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
