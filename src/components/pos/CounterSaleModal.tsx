import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/quotation';
import { getCountryByCode } from '../../utils/countryUtils';

interface CounterSaleModalProps {
  counterSaleDetails: {
    // Basic customer information
    buyerName: string;
    buyerPhone: string;
    // Delivery and payment details
    deliveryMethod: string;
    paymentStatus: string;
    paidAmount: number;
    // Optional additional information
    buyerCategory?: string[];
    paymentMethod?: string;
    buyerEmail?: string;
  };
  setCounterSaleDetails: (details: any) => void;
  customerType: 'wholesaler' | 'retailer';
  total: number;
  onClose: () => void;
  onSubmit: () => void;
}

// Import required icons
import { X, Building2, Phone, Mail, Globe, FileText, BanIcon as BankIcon } from 'lucide-react';

// Import utility constants
import { PAYMENT_METHODS, PAYMENT_STATUS, DELIVERY_METHODS } from '../../utils/constants';

// Product categories based on billing type
const PRODUCT_CATEGORIES = [
  "Fancy Category",
  "Korean Category",
  "Medium Category"
];

const CounterSaleModal: React.FC<CounterSaleModalProps> = ({
  counterSaleDetails,
  setCounterSaleDetails,
  customerType,
  total,
  onClose,
  onSubmit
}) => {
  const [error, setError] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState('IN');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    counterSaleDetails.buyerCategory || []
  );

  useEffect(() => {
    // Update the main state when selected categories change
    setCounterSaleDetails(prev => ({
      ...prev,
      buyerCategory: selectedCategories
    }));
  }, [selectedCategories, setCounterSaleDetails]);

  // If phone number is provided in counterSaleDetails, extract it to state
  useEffect(() => {
    if (counterSaleDetails.buyerPhone && phoneNumber === '') {
      const match = counterSaleDetails.buyerPhone.match(/\+(\d+)(\d+)/);
      if (match && match.length >= 3) {
        // Find country code
        const code = match[1];
        const number = match[2];
        // Map country code to country
        const countryMap: {[key: string]: string} = {
          '91': 'IN',
          '1': 'US',
          '44': 'GB',
          '971': 'AE',
          '65': 'SG'
        };
        
        if (countryMap[code]) {
          setCountryCode(countryMap[code]);
        }
        
        setPhoneNumber(number);
      }
    }
  }, [counterSaleDetails.buyerPhone, phoneNumber]);

  const getCountryCode = (code: string) => {
    const codes: { [key: string]: string } = {
      'IN': '91',
      'US': '1',
      'GB': '44',
      'AE': '971',
      'SG': '65'
    };
    return codes[code] || '91';
  };

  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(prev => prev.filter(cat => cat !== category));
    } else {
      setSelectedCategories(prev => [...prev, category]);
    }
  };

  const handleSubmit = () => {
    // Validate required fields
    if (!counterSaleDetails.buyerName.trim()) {
      setError('Please enter buyer name');
      return;
    }

    if (!phoneNumber.trim()) {
      setError('Please enter phone number');
      return;
    }

    // Validate phone number length
    const minLength = countryCode === 'IN' ? 10 : 8;
    const maxLength = countryCode === 'IN' ? 10 : 12;
    if (phoneNumber.length < minLength || phoneNumber.length > maxLength) {
      setError(`Phone number must be ${countryCode === 'IN' ? '10' : '8-12'} digits`);
      return;
    }

    // For wholesalers, validate category selection
    if (customerType === 'wholesaler' && selectedCategories.length === 0) {
      setError('Please select at least one product category');
      return;
    }

    // For wholesalers with partial payment, validate payment amount
    if (customerType === 'wholesaler' && 
        counterSaleDetails.paymentStatus === PAYMENT_STATUS.PARTIALLY_PAID && 
        (counterSaleDetails.paidAmount <= 0 || counterSaleDetails.paidAmount >= total)) {
      setError('For partial payment, please enter an amount greater than 0 and less than the total');
      return;
    }

    // Validate payment method selection
    if (counterSaleDetails.paymentStatus === PAYMENT_STATUS.PAID && !counterSaleDetails.paymentMethod) {
      setError('Please select a payment method');
      return;
    }

    // Format phone number with country code
    const formattedPhone = `+${getCountryCode(countryCode)}${phoneNumber}`;
    setCounterSaleDetails(prev => ({
      ...prev,
      buyerPhone: formattedPhone
    }));

    onSubmit();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-black w-full max-w-5xl mx-4 text-white p-6 rounded-lg max-h-[90vh] overflow-hidden flex flex-col">
        <h2 className="text-lg font-semibold text-blue-400 mb-2">
          {customerType === 'wholesaler' ? 'Wholesale Counter Sale' : 'Retail Counter Sale'}
        </h2>
        <div className="text-sm text-gray-400 mb-6">
          Total Amount: {formatCurrency(total)}
        </div>

        {error && (
          <div className="bg-red-900/50 text-red-200 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}
          
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Basic Information */}
            <div className="space-y-4">
              {/* Basic Information */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Buyer Name *
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-transparent border border-gray-700 rounded p-2 text-white placeholder-gray-500"
                  value={counterSaleDetails.buyerName}
                  onChange={(e) => setCounterSaleDetails(prev => ({ ...prev, buyerName: e.target.value }))}
                  placeholder="Customer name"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Phone Number *
                </label>
                <div className="flex gap-2">
                  <select
                    className="w-24 bg-transparent border border-gray-700 rounded p-2 text-white"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                  >
                    <option value="IN">+91</option>
                    <option value="US">+1</option>
                    <option value="GB">+44</option>
                    <option value="AE">+971</option>
                    <option value="SG">+65</option>
                  </select>
                  <input
                    type="tel"
                    className="flex-1 bg-transparent border border-gray-700 rounded p-2 text-white placeholder-gray-500"
                    value={phoneNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      const maxLength = countryCode === 'IN' ? 10 : 12;
                      setPhoneNumber(value.slice(0, maxLength));
                    }}
                    placeholder="Enter 10 digits"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter {countryCode === 'IN' ? '10' : '8-12'} digits
                </p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  className="w-full bg-transparent border border-gray-700 rounded p-2 text-white placeholder-gray-500"
                  value={counterSaleDetails.buyerEmail || ''}
                  onChange={(e) => setCounterSaleDetails(prev => ({
                    ...prev,
                    buyerEmail: e.target.value
                  }))}
                  placeholder="For digital receipt (optional)"
                />
              </div>

              {/* Country */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Country
                </label>
                <div className="flex items-center gap-2 text-gray-300">
                  {React.createElement(
                    getCountryByCode(countryCode)?.flag || 'span',
                    { className: 'h-4 w-4' }
                  )}
                  <span className="text-sm">
                    {getCountryByCode(countryCode)?.name || 'Unknown Country'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column - Categories and Payment */}
            <div className="space-y-4">
              {/* Product Categories for Wholesalers */}
              {customerType === 'wholesaler' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Product Categories * <span className="text-xs text-gray-500">(Select all that apply)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRODUCT_CATEGORIES.map(category => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className={`px-3 py-2 text-sm rounded border ${
                          selectedCategories.includes(category)
                            ? 'bg-blue-900/50 border-blue-500 text-blue-200'
                            : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                  {selectedCategories.length === 0 && (
                    <p className="text-xs text-red-400 mt-1">
                      Please select at least one category
                    </p>
                  )}
                </div>
              )}

              {/* Delivery Method */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Delivery Method
                </label>
                <select
                  className="w-full bg-transparent border border-gray-700 rounded p-2 text-white"
                  value={counterSaleDetails.deliveryMethod}
                  onChange={(e) => setCounterSaleDetails(prev => ({
                    ...prev,
                    deliveryMethod: e.target.value
                  }))}
                >
                  <option value="hand_carry">Hand Carry</option>
                  <option value="dispatch">Dispatch</option>
                </select>
              </div>

              {/* Payment Status */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Payment Status
                </label>
                {customerType === 'wholesaler' ? (
                  <select
                    className="w-full bg-transparent border border-gray-700 rounded p-2 text-white"
                    value={counterSaleDetails.paymentStatus}
                    onChange={(e) => setCounterSaleDetails(prev => ({
                      ...prev,
                      paymentStatus: e.target.value,
                      paidAmount: e.target.value === PAYMENT_STATUS.PAID ? total : prev.paidAmount
                    }))}
                  >
                    <option value={PAYMENT_STATUS.PAID}>Full Payment</option>
                    <option value={PAYMENT_STATUS.PARTIALLY_PAID}>Partial Payment</option>
                    <option value={PAYMENT_STATUS.UNPAID}>No Payment (Credit)</option>
                  </select>
                ) : (
                  <div className="bg-gray-900/50 p-2 rounded text-gray-300">
                    <p>Full payment required for retail counter sales</p>
                    <p className="text-sm text-gray-400 mt-1">Amount: {formatCurrency(total)}</p>
                    <p className="text-sm text-green-400 mt-1">Payment will be marked as completed</p>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              {(customerType === 'retailer' || 
                counterSaleDetails.paymentStatus === PAYMENT_STATUS.PAID || 
                counterSaleDetails.paymentStatus === PAYMENT_STATUS.PARTIALLY_PAID) && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Payment Method *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(PAYMENT_METHODS).map(([key, value]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCounterSaleDetails(prev => ({
                          ...prev,
                          paymentMethod: value
                        }))}
                        className={`px-3 py-2 text-sm rounded border ${
                          counterSaleDetails.paymentMethod === value
                            ? 'bg-blue-900/50 border-blue-500 text-blue-200'
                            : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        {key.charAt(0) + key.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Partial Payment Amount */}
              {counterSaleDetails.paymentStatus === PAYMENT_STATUS.PARTIALLY_PAID && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Advance Payment Amount
                  </label>
                  <input
                    type="number"
                    className="w-full bg-transparent border border-gray-700 rounded p-2 text-white"
                    value={counterSaleDetails.paidAmount}
                    onChange={(e) => setCounterSaleDetails(prev => ({
                      ...prev,
                      paidAmount: Math.min(Number(e.target.value), total)
                    }))}
                    min="0"
                    max={total}
                    step="0.01"
                  />
                  <div className="mt-2 space-y-1">
                    {counterSaleDetails.paidAmount > 0 && (
                      <p className="text-sm text-green-400">
                        Advance Paid: {formatCurrency(counterSaleDetails.paidAmount)}
                      </p>
                    )}
                    <p className={`text-sm ${counterSaleDetails.paidAmount > 0 ? 'text-orange-400' : 'text-gray-400'}`}>
                      Remaining: {formatCurrency(total - counterSaleDetails.paidAmount)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-700 rounded text-gray-300 hover:bg-gray-800"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            type="button"
          >
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  );
};

export default CounterSaleModal;