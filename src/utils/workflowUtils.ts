import type { VideoCall } from '../types';

export const getCurrentStep = (status: Record<string, any>): string => {
  const workflowOrder = [
    'video_call',
    'quotation',
    'profiling',
    'payment',
    'qc',
    'packaging',
    'dispatch'
  ];

  // Find the first step that is in_progress
  const inProgressStep = workflowOrder.find(step => status[step] === 'in_progress');
  if (inProgressStep) return inProgressStep;

  // If no step is in_progress, find the first pending step
  const pendingStep = workflowOrder.find(step => status[step] === 'pending');
  if (pendingStep) return pendingStep;

  // If all steps are completed, return the last step
  if (workflowOrder.every(step => status[step] === 'completed')) {
    return workflowOrder[workflowOrder.length - 1];
  }

  // Default to first step
  return workflowOrder[0];
};

export const getRelevantWorkflowSteps = (status: Record<string, string>): string[] => {
  const workflowOrder = [
    'video_call',
    'quotation', 
    'profiling',
    'payment',
    'qc',
    'packaging',
    'dispatch'
  ];

  // Find the current active step
  let currentStepIndex = workflowOrder.findIndex(step => 
    status[step] === 'pending' || status[step] === 'in_progress'
  );

  // If no pending/in_progress step found, show all completed steps
  if (currentStepIndex === -1) {
    return workflowOrder.filter(step => status[step] === 'completed');
  }

  // Get all completed steps plus the current step and next step
  return workflowOrder.filter((step, index) => {
    // Include all completed steps
    if (status[step] === 'completed') return true;
    
    // Include current step
    if (index === currentStepIndex) return true;
    
    // Include next step if it exists
    if (index === currentStepIndex + 1) return true;
    
    return false;
  });
};

// Helper function to check if a step should be shown
export const shouldShowWorkflowStep = (
  step: string,
  status: VideoCall['workflow_status']
): boolean => {
  if (!status) return false;

  const workflowOrder = [
    'video_call',
    'quotation',
    'profiling', 
    'payment',
    'qc',
    'packaging',
    'dispatch'
  ];

  const stepIndex = workflowOrder.indexOf(step);
  const currentStepIndex = workflowOrder.findIndex(s => 
    status[s] === 'pending' || status[s] === 'in_progress'
  );

  // Show if:
  // 1. Step is completed
  // 2. Step is current step
  // 3. Step is next step
  return (
    status[step] === 'completed' ||
    stepIndex === currentStepIndex ||
    stepIndex === currentStepIndex + 1
  );
};

// Get the current active step
export const getCurrentWorkflowStep = (status: VideoCall['workflow_status']): string => {
  if (!status) return 'video_call';

  const workflowOrder = [
    'video_call',
    'quotation',
    'profiling',
    'payment', 
    'qc',
    'packaging',
    'dispatch'
  ];

  return workflowOrder.find(step => 
    status[step] === 'pending' || status[step] === 'in_progress'
  ) || 'completed';
};

// Get staff name for workflow step
export const getStaffName = (assignedStaff: Record<string, any> | undefined, step: string): string | null => {
  if (!assignedStaff) return null;

  // Get staff ID from the step-specific assignment or primary staff
  const staffId = assignedStaff[step]?.primary || assignedStaff.primary;
  if (!staffId) return null;

  // Return staff name from history if available
  const historyEntry = assignedStaff.history?.find((h: any) => h.staff_id === staffId && h.step === step);
  return historyEntry?.name || assignedStaff.staff_name || 'Staff Member';
};
