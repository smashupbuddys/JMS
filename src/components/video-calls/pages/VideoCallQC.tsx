import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Loader2, AlertCircle, CheckCircle, X } from 'lucide-react';
import type { VideoCall } from '../../../types';

const VideoCallQC = () => {
  const { callId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [call, setCall] = React.useState<VideoCall | null>(null);
  const [qcChecks, setQcChecks] = React.useState({
    pieces_checked: false,
    chains_checked: false,
    dori_checked: false
  });
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
            type
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
      if (data.qc_details) {
        setQcChecks(data.qc_details);
        setNotes(data.qc_details.notes || '');
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

  const handleCompleteQC = async () => {
    try {
      const { error } = await supabase
        .from('video_calls')
        .update({
          workflow_status: {
            ...call?.workflow_status,
            qc: 'completed',
            packaging: 'pending'
          },
          qc_details: {
            ...qcChecks,
            notes,
            checked_at: new Date().toISOString(),
            checked_by: localStorage.getItem('staffId')
          }
        })
        .eq('id', callId);

      if (error) throw error;
      navigate(`/video-calls/${callId}`);
    } catch (error) {
      console.error('Error completing QC:', error);
      alert('Error updating QC status. Please try again.');
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

  const allChecksCompleted = Object.values(qcChecks).every(check => check);

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100">
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-6">Quality Check</h2>

        <div className="space-y-4 mb-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={qcChecks.pieces_checked}
              onChange={(e) => setQcChecks(prev => ({ ...prev, pieces_checked: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <span>All pieces checked and verified</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={qcChecks.chains_checked}
              onChange={(e) => setQcChecks(prev => ({ ...prev, chains_checked: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <span>Chains verified and attached</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={qcChecks.dori_checked}
              onChange={(e) => setQcChecks(prev => ({ ...prev, dori_checked: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <span>Dori checked and secured</span>
          </label>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input w-full"
            rows={3}
            placeholder="Add any QC notes or observations..."
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
            onClick={handleCompleteQC}
            disabled={!allChecksCompleted}
            className="btn btn-primary flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Complete QC
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCallQC;
