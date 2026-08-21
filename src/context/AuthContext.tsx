import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '../types';
import { verifyUserCredentials, updateUserPassword } from '../services/guests';
import type { AuthResult } from '../services/guests';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  updatePassword: (newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('auth_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed);
      }
    } catch (err) {
      console.warn('Falha ao restaurar sessão do usuário:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async login(username: string, password: string): Promise<AuthResult> {
      try {
        const res = await verifyUserCredentials(username, password);
        if (res.success) {
          setUser(res.user);
          try {
            sessionStorage.setItem('auth_user', JSON.stringify(res.user));
          } catch (storageErr) {
            console.debug('Erro ao salvar auth_user no sessionStorage:', storageErr);
          }
        }
        return res;
      } catch (err) {
        console.error('Falha no login:', err);
        return { success: false, error: 'SERVER_ERROR' };
      }
    },
    logout() {
      setUser(null);
      try {
        sessionStorage.removeItem('auth_user');
      } catch (storageErr) {
        console.debug('Erro ao remover auth_user do sessionStorage:', storageErr);
      }
    },
    async updatePassword(newPassword: string) {
      if (!user) return false;
      try {
        await updateUserPassword(user.id, newPassword);
        const updated: User = {
          ...user,
          mustChangePassword: false,
        };
        setUser(updated);
        try {
          sessionStorage.setItem('auth_user', JSON.stringify(updated));
        } catch (storageErr) {
          console.debug('Erro ao salvar auth_user no sessionStorage:', storageErr);
        }
        return true;
      } catch (err) {
        console.error('Falha ao atualizar senha:', err);
        return false;
      }
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}