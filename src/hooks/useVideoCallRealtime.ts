import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from './useToast';

export const useVideoCallRealtime = (
  callId: string | undefined,
  onUpdate: () => void
) => {
  const { addToast } = useToast();

  useEffect(() => {
    if (!callId) return;

    // Create channel for video call updates
    const channel = supabase
      .channel(`video_call_${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_calls',
          filter: `id=eq.${callId}`
        },
        async (payload) => {
          try {
            // Fetch complete updated video call data
            const { data: updatedCall, error } = await supabase
              .from('video_calls')
              .select(`
                *,
                customers (
                  name,
                  phone,
                  type
                ),
                staff (
                  name,
                  role
                )
              `)
              .eq('id', callId)
              .single();

            if (error) throw error;

            // Check for specific changes
            if (payload.new.staff_id !== payload.old.staff_id) {
              addToast({ 
                title: 'Staff Assignment Updated',
                message: `Staff assignment updated to ${updatedCall.staff?.name || 'Unassigned'}`,
                type: 'info'
              });
            }

            if (payload.new.workflow_status !== payload.old.workflow_status) {
              const newStatus = payload.new.workflow_status;
              const oldStatus = payload.old.workflow_status;
              
              Object.keys(newStatus).forEach(step => {
                if (newStatus[step] !== oldStatus[step]) {
                  addToast({
                    title: 'Workflow Updated',
                    message: `${step.replace('_', ' ')} status changed to ${newStatus[step]}`,
                    type: 'info'
                  });
                }
              });
            }

            // Trigger update callback
            onUpdate();
          } catch (error) {
            console.error('Error handling video call update:', error);
            addToast({
              title: 'Update Error',
              message: 'Failed to process video call update',
              type: 'error'
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [callId, onUpdate]);
};
