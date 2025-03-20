import React from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/quotation';
import { TrendingUp, TrendingDown, Package, DollarSign, ArrowRight, ShoppingBag } from 'lucide-react';
import ManufacturerDetails from './ManufacturerDetails.tsx';
import PurchaseAnalytics from './PurchaseAnalytics';

interface ManufacturerStats {
  manufacturer: string;
  total_sales: number;
  total_items: number;
  total_revenue: number;
  average_price: number;
  top_categories: Array<{
    category: string;
    quantity: number;
    revenue: number;
  }>;
  monthly_trend: Array<{
    month: string;
    sales: number;
    revenue: number;
  }>;
}

const ManufacturerAnalytics = () => {
  const [stats, setStats] = React.useState<ManufacturerStats[]>([]);
  const [activeTab, setActiveTab] = React.useState<'sales' | 'purchases'>('sales');
  const [loading, setLoading] = React.useState(true);
  const [selectedMonth, setSelectedMonth] = React.useState(() => format(new Date(), 'yyyy-MM'));
  const [selectedManufacturer, setSelectedManufacturer] = React.useState<string | null>(null);
  const [showDetails, setShowDetails] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchManufacturerStats();
  }, [selectedMonth]);

  const fetchManufacturerStats = async () => {
    try {
      const startDate = new Date(selectedMonth);
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('quotations')
        .select(`
          items,
          total_amount,
          created_at
        `)
        .eq('status', 'accepted')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      // Process data by manufacturer
      const manufacturerData = new Map<string, {
        sales: number;
        items: number;
        revenue: number;
        categories: Map<string, { quantity: number; revenue: number }>;
        monthlyTrend: Map<string, { sales: number; revenue: number }>;
      }>();

      data?.forEach(quotation => {
        const items = quotation.items as any[];
        items.forEach(item => {
          const manufacturer = item.product.manufacturer;
          const category = item.product.category;
          const quantity = Number(item.quantity);
          const revenue = Number(item.price) * quantity;

          if (!manufacturerData.has(manufacturer)) {
            manufacturerData.set(manufacturer, {
              sales: 0,
              items: 0,
              revenue: 0,
              categories: new Map(),
              monthlyTrend: new Map()
            });
          }

          const mfrData = manufacturerData.get(manufacturer)!;
          mfrData.sales++;
          mfrData.items += quantity;
          mfrData.revenue += revenue;

          // Update category stats
          if (!mfrData.categories.has(category)) {
            mfrData.categories.set(category, { quantity: 0, revenue: 0 });
          }
          const catStats = mfrData.categories.get(category)!;
          catStats.quantity += quantity;
          catStats.revenue += revenue;

          // Update monthly trend
          const month = format(new Date(quotation.created_at), 'yyyy-MM');
          if (!mfrData.monthlyTrend.has(month)) {
            mfrData.monthlyTrend.set(month, { sales: 0, revenue: 0 });
          }
          const monthStats = mfrData.monthlyTrend.get(month)!;
          monthStats.sales += quantity;
          monthStats.revenue += revenue;
        });
      });

      // Transform data for display
      const statsArray: ManufacturerStats[] = Array.from(manufacturerData.entries())
        .map(([manufacturer, data]) => ({
          manufacturer,
          total_sales: data.sales,
          total_items: data.items,
          total_revenue: data.revenue,
          average_price: data.revenue / data.items,
          top_categories: Array.from(data.categories.entries())
            .map(([category, stats]) => ({
              category,
              quantity: stats.quantity,
              revenue: stats.revenue
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5),
          monthly_trend: Array.from(data.monthlyTrend.entries())
            .map(([month, stats]) => ({
              month,
              sales: stats.sales,
              revenue: stats.revenue
            }))
            .sort((a, b) => a.month.localeCompare(b.month))
        }))
        .sort((a, b) => b.total_revenue - a.total_revenue);

      setStats(statsArray);
    } catch (error) {
      console.error('Error fetching manufacturer stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4">
            Manufacturer Performance
          </h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setActiveTab('sales')}
              className={`btn ${
                activeTab === 'sales' 
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' 
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } flex items-center gap-2 rounded-xl px-6`}
            >
              <TrendingUp className="h-4 w-4" />
              Sales Performance
            </button>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`btn ${
                activeTab === 'purchases'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } flex items-center gap-2 rounded-xl px-6`}
            >
              <ShoppingBag className="h-4 w-4" />
              Purchase Analytics
            </button>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <select
            value={selectedManufacturer || ''}
            onChange={(e) => setSelectedManufacturer(e.target.value || null)}
            className="input bg-white/80 backdrop-blur-sm w-48"
          >
            <option value="">All Manufacturers</option>
            {stats.map(s => (
              <option key={s.manufacturer} value={s.manufacturer}>
                {s.manufacturer}
              </option>
            ))}
          </select>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="input bg-white/80 backdrop-blur-sm w-40"
          />
        </div>
      </div>

      {activeTab === 'purchases' ? (
        <PurchaseAnalytics />
      ) : (
      <div className="grid gap-8">
        {stats.map((manufacturer) => (
          <div 
            key={manufacturer.manufacturer} 
            className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100/80 overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            onClick={() => setShowDetails(manufacturer.manufacturer)}
          >
            <div className="relative p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 opacity-50" />
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                    {manufacturer.manufacturer}
                  </h3>
                  <p className="text-sm text-gray-500">Performance for {format(new Date(selectedMonth), 'MMMM yyyy')}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                    ₹{formatCurrency(manufacturer.total_revenue)}
                  </p>
                  <p className="text-sm text-gray-500">Total Revenue</p>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Total Items Sold</span>
                  </div>
                  <p className="text-2xl font-bold">{manufacturer.total_items}</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Average Price</span>
                  </div>
                  <p className="text-2xl font-bold">₹{formatCurrency(manufacturer.average_price)}</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">Total Sales</span>
                  </div>
                  <p className="text-2xl font-bold">{manufacturer.total_sales}</p>
                </div>
              </div>

              {/* Top Categories */}
              <div className="mb-8">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-500" />
                  Top Categories
                </h4>
                <div className="space-y-3">
                  {manufacturer.top_categories.map((category) => (
                    <div key={category.category} className="flex items-center">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium">{category.category}</span>
                          <span className="text-gray-500">{category.quantity} items</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transform transition-all duration-500 ease-out hover:scale-x-105"
                            style={{
                              width: `${(category.revenue / manufacturer.total_revenue) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                      <div className="ml-4 text-right">
                        <p className="font-medium">₹{formatCurrency(category.revenue)}</p>
                        <p className="text-sm text-gray-500">
                          {((category.revenue / manufacturer.total_revenue) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Monthly Trend */}
              <div>
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-gray-500" />
                  Monthly Trend
                </h4>
                <div className="flex items-end h-40 gap-2">
                  {manufacturer.monthly_trend.map((month, index) => {
                    const height = `${(month.revenue / manufacturer.total_revenue) * 100}%`;
                    const isUp = index > 0 && month.revenue > manufacturer.monthly_trend[index - 1].revenue;

                    return (
                      <div
                        key={month.month}
                        className="flex-1 flex flex-col items-center"
                      >
                        <div className="text-xs text-gray-500 mb-1">
                          {isUp ? (
                            <div className="p-1 rounded-full bg-green-100">
                              <TrendingUp className="h-3 w-3 text-green-600" />
                            </div>
                          ) : (
                            <div className="p-1 rounded-full bg-red-100">
                              <TrendingDown className="h-3 w-3 text-red-600" />
                            </div>
                          )}
                        </div>
                        <div 
                          className="w-full bg-gradient-to-t from-blue-100 to-blue-50 rounded-t relative group transition-all duration-300 hover:from-blue-200 hover:to-blue-100" 
                          style={{ height }}
                        >
                          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs">
                            ₹{formatCurrency(month.revenue)}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {format(new Date(month.month), 'MMM')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Detailed Manufacturer View Modal */}
      {showDetails && (
        <ManufacturerDetails
          manufacturer={stats.find(s => s.manufacturer === showDetails)!}
          onClose={() => setShowDetails(null)}
          month={selectedMonth}
        />
      )}
    </div>
  );
};

export default ManufacturerAnalytics;
