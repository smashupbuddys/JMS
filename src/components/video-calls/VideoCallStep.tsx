import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertCircle, Calendar, XCircle, Video } from 'lucide-react';
import type { VideoCall } from '../../types';
import { ConfirmationModal } from './components/ConfirmationModal';
import VideoCallForm from './VideoCallForm';

interface VideoCallStepProps {
  step: string;
}

const VideoCallStep: React.FC<VideoCallStepProps> = ({ step }) => {
  const { callId } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [call, setCall] = React.useState<VideoCall | null>(null);
  const [showConfirmation, setShowConfirmation] = React.useState(false);
  const [showRescheduleForm, setShowRescheduleForm] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!callId) return;
    fetchVideoCall();
  }, [callId]);

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

  const handleCompleteCall = async (action: 'complete' | 'reschedule' | 'cancel') => {
    try {
      const workflowUpdate = {
        ...call?.workflow_status,
        video_call: action === 'complete' ? 'completed' : action === 'cancel' ? 'rejected' : 'pending',
        quotation: action === 'complete' ? 'pending' : call?.workflow_status?.quotation || 'pending'
      };

      const newStatus = action === 'complete' ? 'completed' : action === 'cancel' ? 'cancelled' : 'scheduled';

      // Update video call status
      const { error: updateError } = await supabase
        .from('video_calls')
        .update({
          workflow_status: workflowUpdate,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', callId);

      if (updateError) throw updateError;

      // Create notification
      const staffId = localStorage.getItem('staffId');
      if (staffId) {
        await supabase.from('notifications').insert([{
          user_id: staffId,
          type: `video_call_${action}`,
          title: `Video Call ${action === 'complete' ? 'Completed' : action === 'cancel' ? 'Cancelled' : 'Rescheduled'}`,
          message: `Video call with ${call?.customers?.name} has been ${action === 'complete' ? 'completed' : action === 'cancel' ? 'cancelled' : 'rescheduled'}`,
          data: {
            call_id: callId,
            action: action
          }
        }]);
      }

      // Handle navigation based on action
      if (action === 'complete') {
        navigate(`/video-calls/${callId}/quotation`);
      } else if (action === 'reschedule') {
        navigate(`/video-calls/${callId}?reschedule=true`);
      } else {
        navigate(`/video-calls/${callId}`);
      }
    } catch (error) {
      console.error('Error completing call:', error);
      alert('Error updating call status. Please try again.');
    }
  };

  const handleReschedule = async (callData: any) => {
    try {
      const { error } = await supabase
        .from('video_calls')
        .update({
          scheduled_at: callData.scheduledAt,
          staff_id: callData.staffId,
          notes: callData.notes,
          workflow_status: {
            ...call?.workflow_status,
            video_call: 'pending'
          },
          status: 'scheduled'
        })
        .eq('id', callId);

      if (error) throw error;
      navigate(`/video-calls/${callId}`);
    } catch (error) {
      console.error('Error rescheduling call:', error);
      alert('Error rescheduling call. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-gray-500">Loading {step.toLowerCase()}...</p>
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
            onClick={() => navigate(`/video-calls/${callId}`)}
            className="btn btn-secondary mt-4"
          >
            Return to Video Call
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Video Call Actions</h2>
          <p className="text-sm text-gray-500">
            Call #{call.video_call_number} with {call.customers?.name}
          </p>
          <div className="text-xs text-gray-500 mt-1">
            Current Status: {call.workflow_status?.video_call || 'pending'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <button
          onClick={() => handleCompleteCall('complete')}
          className="btn btn-primary bg-gradient-to-r from-green-600 to-green-700 flex items-center justify-center gap-2"
        >
          <Video className="h-5 w-5" />
          <span>Complete Call</span>
        </button>

        <button
          onClick={() => handleCompleteCall('reschedule')}
          className="btn btn-secondary flex items-center justify-center gap-2"
        >
          <Calendar className="h-5 w-5" />
          <span>Reschedule Call</span>
        </button>

        <button
          onClick={() => setShowConfirmation(true)}
          className="btn btn-secondary bg-gradient-to-r from-red-600 to-red-700 text-white flex items-center justify-center gap-2"
        >
          <XCircle className="h-5 w-5" />
          <span>Cancel Call</span>
        </button>
      </div>

      {showConfirmation && (
        <ConfirmationModal
          call={call}
          onConfirm={(call, action) => {
            if (action === 'reschedule') {
              setShowRescheduleForm(true);
            } else {
              handleCompleteCall(action);
            }
          }}
          onReschedule={() => setShowRescheduleForm(true)}
          onClose={() => setShowConfirmation(false)}
        />
      )}

      {showRescheduleForm && (
        <VideoCallForm
          call={call}
          customers={[call.customers!]}
          onClose={() => setShowRescheduleForm(false)}
          onSubmit={handleReschedule}
        />
      )}
    </div>
  );
};

export default VideoCallStep;
