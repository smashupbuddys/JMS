import React from 'react';
import type { Customer, VideoCall } from '../../../../types';
import { getCountryByCode } from '../../../../utils/countryUtils';
import { formatPhoneNumber } from '../../../../utils/phoneUtils';

interface CustomerSelectorProps {
  selectedCustomer: Customer | null;
  customerType: 'wholesaler' | 'retailer';
  isCounterSale: boolean;
  customers: Customer[];
  videoCall: VideoCall | null;
  disabled?: boolean;
  onCustomerChange: (customerId: string) => void;
  onCustomerTypeChange: (type: 'wholesaler' | 'retailer') => void;
}

const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  selectedCustomer,
  customerType,
  isCounterSale,
  customers,
  videoCall,
  disabled = false,
  onCustomerChange,
  onCustomerTypeChange
}) => {
  // Group customers by type for better organization
  const groupedCustomers = React.useMemo(() => {
    return customers.reduce((acc, customer) => {
      const group = customer.type === 'retailer' ? 'Retail Customers' : 'Wholesale Customers';
      if (!acc[group]) acc[group] = [];
      acc[group].push(customer);
      return acc;
    }, {} as Record<string, Customer[]>);
  }, [customers]);

  // If disabled and customer is selected, show only that customer
  if (disabled && selectedCustomer) {
    return (
      <div className="flex items-center gap-4 opacity-75">
        <div className="relative flex-1">
          <div className="input w-full bg-gray-50/80 backdrop-blur flex items-center gap-2 cursor-not-allowed">
            <div className="flex-1">
              <div className="font-medium">{selectedCustomer.name}</div>
              <div className="text-sm text-gray-500">
                {formatPhoneNumber(selectedCustomer.phone)}
                {selectedCustomer.city && ` (${selectedCustomer.city})`}
                {videoCall && ' - Video Call Customer'}
              </div>
            </div>
            {selectedCustomer.country_code && (
              <div className="flex items-center gap-2 px-2 py-1 bg-gray-100/80 rounded">
                {React.createElement(
                  getCountryByCode(selectedCustomer.country_code)?.flag || 'span',
                  { className: 'h-4 w-4' }
                )}
                <span className="text-sm text-gray-600">
                  {getCountryByCode(selectedCustomer.country_code)?.name}
                </span>
              </div>
            )}
          </div>
        </div>

        <select
          value={customerType}
          disabled={true}
          className="input w-40 bg-gray-50/80 backdrop-blur cursor-not-allowed"
        >
          <option value="retailer">Retail</option>
          <option value="wholesaler">Wholesale</option>
        </select>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-1">
        <select
          value={selectedCustomer?.id || (isCounterSale ? 'counter' : '')}
          onChange={(e) => onCustomerChange(e.target.value)}
          className="input w-full appearance-none"
          disabled={disabled}
        >
          <option value="counter">Counter Sale</option>
          {Object.entries(groupedCustomers).map(([group, groupCustomers]) => (
            <optgroup key={group} label={group}>
              {groupCustomers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} - {formatPhoneNumber(customer.phone)}
                  {customer.city && ` (${customer.city})`}
                  {videoCall && videoCall.customer_id === customer.id && ' - Video Call Customer'}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        
        {/* Display selected customer details */}
        {selectedCustomer && (
          <div className="absolute right-10 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {getCountryByCode(selectedCustomer.country_code || 'IN')?.name}
            </span>
          </div>
        )}
      </div>

      <select
        value={customerType}
        onChange={(e) => onCustomerTypeChange(e.target.value as 'wholesaler' | 'retailer')}
        className="input w-40"
        disabled={disabled || !isCounterSale}
      >
        <option value="retailer">Retail</option>
        <option value="wholesaler">Wholesale</option>
      </select>
    </div>
  );
};

export default CustomerSelector;
