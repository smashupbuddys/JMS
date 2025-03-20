import React, { useState } from 'react';
import { Search, Plus, User } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { formatPhoneNumber } from '../../../../utils/phoneUtils';
import type { Customer } from '../../../../types';

interface CustomerSectionProps {
  selectedCustomer: Customer | null;
  customerType: 'wholesaler' | 'retailer';
  isCounterSale: boolean;
  onCustomerChange: (customer: Customer | null) => void;
  onCustomerTypeChange: (type: 'wholesaler' | 'retailer') => void;
  onCounterSaleChange: (isCounter: boolean) => void;
}

const CustomerSection: React.FC<CustomerSectionProps> = ({
  selectedCustomer,
  customerType,
  isCounterSale,
  onCustomerChange,
  onCustomerTypeChange,
  onCounterSaleChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async (term: string) => {
    if (!term) {
      setSearchResults([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
        .limit(5);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching customers:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Customer Details</h3>
        <button
          onClick={() => {
            onCustomerChange(null);
            onCounterSaleChange(true);
          }}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Reset
        </button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search customers by name or phone..."
            className="input pl-10 w-full"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              handleSearch(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
          />

          {showResults && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg max-h-96 overflow-auto">
              {searchResults.map((customer) => (
                <button
                  key={customer.id}
                  className="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3"
                  onClick={() => {
                    onCustomerChange(customer);
                    onCustomerTypeChange(customer.type);
                    onCounterSaleChange(false);
                    setSearchTerm('');
                    setShowResults(false);
                  }}
                >
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-sm text-gray-500">
                      {formatPhoneNumber(customer.phone)}
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                        customer.type === 'wholesaler'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {customer.type}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

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

      {selectedCustomer && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="font-medium">{selectedCustomer.name}</div>
              <div className="text-sm text-gray-600">
                {formatPhoneNumber(selectedCustomer.phone)}
                {selectedCustomer.city && ` • ${selectedCustomer.city}`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSection;