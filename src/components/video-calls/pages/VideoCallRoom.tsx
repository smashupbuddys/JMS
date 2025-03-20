import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Loader2, AlertCircle, Video, Microscope as Microphone, PhoneOff, Settings, UserCheck } from 'lucide-react';
import type { VideoCall } from '../../../types';
import { StaffActionModal } from '../components/StaffActionModal';

const VideoCallRoom = () => {
  const { callId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [call, setCall] = React.useState<VideoCall | null>(null);
  const [showCompleteModal, setShowCompleteModal] = React.useState(false);
  const [deviceStatus, setDeviceStatus] = React.useState({
    camera: true,
    microphone: true
  });
  const [duration, setDuration] = React.useState(0);
  const durationInterval = React.useRef<NodeJS.Timeout>();

  React.useEffect(() => {
    if (!callId) return;
    fetchVideoCall();
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
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
          )
        `)
        .eq('id', callId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Video call not found');

      setCall(data);
      startCallTimer();
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

  const startCallTimer = () => {
    durationInterval.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = async () => {
    try {
      const { error } = await supabase
        .from('video_calls')
        .update({
          workflow_status: {
            ...call?.workflow_status,
            video_call: 'completed',
            quotation: 'pending'
          }
        })
        .eq('id', callId);

      if (error) throw error;
      navigate(`/video-calls/${callId}/quotation`);
    } catch (error) {
      console.error('Error ending call:', error);
      alert('Error updating call status. Please try again.');
    }
  };

  const handleCallComplete = () => {
    setShowCompleteModal(true);
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
    <div className="fixed inset-0 bg-gray-900 text-white">
      <div className="h-full flex flex-col">
        {/* Video Area */}
        <div className="flex-1 relative">
          {/* Main video container */}
          <div id="remote-video" className="absolute inset-0">
            {/* Remote video will be inserted here by WebRTC */}
          </div>
          
          {/* Local video preview */}
          <div className="absolute bottom-4 right-4 w-48 h-36 bg-black rounded-lg overflow-hidden">
            <video
              id="local-video"
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>

          {/* Call Duration */}
          <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5">
            {formatDuration(duration)}
          </div>

          {/* Customer Info */}
          <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5">
            <div className="font-medium">{call.customers?.name}</div>
            <div className="text-sm text-gray-400">{call.customers?.phone}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="h-20 bg-gray-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDeviceStatus(prev => ({ ...prev, camera: !prev.camera }))}
              className={`p-3 rounded-full ${deviceStatus.camera ? 'bg-blue-600' : 'bg-red-600'}`}
            >
              <Video className="h-6 w-6" />
            </button>
            <button
              onClick={() => setDeviceStatus(prev => ({ ...prev, microphone: !prev.microphone }))}
              className={`p-3 rounded-full ${deviceStatus.microphone ? 'bg-blue-600' : 'bg-red-600'}`}
            >
              <Microphone className="h-6 w-6" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {/* Open settings modal */}}
              className="p-3 rounded-full bg-gray-700 hover:bg-gray-600"
            >
              <Settings className="h-6 w-6" />
            </button>
            <button
              onClick={handleCallComplete}
              className="p-3 rounded-full bg-green-600 hover:bg-green-700"
            >
              <UserCheck className="h-6 w-6" />
            </button>
            <button
              onClick={handleEndCall}
              className="p-3 rounded-full bg-red-600 hover:bg-red-700"
            >
              <PhoneOff className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Complete Call Modal */}
      {showCompleteModal && call && (
        <StaffActionModal
          call={call}
          onClose={() => setShowCompleteModal(false)}
          onComplete={() => navigate(`/video-calls/${callId}/quotation`)}
          onError={(error) => {
            setError(error);
            setShowCompleteModal(false);
          }}
        />
      )}
    </div>
  );
};

export default VideoCallRoom;
