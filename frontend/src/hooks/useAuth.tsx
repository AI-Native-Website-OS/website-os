'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, LoginResponse } from '@/types';
import api from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  permissions: string[];
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginByCode: (phone: string, code: string) => Promise<void>;
  sendSmsCode: (phone: string) => Promise<string>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  hasPermission: (code: string) => boolean;
  hasRole: (role: string) => boolean;
  isAdmin: boolean;
}

interface RegisterData {
  username: string;
  password: string;
  email?: string;
  phone?: string;
  code?: string;
  realName?: string;
  companyName?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const savedPermissions = localStorage.getItem('permissions');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      setPermissions(savedPermissions ? JSON.parse(savedPermissions) : []);
    }
    setLoading(false);
  }, []);

  const applyLogin = useCallback((data: LoginResponse) => {
    setToken(data.token);
    setUser(data.user);
    setPermissions(data.permissions || []);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('permissions', JSON.stringify(data.permissions || []));
    document.cookie = `token=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res: any = await api.post('/auth/login', { username, password });
    if (res.code !== 200) {
      throw new Error(res.message || '登录失败');
    }
    applyLogin(res.data);
  }, [applyLogin]);

  const register = useCallback(async (registerData: RegisterData) => {
    const res: any = await api.post('/auth/register', registerData);
    if (res.code !== 200) {
      throw new Error(res.message || '注册失败');
    }
  }, []);

  const sendSmsCode = useCallback(async (phone: string) => {
    const res: any = await api.post('/auth/send-code', { phone });
    if (res.code !== 200) {
      throw new Error(res.message || '验证码发送失败');
    }
    return res.data as string;
  }, []);

  const loginByCode = useCallback(async (phone: string, code: string) => {
    const res: any = await api.post('/auth/login-by-code', { phone, code });
    if (res.code !== 200) {
      throw new Error(res.message || '登录失败');
    }
    applyLogin(res.data);
  }, [applyLogin]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setPermissions([]);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
    document.cookie = 'token=; path=/; max-age=0; SameSite=Lax';
  }, []);

  const hasPermission = useCallback((code: string) => {
    return permissions.includes(code);
  }, [permissions]);

  const hasRole = useCallback((role: string) => {
    return user?.role === role;
  }, [user]);

  const isAdmin = user?.userType === 'INTERNAL';

  return (
    <AuthContext.Provider value={{ user, token, permissions, loading, login, loginByCode, sendSmsCode, register, logout, hasPermission, hasRole, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
