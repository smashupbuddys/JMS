import React from 'react';
import { format } from 'date-fns';
import { getCompanySettings } from '../../utils/settings';

interface ShippingLabelProps {
  customer: {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    country?: string;
  };
  items: Array<{
    product: {
      category: string;
    };
    quantity: number;
  }>;
  packedBy: string;
}

const ShippingLabel: React.FC<ShippingLabelProps> = ({
  customer,
  items,
  packedBy
}) => {
  const companySettings = getCompanySettings();

  // Calculate category summary
  const categorySummary = items.reduce((acc, item) => {
    const category = item.product.category;
    acc[category] = (acc[category] || 0) + item.quantity;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-4 border-2 border-black text-sm">
      {/* From Address */}
      <div className="mb-4 text-xs">
        <div className="font-bold">{companySettings.name}</div>
        <div>{companySettings.address}</div>
        <div>{companySettings.city}, {companySettings.state} {companySettings.pincode}</div>
        <div>Phone: {companySettings.phone}</div>
      </div>

      <div className="border-b-2 border-black mb-4" />

      {/* To Address */}
      <div className="mb-4">
        <div className="font-bold text-lg mb-1">Ship To:</div>
        <div className="font-bold">{customer.name}</div>
        <div>{customer.address}</div>
        <div>
          {customer.city}, {customer.state} {customer.pincode}
          {customer.country && customer.country !== 'INDIA' && (
            <div className="font-bold mt-1">
              {customer.country}
            </div>
          )}
        </div>
        <div>Phone: {customer.phone}</div>
      </div>

      {/* Category Summary */}
      <div className="mb-4 border border-black">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black">
              <th className="py-1 px-2 text-left font-bold">CATEGORY</th>
              <th className="py-1 px-2 text-right font-bold">QTY</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(categorySummary).map(([category, count]) => (
              <tr key={category} className="border-b border-black last:border-b-0">
                <td className="py-1 px-2">{category.toUpperCase()}</td>
                <td className="py-1 px-2 text-right font-mono">{count}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-black bg-gray-100">
              <td className="py-1 px-2 font-bold">TOTAL PIECES</td>
              <td className="py-1 px-2 text-right font-bold font-mono">
                {Object.values(categorySummary).reduce((sum, count) => sum + count, 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Packed By */}
      <div className="text-xs">
        <div className="font-bold">Packed By: {packedBy}</div>
        <div className="flex justify-between">
          <span>Date: {format(new Date(), 'dd/MM/yyyy')}</span>
          {customer.country && customer.country !== 'INDIA' && (
            <span className="font-bold text-red-600">INTERNATIONAL SHIPMENT</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShippingLabel;
