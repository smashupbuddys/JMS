import React from 'react';
import { X, TrendingUp, TrendingDown, Package, DollarSign, ArrowRight, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/quotation';

interface ManufacturerDetailsProps {
  manufacturer: {
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
  };
  onClose: () => void;
  month: string;
}

const ManufacturerDetails: React.FC<ManufacturerDetailsProps> = ({
  manufacturer,
  onClose,
  month
}) => {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'categories' | 'trends'>('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Package },
    { id: 'categories', label: 'Categories', icon: DollarSign },
    { id: 'trends', label: 'Trends', icon: TrendingUp }
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl w-full max-w-5xl shadow-xl border border-gray-100">
        <div className="flex justify-between items-center p-6 border-b relative">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-50 to-gray-100 opacity-50 rounded-t-2xl -z-10" />
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              {manufacturer.manufacturer}
            </h2>
            <p className="text-sm text-gray-500">
              Performance Report for {format(new Date(month), 'MMMM yyyy')}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-blue-500/20 rounded-xl blur-lg transition-all duration-300 group-hover:scale-105 -z-10" />
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
                  <DollarSign className="h-5 w-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold">₹{formatCurrency(manufacturer.total_revenue)}</p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-green-500/20 rounded-xl blur-lg transition-all duration-300 group-hover:scale-105 -z-10" />
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-500">Items Sold</h3>
                  <Package className="h-5 w-5 text-green-500" />
                </div>
                <p className="text-2xl font-bold">{manufacturer.total_items}</p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-purple-500/20 rounded-xl blur-lg transition-all duration-300 group-hover:scale-105 -z-10" />
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-500">Average Price</h3>
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                </div>
                <p className="text-2xl font-bold">₹{formatCurrency(manufacturer.average_price)}</p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-amber-500/20 rounded-xl blur-lg transition-all duration-300 group-hover:scale-105 -z-10" />
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-500">Total Sales</h3>
                  <Calendar className="h-5 w-5 text-amber-500" />
                </div>
                <p className="text-2xl font-bold">{manufacturer.total_sales}</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 mb-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  flex items-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-all duration-200
                  ${activeTab === tab.id 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md' 
                    : 'text-gray-600 hover:bg-gray-100'}
                `}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <h3 className="font-medium text-gray-900">Performance Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-4">Sales Distribution</h4>
                    <div className="space-y-4">
                      {manufacturer.top_categories.map((category, index) => (
                        <div key={category.category} className="relative">
                          <div className="flex justify-between mb-1">
                            <span className="font-medium">{category.category}</span>
                            <span>₹{formatCurrency(category.revenue)}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                              style={{ width: `${(category.revenue / manufacturer.total_revenue) * 100}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {category.quantity} items ({((category.revenue / manufacturer.total_revenue) * 100).toFixed(1)}%)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-4">Monthly Performance</h4>
                    <div className="h-64 flex items-end gap-2">
                      {manufacturer.monthly_trend.map((month, index) => {
                        const height = `${(month.revenue / manufacturer.total_revenue) * 100}%`;
                        const isUp = index > 0 && month.revenue > manufacturer.monthly_trend[index - 1].revenue;

                        return (
                          <div key={month.month} className="flex-1 flex flex-col items-center">
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
                              className="w-full bg-gradient-to-t from-blue-100 to-blue-50 rounded-t relative group"
                              style={{ height }}
                            >
                              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
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
            )}

            {activeTab === 'categories' && (
              <div className="space-y-6">
                <h3 className="font-medium text-gray-900">Category Analysis</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {manufacturer.top_categories.map(category => (
                    <div key={category.category} className="bg-gray-50 rounded-xl p-6">
                      <h4 className="font-medium text-gray-900 mb-4">{category.category}</h4>
                      <div className="space-y-4">
                        <div>
                          <div className="text-sm text-gray-500">Revenue</div>
                          <div className="text-xl font-bold">₹{formatCurrency(category.revenue)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Items Sold</div>
                          <div className="text-xl font-bold">{category.quantity}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Average Price</div>
                          <div className="text-xl font-bold">
                            ₹{formatCurrency(category.revenue / category.quantity)}
                          </div>
                        </div>
                        <div className="pt-4 border-t">
                          <div className="text-sm text-gray-500">Share of Total Revenue</div>
                          <div className="text-xl font-bold">
                            {((category.revenue / manufacturer.total_revenue) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'trends' && (
              <div className="space-y-6">
                <h3 className="font-medium text-gray-900">Monthly Trends</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-4">Revenue Trend</h4>
                    <div className="h-64 flex items-end gap-2">
                      {manufacturer.monthly_trend.map((month, index) => {
                        const height = `${(month.revenue / manufacturer.total_revenue) * 100}%`;
                        const isUp = index > 0 && month.revenue > manufacturer.monthly_trend[index - 1].revenue;

                        return (
                          <div key={month.month} className="flex-1 flex flex-col items-center">
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
                              className="w-full bg-gradient-to-t from-blue-100 to-blue-50 rounded-t relative group"
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

                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-4">Sales Volume Trend</h4>
                    <div className="h-64 flex items-end gap-2">
                      {manufacturer.monthly_trend.map((month, index) => {
                        const height = `${(month.sales / Math.max(...manufacturer.monthly_trend.map(m => m.sales))) * 100}%`;
                        const isUp = index > 0 && month.sales > manufacturer.monthly_trend[index - 1].sales;

                        return (
                          <div key={month.month} className="flex-1 flex flex-col items-center">
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
                              className="w-full bg-gradient-to-t from-green-100 to-green-50 rounded-t relative group"
                              style={{ height }}
                            >
                              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs">
                                {month.sales} items
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManufacturerDetails;
