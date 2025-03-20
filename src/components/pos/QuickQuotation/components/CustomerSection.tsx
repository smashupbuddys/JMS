import React from 'react';
import type { Customer, VideoCall } from '../../../../types';

interface CustomerSectionProps {
  selectedCustomer: Customer | null;
  customerType: 'wholesaler' | 'retailer';
  isCounterSale: boolean;
  customers: Customer[];
  videoCall: VideoCall | null;
  onCustomerChange: (customerId: string) => void;
  onCustomerTypeChange: (type: 'wholesaler' | 'retailer') => void;
}

const CustomerSection: React.FC<CustomerSectionProps> = ({
  selectedCustomer,
  customerType,
  isCounterSale,
  customers,
  videoCall,
  onCustomerChange,
  onCustomerTypeChange
}) => {
  return (
    <div className="flex items-center gap-4">
      <select
        value={selectedCustomer?.id || (isCounterSale ? 'counter' : '')}
        onChange={(e) => onCustomerChange(e.target.value)}
        className="input flex-1"
      >
        <option value="counter">Counter Sale</option>
        <optgroup label="Customers">
          {customers.map(customer => (
            <option key={customer.id} value={customer.id}>
              {customer.name} ({customer.type})
              {videoCall && videoCall.customer_id === customer.id && ' - Video Call Customer'}
            </option>
          ))}
        </optgroup>
      </select>
      <select
        value={customerType}
        onChange={(e) => onCustomerTypeChange(e.target.value as 'wholesaler' | 'retailer')}
        className="input w-40"
        disabled={!isCounterSale}
      >
        <option value="retailer">Retail</option>
        <option value="wholesaler">Wholesale</option>
      </select>
    </div>
  );
};

export default CustomerSection;
