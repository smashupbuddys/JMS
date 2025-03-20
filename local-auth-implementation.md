# Implementing Custom Authentication for Your React Application

This guide will show you how to implement a custom authentication system directly in your React application, bypassing Supabase's auth service while still using your database.

## 1. Install Required Dependencies

First, install the necessary packages:

```bash
npm install pg jsonwebtoken bcrypt cookie
# or with yarn
yarn add pg jsonwebtoken bcrypt cookie
```

## 2. Create Authentication API Endpoints

Create a new directory for your authentication backend:

```
/src
  /api
    /auth
      auth.ts
```

### `src/api/auth.ts`

```typescript
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

// Database connection
const pool = new Pool({
  connectionString: import.meta.env.VITE_DATABASE_URL,
});

const JWT_SECRET = import.meta.env.VITE_JWT_SECRET || 'your-secret-key';
const TOKEN_EXPIRY = '24h';

export async function signIn(email: string, password: string) {
  try {
    // Step 1: Find user in auth.users
    const userResult = await pool.query(
      'SELECT id, email, encrypted_password FROM auth.users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return { success: false, error: 'Invalid login credentials' };
    }

    const user = userResult.rows[0];
    
    // Step 2: Verify password using pgcrypto
    const passwordCheckResult = await pool.query(
      "SELECT encrypted_password = crypt($1, encrypted_password) as password_matches FROM auth.users WHERE id = $2",
      [password, user.id]
    );
    
    if (!passwordCheckResult.rows[0].password_matches) {
      return { success: false, error: 'Invalid login credentials' };
    }
    
    // Step 3: Get user details with role from public.users
    const userDetailsResult = await pool.query(
      'SELECT id, email, role, full_name, is_active FROM public.users WHERE id = $1',
      [user.id]
    );
    
    if (userDetailsResult.rows.length === 0 || !userDetailsResult.rows[0].is_active) {
      return { success: false, error: 'User account not found or inactive' };
    }
    
    const userDetails = userDetailsResult.rows[0];
    
    // Step 4: Get staff details
    const staffResult = await pool.query(
      'SELECT id, employee_id, department, position, permissions FROM public.staff WHERE id = $1',
      [user.id]
    );
    
    const staffDetails = staffResult.rows[0] || null;
    
    // Step 5: Generate JWT token
    const token = jwt.sign(
      { 
        sub: user.id,
        email: user.email,
        role: userDetails.role,
        permissions: staffDetails?.permissions || {}
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
    
    // Step 6: Update last_sign_in_at
    await pool.query(
      'UPDATE auth.users SET last_sign_in_at = NOW() WHERE id = $1',
      [user.id]
    );
    
    return {
      success: true,
      user: {
        id: user.id,
        email: userDetails.email,
        role: userDetails.role,
        full_name: userDetails.full_name,
      },
      staff: staffDetails,
      token
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: 'An error occurred during authentication' };
  }
}

export async function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, user: decoded };
  } catch (error) {
    return { valid: false, error: 'Invalid token' };
  }
}

export async function getUserProfile(userId: string) {
  try {
    const userResult = await pool.query(
      `SELECT u.id, u.email, u.role, u.full_name, 
              s.employee_id, s.department, s.position, s.permissions
       FROM public.users u
       LEFT JOIN public.staff s ON u.id = s.id
       WHERE u.id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return { success: false, error: 'User not found' };
    }
    
    return { success: true, profile: userResult.rows[0] };
  } catch (error) {
    console.error('Profile fetch error:', error);
    return { success: false, error: 'Failed to fetch user profile' };
  }
}
```

## 3. Create Authentication Context

Set up an authentication context to manage state throughout your app:

```
/src
  /contexts
    AuthContext.tsx
```

### `src/contexts/AuthContext.tsx`

```tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { signIn, verifyToken, getUserProfile } from '../api/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  user: any | null;
  staff: any | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  staff: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: () => {},
  error: null,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [staff, setStaff] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing token on load
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { valid, user: decodedUser } = await verifyToken(token);
        if (valid && decodedUser) {
          setIsAuthenticated(true);
          setUser(decodedUser);
          
          // Get full profile
          const profileResult = await getUserProfile(decodedUser.sub);
          if (profileResult.success) {
            setUser(profileResult.profile);
            
            // Set staff data if role is not a basic user
            if (profileResult.profile.employee_id) {
              setStaff({
                id: profileResult.profile.id,
                employee_id: profileResult.profile.employee_id,
                department: profileResult.profile.department,
                position: profileResult.profile.position,
                permissions: profileResult.profile.permissions,
              });
            }
          }
        } else {
          // Token is invalid or expired
          localStorage.removeItem('authToken');
        }
      } catch (error) {
        console.error('Auth verification error:', error);
        localStorage.removeItem('authToken');
      }

      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    
    try {
      const result = await signIn(email, password);
      
      if (result.success) {
        localStorage.setItem('authToken', result.token);
        setIsAuthenticated(true);
        setUser(result.user);
        setStaff(result.staff);
        setLoading(false);
        return { success: true };
      } else {
        setError(result.error || 'Authentication failed');
        setLoading(false);
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setIsAuthenticated(false);
    setUser(null);
    setStaff(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        staff,
        loading,
        login,
        logout,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

## 4. Update Your Login Page

Modify your existing login page to use the new authentication system:

### `src/components/auth/LoginPage.tsx`

```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError('Email and password are required');
      setLoading(false);
      return;
    }

    try {
      const result = await login(email, password);
      
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (error) {
      setError('An unexpected error occurred');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Login Error
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    {error}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                loading
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              }`}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>

        <div className="text-center text-sm">
          <p>Test credentials:</p>
          <p>Email: smash@gmail.com</p>
          <p>Password: @pplepie9229S</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
```

## 5. Add Protected Routes

Create a component to protect routes that require authentication:

### `src/components/auth/ProtectedRoute.tsx`

```tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole = [] 
}) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check for role-based access
  if (requiredRole.length > 0 && user && !requiredRole.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
```

## 6. Set Up App Entry Point

Update your main App component to use the AuthProvider:

### `src/App.tsx`

```tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LoginPage from './components/auth/LoginPage';
import Dashboard from './components/Dashboard';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Unauthorized from './components/Unauthorized';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute requiredRole={['admin']}>
                <AdminPanel />
              </ProtectedRoute>
            } 
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
```

## 7. Create a Custom API Client

Replace Supabase client with a custom API client:

### `src/lib/apiClient.ts`

```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Add a request interceptor to include auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

## 8. Create Environment Variables

Create a `.env` file in your project root:

```
VITE_DATABASE_URL=postgresql://wms_user:your_secure_password@localhost:5432/wms_db
VITE_JWT_SECRET=your-jwt-secret-key
VITE_API_URL=/api
```

## 9. Test and Debug

1. Start your application: `npm run dev`
2. Navigate to the login page
3. Try logging in with your admin credentials
4. Check the console for any errors

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Verify connection string is correct
- Check database user permissions

### Authentication Issues
- Verify JWT secret is correctly set
- Check password hashing implementation
- Ensure foreign key relationships in the database are maintained

### API Route Issues
- Use browser developer tools to check network requests
- Verify tokens are being sent in request headers
- Check server logs for error messages

## Benefits of Custom Authentication

1. Full control over authentication flow
2. No dependency on external services
3. Easier debugging and customization
4. Direct integration with your database
5. Simplified user management 