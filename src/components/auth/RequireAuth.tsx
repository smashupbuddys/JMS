import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { hasPermission, isAuthenticated } from '../../lib/auth';

interface RequireAuthProps {
  children: React.ReactNode;
  permissions?: string[];
  fallback?: React.ReactNode;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children, permissions = [], fallback }) => {
  const location = useLocation();
  const authenticated = isAuthenticated();

  // If not authenticated, redirect to login
  if (!authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If permissions are required and user doesn't have them, show fallback or redirect
  if (permissions.length > 0 && !permissions.every(hasPermission)) {
    return fallback ? <>{fallback}</> : <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
