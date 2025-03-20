import React from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/quotation';
import { Package, DollarSign, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface PurchaseStats {
  manufacturer: string;
  total_purchases: number;
  total_items: number;
  total_cost: number;
  average_cost: number;
  dead_stock: {
    total_items: number;
    total_value: number;
    items: Array<{
      id: string;
      sku: string;
      name: string;
      category: string;
      stock_level: number;
      buy_price: number;
      last_sold: string | null;
    }>;
  };
  category_breakdown: Array<{
    category: string;
    quantity: number;
    value: number;
  }>;
}

const PurchaseAnalytics = () => {
  const [stats, setStats] = React.useState<PurchaseStats[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedMonth, setSelectedMonth] = React.useState(() => format(new Date(), 'yyyy-MM'));
  const [deadStockPeriod, setDeadStockPeriod] = React.useState(90); // Days

  React.useEffect(() => {
    fetchPurchaseStats();
  }, [selectedMonth, deadStockPeriod]);

  const fetchPurchaseStats = async () => {
    try {
      const { data: analyticsData, error } = await supabase
        .from('manufacturer_analytics')
        .select('*')
        .eq('month', selectedMonth + '-01');

      if (error) throw error;

      const stats = analyticsData.map(record => ({
        manufacturer: record.manufacturer,
        total_purchases: record.purchases.total_amount || 0,
        total_items: record.purchases.total_items || 0,
        total_cost: record.purchases.total_amount || 0,
        average_cost: record.purchases.total_items ? 
          record.purchases.total_amount / record.purchases.total_items : 0,
        dead_stock: record.dead_stock || {
          total_items: 0,
          total_value: 0,
          items: []
        },
        category_breakdown: Object.entries(record.purchases.categories || {}).map(([category, data]: [string, any]) => ({
          category,
          quantity: data.quantity || 0,
          value: data.value || 0
        }))
      }));

      setStats(stats.sort((a, b) => b.total_cost - a.total_cost));
    } catch (error) {
      console.error('Error fetching purchase stats:', error);
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
        <h2 className="text-2xl font-bold">Purchase Analytics</h2>
        <div className="flex gap-4">
          <select
            value={deadStockPeriod}
            onChange={(e) => setDeadStockPeriod(Number(e.target.value))}
            className="input"
          >
            <option value="30">30 Days</option>
            <option value="60">60 Days</option>
            <option value="90">90 Days</option>
            <option value="180">180 Days</option>
          </select>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="input"
          />
        </div>
      </div>

      <div className="grid gap-6">
        {stats.map((manufacturer) => (
          <div key={manufacturer.manufacturer} className="bg-white rounded-lg shadow">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold">{manufacturer.manufacturer}</h3>
                  <p className="text-sm text-gray-500">
                    Purchase data for {format(new Date(selectedMonth), 'MMMM yyyy')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">
                    ₹{formatCurrency(manufacturer.total_cost)}
                  </p>
                  <p className="text-sm text-gray-500">Total Purchase Cost</p>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Total Items Purchased</span>
                  </div>
                  <p className="text-2xl font-bold">{manufacturer.total_items}</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Average Cost</span>
                  </div>
                  <p className="text-2xl font-bold">₹{formatCurrency(manufacturer.average_cost)}</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <span className="font-medium">Dead Stock Value</span>
                  </div>
                  <p className="text-2xl font-bold">₹{formatCurrency(manufacturer.dead_stock.total_value)}</p>
                  <p className="text-sm text-gray-500">{manufacturer.dead_stock.total_items} items</p>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="mb-6">
                <h4 className="font-medium mb-4">Category Breakdown</h4>
                <div className="space-y-3">
                  {manufacturer.category_breakdown.map((category) => (
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
                              width: `${(category.value / manufacturer.total_cost) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                      <div className="ml-4 text-right">
                        <p className="font-medium">₹{formatCurrency(category.value)}</p>
                        <p className="text-sm text-gray-500">
                          {((category.value / manufacturer.total_cost) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dead Stock Details */}
              {manufacturer.dead_stock.items.length > 0 && (
                <div>
                  <h4 className="font-medium mb-4">Dead Stock ({deadStockPeriod} Days+)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-gray-500">
                          <th className="pb-2">SKU</th>
                          <th className="pb-2">Name</th>
                          <th className="pb-2">Category</th>
                          <th className="pb-2 text-right">Stock</th>
                          <th className="pb-2 text-right">Value</th>
                          <th className="pb-2">Last Sold</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {manufacturer.dead_stock.items.map((item) => (
                          <tr key={item.id} className="border-t">
                            <td className="py-2 font-mono">{item.sku}</td>
                            <td className="py-2">{item.name}</td>
                            <td className="py-2">{item.category}</td>
                            <td className="py-2 text-right">{item.stock_level}</td>
                            <td className="py-2 text-right">
                              ₹{formatCurrency(item.stock_level * item.buy_price)}
                            </td>
                            <td className="py-2">
                              {item.last_sold ? 
                                format(new Date(item.last_sold), 'dd/MM/yyyy') : 
                                'Never'
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PurchaseAnalytics;
