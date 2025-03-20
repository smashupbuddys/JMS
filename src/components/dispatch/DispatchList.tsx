import React from 'react';
import { Truck, Search, Box, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import type { Quotation } from '../../types';

const DispatchList = () => {
  const [quotations, setQuotations] = React.useState<Quotation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    fetchPendingDispatches();
  }, []);

  const fetchPendingDispatches = async () => {
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select(`
          *,
          customers (
            name,
            phone,
            address,
            city,
            state,
            pincode
          )
        `)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotations(data || []);
    } catch (error) {
      console.error('Error fetching pending dispatches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (quotationId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('quotations')
        .update({
          workflow_status: {
            ...quotations.find(q => q.id === quotationId)?.workflow_status,
            dispatch: status
          }
        })
        .eq('id', quotationId);

      if (error) throw error;
      
      // Refresh the list
      fetchPendingDispatches();
    } catch (error) {
      console.error('Error updating dispatch status:', error);
      alert('Error updating status. Please try again.');
    }
  };

  const filteredQuotations = quotations.filter(quotation => {
    const searchString = searchTerm.toLowerCase();
    const customerName = quotation.customers?.name?.toLowerCase() || '';
    const customerPhone = quotation.customers?.phone?.toLowerCase() || '';
    
    return customerName.includes(searchString) || customerPhone.includes(searchString);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading pending dispatches...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Truck className="h-6 w-6" />
          Pending Dispatches
        </h2>
        <div className="flex-1 max-w-md relative ml-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search dispatches..."
            className="input pl-10 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredQuotations.map((quotation) => (
          <div key={quotation.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold">{quotation.customers?.name}</h3>
                <p className="text-gray-600">{quotation.customers?.phone}</p>
                <p className="text-gray-600 mt-2">
                  {quotation.customers?.address}, {quotation.customers?.city}, {quotation.customers?.state} {quotation.customers?.pincode}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">₹{quotation.total_amount.toLocaleString()}</p>
                <p className="text-sm text-gray-500">
                  Order Date: {format(new Date(quotation.created_at), 'PP')}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Box className="h-5 w-5 text-blue-500" />
                  <span>Packaging</span>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-500" />
                  <span>Dispatch</span>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-gray-400" />
                  <span>Delivered</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdateStatus(quotation.id, 'in_progress')}
                  className="btn btn-primary"
                >
                  Start Processing
                </button>
                <button
                  onClick={() => handleUpdateStatus(quotation.id, 'completed')}
                  className="btn btn-secondary"
                >
                  Mark as Dispatched
                </button>
              </div>
            </div>

            {/* Order Items */}
            <div className="mt-6 border-t pt-4">
              <h4 className="font-medium mb-2">Order Items</h4>
              <div className="space-y-2">
                {quotation.items.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-sm text-gray-500">SKU: {item.product.sku}</p>
                    </div>
                    <div className="text-right">
                      <p>Qty: {item.quantity}</p>
                      <p className="text-sm text-gray-500">₹{item.price.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {filteredQuotations.length === 0 && (
          <div className="text-center py-12">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No pending dispatches</h3>
            <p className="mt-1 text-gray-500">
              {searchTerm 
                ? 'Try adjusting your search terms'
                : 'All orders have been dispatched'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DispatchList;
