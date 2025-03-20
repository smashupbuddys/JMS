import React, { useState, useEffect } from 'react';
import { X, Eye, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

interface SavedQuotationsProps {
  customerId?: string | null;
  onClose: () => void;
  onSelect: (quotationId: string) => void;
}

const SavedQuotations: React.FC<SavedQuotationsProps> = ({
  customerId,
  onClose,
  onSelect
}) => {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuotations();
  }, [customerId]);

  const fetchQuotations = async () => {
    try {
      let query = supabase
        .from('quotations')
        .select(`
          *,
          customers (
            name,
            type
          )
        `)
        .eq('status', 'draft')
        .eq('bill_status', 'pending')
        .order('created_at', { ascending: false });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;

      if (error) throw error;
      console.log('Fetched quotations:', data); // Debug log
      setQuotations(data || []);
    } catch (error) {
      console.error('Error fetching quotations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (quotationId: string) => {
    if (!window.confirm('Are you sure you want to delete this quotation?')) return;

    try {
      const { error } = await supabase
        .from('quotations')
        .delete()
        .eq('id', quotationId);

      if (error) throw error;

      setQuotations(prev => prev.filter(q => q.id !== quotationId));
    } catch (error) {
      console.error('Error deleting quotation:', error);
      alert('Error deleting quotation. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-3xl mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Saved Quotations</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-4">Loading quotations...</div>
          ) : quotations.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No saved quotations found
            </div>
          ) : (
            <div className="space-y-4">
              {quotations.map((quotation) => (
                <div
                  key={quotation.id}
                  className="border rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">
                        {quotation.customers?.name || 'Counter Sale'}
                        {quotation.customers?.type && (
                          <span className="ml-2 text-sm text-gray-500">
                            ({quotation.customers.type})
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        Created: {format(new Date(quotation.created_at), 'PPp')}
                      </div>
                      <div className="text-sm text-gray-500">
                        Quotation #: {quotation.quotation_number}
                      </div>
                      <div className="text-sm font-medium mt-1">
                        Total: ₹{Number(quotation.total_amount).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Items: {(quotation.items || []).length}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onSelect(quotation.id)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Load Quotation"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(quotation.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete Quotation"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SavedQuotations;
