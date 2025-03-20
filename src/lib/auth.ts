import { supabase } from './supabase';

export interface UserRole {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'sales' | 'qc' | 'packaging' | 'dispatch';
  permissions: string[];
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    role: string;
    full_name: string | null;
    is_active: boolean;
  } | null;
  staff: {
    id: string;
    employee_id: string;
    department: string;
    position: string;
    permissions: Record<string, boolean>;
  } | null;
  error?: string;
}

export const ROLE_PERMISSIONS = {
  admin: [
    'manage_staff',
    'manage_settings',
    'manage_inventory',
    'view_sensitive_info',
    'manage_customers',
    'view_analytics',
    'view_inventory',
    'manage_qc',
    'manage_packaging',
    'manage_dispatch'
  ],
  manager: [
    'manage_inventory',
    'manage_customers',
  ],
  sales: [
    'view_inventory',
    'manage_customers',
  ],
  qc: [
    'view_inventory',
    'manage_qc'
  ],
  packaging: [
    'view_inventory',
    'manage_packaging'
  ],
  dispatch: [
    'view_inventory',
    'manage_dispatch'
  ]
};

export const signInWithEmail = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    if (!email || !password) {
      return { user: null, staff: null, error: 'Please enter both email and password' };
    }

    console.log('Attempting authentication for:', email);

    // Step 1: Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('Auth error:', authError);
      return { user: null, staff: null, error: authError.message };
    }

    if (!authData.user) {
      console.error('No user data returned from auth');
      return { user: null, staff: null, error: 'No user data returned' };
    }

    console.log('Auth successful, user ID:', authData.user.id);

    try {
      // Step 2: Get user details with role
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, role, full_name, is_active')
        .eq('id', authData.user.id)
        .single();

      if (userError) {
        console.error('User fetch error:', userError);
        if (userError.code === '42501') {
          return { user: null, staff: null, error: 'Access denied. Please check your permissions.' };
        }
        return { user: null, staff: null, error: `User account not found: ${userError.message}` };
      }

      if (!userData.is_active) {
        return { user: null, staff: null, error: 'Account is inactive. Please contact administrator.' };
      }

      console.log('User data retrieved:', userData);

      // Step 3: Get staff details with permissions
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, employee_id, department, position, permissions')
        .eq('id', authData.user.id)
        .single();

      if (staffError) {
        console.error('Staff fetch error:', staffError);
        return { user: userData, staff: null, error: `Staff record not found: ${staffError.message}` };
      }

      return { user: userData, staff: staffData };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return { 
        user: null, 
        staff: null, 
        error: error instanceof Error ? error.message : 'Error fetching user data' 
      };
    }
  } catch (error) {
    console.error('Login error:', error);
    return { 
      user: null, 
      staff: null, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
    };
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Clear local storage
    localStorage.removeItem('staffRole');
    localStorage.removeItem('staffId');
    localStorage.removeItem('staffName');
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export const createStaffUser = async (email: string, password: string, name: string, role: string) => {
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role
        }
      }
    });

    if (authError) throw authError;

    // Create staff record
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .insert([
        {
          id: authData.user?.id,
          name,
          email,
          role,
          active: true
        }
      ])
      .select()
      .single();

    if (staffError) throw staffError;

    return { user: authData.user, staff: staffData };
  } catch (error) {
    console.error('Error creating staff user:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;

    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (staffError || !staff) return null;

    return {
      ...session.user,
      role: staff.role,
      name: staff.name,
      permissions: ROLE_PERMISSIONS[staff.role as keyof typeof ROLE_PERMISSIONS] || []
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

export const hasPermission = (permission: string): boolean => {
  const role = localStorage.getItem('staffRole');
  if (!role) return false;
  
  // Admin has access to everything
  if (role === 'admin') return true;
  
  // For other roles, check specific permissions
  return ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS]?.includes(permission) || false;
};

export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('staffRole') && !!localStorage.getItem('staffId');
};
