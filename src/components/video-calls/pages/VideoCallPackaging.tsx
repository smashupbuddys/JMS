import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Loader2, AlertCircle, Box, CheckCircle } from 'lucide-react';
import type { VideoCall } from '../../../types';

const VideoCallPackaging = () => {
  const { callId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [call, setCall] = React.useState<VideoCall | null>(null);
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (!callId) return;
    fetchVideoCall();
  }, [callId]);

  const fetchVideoCall = async () => {
    try {
      const { data, error } = await supabase
        .from('video_calls')
        .select(`
          *,
          customers (
            name,
            phone,
            type,
            address,
            city,
            state,
            pincode
          ),
          quotations (
            id,
            items
          )
        `)
        .eq('id', callId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Video call not found');

      setCall(data);
      if (data.packaging_details?.notes) {
        setNotes(data.packaging_details.notes);
      }
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

  const handleCompletePackaging = async () => {
    try {
      const { error } = await supabase
        .from('video_calls')
        .update({
          workflow_status: {
            ...call?.workflow_status,
            packaging: 'completed',
            dispatch: 'pending'
          },
          packaging_details: {
            packed_at: new Date().toISOString(),
            packed_by: localStorage.getItem('staffId'),
            notes
          }
        })
        .eq('id', callId);

      if (error) throw error;
      navigate(`/video-calls/${callId}`);
    } catch (error) {
      console.error('Error completing packaging:', error);
      alert('Error updating packaging status. Please try again.');
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
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100">
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-6">Packaging Details</h2>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-medium mb-2">Shipping Address</h3>
          <div className="text-gray-600">
            <p className="font-medium">{call.customers?.name}</p>
            <p>{call.customers?.address}</p>
            <p>{call.customers?.city}, {call.customers?.state} {call.customers?.pincode}</p>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Packaging Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input w-full"
            rows={3}
            placeholder="Add any packaging notes or special instructions..."
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => navigate(`/video-calls/${callId}`)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleCompletePackaging}
            className="btn btn-primary flex items-center gap-2"
          >
            <Box className="h-4 w-4" />
            Complete Packaging
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCallPackaging;
