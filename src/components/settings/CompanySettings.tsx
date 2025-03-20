import React, { useState } from 'react';
import { Save, Building, Mail, Phone, MapPin, Globe, FileText, BanIcon as BankIcon, Video, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CompanySettings {
  name: string;
  legal_name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  website: string;
  gst_number: string;
  pan_number: string;
  bank_details: {
    bank_name: string;
    account_name: string;
    account_number: string;
    ifsc_code: string;
    branch: string;
  };
  bill_retention_days: number;
  video_call_settings: {
    allow_retail: boolean;
    allow_wholesale: boolean;
    retail_notice_hours: number;
    wholesale_notice_hours: number;
  };
  logo_url: string;
}

const defaultSettings: CompanySettings = {
  name: 'Jewelry Management System',
  legal_name: 'JMS Pvt Ltd',
  address: '123 Diamond Street',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  phone: '+91 98765 43210',
  email: 'contact@jms.com',
  website: 'www.jms.com',
  gst_number: '27AABCU9603R1ZX',
  pan_number: 'AABCU9603R',
  bank_details: {
    bank_name: 'HDFC Bank',
    account_name: 'JMS Pvt Ltd',
    account_number: '50100123456789',
    ifsc_code: 'HDFC0001234',
    branch: 'Diamond District'
  },
  bill_retention_days: 90,
  video_call_settings: {
    allow_retail: true,
    allow_wholesale: true,
    retail_notice_hours: 24,
    wholesale_notice_hours: 48
  },
  logo_url: ''
};

const CompanySettings = () => {
  const [settings, setSettings] = useState<CompanySettings>(() => {
    const savedSettings = localStorage.getItem('companySettings');
    return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setSettings(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof CompanySettings],
          [child]: value
        }
      }));
    } else {
      setSettings(prev => ({ ...prev, [name]: value }));
    }
    setError(null);
    setSuccess(false);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const { error } = await supabase
        .from('company_settings')
        .upsert({
          settings_key: 1, // Always use key 1 for the single row
          name: settings.name,
          legal_name: settings.legal_name,
          address: settings.address,
          city: settings.city,
          state: settings.state,
          pincode: settings.pincode,
          phone: settings.phone,
          email: settings.email,
          website: settings.website,
          gst_number: settings.gst_number,
          pan_number: settings.pan_number,
          bank_details: settings.bank_details,
          video_call_settings: settings.video_call_settings
        })
        .eq('settings_key', 1);

      if (error) throw error;

      localStorage.setItem('companySettings', JSON.stringify(settings));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error saving company settings:', error);
      setError(error.message || 'An error occurred while saving settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Company Settings
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure your company information and preferences
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="btn btn-primary bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100">
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              Settings saved successfully!
            </div>
          )}

          {/* Company Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Building className="h-5 w-5" />
              Company Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  name="name"
                  className="input"
                  value={settings.name}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Legal Name
                </label>
                <input
                  type="text"
                  name="legal_name"
                  className="input"
                  value={settings.legal_name}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                name="address"
                rows={2}
                className="input"
                value={settings.address}
                onChange={handleChange}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  className="input"
                  value={settings.city}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  className="input"
                  value={settings.state}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PIN Code
                </label>
                <input
                  type="text"
                  name="pincode"
                  className="input"
                  value={settings.pincode}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4 pt-6 border-t">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Contact Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  className="input"
                  value={settings.phone}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  className="input"
                  value={settings.email}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  name="website"
                  className="input"
                  value={settings.website}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Tax Information */}
          <div className="space-y-4 pt-6 border-t">
            <h3 className="text-lg font-semibold">Tax Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GST Number
                </label>
                <input
                  type="text"
                  name="gst_number"
                  className="input"
                  value={settings.gst_number}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PAN Number
                </label>
                <input
                  type="text"
                  name="pan_number"
                  className="input"
                  value={settings.pan_number}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Video Call Settings */}
          <div className="space-y-4 pt-6 border-t">
            <h3 className="text-lg font-semibold">Video Call Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-8">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.video_call_settings.allow_retail}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      video_call_settings: {
                        ...prev.video_call_settings,
                        allow_retail: e.target.checked
                      }
                    }))}
                    className="rounded border-gray-300"
                  />
                  <span>Allow Retail Video Calls</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.video_call_settings.allow_wholesale}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      video_call_settings: {
                        ...prev.video_call_settings,
                        allow_wholesale: e.target.checked
                      }
                    }))}
                    className="rounded border-gray-300"
                  />
                  <span>Allow Wholesale Video Calls</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Retail Notice Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.video_call_settings.retail_notice_hours}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      video_call_settings: {
                        ...prev.video_call_settings,
                        retail_notice_hours: parseInt(e.target.value)
                      }
                    }))}
                    className="input"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Minimum hours of notice required for retail video calls
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Wholesale Notice Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.video_call_settings.wholesale_notice_hours}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      video_call_settings: {
                        ...prev.video_call_settings,
                        wholesale_notice_hours: parseInt(e.target.value)
                      }
                    }))}
                    className="input"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Minimum hours of notice required for wholesale video calls
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bill Retention Settings */}
          <div className="space-y-4 pt-6 border-t">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Bill Retention Settings
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bill Retention Period (Days)
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  name="bill_retention_days"
                  className="input w-32"
                  value={settings.bill_retention_days}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    bill_retention_days: Math.max(1, parseInt(e.target.value) || 90)
                  }))}
                  min="1"
                />
                <span className="text-sm text-gray-500">days</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Bills older than this will be automatically deleted if they are completed and paid.
                Default is 90 days.
              </p>
            </div>
          </div>

          {/* Bank Details */}
          <div className="space-y-4 pt-6 border-t">
            <h3 className="text-lg font-semibold">Bank Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  name="bank_details.bank_name"
                  className="input"
                  value={settings.bank_details.bank_name}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  name="bank_details.account_name"
                  className="input"
                  value={settings.bank_details.account_name}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  name="bank_details.account_number"
                  className="input"
                  value={settings.bank_details.account_number}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IFSC Code
                </label>
                <input
                  type="text"
                  name="bank_details.ifsc_code"
                  className="input"
                  value={settings.bank_details.ifsc_code}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch
                </label>
                <input
                  type="text"
                  name="bank_details.branch"
                  className="input"
                  value={settings.bank_details.branch}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanySettings
