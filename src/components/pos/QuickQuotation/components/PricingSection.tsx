import React from 'react';
import type { QuotationItem } from '../../../../types';
import { formatCurrency } from '../../../../utils/quotation';

interface PricingSectionProps {
  isAdvancedDiscountEnabled: boolean;
  showSecretInput: boolean;
  secretCode: string;
  setSecretCode: (code: string) => void;
  setShowSecretInput: (show: boolean) => void;
  setIsAdvancedDiscountEnabled: (enabled: boolean) => void;
  discount: number;
  maxDiscount: number;
  discountPresets: number[];
  handleDiscountChange: (value: number) => void;
  totals: {
    subtotal: number;
    discountAmount: number;
    total: number;
    gstAmount: number;
    finalTotal: number;
  };
  items: QuotationItem[];
  handleCompleteSale: () => void;
  handlePrint: () => void;
}

const PricingSection: React.FC<PricingSectionProps> = ({
  isAdvancedDiscountEnabled,
  showSecretInput,
  secretCode,
  setSecretCode,
  setShowSecretInput,
  setIsAdvancedDiscountEnabled,
  discount,
  maxDiscount,
  discountPresets,
  handleDiscountChange,
  totals,
  items,
  handleCompleteSale,
  handlePrint
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Discount Calculator */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Quick Calculator</h3>
          {!isAdvancedDiscountEnabled && (
            <button
              onClick={() => setShowSecretInput(true)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Enable Advanced
            </button>
          )}
        </div>

        {showSecretInput && (
          <div className="flex gap-2">
            <input
              type="password"
              value={secretCode}
              onChange={(e) => setSecretCode(e.target.value)}
              placeholder="Enter secret code"
              className="input flex-1"
              autoComplete="off"
            />
            <button
              onClick={() => {
                if (secretCode === 'SECRET') {
                  setIsAdvancedDiscountEnabled(true);
                  setShowSecretInput(false);
                  setSecretCode('');
                } else {
                  alert('Invalid code');
                }
              }}
              className="btn btn-primary"
            >
              Submit
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max={maxDiscount}
            value={discount}
            onChange={(e) => handleDiscountChange(Number(e.target.value))}
            className="input w-20"
          />
          <span className="text-gray-600">% Discount</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {discountPresets.map(percent => (
            <button
              key={percent}
              onClick={() => handleDiscountChange(percent)}
              className={`px-3 py-2 rounded text-sm ${
                discount === percent
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {percent}%
            </button>
          ))}
        </div>
      </div>

      {/* Order Summary */}
      <div className="space-y-4">
        <h3 className="font-medium">Order Summary</h3>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal:</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          
          {discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount ({discount}%):</span>
              <span>-{formatCurrency(totals.discountAmount)}</span>
            </div>
          )}
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">GST (18%):</span>
            <span>{formatCurrency(totals.gstAmount)}</span>
          </div>

          <div className="flex justify-between font-bold text-lg pt-2 border-t">
            <span>Total:</span>
            <span>{formatCurrency(totals.finalTotal)}</span>
          </div>
        </div>

        <div className="space-y-2 pt-4">
          <button
            onClick={handleCompleteSale}
            disabled={items.length === 0}
            className="w-full btn btn-primary"
          >
            Complete Sale
          </button>
          
          <button
            onClick={handlePrint}
            disabled={items.length === 0}
            className="w-full btn btn-secondary"
          >
            Print Quotation
          </button>
        </div>
      </div>
    </div>
  );
};

export default PricingSection;
