import React from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/quotation';
import { TrendingUp, TrendingDown, Package, DollarSign, ArrowRight } from 'lucide-react';

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
  const [loading, setLoading] = React.useState(true);
  const [selectedMonth, setSelectedMonth] = React.useState(() => format(new Date(), 'yyyy-MM'));

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Manufacturer Performance</h2>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="input"
        />
      </div>

      <div className="grid gap-6">
        {stats.map((manufacturer) => (
          <div key={manufacturer.manufacturer} className="bg-white rounded-lg shadow">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold">{manufacturer.manufacturer}</h3>
                  <p className="text-sm text-gray-500">Performance for {format(new Date(selectedMonth), 'MMMM yyyy')}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">
                    ₹{formatCurrency(manufacturer.total_revenue)}
                  </p>
                  <p className="text-sm text-gray-500">Total Revenue</p>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
              <div className="mb-6">
                <h4 className="font-medium mb-4">Top Categories</h4>
                <div className="space-y-3">
                  {manufacturer.top_categories.map((category) => (
                    <div key={category.category} className="flex items-center">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium">{category.category}</span>
                          <span className="text-gray-500">{category.quantity} items</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
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
                <h4 className="font-medium mb-4">Monthly Trend</h4>
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
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <div className="w-full bg-blue-100 rounded-t relative" style={{ height }}>
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
    </div>
  );
};

export default ManufacturerAnalytics;
