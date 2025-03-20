import React from 'react';
import { format } from 'date-fns';
import { getCompanySettings } from '../../../utils/settings';
import type { PrintTemplatesProps } from './types';
import { calculateTotals } from '../../../utils/quotation';

const StandardTemplate: React.FC<PrintTemplatesProps> = ({
  items,
  customerType,
  total,
  customer,
  discount,
  quotationNumber,
  gstRate
}) => {
  const companySettings = getCompanySettings();
  const totals = calculateTotals(items, discount, gstRate);

  // Calculate category totals
  const categoryTotals = items.reduce((acc, item) => {
    const category = item.product.category;
    acc[category] = (acc[category] || 0) + item.quantity;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="print-content font-mono text-[9pt] leading-tight">
      {/* Header */}
      <div className="border-2 border-gray-300 p-3 mb-3">
        <div className="text-center">
          <div className="font-bold text-[12pt] mb-1">{companySettings.name}</div>
          <div className="text-[8pt]">{companySettings.address}</div>
          <div className="text-[8pt]">
            GSTIN: {companySettings.gst_number} | Ph: {companySettings.phone}
          </div>
        </div>
      </div>

      {/* Bill Info */}
      <div className="border p-2 mb-3">
        <div className="grid grid-cols-2 gap-2 text-[8pt]">
          <div>
            <div>Bill No: {quotationNumber}</div>
            <div>Date: {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
          </div>
          <div className="text-right">
            {customer ? (
              <>
                <div className="font-bold">{customer.name}</div>
                <div>{customer.phone}</div>
                {customer.gst_number && <div>GST: {customer.gst_number}</div>}
              </>
            ) : (
              <div>Counter Sale</div>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <table className="w-full mb-3">
        <thead>
          <tr className="border-y-2">
            <th className="py-1 text-left">Item</th>
            <th className="py-1 text-right w-12">Qty</th>
            <th className="py-1 text-right w-20">Rate</th>
            <th className="py-1 text-right w-24">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item, index) => (
            <tr key={index}>
              <td className="py-1">
                <div>{item.product.category}</div>
                <div className="text-[7pt] text-gray-600">{item.product.sku}</div>
              </td>
              <td className="py-1 text-right">{item.quantity}</td>
              <td className="py-1 text-right">{item.price.toFixed(2)}</td>
              <td className="py-1 text-right">{(item.price * item.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Category Summary */}
      <div className="border p-2 mb-3">
        <div className="font-bold mb-1">Category Summary:</div>
        <div className="grid grid-cols-2 gap-2 text-[8pt]">
          {Object.entries(categoryTotals).map(([category, count]) => (
            <div key={category} className="flex justify-between">
              <span>{category}:</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="border-t-2">
        <div className="grid grid-cols-2 gap-4 p-2">
          <div className="text-center border-r">
            <div className="text-[8pt] text-gray-600">You Saved</div>
            <div className="font-bold text-[14pt]">
              ₹{totals.discountAmount.toFixed(2)}
            </div>
          </div>
          <div className="space-y-1 text-[8pt]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Discount ({discount}%):</span>
              <span>-{totals.discountAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST ({gstRate}%):</span>
              <span>{totals.gstAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-[10pt] border-t pt-1">
              <span>Total:</span>
              <span>{totals.finalTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2 border-t text-center text-[7pt] text-gray-600">
        <div>Thank you for your business!</div>
        <div>{quotationNumber}</div>
      </div>
    </div>
  );
};

export default StandardTemplate;
