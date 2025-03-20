import React from 'react';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { getCompanySettings, getPrintSettings } from '../../../utils/settings';
import type { PrintTemplatesProps } from './types';
import { calculateTotals, numberToWords } from '../../../utils/quotation';

const ThermalTemplate: React.FC<PrintTemplatesProps> = ({
  items,
  customerType,
  total,
  customer,
  discount,
  quotationNumber,
  gstRate,
  includeGst = true
}) => {
  const companySettings = getCompanySettings();
  const printSettings = getPrintSettings();
  
  // Get base totals
  const baseTotals = calculateTotals(items, discount, gstRate, includeGst);
  
  // Format and round totals
  const totals = {
    ...baseTotals,
    // Round up the final total if GST is included
    finalTotal: includeGst ? Math.ceil(baseTotals.finalTotal) : baseTotals.finalTotal
  };
  
  // Format amounts function - removes .00 from whole numbers
  const formatAmount = (amount) => {
    return Math.floor(amount) === amount ? Math.floor(amount).toString() : amount.toFixed(2);
  };

  // Calculate category totals with memoization
  const categoryTotals = React.useMemo(() => {
    const totals = items.reduce((acc, item) => {
      const category = item.product.category;
      if (!acc[category]) {
        acc[category] = { quantity: 0 };
      }
      acc[category].quantity += item.quantity;
      return acc;
    }, {} as Record<string, { quantity: number }>);

    // Calculate grand total
    const grandTotal = Object.values(totals).reduce(
      (sum, cat) => ({
        quantity: sum.quantity + cat.quantity
      }),
      { quantity: 0 }
    );

    return { categories: totals, grandTotal };
  }, [items]);

  const Header = () => (
    <div className="text-center border-b pb-2 mb-2">
      <div className="font-bold text-lg">{companySettings.name}</div>
      <div className="text-sm font-bold">{companySettings.address}</div>
      <div className="text-sm font-bold">GSTIN: {companySettings.gst_number}</div>
      <div className="text-sm font-bold">Ph: {companySettings.phone}</div>
    </div>
  );

  const BillInfo = () => (
    <div className="mb-3 text-sm">
      <div className="font-medium border-b pb-1 mb-1">
        Bill No: {quotationNumber}
      </div>
      <div className="flex justify-between">
        <span>{format(new Date(), 'dd/MM/yy')}</span>
        <span>{format(new Date(), 'HH:mm')}</span>
      </div>
      <div className="flex justify-between mt-1">
        <span>Customer: {customer?.name || 'Counter Sale'}</span>
        {customer?.phone && <span>Ph: {customer.phone}</span>}
      </div>
    </div>
  );

  const ItemsTable = () => (
    <table className="w-full text-sm mb-3">
      <thead className="border-y font-bold">
        <tr>
          <th className="text-left py-1">Item</th>
          <th className="text-right w-16">Qty</th>
          <th className="text-right w-20">Rate</th>
          <th className="text-right w-20">Amt</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {items.map((item, index) => (
          <tr key={index} className="py-1">
            <td>
              <div className="flex flex-col">
                <span className="font-bold">{item.product.category}</span>
                <span className="text-xs font-bold text-black break-words">
                  {item.product.sku}
                </span>
              </div>
            </td>
            <td className="text-right font-bold">{item.quantity}</td>
            <td className="text-right font-bold">{formatAmount(item.price)}</td>
            <td className="text-right font-bold">{formatAmount(item.quantity * item.price)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const CategorySummary = () => (
    <div className="mb-3 border-t pt-2">
      <div className="font-bold mb-2">Items Summary:</div>
      <div className="space-y-1">
          {Object.entries(categoryTotals.categories).map(([category, data]) => (
            <div key={category} className="flex justify-between text-sm">
              <span className="font-bold">{category}:</span>
              <span className="mono font-bold">{data.quantity} pcs</span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-sm pt-1 border-t border-dotted">
            <span>Total Items:</span>
            <span className="mono">{categoryTotals.grandTotal.quantity} pcs</span>
          </div>
      </div>
    </div>
  );

  const TotalSection = () => (
    <div className="border-t pt-2 mb-3">
      <div className="flex justify-between text-sm font-bold">
        <span>Subtotal:</span>
        <span>{formatAmount(totals.subtotal)}</span>
      </div>
      {discount > 0 && (
        <div className="flex justify-between text-sm font-bold text-green-600">
          <span>Discount ({discount}%):</span>
          <span>-{formatAmount(totals.discountAmount)}</span>
        </div>
      )}
      {includeGst && (
        <div className="flex justify-between text-sm font-bold">
          <span>GST ({gstRate}%):</span>
          <span>{formatAmount(totals.gstAmount)}</span>
        </div>
      )}
      {includeGst && baseTotals.finalTotal !== totals.finalTotal && (
        <div className="flex justify-between text-sm font-bold">
          <span>Round Off:</span>
          <span>+{formatAmount(totals.finalTotal - baseTotals.finalTotal)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold mt-1 pt-1 border-t">
        <span>Net Amount:</span>
        <span>{formatAmount(totals.finalTotal)}</span>
      </div>
    </div>
  );

  const Footer = () => (
    <div className="text-center text-sm space-y-2">
      <div className="border-t pt-2">
        <div className="font-bold">Amount in Words:</div>
        <div className="text-xs font-bold">{numberToWords(totals.finalTotal)} Only</div>
      </div>
      {printSettings.footerText && (
        <div className="border-t pt-2 font-bold">{printSettings.footerText}</div>
      )}
      {printSettings.termsText && (
        <div className="border-t pt-2 text-left">
          <div className="font-bold">Terms & Conditions:</div>
          <div className="text-xs font-bold whitespace-pre-line">
            {includeGst 
              ? printSettings.termsText 
              : printSettings.termsText.replace(/GST will be charged as applicable/g, '').replace(/\n\n/g, '\n').trim()}
          </div>
        </div>
      )}
      <div className="border-t pt-2">
        <div className="font-bold">Thank You for Your Business!</div>
        <div className="flex justify-center mt-2">
          <QRCodeSVG 
            value={JSON.stringify({
              quotationNumber,
              total: totals.finalTotal,
              date: format(new Date(), 'yyyy-MM-dd'),
              customer: customer?.name || 'Counter Sale'
            })}
            size={80}
            level="M"
            includeMargin={true}
          />
        </div>
        <div className="text-xs font-bold mt-1">{quotationNumber}</div>
        <div className="text-sm font-bold mt-2 bg-black text-white inline-block px-2 py-1 rounded">Powered by JMS</div>
      </div>
    </div>
  );

  return (
    <div className="p-4 max-w-sm mx-auto bg-white font-medium text-black">
      <Header />
      <BillInfo />
      <ItemsTable />
      <CategorySummary />
      <TotalSection />
      <Footer />
    </div>
  );
};

export default ThermalTemplate;
