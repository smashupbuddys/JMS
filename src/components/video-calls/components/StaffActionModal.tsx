import React from 'react';
import { X, Video, UserCheck, AlertCircle } from 'lucide-react';
import type { VideoCall } from '../../../types';
import { supabase } from '../../../lib/supabase';

interface StaffActionModalProps {
  call: VideoCall;
  onClose: () => void;
  onComplete: () => void;
  onError?: (error: string) => void;
}

export const StaffActionModal: React.FC<StaffActionModalProps> = ({
  call,
  onClose,
  onComplete,
  onError
}) => {
  const [notes, setNotes] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleComplete = async () => {
    try {
      setLoading(true);

      // Update video call status
      const { error: updateError } = await supabase
        .from('video_calls')
        .update({
          status: 'completed',
          workflow_status: {
            ...call.workflow_status,
            video_call: 'completed',
            quotation: 'pending'
          },
          notes: notes ? `${call.notes ? call.notes + '\n' : ''}Staff Notes: ${notes}` : call.notes
        })
        .eq('id', call.id);

      if (updateError) throw updateError;

      // Create notification
      await supabase.from('notifications').insert([{
        user_id: call.customer_id,
        type: 'video_call_completed',
        title: 'Video Call Completed',
        message: `Your video call with ${call.assigned_staff?.staff_name} has been completed.`,
        data: {
          video_call_id: call.id, 
          video_call_number: call.video_call_number
        }
      }]);

      onComplete();
    } catch (error) {
      console.error('Error completing video call:', error);
      onError?.(error.message || 'Failed to complete video call');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl w-full max-w-md mx-4 shadow-xl border border-gray-100"> 
        <div className="flex justify-between items-center p-6 border-b relative">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-50/80 to-gray-100/80 opacity-50 rounded-t-2xl -z-10" />
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Video className="h-5 w-5 text-blue-600" />
              Complete Video Call
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Call #{call.video_call_number}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Staff Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input w-full"
                rows={3}
                placeholder="Add any notes about the video call..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={onClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleComplete}
                disabled={loading}
                className="btn btn-primary bg-gradient-to-r from-green-600 to-green-700 flex items-center gap-2"
              >
                <UserCheck className="h-4 w-4" />
                {loading ? 'Completing...' : 'Complete Call'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
