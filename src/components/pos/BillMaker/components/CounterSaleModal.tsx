import React, { useState } from 'react';
import { formatCurrency } from '../../../../utils/quotation';
import { getCountryByCode } from '../../../../utils/countryUtils';

interface CounterSaleModalProps {
  counterSaleDetails: {
    buyerName: string;
    buyerPhone: string;
    deliveryMethod: string;
    paymentStatus: string;
    paidAmount: number;
  };
  setCounterSaleDetails: (details: any) => void;
  customerType: 'wholesaler' | 'retailer';
  total: number;
  onClose: () => void;
  onSubmit: () => void;
}

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
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl w-full max-w-md mx-4 shadow-xl border border-gray-100">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            {customerType === 'wholesaler' ? 'Wholesale Counter Sale' : 'Retail Counter Sale'}
          </h2>
          <div className="text-sm text-gray-500 mb-6">
            Total Amount: {formatCurrency(total)}
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buyer Name *
              </label>
              <input
                type="text"
                className="input"
                value={counterSaleDetails.buyerName}
                onChange={(e) => setCounterSaleDetails(prev => ({
                  ...prev,
                  buyerName: e.target.value
                }))}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <div className="flex gap-2">
                <select
                  className="input w-24"
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
                  className="input flex-1"
                  value={phoneNumber}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    const maxLength = countryCode === 'IN' ? 10 : 12;
                    setPhoneNumber(value.slice(0, maxLength));
                    setCounterSaleDetails(prev => ({
                      ...prev,
                      buyerPhone: `+${getCountryCode(countryCode)}${value.slice(0, maxLength)}`
                    }));
                  }}
                  placeholder={countryCode === 'IN' ? '98765 43210' : 'Enter phone number'}
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {countryCode === 'IN' ? 'Enter 10 digits' : 'Enter 8-12 digits'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country
              </label>
              <div className="flex items-center gap-2">
                {React.createElement(
                  getCountryByCode(countryCode)?.flag || 'span',
                  { className: 'h-4 w-4' }
                )}
                <span className="text-sm">
                  {getCountryByCode(countryCode)?.name || 'Unknown Country'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Method
              </label>
              <select
                className="input"
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

            {/* Payment section - different for retail and wholesale */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Status
              </label>
              <>
                {customerType === 'wholesaler' ? (
                  <select
                    className="input"
                    value={counterSaleDetails.paymentStatus}
                    onChange={(e) => setCounterSaleDetails(prev => ({
                      ...prev,
                      paymentStatus: e.target.value,
                      paidAmount: e.target.value === 'paid' ? total : prev.paidAmount
                    }))}
                  >
                    <option value="paid">Full Payment</option>
                    <option value="pending">Partial Payment</option>
                  </select>
                ) : (
                  <div className="text-gray-700 bg-gray-50 p-2 rounded">
                    <p>Full payment required for retail counter sales</p>
                    <p className="text-sm text-gray-500 mt-1">Amount: {formatCurrency(total)}</p>
                    <p className="text-sm text-green-600 mt-1">Payment will be marked as completed</p>
                  </div>
                )}
              </>
            </div>

            {counterSaleDetails.paymentStatus === 'pending' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Advance Payment Amount
                </label>
                <input
                  type="number"
                  className="input"
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
                    <p className="text-sm text-green-600">
                      Advance Paid: {formatCurrency(counterSaleDetails.paidAmount)}
                    </p>
                  )}
                  <p className={`text-sm ${counterSaleDetails.paidAmount > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                    Remaining: {formatCurrency(total - counterSaleDetails.paidAmount)}
                  </p>
                  {counterSaleDetails.paidAmount <= 0 && (
                    <p className="text-sm text-red-500">
                      Please enter advance payment amount
                    </p>
                  )}
                  {counterSaleDetails.paidAmount > 0 && counterSaleDetails.paidAmount < total && (
                    <p className="text-sm text-blue-600">
                      Payment will be marked as pending
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="btn btn-primary bg-gradient-to-r from-blue-600 to-blue-700"
            >
              Complete Sale
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CounterSaleModal;