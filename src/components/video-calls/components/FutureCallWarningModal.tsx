import React from 'react';
import { X } from 'lucide-react';
import type { VideoCall } from '../../../types';
import { format } from 'date-fns';

interface FutureCallWarningModalProps {
  call: VideoCall;
  onConfirm: () => void;
  onClose: () => void;
}

export const FutureCallWarningModal: React.FC<FutureCallWarningModalProps> = ({
  call,
  onConfirm,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl w-full max-w-md mx-4 p-6 shadow-xl border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Warning: Future Call</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-gray-700 mb-4">
          This video call is scheduled for {format(new Date(call.scheduled_at), 'PPp')}.
          Are you sure you want to start it now?
        </p>
        <div className="flex justify-end gap-4">
          <button 
            onClick={onConfirm}
            className="btn btn-primary bg-gradient-to-r from-blue-600 to-blue-700"
          >
            Yes, Start Now
          </button>
          <button 
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
