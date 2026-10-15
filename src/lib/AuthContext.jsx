import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { db } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [accessState, setAccessState] = useState({
    state: 'none',
    allowed: false,
    badge: 'Checking...',
    reason: null
  });

  const [appPublicSettings, setAppPublicSettings] = useState({
    id: appParams.appId || 'thredo-app',
    public_settings: { auth_required: true }
  });

  const refreshAccessState = useCallback(async () => {
    try {
      const res = await db.functions.invoke('getAccessState', {});
      const acc = res.data?.access || res.access;
      if (acc) {
        setAccessState(acc);
      }
      return acc;
    } catch (err) {
      console.warn('[AuthContext] Failed to fetch access state:', err);
      return null;
    }
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const currentUser = await db.auth.me();
      if (currentUser && currentUser.id) {
        setUser(currentUser);
        setIsAuthenticated(true);
        // Compute server access state
        await refreshAccessState();
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setAccessState({ state: 'none', allowed: false, badge: 'Unauthenticated' });
      }
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      setAccessState({ state: 'none', allowed: false, badge: 'Unauthenticated' });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [refreshAccessState]);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const logout = async (shouldRedirect = true) => {
    try {
      await db.auth.logout();
    } catch (e) {
      console.warn('Logout error:', e);
    }
    setUser(null);
    setIsAuthenticated(false);
    setAccessState({ state: 'none', allowed: false, badge: 'Logged Out' });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('base44_access_token');
      localStorage.removeItem('token');
      if (shouldRedirect) {
        window.location.href = '/login';
      }
    }
  };

  const navigateToLogin = (returnTo) => {
    if (typeof window !== 'undefined') {
      const path = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login';
      window.location.href = path;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      accessState,
      setAccessState,
      refreshAccessState,
      logout,
      navigateToLogin,
      checkUserAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
