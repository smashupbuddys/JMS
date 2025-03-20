import React from 'react';
import { TrendingUp, Video, FileText, Users, DollarSign, Package, ArrowUp, ArrowDown, Calendar, AlertTriangle, Truck, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/quotation';
import { Link } from 'react-router-dom';

interface DailyStats {
  date: string;
  video_calls_count: number;
  bills_generated_count: number;
  total_sales_amount: number;
  total_items_sold: number;
  new_customers_count: number;
  payment_collection: number;
  stats: {
    categories: Record<string, number>;
    payment_methods: Record<string, number>;
    customer_types: {
      retail: number;
      wholesale: number;
    };
  };
}

const DailyAnalytics = () => {
  const [todayStats, setTodayStats] = React.useState<DailyStats | null>(null);
  const [yesterdayStats, setYesterdayStats] = React.useState<DailyStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [totalSales, setTotalSales] = React.useState({ daily: 0, weekly: 0, monthly: 0, total: 0 });
  const [pendingCalls, setPendingCalls] = React.useState([]);
  const [pendingBilling, setPendingBilling] = React.useState([]);
  const [overdueBilling, setOverdueBilling] = React.useState([]);
  const [pendingDispatches, setPendingDispatches] = React.useState([]);

  const hasPermission = (permission: string) => true; // Mock implementation

  React.useEffect(() => {
    fetchDailyStats();
  }, []);

  const fetchDailyStats = async () => {
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const { data, error } = await supabase
        .from('daily_analytics')
        .select('*')
        .in('date', [format(today, 'yyyy-MM-dd'), format(yesterday, 'yyyy-MM-dd')]);

      if (error) throw error;

      const todayData = data?.find(d => d.date === format(today, 'yyyy-MM-dd'));
      const yesterdayData = data?.find(d => d.date === format(yesterday, 'yyyy-MM-dd'));

      setTodayStats(todayData || null);
      setYesterdayStats(yesterdayData || null);
    } catch (error) {
      console.error('Error fetching daily stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateChange = (today: number, yesterday: number) => {
    if (!yesterday) return { value: 100, increase: true };
    const change = ((today - yesterday) / yesterday) * 100;
    return {
      value: Math.abs(change),
      increase: change >= 0
    };
  };

  const StatCard = ({ 
    title, 
    value, 
    previousValue, 
    icon: Icon,
    prefix = '',
    format = (v: number) => v.toString()
  }) => {
    const change = calculateChange(value, previousValue);
    
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold mt-1">{prefix}{format(value)}</p>
          </div>
          <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
            change.increase ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
          }`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
        <div className="mt-4 flex items-center">
          {change.increase ? (
            <ArrowUp className="h-4 w-4 text-green-500" />
          ) : (
            <ArrowDown className="h-4 w-4 text-red-500" />
          )}
          <span className={`text-sm ${
            change.increase ? 'text-green-600' : 'text-red-600'
          }`}>
            {change.value.toFixed(1)}%
          </span>
          <span className="text-sm text-gray-500 ml-2">vs yesterday</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-4 text-gray-500">Loading daily analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Today's Analytics</h2>
        <p className="text-gray-500">{format(new Date(), 'PPP')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {hasPermission('view_analytics') ? [
          { 
            label: 'Today\'s Sales', 
            value: totalSales.daily,
            color: 'bg-gradient-to-br from-emerald-400 to-green-500',
            bgColor: 'bg-emerald-50',
            icon: TrendingUp
          },
          { 
            label: 'This Week', 
            value: totalSales.weekly,
            color: 'bg-gradient-to-br from-blue-400 to-blue-500',
            bgColor: 'bg-blue-50',
            icon: Calendar
          },
          { 
            label: 'This Month', 
            value: totalSales.monthly,
            color: 'bg-gradient-to-br from-violet-400 to-purple-500',
            bgColor: 'bg-purple-50',
            icon: DollarSign
          },
          { 
            label: 'Total Sales', 
            value: totalSales.total,
            color: 'bg-gradient-to-br from-indigo-400 to-indigo-500',
            bgColor: 'bg-indigo-50',
            icon: Package
          }
        ].map(({ label, value, color, bgColor, icon: Icon }) => (
          <div key={label} className="relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className={`absolute inset-0 opacity-10 ${color}`} />
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-gray-600">{label}</p>
                <div className={`p-2 rounded-lg ${color} bg-opacity-20`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight">₹{value.toLocaleString()}</p>
              <div className="mt-2 flex items-center text-sm">
                <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-500 font-medium">100.0%</span>
                <span className="text-gray-500 ml-2">vs yesterday</span>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-4 text-center py-12 bg-white rounded-2xl shadow-lg">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">You don't have permission to view analytics</p>
          </div>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
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
            className="relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className={`absolute inset-0 opacity-10 ${color}`} />
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-gray-600">{label}</p>
                <div className={`p-2 rounded-lg ${color} bg-opacity-20`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight">{value}</p>
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

      {/* Category-wise Sales */}
      {todayStats?.stats.categories && Object.keys(todayStats.stats.categories).length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h3 className="text-lg font-semibold mb-4">Category-wise Sales</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Object.entries(todayStats.stats.categories).map(([category, count]) => (
              <div key={category} className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 hover:shadow-md transition-all duration-300">
                <div className="absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 bg-gradient-to-br from-blue-400/10 to-blue-600/10 rounded-full" />
                <p className="font-medium text-gray-800">{category}</p>
                <p className="text-3xl font-bold mt-2 bg-gradient-to-br from-blue-600 to-blue-800 bg-clip-text text-transparent">{count}</p>
                <p className="text-sm text-gray-500 mt-2">items sold</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Type Distribution */}
      {todayStats?.stats.customer_types && (
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h3 className="text-lg font-semibold mb-4">Customer Distribution</h3>
          <div className="grid grid-cols-2 gap-8">
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 bg-gradient-to-br from-blue-400/10 to-blue-600/10 rounded-full" />
              <p className="font-medium text-blue-800">Retail Customers</p>
              <p className="text-3xl font-bold mt-2 bg-gradient-to-br from-blue-600 to-blue-800 bg-clip-text text-transparent">
                {todayStats.stats.customer_types.retail}
              </p>
            </div>
            <div className="relative overflow-hidden bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 bg-gradient-to-br from-purple-400/10 to-purple-600/10 rounded-full" />
              <p className="font-medium text-purple-800">Wholesale Customers</p>
              <p className="text-3xl font-bold mt-2 bg-gradient-to-br from-purple-600 to-purple-800 bg-clip-text text-transparent">
                {todayStats.stats.customer_types.wholesale}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyAnalytics;
