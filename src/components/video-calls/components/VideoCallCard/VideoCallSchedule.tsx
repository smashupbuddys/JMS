import React from 'react';
import { Clock } from 'lucide-react';
import type { VideoCall } from '../../../../types';
import { formatDateTime, getLocalTimeZone } from '../../../../utils/dateUtils';

interface VideoCallScheduleProps {
  call: VideoCall;
}

export const VideoCallSchedule: React.FC<VideoCallScheduleProps> = ({ call }) => {
  const customerTime = React.useMemo(() => {
    return formatDateTime(call.scheduled_at, call.time_zone || getLocalTimeZone()).local;
  }, [call.scheduled_at, call.time_zone]);

  const utcTime = React.useMemo(() => {
    return formatDateTime(call.scheduled_at).utc;
  }, [call.scheduled_at]);

  return (
    <div className={`rounded-lg p-3 ${getScheduleStyle(call)}`}>
      <div className="flex items-center gap-2 text-sm mb-1">
        <Clock className="h-4 w-4 text-gray-500" />
        <span className="font-medium">Scheduled Time</span>
      </div>
      <div className="space-y-1 ml-6">
        <div className={`text-sm ${getTimeStyle(call)}`}>Your time: {customerTime}</div>
        <div className="text-xs text-blue-600">{utcTime} (UTC)</div>
        {call.customer_time_zone && call.customer_time_zone !== getLocalTimeZone() && (
          <div className="text-xs text-purple-600">
            Customer's time: {formatDateTime(call.scheduled_at, call.customer_time_zone).local}
          </div>
        )}
      </div>
    </div>
  );
};

const getScheduleStyle = (call: VideoCall) => {
  const now = new Date();
  const scheduledTime = new Date(call.scheduled_at);
  const timeDiff = scheduledTime.getTime() - now.getTime();
  const minutesUntilCall = timeDiff / (1000 * 60);

  if (timeDiff < 0) {
    return 'bg-red-50/80';
  } else if (minutesUntilCall <= 15) {
    return 'bg-yellow-50/80';
  }
  
  return 'bg-gray-50';
};

const getTimeStyle = (call: VideoCall) => {
  const now = new Date();
  const scheduledTime = new Date(call.scheduled_at);
  const timeDiff = scheduledTime.getTime() - now.getTime();
  const minutesUntilCall = timeDiff / (1000 * 60);

  if (timeDiff < 0) {
    return 'text-red-700 font-medium';
  } else if (minutesUntilCall <= 15) {
    return 'text-yellow-700 font-medium';
  }
  
  return 'text-gray-700';
};
