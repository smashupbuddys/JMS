import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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

  // Check for existing session on load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session) {
          // User is authenticated in Supabase
          const { user: authUser } = session;
          
          // Get user details from public.users table
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, email, role, full_name, is_active')
            .eq('id', authUser.id)
            .single();
          
          if (userError) throw userError;
          
          if (!userData.is_active) {
            throw new Error('Account is inactive');
          }
          
          // Get staff details
          const { data: staffData, error: staffError } = await supabase
            .from('staff')
            .select('id, employee_id, department, position, permissions')
            .eq('id', authUser.id)
            .single();
          
          if (staffError) {
            console.warn('Staff record not found:', staffError);
          }
          
          setIsAuthenticated(true);
          setUser(userData);
          setStaff(staffData || null);
          
          // Set local storage items for compatibility with existing code
          localStorage.setItem('staffRole', userData.role);
          localStorage.setItem('staffId', userData.id);
          localStorage.setItem('staffName', userData.full_name || userData.email.split('@')[0]);
          
          if (staffData?.permissions) {
            localStorage.setItem('permissions', JSON.stringify(staffData.permissions));
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        // Clear any leftover auth state
        localStorage.removeItem('staffRole');
        localStorage.removeItem('staffId');
        localStorage.removeItem('staffName');
        localStorage.removeItem('permissions');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    
    try {
      // Step 1: Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (authError) {
        console.error('Auth error:', authError);
        return { success: false, error: authError.message };
      }
      
      if (!authData.user) {
        console.error('No user data returned from auth');
        return { success: false, error: 'No user data returned' };
      }
      
      // Step 2: Get user details from public.users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, role, full_name, is_active')
        .eq('id', authData.user.id)
        .single();
      
      if (userError) {
        console.error('User fetch error:', userError);
        return { success: false, error: `User account not found: ${userError.message}` };
      }
      
      if (!userData.is_active) {
        return { success: false, error: 'Account is inactive. Please contact administrator.' };
      }
      
      // Step 3: Get staff details
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, employee_id, department, position, permissions')
        .eq('id', authData.user.id)
        .single();
      
      if (staffError) {
        console.error('Staff fetch error:', staffError);
        // We'll continue without staff data, but log the error
      }
      
      // Set auth state
      setIsAuthenticated(true);
      setUser(userData);
      setStaff(staffData || null);
      
      // Store necessary session data in localStorage for compatibility
      localStorage.setItem('staffRole', userData.role);
      localStorage.setItem('staffId', userData.id);
      localStorage.setItem('staffName', userData.full_name || email.split('@')[0]);
      
      if (staffData?.permissions) {
        localStorage.setItem('permissions', JSON.stringify(staffData.permissions));
      }
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during login';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      
      // Clear auth state
      setIsAuthenticated(false);
      setUser(null);
      setStaff(null);
      
      // Clear local storage
      localStorage.removeItem('staffRole');
      localStorage.removeItem('staffId');
      localStorage.removeItem('staffName');
      localStorage.removeItem('permissions');
    } catch (error) {
      console.error('Logout error:', error);
    }
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