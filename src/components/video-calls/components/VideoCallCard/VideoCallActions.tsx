import React from 'react';
import { Video, Calendar, XCircle, Trash2 } from 'lucide-react';
import type { VideoCall } from '../../../../types';
import Swal from 'sweetalert2';

interface VideoCallActionsProps {
  call: VideoCall;
  onCompleteCall: (call: VideoCall, action: 'start' | 'complete' | 'reschedule' | 'cancel') => void;
  onDelete: () => void;
}

export const VideoCallActions: React.FC<VideoCallActionsProps> = ({
  call,
  onCompleteCall,
  onDelete
}) => {
  const handleStartCall = () => {
    const now = new Date();
    const scheduledTime = new Date(call.scheduled_at);
    const timeDiff = scheduledTime.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff > 0.083) { // 5 minutes
      Swal.fire({
        title: 'Start Early?',
        text: 'This call is scheduled for later. Are you sure you want to start it now?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Start Now',
        cancelButtonText: 'Cancel'
      }).then((result) => {
        if (result.isConfirmed) {
          onCompleteCall(call, 'scheduled');
        }
      });
    } else {
      onCompleteCall(call, 'scheduled');
    }
  };

  return (
    <div className="flex items-center justify-between pt-2 border-t">
      <div className="flex gap-2">
        {/* Show Ready/Reschedule/Cancel buttons for pending calls */}
        {call.status === 'scheduled' && (
          <div className="flex gap-2">
            <button
              onClick={() => onCompleteCall(call, 'start')}
              className="btn btn-primary bg-gradient-to-r from-green-600 to-green-700 flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <Video className="h-4 w-4" />
              <span>Ready</span>
            </button>
            <button
              onClick={() => onCompleteCall(call, 'reschedule')}
              className="btn btn-secondary flex items-center gap-2 shadow hover:shadow-md transition-shadow"
            >
              <Calendar className="h-4 w-4" />
              <span>Reschedule</span>
            </button>
            <button
              onClick={() => onCompleteCall(call, 'cancel')}
              className="btn btn-secondary bg-gradient-to-r from-red-600 to-red-700 text-white flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <XCircle className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          </div>
        )}
        
        {/* Show End/Reschedule/Cancel for in-progress calls */}
        {call.status === 'in_progress' && (
          <div className="flex gap-2">
            <button
              onClick={() => onCompleteCall(call, 'completed')}
              className="btn btn-primary bg-gradient-to-r from-green-600 to-green-700 flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <Video className="h-4 w-4" />
              <span>Complete</span>
            </button>
            <button
              onClick={() => onCompleteCall(call, 'scheduled')}
              className="btn btn-secondary flex items-center gap-2 shadow hover:shadow-md transition-shadow"
            >
              <Calendar className="h-4 w-4" />
              <span>Reschedule</span>
            </button>
            <button
              onClick={() => onCompleteCall(call, 'cancelled')}
              className="btn btn-secondary bg-gradient-to-r from-red-600 to-red-700 text-white flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <XCircle className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          </div>
        )}

        <button
          onClick={onDelete}
          className="p-2 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110"
          title="Delete Video Call"
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </button>
      </div>
    </div>
  );
};
