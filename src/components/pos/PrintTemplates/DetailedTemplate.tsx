import React from 'react';
import { format } from 'date-fns';
import { getCompanySettings } from '../../../utils/settings';
import type { PrintTemplatesProps } from './types';
import { calculateTotals } from '../../../utils/quotation';

const DetailedTemplate: React.FC<PrintTemplatesProps> = ({
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
    if (!acc[category]) {
      acc[category] = {
        count: 0,
        amount: 0
      };
    }
    acc[category].count += item.quantity;
    acc[category].amount += item.price * item.quantity;
    return acc;
  }, {} as Record<string, { count: number; amount: number }>);

  return (
    <div className="print-content font-mono text-[9pt] leading-tight">
      {/* Header */}
      <div className="border-2 border-gray-300 p-4 mb-4">
        <div className="text-center mb-3">
          <div className="font-bold text-[14pt]">{companySettings.name}</div>
          <div className="text-[9pt]">{companySettings.address}</div>
          <div className="text-[9pt]">
            GSTIN: {companySettings.gst_number} | Ph: {companySettings.phone}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-[8pt]">
          <div>
            <div className="font-bold mb-1">Bill Details:</div>
            <div>Bill No: {quotationNumber}</div>
            <div>Date: {format(new Date(), 'PPpp')}</div>
            <div>Type: {customerType === 'wholesaler' ? 'Wholesale' : 'Retail'}</div>
          </div>
          <div>
            <div className="font-bold mb-1">Customer Details:</div>
            {customer ? (
              <>
                <div>{customer.name}</div>
                <div>{customer.phone}</div>
                {customer.gst_number && <div>GST: {customer.gst_number}</div>}
                {customer.address && (
                  <div className="text-[7pt]">
                    {customer.address}, {customer.city}, {customer.state} {customer.pincode}
                  </div>
                )}
              </>
            ) : (
              <div>Counter Sale</div>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <table className="w-full mb-4">
        <thead>
          <tr className="border-y-2">
            <th className="py-2 text-left">Item Details</th>
            <th className="py-2 text-right w-12">Qty</th>
            <th className="py-2 text-right w-20">Rate</th>
            <th className="py-2 text-right w-24">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item, index) => (
            <tr key={index}>
              <td className="py-2">
                <div className="font-bold">{item.product.category}</div>
                <div className="text-[8pt]">SKU: {item.product.sku}</div>
                {item.product.description && (
                  <div className="text-[7pt] text-gray-600">{item.product.description}</div>
                )}
              </td>
              <td className="py-2 text-right align-top">{item.quantity}</td>
              <td className="py-2 text-right align-top">{item.price.toFixed(2)}</td>
              <td className="py-2 text-right align-top">{(item.price * item.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Category Summary */}
      <div className="border p-3 mb-4">
        <div className="font-bold mb-2">Category Summary:</div>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(categoryTotals).map(([category, data]) => (
            <div key={category} className="border-b pb-1">
              <div className="font-bold">{category}</div>
              <div className="flex justify-between text-[8pt]">
                <span>Quantity:</span>
                <span>{data.count}</span>
              </div>
              <div className="flex justify-between text-[8pt]">
                <span>Amount:</span>
                <span>₹{data.amount.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="border-t-2">
        <div className="grid grid-cols-2 gap-6 p-3">
          <div className="text-center border-r">
            <div className="text-[9pt] text-gray-600">Total Savings</div>
            <div className="font-bold text-[16pt]">
              ₹{totals.discountAmount.toFixed(2)}
            </div>
            <div className="text-[8pt] text-gray-600">
              ({discount}% Discount Applied)
            </div>
          </div>
          <div className="space-y-2">
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
            <div className="flex justify-between font-bold text-[12pt] border-t pt-2">
              <span>Grand Total:</span>
              <span>{totals.finalTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Terms */}
      <div className="mt-4 pt-2 border-t text-[7pt]">
        <div className="font-bold mb-1">Terms & Conditions:</div>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>All prices include GST where applicable</li>
          <li>Exchange within 7 days with original bill</li>
          <li>No refund on sale items</li>
          <li>Warranty as per manufacturer terms</li>
        </ol>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-2 border-t text-center text-[8pt]">
        <div className="font-bold mb-1">Thank you for your business!</div>
        <div className="text-[7pt] text-gray-600">
          For support: {companySettings.phone} | {companySettings.email}
        </div>
        <div className="text-[7pt] text-gray-600 mt-1">{quotationNumber}</div>
      </div>
    </div>
  );
};

export default DetailedTemplate;
