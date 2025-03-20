import React from 'react';
import { User, Phone, Mail, MapPin } from 'lucide-react';
import type { VideoCall } from '../../../../types';
import { formatPhoneNumber } from '../../../../utils/phoneUtils';

interface VideoCallHeaderProps {
  call: VideoCall;
  priorityBadge: {
    text: string;
    color: string;
  };
}

export const VideoCallHeader: React.FC<VideoCallHeaderProps> = ({ call, priorityBadge }) => {
  return (
    <div className="flex justify-between items-start">
      <div className="flex items-start gap-4">
        <div className={`h-12 w-12 rounded-full flex items-center justify-center shadow-inner ${getAvatarStyle(call)}`}>
          <User className="h-6 w-6 text-blue-600" />
        </div>
        
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{call.customers?.name}</h3>
            <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              #{call.video_call_number}
            </span>
          </div>
          
          {/* Customer Contact Info */}
          <div className="mt-1 space-y-0.5">
            {call.customers?.phone && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Phone className="h-3.5 w-3.5" />
                <span>{formatPhoneNumber(call.customers.phone)}</span>
              </div>
            )}
            {call.customers?.email && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Mail className="h-3.5 w-3.5" />
                <span>{call.customers.email}</span>
              </div>
            )}
            {(call.customers?.city || call.customers?.state) && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <MapPin className="h-3.5 w-3.5" />
                <span>
                  {[call.customers.city, call.customers.state].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex flex-col items-end gap-2">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${priorityBadge.color}`}>
          {priorityBadge.text}
        </span>
        <span className={`text-xs ${
          call.status === 'scheduled' ? 'bg-blue-50 text-blue-700' :
          call.status === 'in_progress' ? 'bg-yellow-50 text-yellow-700' :
          call.status === 'completed' ? 'bg-green-50 text-green-700' :
          'bg-red-50 text-red-700'
        } px-2 py-0.5 rounded-full`}>
          {call.status.charAt(0).toUpperCase() + call.status.slice(1)}
        </span>
      </div>
    </div>
  );
};

const getAvatarStyle = (call: VideoCall) => {
  const now = new Date();
  const scheduledTime = new Date(call.scheduled_at);
  const timeDiff = scheduledTime.getTime() - now.getTime();
  const minutesUntilCall = timeDiff / (1000 * 60);

  if (timeDiff < 0) {
    // Overdue - red gradient
    return 'bg-gradient-to-br from-red-100 to-red-200';
  } else if (minutesUntilCall <= 15) {
    // Starting soon - yellow gradient
    return 'bg-gradient-to-br from-yellow-100 to-yellow-200';
  }
  
  // Default blue gradient
  return 'bg-gradient-to-br from-blue-100 to-blue-200';
};
