import React from 'react';
import { X, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface PaymentNoteModalProps {
  onClose: () => void;
  onSubmit: (data: {
    note: string;
    status: string;
    nextPaymentDate: string | null;
    staffId: string;
  }) => void;
}

const PAYMENT_NOTE_TYPES = [
  { value: 'customer_request', label: 'Customer Request' },
  { value: 'staff_follow_up', label: 'Staff Follow-up' },
  { value: 'payment_promise', label: 'Payment Promise' },
  { value: 'payment_failed', label: 'Payment Failed' },
  { value: 'payment_partial', label: 'Partial Payment' },
  { value: 'customer_issue', label: 'Customer Issue' }
];

const PaymentNoteModal: React.FC<PaymentNoteModalProps> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = React.useState({
    note: '',
    status: 'customer_request',
    nextPaymentDate: '',
    includeDate: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      note: formData.note,
      status: formData.status,
      nextPaymentDate: formData.includeDate ? formData.nextPaymentDate : null,
      staffId: localStorage.getItem('staffId') || ''
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Add Payment Note</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note Type
            </label>
            <select
              className="input"
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
            >
              {PAYMENT_NOTE_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note Details
            </label>
            <textarea
              className="input"
              rows={3}
              value={formData.note}
              onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
              placeholder="Enter details about the payment status..."
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeDate"
              checked={formData.includeDate}
              onChange={(e) => setFormData(prev => ({ ...prev, includeDate: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <label htmlFor="includeDate" className="text-sm text-gray-700">
              Set Next Payment Date
            </label>
          </div>

          {formData.includeDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Next Payment Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="date"
                  className="input pl-10"
                  value={formData.nextPaymentDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, nextPaymentDate: e.target.value }))}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  required={formData.includeDate}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              Add Note
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentNoteModal;
