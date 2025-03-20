import React from 'react';
import { Diamond } from 'lucide-react';
import { format } from 'date-fns';
import { getCompanySettings } from '../../../utils/settings';
import type { PrintTemplatesProps } from './types';
import { calculateTotals, formatCurrency } from '../../../utils/quotation';

const ClassicTemplate: React.FC<PrintTemplatesProps> = ({
  items,
  customerType,
  total,
  customer,
  discount,
  videoCall,
  quotationNumber,
  gstRate
}) => {
  const companySettings = getCompanySettings();
  const totals = calculateTotals(items, discount, gstRate);

  return (
    <div className="print-content font-serif">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold">QUOTATION</h1>
        <h2 className="text-lg">#{quotationNumber}</h2>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse mb-8">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="py-2 text-left w-1/4">Category</th>
            <th className="py-2 text-left w-1/4">SKU</th>
            <th className="py-2 text-right w-1/6">Rate</th>
            <th className="py-2 text-right w-1/6">Qty</th>
            <th className="py-2 text-right w-1/6">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item, index) => (
            <tr key={index} className="text-sm">
              <td className="py-3">{item.product.category}</td>
              <td className="py-3 font-mono">
                {item.product.sku.split('').map((char, i) => {
                  const isBold = /\d/.test(char) && /\d/.test(item.product.sku[i + 1]);
                  return isBold ? (
                    <strong key={i} className="font-bold">{char}</strong>
                  ) : (
                    <span key={i}>{char}</span>
                  );
                })}
              </td>
              <td className="py-3 text-right font-mono">{formatCurrency(item.price)}</td>
              <td className="py-3 text-right font-mono">{item.quantity}</td>
              <td className="py-3 text-right font-mono">
                {formatCurrency(item.price * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <div className="w-1/2 ml-auto space-y-2">
        <div className="flex justify-between items-center py-1">
          <span className="text-gray-600">Subtotal:</span>
          <span className="font-mono">{formatCurrency(totals.subtotal)}</span>
        </div>
        
        {discount > 0 && (
          <div className="flex justify-between items-center py-1 text-green-600">
            <span>Discount ({discount}%):</span>
            <span className="font-mono">-{formatCurrency(totals.discountAmount)}</span>
          </div>
        )}
        
        <div className="flex justify-between items-center py-1">
          <span className="text-gray-600">GST ({gstRate}%):</span>
          <span className="font-mono">{formatCurrency(totals.gstAmount)}</span>
        </div>
        
        <div className="flex justify-between items-center pt-2 border-t border-gray-200 font-bold">
          <span>Total:</span>
          <span className="font-mono">{formatCurrency(totals.finalTotal)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-4 border-t border-gray-200 text-xs text-gray-500 text-center">
        <p>This is a computer generated quotation</p>
      </div>
    </div>
  );
};

export default ClassicTemplate;
