import React from 'react';
import { TrendingUp, Package, DollarSign, Users, Video, Clock, AlertTriangle, Truck, CheckCircle, ArrowUp, Calendar } from 'lucide-react';
import type { Product, VideoCall, Quotation } from '../../types';
import { supabase } from '../../lib/supabase';
import { Link, Routes, Route } from 'react-router-dom';
import DailyAnalytics from './DailyAnalytics';
import ManufacturerAnalytics from './ManufacturerAnalytics';
import { format } from 'date-fns';
import { hasPermission } from '../../lib/auth';

const SalesAnalytics = () => {
  const [pendingCalls, setPendingCalls] = React.useState<VideoCall[]>([]);
  const [pendingBilling, setPendingBilling] = React.useState<VideoCall[]>([]);
  const [overdueBilling, setOverdueBilling] = React.useState<VideoCall[]>([]);
  const [pendingDispatches, setPendingDispatches] = React.useState<Quotation[]>([]);
  const [totalSales, setTotalSales] = React.useState({
    daily: 0,
    weekly: 0,
    monthly: 0,
    total: 0
  });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch pending video calls
      const { data: callsData } = await supabase
        .from('video_calls')
        .select('*')
        .eq('status', 'scheduled')
        .order('scheduled_at', { ascending: true });

      // Fetch calls pending billing
      const { data: billingData } = await supabase
        .from('video_calls')
        .select('*')
        .eq('quotation_required', true)
        .eq('bill_status', 'pending')
        .order('scheduled_at', { ascending: true });

      // Fetch overdue payments
      const { data: overdueData } = await supabase
        .from('video_calls')
        .select('*')
        .eq('payment_status', 'overdue')
        .order('payment_due_date', { ascending: true });

      // Fetch pending dispatches (accepted quotations awaiting delivery)
      const { data: dispatchData } = await supabase
        .from('quotations')
        .select('*')
        .eq('status', 'accepted')
        .order('created_at', { ascending: true });

      // Fetch total sales from accepted quotations
      const now = new Date();
      const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).toISOString();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: salesData } = await supabase
        .from('quotations')
        .select('total_amount, created_at')
        .eq('status', 'accepted');

      // Calculate sales totals
      const sales = {
        daily: 0,
        weekly: 0,
        monthly: 0,
        total: 0
      };

      salesData?.forEach(quotation => {
        const amount = Number(quotation.total_amount);
        const date = new Date(quotation.created_at);
        
        // Add to total sales
        sales.total += amount;

        // Check if within current day/week/month
        if (date >= new Date(startOfDay)) {
          sales.daily += amount;
        }
        if (date >= new Date(startOfWeek)) {
          sales.weekly += amount;
        }
        if (date >= new Date(startOfMonth)) {
          sales.monthly += amount;
        }
      });

      setPendingCalls(callsData || []);
      setPendingBilling(billingData || []);
      setOverdueBilling(overdueData || []);
      setPendingDispatches(dispatchData || []);
      setTotalSales(sales);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Sales Overview
          </h2>
          <div className="flex flex-wrap gap-4">
            <Link to="/" className="btn btn-primary bg-gradient-to-r from-blue-600 to-blue-700">
              Daily Overview
            </Link>
            <Link to="/manufacturers" className="btn btn-secondary">
              Manufacturer Performance
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-emerald-500/20 rounded-2xl blur-xl transition-all duration-300 group-hover:scale-105 -z-10" />
            <div className="bg-white rounded-2xl p-6 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-500">Today's Sales</h3>
                <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">₹{totalSales.daily.toLocaleString()}</p>
              <div className="mt-2 flex items-center text-sm">
                <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-500 font-medium">100.0%</span>
                <span className="text-gray-500 ml-2">vs yesterday</span>
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-blue-500/20 rounded-2xl blur-xl transition-all duration-300 group-hover:scale-105 -z-10" />
            <div className="bg-white rounded-2xl p-6 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-500">This Week</h3>
                <div className="p-2 bg-gradient-to-br from-blue-400 to-blue-500 rounded-lg">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">₹{totalSales.weekly.toLocaleString()}</p>
              <div className="mt-2 flex items-center text-sm">
                <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-500 font-medium">100.0%</span>
                <span className="text-gray-500 ml-2">vs last week</span>
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-violet-500/20 rounded-2xl blur-xl transition-all duration-300 group-hover:scale-105 -z-10" />
            <div className="bg-white rounded-2xl p-6 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-500">This Month</h3>
                <div className="p-2 bg-gradient-to-br from-purple-400 to-violet-500 rounded-lg">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">₹{totalSales.monthly.toLocaleString()}</p>
              <div className="mt-2 flex items-center text-sm">
                <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-500 font-medium">100.0%</span>
                <span className="text-gray-500 ml-2">vs last month</span>
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/20 to-indigo-500/20 rounded-2xl blur-xl transition-all duration-300 group-hover:scale-105 -z-10" />
            <div className="bg-white rounded-2xl p-6 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-500">Total Sales</h3>
                <div className="p-2 bg-gradient-to-br from-indigo-400 to-indigo-500 rounded-lg">
                  <Package className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">₹{totalSales.total.toLocaleString()}</p>
              <div className="mt-2 flex items-center text-sm">
                <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-500 font-medium">100.0%</span>
                <span className="text-gray-500 ml-2">overall growth</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { 
              permission: 'manage_video_calls',
              icon: Video, 
              label: 'Pending Calls', 
              value: pendingCalls.length, 
              link: '/video-calls',
              color: 'bg-gradient-to-br from-sky-400 to-blue-500',
              bgColor: 'bg-blue-50'
            },
            { 
              permission: 'manage_quotations',
              icon: DollarSign, 
              label: 'Pending Billing', 
              value: pendingBilling.length,
              link: '/pos',
              color: 'bg-gradient-to-br from-amber-400 to-yellow-500',
              bgColor: 'bg-yellow-50'
            },
            { 
              permission: 'manage_quotations',
              icon: AlertTriangle, 
              label: 'Overdue Payments', 
              value: overdueBilling.length,
              link: '/video-calls',
              color: 'bg-gradient-to-br from-rose-400 to-red-500',
              bgColor: 'bg-red-50'
            },
            { 
              permission: 'manage_dispatch',
              icon: Truck, 
              label: 'Pending Dispatches', 
              value: pendingDispatches.length,
              link: '/orders',
              color: 'bg-gradient-to-br from-emerald-400 to-green-500',
              bgColor: 'bg-green-50'
            }
          ].map(({ permission, icon: Icon, label, value, link, color, bgColor }) => (
            hasPermission(permission) ? (
            <Link 
              key={label} 
              to={link}
              className="relative group"
            >
              <div className={`absolute inset-0 ${color.replace('to-', 'to-transparent ').replace('from-', 'from-transparent ')} opacity-20 rounded-2xl blur-xl transition-all duration-300 group-hover:scale-105 -z-10`} />
              <div className="bg-white rounded-2xl p-6 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-500">{label}</h3>
                  <div className={`p-2 ${color} rounded-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">{value}</p>
                <div className="mt-2 flex items-center text-sm">
                  <Clock className="h-4 w-4 text-gray-500 mr-1" />
                  <span className="text-gray-500">Updated just now</span>
                </div>
              </div>
            </Link>
            ) : (
              <div key={label} className="bg-gray-50 p-6 rounded-2xl">
                <div className="text-center text-gray-500">***</div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* Pending Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Video Calls */}
        <div className="bg-white rounded-lg shadow">
          {hasPermission('manage_video_calls') ? (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Upcoming Video Calls</h2>
              <Link to="/video-calls" className="text-blue-600 hover:text-blue-800 text-sm">
                View All
              </Link>
            </div>
            <div className="space-y-4">
              {pendingCalls.slice(0, 5).map(call => (
                <div key={call.id} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{format(new Date(call.scheduled_at), 'PPp')}</p>
                    <p className="text-sm text-gray-500">Customer ID: {call.customer_id}</p>
                  </div>
                  <Link
                    to={`/video-calls?id=${call.id}`}
                    className="btn btn-secondary"
                  >
                    View Details
                  </Link>
                </div>
              ))}
              {pendingCalls.length === 0 && (
                <p className="text-gray-500 text-center py-4">No pending video calls</p>
              )}
            </div>
          </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-gray-500">You don't have permission to view video calls</p>
            </div>
          )}
        </div>

        {/* Pending Billing */}
        <div className="bg-white rounded-lg shadow">
          {hasPermission('manage_quotations') ? (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Pending Billing</h2>
              <Link to="/pos" className="text-blue-600 hover:text-blue-800 text-sm">
                View All
              </Link>
            </div>
            <div className="space-y-4">
              {pendingBilling.slice(0, 5).map(call => (
                <div key={call.id} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">
                      Amount: ₹{call.bill_amount.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Due: {format(new Date(call.payment_due_date!), 'PP')}
                    </p>
                  </div>
                  <Link
                    to={`/pos?call=${call.id}`}
                    className="btn btn-primary"
                  >
                    Generate Bill
                  </Link>
                </div>
              ))}
              {pendingBilling.length === 0 && (
                <p className="text-gray-500 text-center py-4">No pending bills</p>
              )}
            </div>
          </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-gray-500">You don't have permission to view billing</p>
            </div>
          )}
        </div>

        {/* Overdue Payments */}
        <div className="bg-white rounded-lg shadow">
          {hasPermission('manage_quotations') ? (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-red-600">Overdue Payments</h2>
              <span className="text-sm text-red-600">
                {overdueBilling.length} overdue
              </span>
            </div>
            <div className="space-y-4">
              {overdueBilling.slice(0, 5).map(call => (
                <div key={call.id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                  <div>
                    <p className="font-medium">Amount: ₹{call.bill_amount.toLocaleString()}</p>
                    <p className="text-sm text-red-600">
                      Overdue since {format(new Date(call.payment_due_date!), 'PP')}
                    </p>
                  </div>
                  <Link
                    to={`/video-calls?id=${call.id}`}
                    className="btn btn-secondary"
                  >
                    View Details
                  </Link>
                </div>
              ))}
              {overdueBilling.length === 0 && (
                <p className="text-gray-500 text-center py-4">No overdue payments</p>
              )}
            </div>
          </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-gray-500">You don't have permission to view payments</p>
            </div>
          )}
        </div>

        {/* Pending Dispatches */}
        <div className="bg-white rounded-lg shadow">
          {hasPermission('manage_dispatch') ? (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Pending Dispatches</h2>
              <Link to="/orders" className="text-blue-600 hover:text-blue-800 text-sm">
                View All
              </Link>
            </div>
            <div className="space-y-4">
              {pendingDispatches.slice(0, 5).map(quotation => (
                <div key={quotation.id} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">
                      Order Total: ₹{quotation.total_amount.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Accepted on {format(new Date(quotation.updated_at), 'PP')}
                    </p>
                  </div>
                  <Link
                    to="/dispatch/pending"
                    className="btn btn-secondary"
                  >
                    Process Order
                  </Link>
                </div>
              ))}
              {pendingDispatches.length === 0 && (
                <p className="text-gray-500 text-center py-4">No pending dispatches</p>
              )}
            </div>
          </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-gray-500">You don't have permission to view dispatches</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesAnalytics;
