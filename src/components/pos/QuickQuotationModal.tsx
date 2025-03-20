import React from 'react';
import { X, Calculator } from 'lucide-react';
import QuickQuotation from './QuickQuotation';
import type { VideoCall } from '../../types';
import { supabase } from '../../lib/supabase';

interface QuickQuotationModalProps {
  call: VideoCall;
  onClose: () => void;
  onComplete: () => void;
}

const QuickQuotationModal: React.FC<QuickQuotationModalProps> = ({
  call,
  onClose,
  onComplete
}) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b relative">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-50/80 to-gray-100/80 opacity-50 rounded-t-2xl -z-10" />
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-600" />
              Create Quotation
            </h2>
            <div className="text-sm text-gray-500 mt-1">
              <div className="font-mono text-blue-600">Video Call #{call.video_call_number}</div>
              <div>Customer: {call.customers?.name}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <QuickQuotation
            videoCall={call}
            onComplete={onComplete}
            customer={call.customers || null}
            disableCustomerSelect={true}
            initialCustomerType={call.customers?.type || 'retailer'}
          />
        </div>
      </div>
    </div>
  );
};

export default QuickQuotationModal;
