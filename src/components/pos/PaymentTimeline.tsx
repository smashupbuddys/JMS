import React from 'react';
import { format } from 'date-fns';
import { Clock, AlertCircle, CheckCircle, XCircle, Calendar, MessageSquare } from 'lucide-react';

interface PaymentTimelineProps {
  timeline: Array<{
    type: string;
    timestamp: string;
    message: string;
    response?: any;
  }>;
  staffResponses: Array<{
    timestamp: string;
    staff_id: string;
    action: string;
    note: string;
    next_action_date?: string;
  }>;
}

const STATUS_ICONS = {
  first_alert: AlertCircle,
  suspicious_alert: AlertCircle,
  admin_alert: AlertCircle,
  staff_response: MessageSquare,
  payment_promise: Calendar,
  payment_received: CheckCircle,
  payment_failed: XCircle
};

const STATUS_COLORS = {
  first_alert: 'text-yellow-500',
  suspicious_alert: 'text-orange-500',
  admin_alert: 'text-red-500',
  staff_response: 'text-blue-500',
  payment_promise: 'text-purple-500',
  payment_received: 'text-green-500',
  payment_failed: 'text-red-500'
};

const PaymentTimeline: React.FC<PaymentTimelineProps> = ({ timeline, staffResponses }) => {
  // Combine and sort all events by timestamp
  const allEvents = [
    ...timeline.map(event => ({
      ...event,
      isStaffResponse: false
    })),
    ...staffResponses.map(response => ({
      type: 'staff_response',
      timestamp: response.timestamp,
      message: response.note,
      isStaffResponse: true,
      staffId: response.staff_id,
      nextActionDate: response.next_action_date
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-4">
      <h3 className="font-medium flex items-center gap-2">
        <Clock className="h-5 w-5" />
        Payment Timeline
      </h3>

      <div className="space-y-4">
        {allEvents.map((event, index) => {
          const Icon = STATUS_ICONS[event.type as keyof typeof STATUS_ICONS] || Clock;
          const colorClass = STATUS_COLORS[event.type as keyof typeof STATUS_COLORS] || 'text-gray-500';

          return (
            <div key={index} className="flex gap-4">
              <div className={`flex-shrink-0 ${colorClass}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <p className="font-medium">{event.message}</p>
                  <span className="text-sm text-gray-500">
                    {format(new Date(event.timestamp), 'PPp')}
                  </span>
                </div>
                
                {event.isStaffResponse && event.nextActionDate && (
                  <p className="text-sm text-blue-600 mt-1">
                    Next follow-up: {format(new Date(event.nextActionDate), 'PP')}
                  </p>
                )}

                {event.response && (
                  <div className="mt-2 bg-gray-50 p-3 rounded-md">
                    <p className="text-sm">{event.response.message}</p>
                    {event.response.next_action && (
                      <p className="text-sm text-gray-500 mt-1">
                        Next action: {event.response.next_action}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {allEvents.length === 0 && (
          <p className="text-gray-500 text-center py-4">No payment events yet</p>
        )}
      </div>
    </div>
  );
};

export default PaymentTimeline;
