import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Loader2, AlertCircle, ArrowLeft, Video, Clock, UserCheck, FileText, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useVideoCallRealtime } from '../../../hooks/useVideoCallRealtime';

interface VideoCallLog {
  event_type: string;
  old_data: any;
  new_data: any;
  changed_by_name: string;
  created_at: string;
}

const EVENT_ICONS = {
  created: Video,
  rescheduled: Clock,
  staff_assigned: UserCheck,
  staff_changed: UserCheck,
  status_changed: RefreshCw,
  workflow_updated: FileText,
  cancelled: AlertCircle,
  deleted: AlertCircle
};

const EVENT_COLORS = {
  created: 'text-blue-600 bg-blue-100',
  rescheduled: 'text-purple-600 bg-purple-100',
  staff_assigned: 'text-green-600 bg-green-100',
  staff_changed: 'text-amber-600 bg-amber-100',
  status_changed: 'text-orange-600 bg-orange-100',
  workflow_updated: 'text-indigo-600 bg-indigo-100',
  cancelled: 'text-red-600 bg-red-100',
  deleted: 'text-red-600 bg-red-100'
};

const VideoCallLogs = () => {
  const { callId } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [logs, setLogs] = React.useState<VideoCallLog[]>([]);
  const [call, setCall] = React.useState<any>(null);

  // Add real-time updates
  useVideoCallRealtime(callId, () => {
    fetchLogs();
  });

  React.useEffect(() => {
    if (!callId) return;
    fetchCallDetails();
    fetchLogs();
  }, [callId]);

  const fetchCallDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('video_calls')
        .select(`
          *,
          customers (
            name,
            phone,
            type
          )
        `)
        .eq('id', callId)
        .single();

      if (error) throw error;
      setCall(data);
    } catch (error) {
      console.error('Error fetching call details:', error);
      setError('Failed to load video call details');
    }
  };

  const fetchLogs = async () => {
    try {
      setError(null);
      const { data, error } = await supabase.rpc(
        'get_video_call_logs',
        { p_video_call_id: callId }
      );

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
      setError('Failed to load video call logs');
    } finally {
      setLoading(false);
    }
  };

  const formatLogMessage = (log: VideoCallLog) => {
    switch (log.event_type) {
      case 'created':
        return 'Video call was created';
      
      case 'rescheduled':
        return `Rescheduled from ${format(new Date(log.old_data.scheduled_at), 'PPp')} to ${format(new Date(log.new_data.scheduled_at), 'PPp')}`;
      
      case 'staff_assigned':
        return `Assigned to ${log.new_data.assigned_staff.staff_name}`;
      
      case 'staff_changed':
        return `Staff changed from ${log.old_data.assigned_staff.staff_name} to ${log.new_data.assigned_staff.staff_name}`;
      
      case 'status_changed':
        return `Status changed from ${log.old_data.status} to ${log.new_data.status}`;
      
      case 'workflow_updated':
        const changes = Object.entries(log.new_data.workflow_status).filter(
          ([key, value]) => value !== log.old_data.workflow_status[key]
        );
        return changes.map(([step, status]) => 
          `${step.replace('_', ' ')} status changed to ${status}`
        ).join(', ');
      
      case 'cancelled':
        return 'Video call was cancelled';
      
      case 'deleted':
        return 'Video call was deleted';
      
      default:
        return 'Unknown event';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-red-100 p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <div className="text-red-600 font-medium">{error || 'Video call not found'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            to={`/video-calls/${callId}`}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Video Call
          </Link>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Activity Log
          </h2>
        </div>
        <button
          onClick={fetchLogs}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Call Details */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm text-gray-500">Video Call</div>
            <div className="font-medium text-lg">{call.video_call_number}</div>
            <div className="text-sm text-gray-600 mt-1">
              Customer: {call.customers?.name}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Scheduled For</div>
            <div className="font-medium">{format(new Date(call.scheduled_at), 'PPp')}</div>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
        <h3 className="font-medium mb-6">Activity Timeline</h3>
        <div className="space-y-6">
          {logs.length > 0 ? (
            logs.map((log, index) => {
              const Icon = EVENT_ICONS[log.event_type as keyof typeof EVENT_ICONS] || AlertCircle;
              const colorClass = EVENT_COLORS[log.event_type as keyof typeof EVENT_COLORS] || 'text-gray-600 bg-gray-100';
              
              return (
                <div key={index} className="flex gap-4">
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full ${colorClass} flex items-center justify-center`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          {formatLogMessage(log)}
                        </p>
                        {log.changed_by_name && (
                          <p className="text-sm text-gray-500">
                            by {log.changed_by_name}
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {format(new Date(log.created_at), 'PPp')}
                      </div>
                    </div>

                    {/* Show detailed changes for workflow updates */}
                    {log.event_type === 'workflow_updated' && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(log.new_data.workflow_status)
                          .filter(([key, value]) => value !== log.old_data.workflow_status[key])
                          .map(([step, status], i) => (
                            <div key={i} className="text-sm">
                              <span className="text-gray-600">{step.replace('_', ' ')}:</span>
                              <span className="text-gray-500"> {log.old_data.workflow_status[step]}</span>
                              <span className="text-gray-400"> → </span>
                              <span className="font-medium">{status as string}</span>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              No activity logs found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCallLogs;
