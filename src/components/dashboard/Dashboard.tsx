import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { user, staff } = useAuth();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalCustomers: 0,
    totalSales: 0,
    pendingOrders: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Get product count
        const { count: productCount, error: productError } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true });

        // Get customer count
        const { count: customerCount, error: customerError } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true });

        // Get sales total
        const { data: salesData, error: salesError } = await supabase
          .from('sales')
          .select('amount')
          .gte('created_at', new Date(new Date().setDate(new Date().getDate() - 30)).toISOString());

        // Get pending orders
        const { count: pendingCount, error: pendingError } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        if (productError || customerError || salesError || pendingError) {
          console.error('Error fetching dashboard data:', { productError, customerError, salesError, pendingError });
        }

        const totalSales = salesData?.reduce((sum, sale) => sum + (sale.amount || 0), 0) || 0;

        setStats({
          totalProducts: productCount || 0,
          totalCustomers: customerCount || 0,
          totalSales,
          pendingOrders: pendingCount || 0
        });
      } catch (error) {
        console.error('Error in dashboard data fetch:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">
          Welcome back, {user?.full_name || 'User'}!
        </p>
      </header>

      {loading ? (
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-gray-500 text-sm font-medium">Total Products</h2>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalProducts}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-gray-500 text-sm font-medium">Total Customers</h2>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalCustomers}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-gray-500 text-sm font-medium">Monthly Sales</h2>
            <p className="text-3xl font-bold text-gray-900 mt-2">₹{stats.totalSales.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-gray-500 text-sm font-medium">Pending Orders</h2>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.pendingOrders}</p>
          </div>
        </div>
      )}

      {/* Permissions info */}
      {staff && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Permissions</h2>
          {Object.entries(staff.permissions || {}).map(([key, value]) => (
            <div key={key} className="flex items-center mb-2">
              <div className={`w-3 h-3 rounded-full mr-2 ${value ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-gray-700">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard; 