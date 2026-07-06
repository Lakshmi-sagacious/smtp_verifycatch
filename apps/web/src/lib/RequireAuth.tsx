import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth';

export function RequireAuth() {
  const { user, loading, hydrated, hydrate } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  if (loading || !hydrated) {
    return <div style={{ padding: '2rem' }}>Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
