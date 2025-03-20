import { supabase } from './supabase';

export const verifySupabaseConfig = async () => {
  try {
    console.log('Checking Supabase configuration...');
    
    // Check environment variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    console.log('Environment variables present');
    console.log('Supabase URL:', supabaseUrl);
    console.log('Anon Key length:', supabaseAnonKey.length);

    // Test connection
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error) {
      throw new Error(`Database connection error: ${error.message}`);
    }

    console.log('Successfully connected to database');

    // Test auth system
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      throw new Error(`Auth system error: ${sessionError.message}`);
    }

    console.log('Auth system is working');
    console.log('Current session:', session ? 'Active' : 'None');

    return {
      success: true,
      message: 'Supabase configuration is valid'
    };
  } catch (error) {
    console.error('Supabase configuration error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      error
    };
  }
}; 