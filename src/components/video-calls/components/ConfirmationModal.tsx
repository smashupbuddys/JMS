import React from 'react';
import { X, Video, FileText, Calendar, XCircle, AlertCircle, Clock } from 'lucide-react';
import type { VideoCall } from '../../../types';
import { format } from 'date-fns';

interface ConfirmationModalProps {
  call: VideoCall;
  onConfirm: (call: VideoCall, action: 'complete' | 'reschedule' | 'cancel') => void;
  onReschedule: (call: VideoCall) => void;
  onClose: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  call,
  onConfirm,
  onReschedule,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl w-full max-w-md mx-4 shadow-xl border border-gray-100">
        <div className="flex justify-between items-center p-6 border-b relative">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-50/80 to-gray-100/80 opacity-50 rounded-t-2xl -z-10" />
          <div>
            <h2 className="text-lg font-semibold">Video Call Actions</h2>
            <p className="text-sm text-gray-500 mt-1">
              Call #{call.video_call_number}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              <span className="font-medium">Video Call Details</span>
            </div>
            <div className="text-gray-700">
              <div className="mb-1">Customer: <span className="font-medium">{call.customers?.name}</span></div>
              <div className="text-sm text-gray-600">
                Scheduled for: {format(new Date(call.scheduled_at), 'PPp')}
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 gap-4">
              {/* Complete Call Button */}
              <button
                onClick={() => onConfirm(call, 'cancel')}
                className="btn btn-primary bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2"
              >
                <XCircle className="h-5 w-5" />
                <span>Cancel Call</span>
              </button>

              {/* Reschedule Button */}
              <button
                onClick={() => onConfirm(call, 'reschedule')}
                className="btn btn-secondary flex items-center gap-2"
              >
                <Calendar className="h-5 w-5" />
                <span>Reschedule Call</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
