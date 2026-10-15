import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import PageNotFound from '@/lib/PageNotFound';

export function AccessGuard({ requireAdmin = false }) {
  const { isAuthenticated, isLoadingAuth, accessState, user } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // Admin route check
  if (requireAdmin) {
    if (user?.role !== 'admin') {
      // Non-admins get 404 from the server and 404 in UI (no admin UI leaked)
      return <PageNotFound />;
    }
    return <Outlet />;
  }

  // Regular app access check
  if (user?.role === 'admin' || accessState?.allowed === true) {
    return <Outlet />;
  }

  // If user has no current access (none, expired, rejected, provisional_expired, revoked),
  // lock out of protected business pages and redirect to paywall
  return <Navigate to="/paywall" replace />;
}

export default AccessGuard;
