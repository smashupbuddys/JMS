import React, { useState } from 'react';
import { X, Globe, User, Phone, Mail, Building2, MapPin, FileText, ClipboardCheck, AlertCircle, UserCheck } from 'lucide-react';
import type { Customer } from '../../types';
import { supabase } from '../../lib/supabase';
import { COUNTRIES, getCountryByCode } from '../../utils/countryUtils';

interface CustomerFormProps {
  customer?: Customer;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const CustomerForm: React.FC<CustomerFormProps> = ({ customer, onClose, onSubmit }) => {
  const [formData, setFormData] = React.useState({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    country_code: customer?.country_code || 'IN',
    type: customer?.type || 'retailer',
    address: customer?.address || '',
    city: customer?.city || '',
    state: customer?.state || '',
    pincode: customer?.pincode || '',
    gst_number: customer?.gst_number || '',
    pan_number: customer?.pan_number || '',
    preferences: customer?.preferences || {
      categories: [],
      priceRange: { min: 0, max: 100000 },
      preferredContact: 'phone',
      profiled: false,
      deviceId: '',
      lastProfilingAttempt: null
    },
    notes: customer?.notes || ''
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [displayPhone, setDisplayPhone] = useState(formData.phone);

  const validateForm = () => {
    setError(null);
    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return false;
    }
    if (!/^\d{10}$/.test(formData.phone)) {
      setError('Please enter a valid 10-digit phone number');
      return false;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if phone number already exists
      const { data: existingPhone } = await supabase
        .from('customers')
        .select('id, phone')
        .eq('phone', formData.phone)
        .maybeSingle();

      if (existingPhone && (!customer || existingPhone.id !== customer.id)) {
        setError(`Phone number ${existingPhone.phone} is already registered`);
        setLoading(false);
        return;
      }

      // If email is provided, check if it already exists
      if (formData.email) {
        const { data: existingEmail } = await supabase
          .from('customers')
          .select('id, email')
          .eq('email', formData.email)
          .maybeSingle();

        if (existingEmail && (!customer || existingEmail.id !== customer.id)) {
          setError(`Email ${existingEmail.email} is already registered`);
          setLoading(false);
          return;
        }
      }

      // Prepare submission data
      const submittedData = {
        ...formData,
        email: formData.email || null,
        phone: formData.phone,
        updated_at: new Date().toISOString()
      };

      await onSubmit(submittedData);
      onClose();
    } catch (error: any) {
      console.error('Error submitting form:', error);
      if (error.code === '23505') {
        if (error.message.includes('customers_email_key')) {
          setError('This email address is already in use.');
        } else if (error.message.includes('customers_phone_key')) {
          setError('This phone number is already in use.');
        } else {
          setError('A unique constraint was violated. Please check your input.');
        }
      } else {
        setError(error.message || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null); // Clear error when user makes changes
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl w-full max-w-5xl shadow-xl border border-gray-100">
        <div className="flex justify-between items-center p-6 border-b relative">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-50 to-gray-100 opacity-50 rounded-t-2xl -z-10" />
          <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            {customer ? 'Edit Customer' : 'Add New Customer'}
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Basic Information */}
            <div className="space-y-4">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 space-y-4 shadow-sm">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-500" />
                  Basic Information
                </h3>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <User className="h-4 w-4 text-gray-400" />
                    Full Name
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="input pl-10 bg-white/80"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter customer's full name"
                  />
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Globe className="h-4 w-4 text-gray-400" />
                    Country
                  </label>
                  <div className="flex gap-2 items-center">
                    <select
                      name="country_code"
                      className="input flex-1 bg-white/80"
                      value={formData.country_code}
                      onChange={(e) => {
                        const newCountryCode = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          country_code: newCountryCode
                        }));
                        setDisplayPhone('');
                      }}
                    >
                      {COUNTRIES.map(country => (
                        <option key={country.code} value={country.code}>
                          {country.name} ({country.phoneCode})
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center">
                      {React.createElement(
                        getCountryByCode(formData.country_code)?.flag || 'span',
                        { className: 'h-5 w-8' }
                      )}
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Phone className="h-4 w-4 text-gray-400" />
                    Phone Number
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {React.createElement(
                        COUNTRIES.find(c => c.code === formData.country_code)?.flag || 'span',
                        { className: 'h-4 w-4' }
                      )}
                    </div>
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 select-none">
                      {COUNTRIES.find(c => c.code === formData.country_code)?.phoneCode}
                    </div>
                    <input
                      type="tel"
                      name="phone"
                      required
                      className="input pl-16"
                      value={displayPhone} 
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        const maxLength = formData.country_code === 'IN' ? 10 : 12;
                        setDisplayPhone(value.slice(0, maxLength));
                        setFormData(prev => ({ ...prev, phone: value.slice(0, maxLength) }));
                      }}
                      placeholder={`Enter ${formData.country_code === 'IN' ? '10' : '8-12'} digits`}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <ClipboardCheck className="h-3 w-3" />
                    Enter full phone number with country code (e.g., +91XXXXXXXXXX)
                  </p>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Mail className="h-4 w-4 text-gray-400" />
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="input pl-10 bg-white/80"
                    placeholder="Enter email address (optional)"
                  />
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    Customer Type
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="type"
                    required
                    className="input bg-white/80"
                    value={formData.type}
                    onChange={handleChange}
                  >
                    <option value="retailer">Retail Customer</option>
                    <option value="wholesaler">Wholesaler</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right Column - Additional Information */}
            <div className="space-y-4">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 space-y-4 shadow-sm">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-500" />
                  Address & Business Details
                </h3>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    Address
                  </label>
                  <textarea
                    name="address"
                    rows={3}
                    className="input bg-white/80"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Enter customer's address"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      className="input bg-white/80"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="Enter city"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      name="state"
                      className="input bg-white/80"
                      value={formData.state}
                      onChange={handleChange}
                      placeholder="Enter state"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PIN Code
                    </label>
                    <input
                      type="text"
                      name="pincode"
                      className="input bg-white/80"
                      value={formData.pincode}
                      onChange={handleChange}
                      placeholder="Enter PIN code"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GST Number
                    </label>
                    <input
                      type="text"
                      name="gst_number"
                      className="input bg-white/80"
                      value={formData.gst_number}
                      onChange={handleChange}
                      placeholder="Enter GST number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PAN Number
                    </label>
                    <input
                      type="text"
                      name="pan_number"
                      className="input bg-white/80"
                      value={formData.pan_number}
                      onChange={handleChange}
                      placeholder="Enter PAN number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      name="notes"
                      rows={3}
                      className="input bg-white/80"
                      value={formData.notes}
                      onChange={handleChange}
                      placeholder="Add any additional notes..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-6 mt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary text-sm px-6"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary text-sm px-6 bg-gradient-to-r from-blue-600 to-blue-700"
              disabled={loading}
            >
              {loading ? 'Adding...' : (customer ? 'Update Customer' : 'Add Customer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerForm;
