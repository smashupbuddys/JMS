import React, { useState, useEffect } from 'react';
import { Diamond, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { verifySupabaseConfig } from '../../lib/supabase-config-check';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../types/database';

type Tables = Database['public']['Tables'];
type UserRow = Tables['users']['Row'];
type StaffRow = Tables['staff']['Row'];

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticInfo, setDiagnosticInfo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [configStatus, setConfigStatus] = useState<{success: boolean; message: string} | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    const result = await verifySupabaseConfig();
    setConfigStatus(result);
    if (!result.success) {
      setError(result.message);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Verify configuration first
      if (!configStatus?.success) {
        const configResult = await verifySupabaseConfig();
        if (!configResult.success) {
          throw new Error('Invalid Supabase configuration: ' + configResult.message);
        }
      }

      // Use the login function from AuthContext
      const result = await login(email, password);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const checkAdminUser = async () => {
    setDiagnosticInfo("Running diagnostics...");
    setError(null);
    
    try {
      // Step 1: Check Supabase connection
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('id')
        .limit(1);
      
      if (testError) {
        setDiagnosticInfo(`Database connection error: ${testError.message}`);
        return;
      }
      
      setDiagnosticInfo("✓ Successfully connected to database\n");
      
      // Step 2: Check auth system
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        setDiagnosticInfo(prev => `${prev}\n✗ Auth system error: ${sessionError.message}`);
        return;
      }
      
      setDiagnosticInfo(prev => `${prev}\n✓ Successfully connected to auth system\n`);
      
      // Step 3: Check admin user in users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role, is_active')
        .eq('email', email || 'smash@gmail.com')
        .single();
        
      if (userError) {
        setDiagnosticInfo(prev => `${prev}\n✗ Admin user check failed: ${userError.message}`);
        return;
      }
      
      if (!userData) {
        setDiagnosticInfo(prev => `${prev}\n✗ Admin user not found in users table`);
        return;
      }
      
      const user = userData as UserRow;
      setDiagnosticInfo(prev => 
        `${prev}\n✓ Found admin user:\n` +
        `  - ID: ${user.id}\n` +
        `  - Role: ${user.role}\n` +
        `  - Active: ${user.is_active ? 'Yes' : 'No'}\n`
      );
      
      // Step 4: Check staff record
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, employee_id, department, position')
        .eq('id', user.id)
        .single();
        
      if (staffError) {
        setDiagnosticInfo(prev => `${prev}\n✗ Staff record check failed: ${staffError.message}`);
        return;
      }
      
      if (!staffData) {
        setDiagnosticInfo(prev => `${prev}\n✗ No staff record found for admin user`);
        return;
      }
      
      const staff = staffData as StaffRow;
      setDiagnosticInfo(prev => 
        `${prev}\n✓ Found staff record:\n` +
        `  - Employee ID: ${staff.employee_id}\n` +
        `  - Department: ${staff.department}\n` +
        `  - Position: ${staff.position}\n\n` +
        `All required records exist. Login should work.`
      );
      
    } catch (error: any) {
      setDiagnosticInfo(`Diagnostic error: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Diamond className="h-12 w-12 text-blue-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Jewelry Management System
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Sign in to your account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {configStatus && !configStatus.success && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Configuration Error
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    {configStatus.message}
                  </div>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10 pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-md p-3">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  loading
                    ? 'bg-indigo-300 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                }`}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          {/* Diagnostic tools */}
          <div className="mt-6">
            <button
              type="button"
              onClick={checkAdminUser}
              className="w-full flex justify-center py-2 px-4 border border-indigo-300 text-indigo-700 rounded-md shadow-sm text-sm font-medium hover:bg-indigo-50"
            >
              Run Diagnostics
            </button>
          </div>

          {diagnosticInfo && (
            <div className="mt-4 bg-gray-50 p-4 rounded-md text-xs font-mono whitespace-pre-wrap">
              {diagnosticInfo}
            </div>
          )}
          
          <div className="mt-4 text-center text-sm">
            <p className="text-gray-600">Default login:</p>
            <p className="font-medium">Email: smash@gmail.com</p>
            <p className="font-medium">Password: @pplepie9229S</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
