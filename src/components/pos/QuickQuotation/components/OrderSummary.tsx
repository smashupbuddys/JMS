import React from 'react';
import { Calculator } from 'lucide-react';
import { formatCurrency } from '../../../../utils/quotation';

interface OrderSummaryProps {
  totals: {
    subtotal: number;
    discountAmount: number;
    total: number;
    gstAmount: number;
    finalTotal: number;
  };
  discount: number;
  gstRate: number;
  includeGst: boolean;
  gstError: string | null;
  disabled?: boolean;
  isAdvancedDiscountEnabled: boolean;
  showSecretInput: boolean;
  secretCode: string;
  onSecretCodeChange: (code: string) => void;
  onSecretSubmit: () => void;
  onDiscountChange: (value: number) => void;
  onGstToggle: () => void;
  onCompleteSale: () => void;
  onPrint: () => void;
  itemsCount: number;
  customerType: 'wholesaler' | 'retailer';
  videoCall: VideoCall | null;
  onAdvancedDiscountChange: (enabled: boolean) => void;
  onAdvancedDiscountChange: (enabled: boolean) => void;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({
  totals,
  discount,
  gstRate,
  disabled,
  includeGst,
  gstError,
  isAdvancedDiscountEnabled,
  showSecretInput,
  secretCode,
  onSecretCodeChange,
  onSecretSubmit,
  onDiscountChange,
  onGstToggle,
  onCompleteSale,
  onPrint,
  itemsCount,
  customerType,
  videoCall,
  onAdvancedDiscountChange
}) => {
  const isVideoCallQuotation = !!videoCall;
  const buttonDisabled = itemsCount === 0 || disabled;

  // Get discount range based on cart value
  const getDiscountRange = (subtotal: number): { values: number[]; max: number } => {
    if (customerType === 'wholesaler') {
      return { values: [1, 2, 3, 4, 5], max: isAdvancedDiscountEnabled ? 100 : 15 };
    }
    
    // For retailers, base discount on cart value excluding GST
    if (subtotal >= 10000 && subtotal <= 30000) {
      return { values: [500, 600, 700, 800, 1000], max: 1000 };
    }
    if (subtotal >= 5000 && subtotal < 10000) {
      return { values: [200, 300, 350, 400, 500], max: 500 };
    }
    if (subtotal >= 3000 && subtotal < 5000) {
      return { values: [50, 60, 75, 85, 100], max: 100 };
    }
    // Default for lower amounts
    return { values: [25, 35, 40, 45, 50], max: 50 };
  };

  const isAmountDiscount = customerType === 'retailer';
  const discountRange = getDiscountRange(totals.subtotal);

  // For wholesalers, allow higher discounts in advanced mode
  const maxDiscount = isAmountDiscount ? discountRange.max : 
    (isAdvancedDiscountEnabled ? 100 : 15);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Discount Calculator */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Quick Calculator</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">GST</span>
            <button
              onClick={onGstToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                includeGst ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  includeGst ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {!isAdvancedDiscountEnabled && (
            <button
              onClick={() => onSecretCodeChange('')}
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
              onChange={(e) => onSecretCodeChange(e.target.value)}
              placeholder="Enter secret code"
              className="input flex-1"
              autoComplete="off"
            />
            <button
              onClick={onSecretSubmit}
              className="btn btn-primary"
            >
              Submit
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0} 
            max={maxDiscount}
            value={discount}
            onChange={(e) => {
              const value = Number(e.target.value);
              // For retailers, only allow values within the predefined range
              if (isAmountDiscount) {
                if (value > discountRange.max) {
                  onDiscountChange(discountRange.max);
                  return;
                }
                // Only allow values from the predefined range
                if (!discountRange.values.includes(value)) {
                  return;
                }
              }
              onDiscountChange(value);
            }}
            className="input w-24"
            readOnly={isAmountDiscount} // Make input readonly for retail customers
            placeholder={isAmountDiscount ? "Amount" : "%"}
          />
          <span className="text-gray-600">{isAmountDiscount ? '₹ Discount' : '% Discount'}</span>
          {isAmountDiscount && (
            <span className="text-xs text-gray-500">
              (Max: ₹{discountRange.max})
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(isAmountDiscount ? discountRange.values : [1, 2, 3, 4, 5]).map(value => (
            <button
              key={value}
              onClick={() => onDiscountChange(value)}
              className={`px-3 py-2 rounded text-sm ${
                discount === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isAmountDiscount ? `₹${value}` : `${value}%`}
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
              <span>Discount {isAmountDiscount ? `(₹${discount})` : `(${discount}%)`}:</span>
              <span>-{formatCurrency(totals.discountAmount)}</span>
            </div>
          )}
          
          {includeGst && <div className="flex justify-between text-sm">
            <span className="text-gray-600">GST ({gstRate}%):</span>
            <span>{formatCurrency(totals.gstAmount)}</span>
          </div>}
          {includeGst && gstError && (
            <div className="text-xs text-orange-600 mt-1">
                {gstError}
            </div>
          )}

          <div className="flex justify-between font-bold text-lg pt-2 border-t">
            <span>Total:</span>
            <span>{formatCurrency(totals.finalTotal)}</span>
          </div>
        </div>

        <div className="space-y-2 pt-4">
          <button
            onClick={onCompleteSale}
            disabled={buttonDisabled}
            className={`w-full btn ${
              isVideoCallQuotation 
                ? 'btn-secondary bg-gradient-to-r from-green-600 to-green-700 text-white' 
                : 'btn-primary bg-gradient-to-r from-blue-600 to-blue-700'
            }`}
          >
            {isVideoCallQuotation ? 'Save Quotation' : 'Complete Sale'}
          </button>
          
          <button
            onClick={onPrint}
            disabled={buttonDisabled}
            className={`w-full btn btn-secondary ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Print Quotation
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderSummary;
