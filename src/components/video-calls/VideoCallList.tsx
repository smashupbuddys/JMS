import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useVideoCallList } from './hooks/useVideoCallList';
import { SearchHeader } from './components/SearchHeader';
import { WorkflowTabs } from './components/WorkflowTabs';
import { VideoCallCard } from './components/VideoCallCard';
import QuickQuotationModal from '../pos/QuickQuotationModal';
import { EmptyState } from './components/EmptyState';
import VideoCallForm from './VideoCallForm';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const VideoCallList = () => {
  const { state, actions } = useVideoCallList();
  const [showQuotationModal, setShowQuotationModal] = useState<VideoCall | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'today' | 'upcoming' | 'overdue'>('all');

  // Add real-time subscription for all video calls
  useEffect(() => {
    const channel = supabase
      .channel('video_calls_list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_calls'
        },
        () => {
          // Refresh the list when any video call changes
          fetchCalls();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    actions.fetchCalls();
  }, []);

  const filterCallsByTab = (calls: VideoCall[]) => {
    switch (state.activeTab) {
      case 'scheduled':
        return calls.filter(call => call.status === 'scheduled');
      case 'video_call':
        return calls.filter(call => call.status === 'in_progress');
      case 'completed':
        return calls.filter(call => call.status === 'completed');
      default:
        return calls;
    }
  };

  const getTabCount = (tabId: string) => {
    if (tabId === 'scheduled') {
      return state.calls.filter(call => call.status === 'scheduled').length;
    }
    
    if (tabId === 'completed') {
      return state.calls.filter(call =>
        Object.values(call.workflow_status || {}).every(status => status === 'completed')
      ).length;
    }
    
    // For workflow steps, check if previous steps are completed
    const workflowOrder = [
      'video_call',
      'quotation', 
      'profiling',
      'payment',
      'qc',
      'packaging',
      'dispatch'
    ];
    
    const currentStepIndex = workflowOrder.indexOf(tabId);
    
    return state.calls.filter(call => {
      // Check if all previous steps are completed
      const previousStepsCompleted = workflowOrder
        .slice(0, currentStepIndex)
        .every(step => call.workflow_status?.[step] === 'completed');
      
      // Current step must be pending or in_progress
      const currentStepPending = call.workflow_status?.[tabId] === 'pending' ||
                               call.workflow_status?.[tabId] === 'in_progress';
      
      return previousStepsCompleted && currentStepPending;
    }).length;
  };

  const getPriorityClass = (call: VideoCall) => {
    const now = new Date();
    const scheduledTime = new Date(call.scheduled_at);
    const timeDiff = scheduledTime.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff < 0) return 'bg-red-50 border-red-200'; // Overdue
    if (hoursDiff <= 24) return 'bg-yellow-50 border-yellow-200'; // Within 24 hours
    if (hoursDiff <= 48) return 'bg-blue-50 border-blue-200'; // Within 48 hours
    return 'bg-white/90 border-gray-100/80'; // Default
  };

  const getPriorityBadge = (call: VideoCall) => {
    const now = new Date();
    const scheduledTime = new Date(call.scheduled_at);
    const timeDiff = scheduledTime.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff < 0) {
      return {
        text: 'Overdue',
        color: 'bg-red-100 text-red-800'
      };
    }
    if (hoursDiff <= 24) {
      return {
        text: 'Today',
        color: 'bg-yellow-100 text-yellow-800'
      };
    }
    if (hoursDiff <= 48) {
      return {
        text: 'Tomorrow',
        color: 'bg-blue-100 text-blue-800'
      };
    }
    return {
      text: format(scheduledTime, 'dd MMM'),
      color: 'bg-gray-100 text-gray-800'
    };
  };

  const filteredCalls = state.calls.filter(call => {
    const searchString = state.searchTerm.toLowerCase();
    const customerName = call.customers?.name.toLowerCase() || '';
    const customerEmail = call.customers?.email?.toLowerCase() || '';
    const customerPhone = call.customers?.phone.toLowerCase() || '';
    
    let matchesSearch = customerName.includes(searchString) ||
           customerEmail.includes(searchString) ||
           customerPhone.includes(searchString);
    
    let matchesPriority = true;
    const now = new Date();
    const scheduledTime = new Date(call.scheduled_at);
    const timeDiff = scheduledTime.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    switch (state.priorityFilter) {
      case 'today':
        matchesPriority = hoursDiff >= 0 && hoursDiff <= 24;
        break;
      case 'upcoming':
        matchesPriority = hoursDiff > 24;
        break;
      case 'overdue':
        matchesPriority = hoursDiff < 0;
        break;
    }

    return matchesSearch && matchesPriority && filterCallsByTab([call]).length > 0;
  }).sort((a, b) => {
    const timeA = new Date(a.scheduled_at).getTime();
    const timeB = new Date(b.scheduled_at).getTime();
    return state.sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
  });

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
            ),
            staff (
              name,
              role
            )
          `)
          .order('scheduled_at', { ascending: true }),
        {
          maxRetries: 3,
          retryDelay: 1000,
          onRetry: (attempt) => {
            addToast({
              title: 'Connection Issue',
              message: `Retrying to load video calls... (Attempt ${attempt + 1}/3)`,
              type: 'warning'
            });
          }
        }
      );

      if (error) throw error;
      if (!data) throw new Error('No data returned from database');
      
      setCalls(data || []);
      setError(null);
    } catch (error) {
      console.error('Error fetching video calls:', error);
      addToast({
        title: 'Connection Error',
        message: 'Failed to load video calls. Please check your internet connection.',
        type: 'error',
        duration: 10000 // Show for 10 seconds
      });
      
      // Return empty array to prevent undefined errors
      setCalls([]);
    } finally {
      setLoading(false);
    }
  };

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {state.error && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-center gap-3">
          <div className="text-red-600">{state.error}</div>
          <button
            onClick={actions.fetchCustomers}
            className="btn btn-secondary text-sm"
          >
            Retry
          </button>
        </div>
      )}

      <SearchHeader
        searchTerm={state.searchTerm}
        onSearchChange={actions.setSearchTerm}
        priorityFilter={state.priorityFilter}
        onPriorityFilterChange={actions.setPriorityFilter}
        sortOrder={state.sortOrder}
        onSortOrderChange={() => actions.setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
        onScheduleClick={() => actions.setShowForm(true)}
      />

      <WorkflowTabs
        activeTab={state.activeTab}
        onTabChange={actions.setActiveTab}
        getTabCount={getTabCount}
      />

      <div className="grid grid-cols-1 gap-6">
        {filteredCalls.map((call) => (
          <VideoCallCard
            key={call.id}
            call={call}
            onCompleteCall={actions.handleCompleteCall}
            onDelete={actions.handleDeleteCall}
            priorityClass={getPriorityClass(call)}
            priorityBadge={getPriorityBadge(call)} 
            assignedStaff={call.assigned_staff || null}
            onCreateQuotation={() => setShowQuotationModal(call)}
          />
        ))}
        
        {filteredCalls.length === 0 && !state.loading && (
          <EmptyState
            searchTerm={state.searchTerm}
            activeTab={state.activeTab}
            tabLabel="Video Calls"
          />
        )}
      </div>

      {(state.showForm || state.editingCall) && (
        <VideoCallForm
          call={state.editingCall}
          customers={state.customers}
          onClose={() => {
            actions.setShowForm(false);
            actions.setEditingCall(undefined);
          }}
          onSubmit={state.editingCall ? actions.handleUpdateCall : actions.handleAddCall}
        />
      )}

      {showQuotationModal && (
        <QuickQuotationModal
          call={showQuotationModal}
          onClose={() => setShowQuotationModal(null)}
          onComplete={() => {
            setShowQuotationModal(null);
            actions.fetchCalls();
          }}
        />
      )}
    </div>
  );
};

export default VideoCallList;
