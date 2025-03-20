import React from 'react';
import type { QuotationItem } from './QuickQuotation';
import type { Customer, VideoCall } from '../../types';
import { format } from 'date-fns';
import { Diamond } from 'lucide-react';
import { getCompanySettings } from '../../utils/settings';
import '../../styles/print.css';

interface PrintQuotationProps {
  items: QuotationItem[];
  customerType: 'wholesaler' | 'retailer';
  total: number;
  customer?: Customer | null;
  discount: number;
  videoCall?: VideoCall | null;
  quotationNumber?: string;
  gstRate: number;
  gstRate: number;
}

const PrintQuotation: React.FC<PrintQuotationProps> = ({
  items,
  customerType,
  total,
  customer,
  discount,
  videoCall,
  quotationNumber = `Q${format(new Date(), 'yyyyMMdd')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
  gstRate = 18
}) => {
  const printSettings = JSON.parse(localStorage.getItem('printSettings') || '{}');
  const companySettings = getCompanySettings();
  const { showHeader, showFooter, showLogo, headerText, footerText, termsText, additionalNotes, showPriceBreakdown, showDiscount, discountPercent } = {
    showHeader: true,
    showFooter: true,
    showLogo: true,
    headerText: companySettings.name,
    footerText: `Thank you for your business!\nFor any queries, please contact:\nPhone: ${companySettings.phone}\nEmail: ${companySettings.email}`,
    termsText: '1. Quotation valid for 7 days from the date of issue\n2. Prices are subject to change without prior notice\n3. GST will be charged as applicable\n4. Delivery timeline will be confirmed upon order confirmation',
    additionalNotes: '',
    showPriceBreakdown: true,
    showDiscount: false,
    discountPercent: 0,
    ...printSettings
  };

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const gstAmount = (total * (gstRate / 100)); // Use dynamic GST rate
  const finalTotal = total + gstAmount;

  return (
    <div className="print-content">
      {/* Header */}
      <div className="border-2 border-gray-300 rounded-lg">
        <div className="p-2">
          <div className="flex justify-between text-xs">
            <div>GSTIN: {companySettings.gst_number}</div>
            <div>{companySettings.phone}</div>
          </div>
          <div className="text-center font-bold text-lg">{companySettings.name}</div>
          <div className="text-center text-sm">{companySettings.address}</div>
          <div className="bg-gray-200 text-center py-1 font-semibold">
            Bill of Supply
          </div>
          <div className="flex justify-between text-xs mt-1">
            <div>Bill No: {quotationNumber}</div>
            <div>Date: {format(new Date(), 'dd-MM-yyyy')}</div>
          </div>
          <div className="flex justify-between text-xs">
            <div>Customer Name: {customer?.name || 'Cash'}</div>
            <div>Time: {format(new Date(), 'H:mm a')}</div>
          </div>
          {customer?.phone && (
            <div className="text-xs">{customer.phone}</div>
          )}
        </div>


      {/* Items Table */}
      <table className="w-full text-xs border-t">
        <thead>
          <tr>
            <th className="p-0.5 text-left">Sr</th>
            <th className="p-0.5 text-left">Item</th>
            <th className="p-0.5 text-right">Qty</th>
            <th className="p-0.5 text-right">Rate</th>
            <th className="p-0.5 text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td className="p-0.5">{index + 1}</td>
              <td className="p-0.5">
                <div>
                  {item.product.category} ({item.product.sku})
                </div>
              </td>
              <td className="p-0.5 text-right">{item.quantity}</td>
              <td className="p-0.5 text-right">{item.price.toFixed(2)}</td>
              <td className="p-0.5 text-right">{(item.price * item.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Category Totals */}
      <div className="border-t border-b">
        <div className="p-0.5 text-xs">
          <div className="font-bold">Items Summary:</div>
          {Object.entries(
            items.reduce((acc, item) => {
              const category = item.product.category;
              acc[category] = (acc[category] || 0) + item.quantity;
              return acc;
            }, {} as Record<string, number>)
          ).map(([category, count]) => (
            <div key={category} className="flex justify-between">
              <span>{category}:</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="border-t">
        <div className="flex">
          <div className="w-1/2 p-1 border-r">
            <div className="text-center text-lg font-bold">
              YOU<br />
              SAVED<br />
              {discount > 0 ? discount.toFixed(2) : '0.00'}
            </div>
          </div>
          <div className="w-1/2 p-1 space-y-0.5">
            <div className="flex justify-between">
              <span>Total:</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Bill Discount:</span>
              <span>{discountAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Round Off:</span>
              <span>0.00</span>
            </div>
            <div className="flex justify-between font-bold border-t pt-1">
              <span>Net Total:</span>
              <span>{finalTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Amount in Words */}
      <div className="border-t p-2 text-xs">
        Amount in words: {toWords(finalTotal)} ONLY
      </div>

      {/* Terms & Conditions */}
      <div className="border-t p-2">
        <div className="text-xs">Terms & Conditions</div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs p-2">
        Thank You... Visit Again!
      </div>
    </div>
    </div>
  );
};

// Helper function to convert number to words
function toWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  function convert(n: number): string {
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
  }

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  
  let result = 'Rupees ' + convert(rupees);
  if (paise > 0) {
    result += ' and ' + convert(paise) + ' Paise';
  }
  
  return result;
}
export default PrintQuotation;
