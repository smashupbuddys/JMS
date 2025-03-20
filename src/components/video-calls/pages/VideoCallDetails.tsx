import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Loader2, AlertCircle } from 'lucide-react';
import type { VideoCall } from '../../../types';
import { VideoCallCard } from '../components/VideoCallCard';
import { WorkflowProgress } from '../components/WorkflowProgress';
import { WorkflowHistory } from '../components/WorkflowHistory';
import { WorkflowAlerts } from '../components/WorkflowAlerts';
import { StaffAssignment } from '../components/StaffAssignment';
import { WorkflowNotes } from '../components/WorkflowNotes';

const VideoCallDetails = () => {
  const { callId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [call, setCall] = React.useState<VideoCall | null>(null);
  const [workflowHistory, setWorkflowHistory] = React.useState([]);

  React.useEffect(() => {
    if (!callId) return;
    fetchVideoCall();
    fetchWorkflowHistory();
  }, [callId]);

  const fetchWorkflowHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('workflow_history')
        .select('*')
        .eq('video_call_id', callId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkflowHistory(data || []);
    } catch (error) {
      console.error('Error fetching workflow history:', error);
    }
  };

  const fetchVideoCall = async () => {
    try {
      setError(null);
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
      if (!data) throw new Error('Video call not found');

      setCall(data);
    } catch (error) {
      console.error('Error fetching video call:', error);
      setError(
        error instanceof Error 
          ? error.message 
          : 'Failed to load video call details'
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-gray-500">Loading video call details...</p>
        </div>
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-red-100 p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <div className="text-red-600 font-medium">{error || 'Video call not found'}</div>
          <button
            onClick={() => navigate('/video-calls')}
            className="btn btn-secondary mt-4"
          >
            Return to Video Calls
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WorkflowAlerts call={call} />
      <StaffAssignment call={call} onAssign={fetchVideoCall} />
      <WorkflowProgress call={call} />
      <WorkflowHistory history={workflowHistory} />
      <WorkflowNotes 
        videoCallId={call.id} 
        currentStep={Object.entries(call.workflow_status || {}).find(
          ([_, status]) => status === 'pending' || status === 'in_progress'
        )?.[0] || 'video_call'}
      />
      <VideoCallCard
        call={call}
        onCompleteCall={() => {}}
        onDelete={() => {}}
        priorityClass=""
        priorityBadge={{ text: '', color: '' }}
        assignedStaff={call.assigned_staff}
        onCreateQuotation={() => {}}
      />
      
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-lg font-semibold mb-4">Workflow Progress</h2>
        <WorkflowStatus
          status={call.workflow_status || {}}
          callId={call.id}
          callNumber={call.video_call_number}
          quotationId={call.quotation_id}
          assignedStaff={call.assigned_staff}
          call={call}
          onCreateQuotation={() => {}}
        />
      </div>
    </div>
  );
};

export default VideoCallDetails;
