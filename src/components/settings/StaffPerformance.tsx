import React, { useState, useEffect } from 'react';
import { Star, TrendingUp, Video, DollarSign, UserCheck, Calendar, ChevronDown, ChevronUp, Users, Target, Award, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/quotation';

interface StaffPerformance {
  staff_id: string;
  staff_name: string;
  video_calls_total: number;
  video_calls_completed: number;
  sales_conversion_rate: number;
  total_sales_value: number;
  completed_sales_value: number;
  average_satisfaction_score: number;
  performance_score: number;
  target_achievement: number;
}

const StaffPerformance = () => {
  const [performance, setPerformance] = useState<StaffPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return format(now, 'yyyy-MM');
  });
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);

  useEffect(() => {
    fetchPerformanceData();
  }, [selectedPeriod]);

  const fetchPerformanceData = async () => {
    try {
      const startDate = new Date(selectedPeriod);
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

      const { data, error } = await supabase.rpc('get_staff_performance_report', {
        p_start_date: format(startDate, 'yyyy-MM-dd'),
        p_end_date: format(endDate, 'yyyy-MM-dd')
      });

      if (error) throw error;
      setPerformance(data || []);
    } catch (error) {
      console.error('Error fetching staff performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceBadge = (score: number) => {
    if (score >= 90) return { text: 'Excellent', color: 'bg-green-100 text-green-800' };
    if (score >= 70) return { text: 'Good', color: 'bg-blue-100 text-blue-800' };
    if (score >= 50) return { text: 'Average', color: 'bg-yellow-100 text-yellow-800' };
    return { text: 'Needs Improvement', color: 'bg-red-100 text-red-800' };
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
        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
          Staff Performance
        </h2>
        <input
          type="month"
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="input bg-white/80 backdrop-blur-sm w-40"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-blue-500/20 rounded-xl blur-lg transition-all duration-300 group-hover:scale-105 -z-10" />
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Total Sales</h3>
              <DollarSign className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">
              ₹{formatCurrency(performance.reduce((sum, p) => sum + p.total_sales_value, 0))}
            </p>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-green-500/20 rounded-xl blur-lg transition-all duration-300 group-hover:scale-105 -z-10" />
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Video Calls</h3>
              <Video className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold">
              {performance.reduce((sum, p) => sum + p.video_calls_total, 0)}
            </p>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-purple-500/20 rounded-xl blur-lg transition-all duration-300 group-hover:scale-105 -z-10" />
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Avg. Satisfaction</h3>
              <Star className="h-5 w-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold">
              {(performance.reduce((sum, p) => sum + p.average_satisfaction_score, 0) / performance.length).toFixed(1)}
            </p>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-amber-500/20 rounded-xl blur-lg transition-all duration-300 group-hover:scale-105 -z-10" />
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Avg. Conversion</h3>
              <TrendingUp className="h-5 w-5 text-amber-500" />
            </div>
            <p className="text-2xl font-bold">
              {(performance.reduce((sum, p) => sum + p.sales_conversion_rate, 0) / performance.length).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {performance.map((staff) => (
          <div 
            key={staff.staff_id}
            className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5 text-gray-500" />
                    {staff.staff_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      getPerformanceBadge(staff.performance_score).color
                    }`}>
                      {getPerformanceBadge(staff.performance_score).text}
                    </span>
                    <span className="text-sm text-gray-500">
                      Performance Score: {staff.performance_score.toFixed(1)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedStaff(expandedStaff === staff.staff_id ? null : staff.staff_id)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {expandedStaff === staff.staff_id ? (
                    <ChevronUp className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500" />
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Video className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Video Calls</span>
                  </div>
                  <p className="text-2xl font-bold">{staff.video_calls_completed} / {staff.video_calls_total}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {((staff.video_calls_completed / staff.video_calls_total) * 100).toFixed(1)}% completion rate
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Sales Value</span>
                  </div>
                  <p className="text-2xl font-bold">₹{formatCurrency(staff.completed_sales_value)}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {((staff.completed_sales_value / staff.total_sales_value) * 100).toFixed(1)}% collection rate
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <span className="font-medium">Satisfaction</span>
                  </div>
                  <p className="text-2xl font-bold">{staff.average_satisfaction_score.toFixed(1)}</p>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= staff.average_satisfaction_score
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">Target Achievement</span>
                  </div>
                  <p className="text-2xl font-bold">{staff.target_achievement.toFixed(1)}%</p>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                    {staff.target_achievement >= 100 ? (
                      <>
                        <ArrowUp className="h-3 w-3 text-green-500" />
                        <span className="text-green-500">Above target</span>
                      </>
                    ) : (
                      <>
                        <ArrowDown className="h-3 w-3 text-red-500" />
                        <span className="text-red-500">Below target</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {expandedStaff === staff.staff_id && (
                <div className="mt-6 pt-6 border-t">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-4">Performance Metrics</h4>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-gray-600">Video Call Completion</span>
                            <span className="text-sm font-medium">
                              {((staff.video_calls_completed / staff.video_calls_total) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                              style={{
                                width: `${(staff.video_calls_completed / staff.video_calls_total) * 100}%`
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-gray-600">Sales Conversion</span>
                            <span className="text-sm font-medium">{staff.sales_conversion_rate.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full"
                              style={{ width: `${staff.sales_conversion_rate}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-gray-600">Payment Collection</span>
                            <span className="text-sm font-medium">
                              {((staff.completed_sales_value / staff.total_sales_value) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"
                              style={{
                                width: `${(staff.completed_sales_value / staff.total_sales_value) * 100}%`
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-gray-600">Customer Satisfaction</span>
                            <span className="text-sm font-medium">{staff.average_satisfaction_score.toFixed(1)}/5.0</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-full"
                              style={{ width: `${(staff.average_satisfaction_score / 5) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-4">Monthly Targets</h4>
                      <div className="space-y-4">
                        <div className="bg-gray-50 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Target className="h-5 w-5 text-blue-500" />
                              <span className="font-medium">Sales Target</span>
                            </div>
                            <span className={staff.target_achievement >= 100 ? 'text-green-600' : 'text-red-600'}>
                              {staff.target_achievement.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                staff.target_achievement >= 100
                                  ? 'bg-gradient-to-r from-green-500 to-green-600'
                                  : 'bg-gradient-to-r from-red-500 to-red-600'
                              }`}
                              style={{ width: `${Math.min(staff.target_achievement, 100)}%` }}
                            />
                          </div>
                          <div className="mt-2 text-sm text-gray-500">
                            ₹{formatCurrency(staff.completed_sales_value)} of ₹{formatCurrency(staff.total_sales_value)} target
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 rounded-xl p-4">
                            <div className="text-sm text-gray-500 mb-1">Conversion Target</div>
                            <div className="text-xl font-bold">{staff.sales_conversion_rate.toFixed(1)}%</div>
                            <div className="text-xs text-gray-500">vs 75% goal</div>
                          </div>

                          <div className="bg-gray-50 rounded-xl p-4">
                            <div className="text-sm text-gray-500 mb-1">Satisfaction Target</div>
                            <div className="text-xl font-bold">{staff.average_satisfaction_score.toFixed(1)}</div>
                            <div className="text-xs text-gray-500">vs 4.5 goal</div>
                          </div>
                        </div>
                      </div>
                    </div>
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

export default StaffPerformance;
