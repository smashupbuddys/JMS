import React from 'react';
import { format } from 'date-fns';
import { getCompanySettings } from '../../../utils/settings';
import type { PrintTemplatesProps } from './types';
import { calculateTotals } from '../../../utils/quotation';

const CompactTemplate: React.FC<PrintTemplatesProps> = ({
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

  return (
    <div className="print-content font-mono text-[7pt] leading-none">
      {/* Header */}
      <div className="text-center mb-0.5">
        <div className="font-bold text-[8pt]">{companySettings.name}</div>
        <div className="text-[5pt]">{companySettings.address}</div>
        <div className="text-[5pt]">GST: {companySettings.gst_number}</div>
        <div className="text-[5pt]">Ph: {companySettings.phone}</div>
      </div>

      {/* Bill Info */}
      <div className="border-t border-b border-dotted py-0.5 text-[5pt]">
        <div className="flex justify-between">
          <span>#{quotationNumber}</span>
          <span>{format(new Date(), 'dd/MM/yy HH:mm')}</span>
        </div>
        <div className="text-center">
          {customer ? (
            <>
              <div>{customer.name}</div>
              <div className="text-[4pt]">{customer.phone}</div>
            </>
          ) : (
            'Counter Sale'
          )}
        </div>
      </div>

      {/* Items */}
      <table className="w-full text-[5pt] mt-0.5">
        <thead>
          <tr className="border-b border-dotted">
            <th className="text-left py-0">Item</th>
            <th className="text-right w-4">Q</th>
            <th className="text-right w-8">Rate</th>
            <th className="text-right w-10">Amt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dotted">
          {items.map((item, index) => (
            <tr key={index}>
              <td className="py-0">{item.product.category}</td>
              <td className="text-right">{item.quantity}</td>
              <td className="text-right">{item.price.toFixed(2)}</td>
              <td className="text-right">{(item.price * item.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-0.5 border-t border-dotted pt-0.5">
        <div className="text-[5pt] space-y-0">
          <div className="flex justify-between">
            <span>Total:</span>
            <span>{totals.subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between">
              <span>-{discount}%:</span>
              <span>{totals.discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>GST{gstRate}%:</span>
            <span>{totals.gstAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-[6pt] border-t border-dotted pt-0.5">
            <span>Net:</span>
            <span>{totals.finalTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-0.5 pt-0.5 border-t border-dotted text-center text-[4pt]">
        <div>Thank You!</div>
        <div>{quotationNumber}</div>
      </div>
    </div>
  );
};

export default CompactTemplate;
