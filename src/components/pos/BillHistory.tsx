import React, { useState, useEffect } from 'react';
import { Search, Calendar, FileText, Download, Filter, ArrowUpDown, Eye, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/quotation';
import { formatPhoneNumber } from '../../utils/phoneUtils';
import PrintPreview from './QuickQuotation/components/PrintPreview';
import { useToast } from '../../hooks/useToast';

const BillHistory = () => {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showPrintPreview, setShowPrintPreview] = useState<string | null>(null);
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string[] | null>(null);
  const [deletedBills, setDeletedBills] = useState<any[]>([]);
  const { addToast } = useToast();

  useEffect(() => {
    fetchBills();
    fetchDeletedBills();
  }, [dateFilter, statusFilter, sortOrder]);

  const fetchDeletedBills = async () => {
    try {
      const { data, error } = await supabase
        .from('deleted_quotations')
        .select('*')
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      setDeletedBills(data || []);
    } catch (error) {
      console.error('Error fetching deleted bills:', error);
    }
  };

  const fetchBills = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('quotations')
        .select(`
          *,
          customers (
            name,
            phone,
            type
          )
        `)
        .order('created_at', { ascending: sortOrder === 'asc' });

      // Apply date filter
      if (dateFilter) {
        const startDate = new Date(dateFilter);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        query = query
          .gte('created_at', startDate.toISOString())
          .lt('created_at', endDate.toISOString());
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('bill_status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBills(data || []);
    } catch (error) {
      console.error('Error fetching bills:', error);
      addToast({
        title: 'Error',
        message: 'Failed to load bills',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredBills = bills.filter(bill => {
    const searchString = searchTerm.toLowerCase();
    const customerName = bill.customers?.name?.toLowerCase() || '';
    const customerPhone = bill.customers?.phone?.toLowerCase() || '';
    const billNumber = bill.quotation_number?.toLowerCase() || '';
    
    return customerName.includes(searchString) ||
           customerPhone.includes(searchString) ||
           billNumber.includes(searchString);
  });

  const handleViewBill = (bill: any) => {
    setShowPrintPreview(bill.id);
  };

  const handleDeleteBill = async (billId: string) => {
    try {
      const { error } = await supabase
        .from('quotations')
        .delete()
        .eq('id', billId);

      if (error) throw error;

      setBills(prev => prev.filter(bill => bill.id !== billId));
      addToast({
        title: 'Success',
        message: 'Bill deleted successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Error deleting bill:', error);
      addToast({
        title: 'Error',
        message: 'Failed to delete bill',
        type: 'error'
      });
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
          Bill History
        </h2>
        {selectedBills.size > 0 && (
          <button
            onClick={() => setShowDeleteConfirm(Array.from(selectedBills))}
            className="btn btn-primary bg-red-600 hover:bg-red-700 flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected ({selectedBills.size})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search bills..."
              className="input pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="input w-full"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>

          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="btn btn-secondary flex items-center gap-2"
          >
            <ArrowUpDown className="h-4 w-4" />
            Sort by Date
          </button>
        </div>
      </div>

      {/* Bills List */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedBills.size === filteredBills.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBills(new Set(filteredBills.map(b => b.id)));
                      } else {
                        setSelectedBills(new Set());
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBills.map((bill) => (
                <tr key={bill.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedBills.has(bill.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedBills);
                        if (e.target.checked) {
                          newSelected.add(bill.id);
                        } else {
                          newSelected.delete(bill.id);
                        }
                        setSelectedBills(newSelected);
                      }}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{bill.quotation_number}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{bill.customers?.name || 'Counter Sale'}</div>
                    {bill.customers?.phone && (
                      <div className="text-sm text-gray-500">{formatPhoneNumber(bill.customers.phone)}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{format(new Date(bill.created_at), 'PPp')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{formatCurrency(bill.total_amount)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      bill.bill_status === 'paid' ? 'bg-green-100 text-green-800' :
                      bill.bill_status === 'overdue' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {bill.bill_status.charAt(0).toUpperCase() + bill.bill_status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleViewBill(bill)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View Bill"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm([bill.id])}
                        className="text-red-600 hover:text-red-900"
                        title="Delete Bill"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading bills...</p>
            </div>
          )}

          {!loading && filteredBills.length === 0 && (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No bills found</p>
            </div>
          )}
        </div>

        {/* Deleted Bills Section */}
        {deletedBills.length > 0 && (
          <div className="mt-8 border-t pt-8">
            <h3 className="text-lg font-medium mb-4">Recently Deleted Bills</h3>
            <div className="space-y-4">
              {deletedBills.map(bill => (
                <div key={bill.id} className="bg-gray-50 p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-medium">{bill.quotation_number}</div>
                    <div className="text-sm text-gray-500">
                      Deleted on {format(new Date(bill.deleted_at), 'PPp')}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const { error } = await supabase
                          .from('quotations')
                          .insert([{
                            ...bill,
                            id: undefined,
                            deleted_at: undefined
                          }]);

                        if (error) throw error;

                        await supabase
                          .from('deleted_quotations')
                          .delete()
                          .eq('id', bill.id);

                        addToast({
                          title: 'Success',
                          message: 'Bill restored successfully',
                          type: 'success'
                        });

                        fetchBills();
                        fetchDeletedBills();
                      } catch (error) {
                        console.error('Error restoring bill:', error);
                        addToast({
                          title: 'Error',
                          message: 'Failed to restore bill',
                          type: 'error'
                        });
                      }
                    }}
                    className="btn btn-secondary"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl w-full max-w-md mx-4 shadow-xl border border-gray-100">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4 text-red-600">
                <AlertCircle className="h-6 w-6" />
                <h3 className="text-lg font-semibold">
                  Delete {showDeleteConfirm.length > 1 ? `${showDeleteConfirm.length} Bills` : 'Bill'}
                </h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete {showDeleteConfirm.length > 1 ? 'these bills' : 'this bill'}?
                You can restore them within 30 days.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      // Move bills to deleted_quotations table
                      const billsToDelete = bills.filter(b => showDeleteConfirm.includes(b.id));
                      const { error: moveError } = await supabase
                        .from('deleted_quotations')
                        .insert(billsToDelete.map(bill => ({
                          ...bill,
                          deleted_at: new Date().toISOString()
                        })));

                      if (moveError) throw moveError;

                      // Delete from quotations
                      const { error: deleteError } = await supabase
                        .from('quotations')
                        .delete()
                        .in('id', showDeleteConfirm);

                      if (deleteError) throw deleteError;

                      setBills(prev => prev.filter(b => !showDeleteConfirm.includes(b.id)));
                      setShowDeleteConfirm(null);
                      setSelectedBills(new Set());
                      fetchDeletedBills();

                      addToast({
                        title: 'Success',
                        message: `${showDeleteConfirm.length} bill(s) moved to trash`,
                        type: 'success'
                      });
                    } catch (error) {
                      console.error('Error deleting bills:', error);
                      addToast({
                        title: 'Error',
                        message: 'Failed to delete bills',
                        type: 'error'
                      });
                    }
                  }}
                  className="btn btn-primary bg-red-600 hover:bg-red-700"
                >
                  Delete Bill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {showPrintPreview && (
        <PrintPreview
          onClose={() => setShowPrintPreview(null)}
          items={bills.find(b => b.id === showPrintPreview)?.items || []}
          customerType={bills.find(b => b.id === showPrintPreview)?.customers?.type || 'retailer'}
          customer={bills.find(b => b.id === showPrintPreview)?.customers}
          totals={{
            subtotal: bills.find(b => b.id === showPrintPreview)?.total_amount || 0,
            discountAmount: 0,
            total: bills.find(b => b.id === showPrintPreview)?.total_amount || 0,
            gstAmount: 0,
            finalTotal: bills.find(b => b.id === showPrintPreview)?.total_amount || 0
          }}
          discount={0}
          gstRate={18}
          includeGst={true}
        />
      )}
    </div>
  );
};

export default BillHistory;