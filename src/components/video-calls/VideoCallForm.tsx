import React, { useState, useEffect } from 'react';
import { X, Plus, Sun, Moon, Sunrise, Sunset, Clock, Globe, Video } from 'lucide-react';
import type { VideoCall, Customer } from '../../types';
import { supabase } from '../../lib/supabase';
import QuickCustomerForm from './QuickCustomerForm';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { getLocalTimeZone } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import { getCountryByCode } from '../../utils/countryUtils';
import { formatPhoneNumber, searchPhoneNumber } from '../../utils/phoneUtils';
import { validateFutureTime } from '../../utils/dateUtils';

interface VideoCallFormProps {
  call?: VideoCall;
  customers: Customer[];
  onClose: () => void;
  onSubmit: (data: any) => void;
}

function getTimeOfDay(date: Date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return { icon: Sunrise, label: 'Morning', color: 'text-orange-500' };
  if (hour >= 12 && hour < 17) return { icon: Sun, label: 'Afternoon', color: 'text-yellow-500' };
  if (hour >= 17 && hour < 20) return { icon: Sunset, label: 'Evening', color: 'text-purple-500' };
  return { icon: Moon, label: 'Night', color: 'text-blue-500' };
}

const VideoCallForm: React.FC<VideoCallFormProps> = ({ call, customers, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    customerId: call?.customer_id || '',
    staffId: call?.assigned_staff?.primary || call?.staff_id || '',
    scheduledAt: call?.scheduled_at ? new Date(call.scheduled_at).toISOString().slice(0, 16) : 
      new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16),
    notes: call?.notes || '',
    timeZone: call?.time_zone || getLocalTimeZone(),
    customerTimeZone: call?.customer_time_zone || '',
    customerCountry: call?.customer_country || 'IN'
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
  const [availableStaff, setAvailableStaff] = useState<Array<{
    id: string;
    name: string;
    role: string;
    active: boolean;
    available: boolean;
    availableUntil?: string;
  }>>([]);

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedHour, setSelectedHour] = useState<string>(() => {
    const now = new Date();
    return now.getHours().toString();
  });
  const [selectedMinute, setSelectedMinute] = useState<string>(() => {
    const now = new Date();
    return now.getMinutes().toString().padStart(2, '0');
  });
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(() => {
    const now = new Date();
    return now.getHours() < 12 ? 'AM' : 'PM';
  });

  React.useEffect(() => {
    fetchAvailableStaff();
    fetchRecentCustomers();
  }, []);

  React.useEffect(() => {
    if (selectedHour !== '' && selectedMinute !== '') {
      const date = new Date();
      const [year, month, day] = selectedDate.split('-').map(Number);
      date.setFullYear(year);
      date.setMonth(month - 1);
      date.setDate(day);
      date.setHours(parseInt(selectedHour), parseInt(selectedMinute), 0, 0);
      
      setSelectedTime(date);
      setFormData(prev => ({ ...prev, scheduledAt: date.toISOString().slice(0, 16) }));
    }
  }, [selectedHour, selectedMinute, selectedDate]);

  const hours = React.useMemo(() => {
    const result = [];
    for (let i = 0; i <= 23; i++) {
      result.push({
        value: i.toString(),
        label: i === 0 || i === 12 ? '12' : (i % 12).toString(),
        period: i < 12 ? 'AM' : 'PM'
      });
    }
    return result;
  }, []);

  const fetchAvailableStaff = async () => {
    try {
      const startTime = new Date(formData.scheduledAt);
      const endTime = new Date(startTime.getTime() + 3 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('staff')
        .select('id, name, role, active')
        .eq('active', true)
        .not('role', 'eq', 'admin')
        .order('name');

      if (error) throw error;
      
      const staffWithAvailability = await Promise.all((data || []).map(async (staff) => {
        const { data: isAvailable } = await supabase
          .rpc('check_staff_availability', {
            p_staff_id: staff.id,
            p_date: startTime.toISOString().split('T')[0],
            p_start_time: startTime.toISOString().split('T')[1].slice(0, 8),
            p_end_time: endTime.toISOString().split('T')[1].slice(0, 8)
          });

        return {
          ...staff,
          available: isAvailable,
          availableUntil: isAvailable ? endTime.toISOString() : undefined
        };
      }));

      setAvailableStaff(staffWithAvailability);

      if (call?.staff_id) {
        const assignedStaff = data?.find(s => s.id === call.staff_id);
        if (!assignedStaff) {
          const { data: currentStaff } = await supabase
            .from('staff')
            .select('id, name, role')
            .eq('id', call.staff_id)
            .single();
          
          if (currentStaff) {
            setAvailableStaff(prev => [...prev, currentStaff]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching available staff:', error);
    }
  };

  const fetchRecentCustomers = async () => {
    try {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .order('last_purchase_date', { ascending: false })
        .limit(3);

      if (data) {
        setRecentCustomers(data);
      }
    } catch (error) {
      console.error('Error fetching recent customers:', error);
    }
  };

  const selectedCustomer = customers.find(c => c.id === formData.customerId);

  const filteredCustomers = React.useMemo(() => {
    if (!customerSearch) return customers;
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
      (customer.phone && searchPhoneNumber(customer.phone, customerSearch))
    );
  }, [customers, customerSearch]);
  const [settings, setSettings] = useState<any>(null);
  const { addToast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: settingsData, error: settingsError } = await supabase
        .from('company_settings')
        .select('video_call_settings')
        .single();

      if (settingsError) throw settingsError;
      setSettings(settingsData.video_call_settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      addToast({
        title: 'Error',
        message: 'Failed to load video call settings',
        type: 'error'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const scheduledTime = selectedTime;

    try {
      if (!formData.staffId) {
        throw new Error('Please select a staff member');
      }

      if (!scheduledTime) {
        throw new Error('Please select a valid date and time');
      }

      if (!formData.customerId) {
        throw new Error('Please select a customer');
      }

      // Get selected staff
      const selectedStaff = availableStaff.find(s => s.id === formData.staffId);
      if (!selectedStaff) {
        throw new Error('Selected staff member not found');
      }

      const assignedStaff = {
        primary: selectedStaff.id,
        staff_name: selectedStaff.name,
        staff_role: selectedStaff.role,
        backup: null,
        history: [{
          staff_id: selectedStaff.id,
          name: selectedStaff.name,
          role: selectedStaff.role,
          assigned_at: scheduledTime.toISOString(),
          assigned_by: 'system'
        }]
      };

      // Prepare submission data
      const submissionData = {
        ...formData,
        scheduledAt: scheduledTime.toISOString(),
        staff_id: selectedStaff.id,
        assigned_staff: assignedStaff,
        customer_time_zone: selectedCustomer?.timezone || getLocalTimeZone(),
        customer_country: selectedCustomer?.country_code || 'IN'
      };

      await onSubmit({
        ...submissionData
      });

      addToast({
        title: 'Success',
        message: call ? 'Video call updated successfully' : 'Video call scheduled successfully',
        type: 'success'
      });

    } catch (error: any) {
      console.error('Error submitting form:', error);
      addToast({
        title: 'Error',
        message: error.message || 'Failed to schedule video call. Please try again.',
        type: 'error'
      });
      setError(error.message || 'Failed to schedule video call. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewCustomer = async (customerData: any) => {
    try {
      if (!customerData.name?.trim() || !customerData.phone?.trim()) {
        setError('Customer name and phone are required');
        return;
      }

      if (!/^\d{10}$/.test(customerData.phone.trim())) {
        setError('Please enter a valid 10-digit phone number');
        return;
      }

      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert([{
          name: customerData.name.trim(),
          phone: customerData.phone.trim(),
          type: customerData.type,
          email: null,
          preferences: {
            categories: [],
            priceRange: { min: 0, max: 100000 },
            preferredContact: 'phone',
            profiled: false
          },
          total_purchases: 0
        }])
        .select()
        .single();

      if (error) throw error;

      customers.push(newCustomer);
      setFormData(prev => ({ ...prev, customerId: newCustomer.id }));
      setShowNewCustomerForm(false);
    } catch (error: any) {
      console.error('Error adding new customer:', error);
      if (error.code === '23505') {
        setError('A customer with this phone number already exists.');
      } else {
        setError('Failed to add new customer. Please try again.');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto relative">
        <div className="flex justify-between items-center p-6 border-b bg-gradient-to-r from-gray-50/80 to-gray-100/80 backdrop-blur">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Video className="h-5 w-5 text-blue-600" />
            {call ? 'Reschedule Video Call' : 'Schedule New Call'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-2 rounded-md text-sm">
              {error}
            </div>
          )}

          {!call && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700">
                  Customer <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewCustomerForm(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add New Customer
                </button>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search by name or phone..."
                    className="input w-full"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerSearch(true);
                    }}
                    onFocus={() => setShowCustomerSearch(true)}
                  />
                  {showCustomerSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg max-h-96 overflow-auto">
                      {!customerSearch && recentCustomers.length > 0 && (
                        <>
                          <div className="px-2 py-1 text-xs font-medium text-gray-500">Recent Customers</div>
                          {recentCustomers.map(customer => (
                            <CustomerCard
                              key={customer.id}
                              customer={customer}
                              onSelect={() => {
                                setFormData(prev => ({ ...prev, customerId: customer.id }));
                                setCustomerSearch(customer.name);
                                setShowCustomerSearch(false);
                              }}
                            />
                          ))}
                          <div className="border-t my-2" />
                        </>
                      )}
                      <div className="space-y-1">
                        {filteredCustomers.map(customer => (
                          <CustomerCard
                            key={customer.id}
                            customer={customer}
                            onSelect={() => {
                              setFormData(prev => ({ ...prev, customerId: customer.id }));
                              setCustomerSearch(customer.name);
                              setShowCustomerSearch(false);
                            }}
                          />
                        ))}
                        {filteredCustomers.length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500 text-center">
                            No customers found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assign Staff <span className="text-red-500">*</span>
              <span className="text-xs text-gray-500 ml-2">(Select available staff member)</span>
            </label>
            <select
              value={formData.staffId}
              onChange={(e) => {
                setFormData(prev => ({
                  ...prev,
                  staffId: e.target.value
                }));
              }}
              className="input"
              required
              disabled={loading}
            >
              <option value="">Select Staff Member</option>
              {availableStaff
                .sort((a, b) => a.role.localeCompare(b.role))
                .filter(member => member.active && member.available)
                .map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.role})
                    {call?.staff_id === member.id ? ' (Currently Assigned)' : ''}
                    {member.availableUntil ? ` (Available until ${format(new Date(member.availableUntil), 'h:mm a')})` : ''}
                  </option>
                ))}
            </select>
            {formData.staffId && (
              <p className="text-xs text-gray-500 mt-1">
                Selected staff member will be notified and assigned to this video call (15 min - 3 hours duration)
              </p>
            )}
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Schedule Time <span className="text-red-500">*</span>
              <span className="text-xs text-gray-500 ml-2">(Local timezone)</span>
            </label>
            
            <div className="space-y-1">
              <label className="block text-sm text-gray-600">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                min={selectedDate}
                max={new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedTime(null);
                }}
                className="input w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-gray-600">Select Time</label>
              <div className="flex gap-2">
                <select
                  value={selectedHour}
                  onChange={(e) => {
                    setSelectedHour(e.target.value);
                    const hour = parseInt(e.target.value);
                    setSelectedPeriod(hour < 12 ? 'AM' : 'PM');
                  }}
                  className="input flex-1"
                >
                  <option value="">Hour</option>
                  {hours.map(hour => (
                    <option key={hour.value} value={hour.value}>
                      {hour.label}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedMinute}
                  onChange={(e) => setSelectedMinute(e.target.value)}
                  className="input w-24"
                >
                  <option value="">Minute</option>
                  {[...Array(60)].map((_, i) => (
                    <option key={i} value={i.toString().padStart(2, '0')}>
                      {i.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
                <div className="input w-20 flex items-center justify-center font-medium">
                  {selectedPeriod}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              <span>Your timezone: {formData.timeZone}</span>
              {selectedCustomer?.timezone && (
                <>
                  <span className="mx-2">•</span>
                  <Globe className="h-4 w-4" />
                  <span>Customer timezone: {selectedCustomer.timezone}</span>
                </>
              )}
            </div>
            
            {selectedHour && selectedMinute && (
              <div className="bg-blue-50 p-3 rounded-lg mt-2">
                <div className="font-medium">Selected Schedule:</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-sm">
                    Your time: {format(new Date(selectedDate + 'T' + selectedHour.padStart(2, '0') + ':' + selectedMinute), 'PPp')}
                  </div>
                  {selectedCustomer?.timezone && (
                    <div className="text-sm text-blue-600 flex items-center gap-1">
                      {selectedCustomer.country_code && (
                        <span className="inline-block h-3 w-4">
                          {React.createElement(
                            getCountryByCode(selectedCustomer.country_code)?.flag || 'span'
                          )}
                        </span>
                      )}
                      Customer's time: {formatInTimeZone(
                        new Date(selectedDate + 'T' + selectedHour.padStart(2, '0') + ':' + selectedMinute),
                        selectedCustomer.timezone,
                        'PPp'
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="input"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary flex items-center gap-2"
              disabled={loading}
            >
              {loading ? 'Saving...' : (call ? 'Update Call' : 'Schedule Call')}
            </button>
          </div>
        </form>

        {showNewCustomerForm && (
          <QuickCustomerForm
            onClose={() => setShowNewCustomerForm(false)}
            onSubmit={handleAddNewCustomer}
          />
        )}
      </div>
    </div>
  );
};

const CustomerCard = ({ customer, onSelect }: { customer: Customer; onSelect: () => void }) => (
  <button
    className="w-full text-left p-3 hover:bg-gray-50 rounded-lg flex items-center gap-3 group"
    onClick={onSelect}
  >
    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
      <span className="text-blue-600 font-semibold">
        {customer.name[0].toUpperCase()}
      </span>
    </div>
    <div>
      <div className="font-medium">{customer.name}</div>
      <div className="text-sm text-gray-500 flex items-center gap-2">
        {React.createElement(
          getCountryByCode(customer.country_code || 'IN')?.flag || 'span',
          { className: 'h-3 w-3' }
        )}
        <span className="font-mono">
          {formatPhoneNumber(customer.phone)}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-xs ${
          customer.type === 'wholesaler'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-green-100 text-green-800'
        }`}>
          {customer.type}
        </span>
      </div>
    </div>
    <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
      <div className="text-xs text-gray-500">
        {customer.city && customer.state && `${customer.city}, ${customer.state}`}
      </div>
    </div>
  </button>
);

export default VideoCallForm;
