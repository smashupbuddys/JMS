import React from 'react';
import { Clock, DollarSign, AlertTriangle, CheckCircle, Plus } from 'lucide-react';
import { format } from 'date-fns';
import PaymentNoteModal from './PaymentNoteModal';
import PaymentTimeline from './PaymentTimeline';

interface PaymentStatusProps {
  quotationId: string;
  billStatus: string;
  billAmount: number;
  billGeneratedAt: string;
  paymentTimeline: any[];
  staffResponses: any[];
  onAddNote: (data: any) => void;
}

const PaymentStatus: React.FC<PaymentStatusProps> = ({
  quotationId,
  billStatus,
  billAmount,
  billGeneratedAt,
  paymentTimeline,
  staffResponses,
  onAddNote
}) => {
  const [showNoteModal, setShowNoteModal] = React.useState(false);

  const getStatusColor = () => {
    switch (billStatus) {
      case 'paid':
        return 'text-green-600';
      case 'overdue':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (billStatus) {
      case 'paid':
        return CheckCircle;
      case 'overdue':
        return AlertTriangle;
      case 'pending':
        return Clock;
      default:
        return DollarSign;
    }
  };

  const StatusIcon = getStatusIcon();

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className={`flex items-center gap-2 ${getStatusColor()}`}>
            <StatusIcon className="h-5 w-5" />
            <h3 className="font-medium">
              Payment Status: {billStatus.charAt(0).toUpperCase() + billStatus.slice(1)}
            </h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Bill generated on {format(new Date(billGeneratedAt), 'PPp')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-medium">₹{billAmount.toLocaleString()}</p>
          <button
            onClick={() => setShowNoteModal(true)}
            className="btn btn-secondary mt-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Note
          </button>
        </div>
      </div>

      {/* Payment Timeline */}
      <PaymentTimeline
        timeline={paymentTimeline}
        staffResponses={staffResponses}
      />

      {/* Payment Note Modal */}
      {showNoteModal && (
        <PaymentNoteModal
          onClose={() => setShowNoteModal(false)}
          onSubmit={async (data) => {
            await onAddNote(data);
            setShowNoteModal(false);
          }}
        />
      )}
    </div>
  );
};

export default PaymentStatus;
