import React, { useState } from 'react';
import { X, Globe } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { COUNTRIES, getCountryByCode, formatPhoneForCountry } from '../../utils/countryUtils';

interface QuickCustomerFormProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const QuickCustomerForm: React.FC<QuickCustomerFormProps> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    type: 'retailer',
    country_code: 'IN', // Default to India
    timezone: 'Asia/Kolkata' // Default timezone for India
  });

  const [displayPhone, setDisplayPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Validate phone number based on country
  const validatePhoneNumber = (phone: string, countryCode: string): string | null => {
    if (!phone) {
      return 'Phone number is required';
    }

    // Remove any non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Validate length based on country
    if (countryCode === 'IN') {
      if (cleanPhone.length !== 10) {
        return 'Please enter a valid 10-digit phone number';
      }
      // Validate Indian mobile number format (starts with 6-9)
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        return 'Invalid Indian mobile number format';
      }
    } else {
      // For other countries
      if (cleanPhone.length < 8 || cleanPhone.length > 12) {
        return 'Phone number must be between 8 and 12 digits';
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate name
      if (!formData.name.trim()) {
        throw new Error('Name is required');
      }
      
      // Get country info
      const country = getCountryByCode(formData.country_code);
      if (!country) {
        throw new Error('Invalid country code');
      }
      
      const cleanPhone = displayPhone.replace(/\D/g, '');
      
      // Validate phone number
      const phoneError = validatePhoneNumber(cleanPhone, formData.country_code);
      if (phoneError) {
        throw new Error(phoneError);
      }
      
      // Format phone number with country code
      const formattedPhone = `${country.phoneCode}${cleanPhone}`;
      
      // Create customer with raw phone number - let the database trigger handle formatting
      const customerData = {
        ...formData,
        phone: formattedPhone,
        preferences: {
          categories: [],
          priceRange: { min: 0, max: 100000 },
          preferredContact: 'phone',
          profiled: false
        }
      };

      const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert([customerData])
        .select()
        .single();

      if (createError) {
        if (createError.code === '23505') {
          throw new Error('A customer with this phone number already exists');
        } else {
          throw createError;
        }
      }

      await onSubmit(newCustomer);
      onClose();
    } catch (error: any) {
      console.error('Error submitting form:', error);
      setError(error.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg w-full max-w-md relative">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">Quick Add Customer</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-2 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              className="input"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Customer name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country
            </label>
            <div className="flex gap-2">
              <select
                className="input flex-1"
                value={formData.country_code}
                onChange={(e) => {
                  const newCountryCode = e.target.value;
                  const country = getCountryByCode(newCountryCode);
                  setFormData(prev => ({
                    ...prev,
                    country_code: newCountryCode,
                    timezone: country?.timezone || prev.timezone
                  }));
                  // Clear the phone number when changing country
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
                <Globe className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
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
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {React.createElement(
                  COUNTRIES.find(c => c.code === formData.country_code)?.flag || 'span',
                  { className: 'h-4 w-4' }
                )}
              </div>
              <input
                type="tel"
                required
                className="input pl-16 pr-10"
                value={displayPhone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  const maxLength = formData.country_code === 'IN' ? 10 : 12;
                  const trimmedValue = value.slice(0, maxLength);
                  setDisplayPhone(trimmedValue);
                  setError(validatePhoneNumber(trimmedValue, formData.country_code));
                }}
                placeholder={formData.country_code === 'IN' ? '9876543210' : 'Enter phone number'}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formData.country_code === 'IN' 
                ? 'Enter 10-digit mobile number starting with 6-9'
                : 'Enter 8-12 digit phone number without country code'
              }
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Type
            </label>
            <select
              className="input"
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
            >
              <option value="retailer">Retailer</option>
              <option value="wholesaler">Wholesaler</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary text-sm"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickCustomerForm;
