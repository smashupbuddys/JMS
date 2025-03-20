import React from 'react';
import type { QuotationItem } from './QuickQuotation';
import type { Customer, VideoCall } from '../../types';
import { format } from 'date-fns';
import { Diamond } from 'lucide-react';

interface PrintableQuotationProps {
  items: QuotationItem[];
  customerType: 'wholesaler' | 'retailer';
  total: number;
  customer?: Customer | null;
  discount: number;
  videoCall?: VideoCall | null;
  quotationNumber: string;
}

const PrintableQuotation: React.FC<PrintableQuotationProps> = ({
  items,
  customerType,
  total,
  customer,
  discount,
  videoCall,
  quotationNumber
}) => {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = (subtotal * discount) / 100;
  const gstAmount = (total * 0.18); // 18% GST
  const finalTotal = total + gstAmount;

  return (
    <div className="bg-white p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="mb-4">
          <Diamond className="h-8 w-8 text-blue-600 mx-auto" />
          <div className="text-3xl font-bold text-blue-600">JMS</div>
        </div>
        <h1 className="text-2xl font-bold">Jewelry Management System</h1>
        <p className="text-gray-600">Quotation #{quotationNumber}</p>
        <div className="mt-4 flex justify-between text-sm text-gray-500">
          <div>
            <p>Date: {format(new Date(), 'dd/MM/yyyy')}</p>
            <p>Type: {customerType === 'wholesaler' ? 'Wholesale' : 'Retail'}</p>
          </div>
          <div>
            <p>Valid Until: {format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'dd/MM/yyyy')}</p>
          </div>
        </div>
      </div>

      {/* Customer Details */}
      {customer && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Bill To:</h3>
              <p className="font-medium">{customer.name}</p>
              <p className="text-sm text-gray-600">{customer.address}</p>
              <p className="text-sm text-gray-600">{customer.city}, {customer.state} {customer.pincode}</p>
              {customer.gst_number && (
                <p className="text-sm text-gray-600">GSTIN: {customer.gst_number}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Phone: {customer.phone}</p>
              {customer.email && (
                <p className="text-sm text-gray-600">Email: {customer.email}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Items Table */}
      <table className="w-full mb-8">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map((item, index) => (
            <tr key={index}>
              <td className="px-4 py-2">
                <div className="font-medium">{item.product.name}</div>
                <div className="text-sm text-gray-500">{item.product.description}</div>
              </td>
              <td className="px-4 py-2 text-gray-500">{item.product.sku}</td>
              <td className="px-4 py-2 text-right">₹{item.price.toLocaleString()}</td>
              <td className="px-4 py-2 text-right">{item.quantity}</td>
              <td className="px-4 py-2 text-right">₹{(item.price * item.quantity).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <div className="flex justify-end mb-8">
        <div className="w-64">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span>₹{subtotal.toLocaleString()}</span>
            </div>
            
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount ({discount}%):</span>
                <span>-₹{discountAmount.toLocaleString()}</span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-gray-600">GST (18%):</span>
              <span>₹{gstAmount.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total:</span>
              <span>₹{finalTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Terms and Bank Details */}
      <div className="grid grid-cols-2 gap-6 border-t pt-6 mb-8">
        <div>
          <h3 className="text-sm font-semibold mb-2">Terms & Conditions:</h3>
          <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
            <li>Quotation valid for 7 days from the date of issue</li>
            <li>Prices are subject to change without prior notice</li>
            <li>GST will be charged as applicable</li>
            <li>Delivery timeline will be confirmed upon order confirmation</li>
          </ol>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Bank Details:</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>Bank Name: HDFC Bank</p>
            <p>Account Name: Jewelry Management System</p>
            <p>Account Number: XXXXX XXXXX XXX</p>
            <p>IFSC Code: HDFC0XXXXX</p>
            <p>Branch: Diamond District</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t pt-6">
        <div className="flex justify-between items-start">
          <div className="text-sm text-gray-600">
            <p>Thank you for your business!</p>
            <p>For any queries, please contact:</p>
            <p>Phone: +91 98765 43210</p>
            <p>Email: sales@jewelryms.com</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium mb-8">For Jewelry Management System</p>
            <div className="border-t border-gray-300 w-40 ml-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintableQuotation;
