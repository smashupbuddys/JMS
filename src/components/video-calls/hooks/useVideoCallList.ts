import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import type { VideoCall, Customer } from '../../../types';
import { fetchWithRetry } from '../../../lib/supabase';
import { useToast } from '../../../hooks/useToast';
import { format } from 'date-fns';

export const useVideoCallList = () => {
  const [calls, setCalls] = useState<VideoCall[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('scheduled');
  const [showForm, setShowForm] = useState(false);
  const [editingCall, setEditingCall] = useState<VideoCall | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState<VideoCall | undefined>();
  const [showFutureCallWarning, setShowFutureCallWarning] = useState<VideoCall | undefined>();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showQuotationModal, setShowQuotationModal] = useState<VideoCall | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'today' | 'upcoming' | 'overdue'>('all');

  useEffect(() => {
    fetchCalls();
    fetchCustomers();
  }, []);

  const fetchCalls = async () => {
    try {
      setError(null);
      const { data, error } = await fetchWithRetry(
        () => supabase
        .from('video_calls')
        .select(`
          *,
          customers (
            name,
            email,
            phone,
            type
          )
        `)
        .order('scheduled_at', { ascending: true }),
        {
          maxRetries: 5,
          retryDelay: 1000,
          onRetry: (attempt) => {
            addToast({
              title: 'Connection Issue',
              message: `Retrying to load video calls... (Attempt ${attempt + 1}/5)`,
              type: 'warning'
            });
          }
        }
      );

      if (error) throw error;
      if (!data) throw new Error('No data returned from database');
      
      setCalls(data || []);
    } catch (error) {
      setError('Unable to load video calls. Please check your connection and try again.');
      console.error('Error fetching video calls:', error);
      addToast({
        title: 'Connection Error',
        message: 'Failed to load video calls. Please check your internet connection.',
        type: 'error',
        duration: 10000
      });
      
      // Return empty array to prevent undefined errors
      setCalls([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      setError(null);
      const { data, error } = await fetchWithRetry(
        () => 
        supabase
          .from('customers')
          .select('*')
          .order('name'),
        {
          maxRetries: 5,
          retryDelay: 1000,
          onRetry: (attempt) => {
            addToast({
              title: 'Connection Issue',
              message: `Retrying to load customers... (Attempt ${attempt + 1}/5)`,
              type: 'warning'
            });
          },
          shouldRetry: (error) => {
            // Retry on network errors or 5xx server errors
            return (
              error.message === 'Failed to fetch' ||
              error.message?.includes('NetworkError') ||
              error.message?.includes('network') ||
              error.status === 503 ||
              error.status === 504
            );
          }
        }
      );

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      setError('Unable to load customers. Please check your connection and try again.');
      console.error('Error fetching customers:', error);
      addToast({
        title: 'Connection Error',
        message: 'Failed to load customers. Please check your internet connection.',
        type: 'error',
        duration: 10000 // Show for 10 seconds
      });
      
      // Return empty array to prevent undefined errors
      setCustomers([]);
    }
  };

  const handleAddCall = async (callData: any) => {
    try {
      if (!callData.staffId) {
        throw new Error('Staff ID not found. Please log in again.');
      }

      const { data, error } = await supabase
        .from('video_calls')
        .insert([{
          customer_id: callData.customerId,
          staff_id: callData.staffId || '',
          scheduled_at: callData.scheduledAt,
          status: 'scheduled',
          notes: callData.notes,
          payment_status: 'pending',
          payment_due_date: callData.quotationRequired ? callData.paymentDueDate : null,
          workflow_status: {
            video_call: 'pending',
            quotation: 'pending',
            profiling: 'pending',
            payment: 'pending',
            qc: 'pending',
            packaging: 'pending',
            dispatch: 'pending'
          }
        }])
        .select()
        .single();

      if (error) throw error;
      setCalls(prev => [data, ...prev]);
      setShowForm(false);
      addToast({
        title: 'Video Call Scheduled',
        message: 'The video call has been scheduled successfully.',
        type: 'success'
      });
    } catch (error) {
      console.error('Error adding video call:', error);
      addToast({
        title: 'Error',
        message: error.message || 'Error scheduling video call. Please try again.',
        type: 'error'
      });
    }
  };

  const handleUpdateCall = async (callData: any) => {
    if (!editingCall) return;
    
    try {
      const { data, error } = await supabase
        .from('video_calls')
        .update({
          customer_id: callData.customerId,
          staff_id: callData.staffId,
          scheduled_at: callData.scheduledAt,
          notes: callData.notes,
          quotation_required: callData.quotationRequired,
          payment_status: callData.paymentDueDate ? callData.paymentDueDate : null
        })
        .eq('id', editingCall.id)
        .select()
        .single();

      if (error) throw error;
      setCalls(prev => prev.map(call => call.id === editingCall.id ? data : call));
      setEditingCall(undefined);
      setShowForm(false);
    } catch (error) {
      console.error('Error updating video call:', error);
      alert('Error updating video call. Please try again.');
    }
  };

  const handleDeleteCall = async (callId: string) => {
    if (!window.confirm('Are you sure you want to delete this video call?')) return;

    try {
      // First, delete workflow assignments
      const { error: workflowError } = await supabase
        .from('workflow_assignments')
        .delete()
        .eq('video_call_id', callId);

      if (workflowError) throw workflowError;

      // First, get all quotations associated with this video call
      const { data: quotations, error: quotationError } = await supabase
        .from('quotations')
        .select('id')
        .eq('video_call_id', callId);

      if (quotationError) throw quotationError;

      // If there are quotations, delete them
      if (quotations && quotations.length > 0) {
        const quotationIds = quotations.map(q => q.id);
        const { error: deleteQuotationsError } = await supabase
          .from('quotations')
          .delete()
          .in('id', quotationIds);

        if (deleteQuotationsError) throw deleteQuotationsError;
      }

      // Now, delete the video call
      const { error: deleteCallError } = await supabase
        .from('video_calls')
        .delete()
        .eq('id', callId);

      if (deleteCallError) throw deleteCallError;

      setCalls(prev => prev.filter(call => call.id !== callId));
      setShowDeleteConfirm(null);
    } catch (error: any) {
      console.error('Error deleting video call:', error);
      alert('Error deleting video call. Please try again.');
    }
  };

  const handleCompleteCall = async (call: VideoCall, action: 'start' | 'complete' | 'reschedule' | 'cancel') => {
    try {
      if (!call || !call.id) {
        addToast({
          title: 'Error',
          message: 'Invalid video call data',
          type: 'error'
        });
        return;
      }

      let notificationTitle = '';
      let notificationMessage = '';
      let notificationType: 'success' | 'info' | 'warning' = 'info';
      let workflowUpdate = call.workflow_status || {
        video_call: 'pending',
        quotation: 'pending',
        profiling: 'pending',
        payment: 'pending',
        qc: 'pending',
        packaging: 'pending',
        dispatch: 'pending'
      };
      let newStatus = call.status;
      let redirectUrl: string | null = null;

      switch (action) {
        case 'start':
          workflowUpdate.video_call = 'in_progress';
          newStatus = 'in_progress';
          notificationTitle = 'Video Call Started';
          notificationMessage = `Video call with ${call.customers?.name} has started`;
          notificationType = 'info';
          redirectUrl = `/video-calls/${call.id}/complete`;
          break;

        case 'complete':
          workflowUpdate.video_call = 'completed';
          workflowUpdate.quotation = 'pending';
          newStatus = 'completed';
          notificationTitle = 'Video Call Completed';
          notificationMessage = `Video call with ${call.customers?.name} has been completed`;
          notificationType = 'success';
          redirectUrl = `/video-calls/${call.id}/quotation`;
          break;

        case 'reschedule':
          workflowUpdate.video_call = 'pending';
          newStatus = 'scheduled';
          notificationTitle = 'Video Call Rescheduled';
          notificationMessage = `Video call with ${call.customers?.name} has been rescheduled`;
          notificationType = 'info';
          break;

        case 'cancel':
          workflowUpdate.video_call = 'rejected';
          newStatus = 'cancelled';
          notificationTitle = 'Video Call Cancelled';
          notificationMessage = `Video call with ${call.customers?.name} has been cancelled`;
          notificationType = 'warning';
          break;
      }

      // Update video call status
      const { data: updatedCall, error: updateError } = await supabase
        .from('video_calls')
        .update({
          workflow_status: workflowUpdate,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', call.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Update calls list with new status
      setCalls(prev => prev.map(c => c.id === call.id ? updatedCall : c));

      // Show toast notification
      addToast({
        title: notificationTitle,
        message: notificationMessage,
        type: notificationType,
        duration: 5000
      });

      // Create notification in database
      const staffId = localStorage.getItem('staffId');
      if (staffId && !error) {
        const { error: notificationError } = await supabase.from('notifications').insert([{
          user_id: staffId,
          type: `video_call_${action}`,
          title: notificationTitle,
          message: notificationMessage,
          data: {
            call_id: call.id,
            call_number: call.video_call_number,
            customer_name: call.customers?.name,
            scheduled_at: call.scheduled_at,
            action: action
          }
        }]);

        if (notificationError) {
          console.error('Error creating notification:', notificationError);
        }
      }

      // Handle post-action workflow
      if (action === 'reschedule') {
        setEditingCall(call);
        setShowForm(true);
      } else if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        // Refresh the list for other actions
        fetchCalls();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update video call status';
      console.error('Error handling call action:', errorMessage);
      addToast({
        title: 'Error',
        message: errorMessage,
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleConfirmCall = async (call: VideoCall, action: 'start' | 'complete' | 'cancel') => {
    try {
      let workflowUpdate;
      let status;
      let redirectUrl;

      switch (action) {
        case 'start':
          workflowUpdate = {
            ...call.workflow_status,
            video_call: 'in_progress',
            quotation: call.quotation_required ? 'pending' : 'completed'
          };
          status = 'in_progress';
          redirectUrl = `/video-calls/${call.id}/video`;
          break;

        case 'complete':
          workflowUpdate = {
            ...call.workflow_status,
            video_call: 'completed',
            quotation: 'pending'
          };
          status = 'completed';
          redirectUrl = `/video-calls/${call.id}/quotation`;
          break;

        case 'cancel':
          workflowUpdate = {
            ...call.workflow_status,
            video_call: 'rejected'
          };
          status = 'cancelled';
          break;

        default:
          throw new Error('Invalid action');
      }

      const { error: updateError } = await supabase
        .from('video_calls')
        .update({
          workflow_status: workflowUpdate,
          status: status
        })
        .eq('id', call.id);

      if (updateError) throw updateError;

      // Create notification for staff
      const notificationData = {
        user_id: call.staff_id,
        type: `video_call_${action}ed`,
        title: `Video Call ${action === 'start' ? 'Started' : action === 'complete' ? 'Completed' : 'Cancelled'}`,
        message: `Video call with ${call.customers?.name} has been ${action === 'start' ? 'started' : action === 'complete' ? 'completed' : 'cancelled'}.`,
        data: {
          call_id: call.id,
          call_number: call.video_call_number,
          action: action
        }
      };

      await supabase.from('notifications').insert([notificationData]);

      // Handle redirection and feedback
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        alert(`Video call ${action === 'cancel' ? 'cancelled' : 'updated'} successfully.`);
        fetchCalls(); // Refresh the list
      }

    } catch (error) {
      console.error('Error updating call:', error);
      alert('Error updating video call. Please try again.');
    } finally {
      setShowConfirmationModal(null);
    }
  };

  const handleReschedule = (call: VideoCall) => {
    // Reset workflow status to pending when rescheduling
    const resetWorkflowStatus = {
      ...call.workflow_status,
      video_call: 'pending'
    };

    // Update the call's workflow status first
    supabase
      .from('video_calls')
      .update({
        workflow_status: resetWorkflowStatus
      })
      .eq('id', call.id)
      .then(({ error }) => {
        if (error) {
          console.error('Error resetting workflow status:', error);
          return;
        }
        // Then show the edit form
        setEditingCall({
          ...call,
          workflow_status: resetWorkflowStatus
        });
        setShowForm(true);
        setShowConfirmationModal(null);
      });
  };

  return {
    state: {
      calls,
      customers,
      error,
      searchTerm,
      activeTab,
      showForm,
      editingCall,
      loading,
      showDeleteConfirm,
      sortOrder,
      priorityFilter,
      showQuotationModal
    },
    actions: {
      setCalls,
      setCustomers,
      setSearchTerm,
      setActiveTab,
      setShowForm,
      setEditingCall,
      setShowDeleteConfirm,
      setSortOrder,
      setPriorityFilter,
      setShowQuotationModal,
      handleAddCall,
      handleUpdateCall,
      handleDeleteCall,
      fetchCalls,
      fetchCustomers,
      handleCompleteCall
    }
  };
};
