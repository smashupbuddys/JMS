import React from 'react';
import { Save, Eye } from 'lucide-react';
import PrintQuotation from '../pos/PrintQuotation';
import { getCompanySettings, getPrintSettings } from '../../utils/settings';

interface PrintSettings {
  showHeader: boolean;
  showFooter: boolean;
  showLogo: boolean;
  headerText: string;
  footerText: string;
  termsText: string;
  additionalNotes: string;
  showPriceBreakdown: boolean;
  showDiscount: boolean;
  discountPercent: number;
}

const defaultSettings: PrintSettings = {
  showHeader: true,
  showFooter: true,
  showLogo: true,
  headerText: 'Jewelry Management System',
  footerText: 'Thank you for your business!\nFor any queries, please contact: +91 1234567890',
  termsText: '1. Quotation valid for 7 days from the date of issue\n2. Prices are subject to change without prior notice\n3. GST will be charged as applicable\n4. Delivery timeline will be confirmed upon order confirmation',
  additionalNotes: '',
  showPriceBreakdown: true,
  showDiscount: false,
  discountPercent: 0
};

// Sample data for preview
const sampleItems = [
  {
    product: {
      id: '1',
      name: 'Diamond Ring 18K Gold',
      description: 'Elegant 18K gold ring with 1 carat diamond',
      sku: 'DR18K-001',
      category: 'Rings',
      manufacturer: 'Cartier',
      wholesalePrice: 1200,
      retailPrice: 2400,
      stockLevel: 5,
      imageUrl: 'https://example.com/ring.jpg',
      buyPrice: 1000,
      qrCode: '',
      code128: '',
      cipher: ''
    },
    quantity: 1,
    price: 2400,
    originalPrice: 1200
  },
  {
    product: {
      id: '2',
      name: 'Pearl Necklace',
      description: 'Freshwater pearl necklace with silver clasp',
      sku: 'PN-002',
      category: 'Necklaces',
      manufacturer: 'Tiffany',
      wholesalePrice: 800,
      retailPrice: 1600,
      stockLevel: 3,
      imageUrl: 'https://example.com/necklace.jpg',
      buyPrice: 600,
      qrCode: '',
      code128: '',
      cipher: ''
    },
    quantity: 1,
    price: 1600,
    originalPrice: 800
  }
];

const PrintSettings = () => {
  const [settings, setSettings] = React.useState<PrintSettings>(() => {
    return getPrintSettings();
  });
  const [showPreview, setShowPreview] = React.useState(false);

  const sampleCustomer = {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1 234 567 8900',
    type: 'retailer' as const,
    address: '123 Main St',
    city: 'New York',
    state: 'NY',
    pincode: '10001',
    gst_number: 'GST123456789',
    preferences: {},
    notes: '',
    total_purchases: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSave = () => {
    localStorage.setItem('printSettings', JSON.stringify(settings));
    alert('Print settings saved successfully!');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Print Settings</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button onClick={handleSave} className="btn btn-primary flex items-center gap-2">
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Panel */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 space-y-6">
            {/* Header Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Header Settings</h3>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="showHeader"
                    checked={settings.showHeader}
                    onChange={handleChange}
                    className="rounded border-gray-300"
                  />
                  <span>Show Header</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="showLogo"
                    checked={settings.showLogo}
                    onChange={handleChange}
                    className="rounded border-gray-300"
                  />
                  <span>Show Logo</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Header Text
                </label>
                <input
                  type="text"
                  name="headerText"
                  value={settings.headerText}
                  onChange={handleChange}
                  className="input"
                />
              </div>
            </div>

            {/* Content Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Content Settings</h3>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="showPriceBreakdown"
                    checked={settings.showPriceBreakdown}
                    onChange={handleChange}
                    className="rounded border-gray-300"
                  />
                  <span>Show Price Breakdown</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="showDiscount"
                    checked={settings.showDiscount}
                    onChange={handleChange}
                    className="rounded border-gray-300"
                  />
                  <span>Enable Discount</span>
                </label>
              </div>

              {settings.showDiscount && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Discount Percentage
                  </label>
                  <input
                    type="number"
                    name="discountPercent"
                    value={settings.discountPercent}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    className="input w-32"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Terms & Conditions
                </label>
                <textarea
                  name="termsText"
                  value={settings.termsText}
                  onChange={handleChange}
                  rows={4}
                  className="input"
                  placeholder="Enter terms and conditions (one per line)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Additional Notes
                </label>
                <textarea
                  name="additionalNotes"
                  value={settings.additionalNotes}
                  onChange={handleChange}
                  rows={3}
                  className="input"
                  placeholder="Enter default additional notes"
                />
              </div>
            </div>

            {/* Footer Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Footer Settings</h3>

              <div>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    name="showFooter"
                    checked={settings.showFooter}
                    onChange={handleChange}
                    className="rounded border-gray-300"
                  />
                  <span>Show Footer</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Footer Text
                </label>
                <textarea
                  name="footerText"
                  value={settings.footerText}
                  onChange={handleChange}
                  rows={2}
                  className="input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview */}
        {showPreview && (
          <div className="bg-white rounded-lg shadow overflow-auto max-h-[calc(100vh-12rem)]">
            <div className="sticky top-0 bg-white border-b p-4">
              <h3 className="font-semibold text-gray-700">Live Preview</h3>
            </div>
            <div className="p-4">
              <PrintQuotation
                items={sampleItems}
                customerType="retailer"
                total={400000}
                customer={sampleCustomer} 
                discount={settings.discountPercent} 
                quotationNumber="Q20250219001" 
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrintSettings;
