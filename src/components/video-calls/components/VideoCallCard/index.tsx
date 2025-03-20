import React from 'react';
import { useNavigate } from 'react-router-dom';
import { VideoCallHeader } from './VideoCallHeader';
import { VideoCallStaff } from './VideoCallStaff';
import { VideoCallSchedule } from './VideoCallSchedule';
import { VideoCallWorkflow } from './VideoCallWorkflow';
import { VideoCallActions } from './VideoCallActions';
import { VideoCallDeleteDialog } from './VideoCallDeleteDialog';
import StaffChangeModal from '../StaffChangeModal';
import type { VideoCall, AssignedStaff } from '../../../../types';
import { useVideoCallRealtime } from '../../../../hooks/useVideoCallRealtime';

interface PriorityBadge {
  text: string;
  color: string;
}

interface VideoCallCardProps {
  call: VideoCall;
  onCompleteCall: (call: VideoCall, action: 'start' | 'complete' | 'reschedule' | 'cancel') => void;
  onDelete: (callId: string) => void;
  priorityClass: string;
  priorityBadge: PriorityBadge;
  assignedStaff: AssignedStaff | null;
  staff_role?: string;
  onAssignStaff?: (call: VideoCall) => void;
  onCreateQuotation: (call: VideoCall) => void;
}

const getCardStyle = (call: VideoCall) => {
  const now = new Date();
  const scheduledTime = new Date(call.scheduled_at);
  const timeDiff = scheduledTime.getTime() - now.getTime();
  const minutesUntilCall = timeDiff / (1000 * 60);

  if (timeDiff < 0) {
    // Overdue - light red background
    return 'bg-red-50/90 border-red-200';
  } else if (minutesUntilCall <= 15) {
    // Starting soon (within 15 minutes) - light yellow background
    return 'bg-yellow-50/90 border-yellow-200';
  }
  
  // Default style
  return 'bg-white/90 border-gray-100';
};

export const VideoCallCard: React.FC<VideoCallCardProps> = ({
  call,
  onCompleteCall,
  onDelete,
  priorityClass,
  priorityBadge,
  assignedStaff,
  staff_role,
  onAssignStaff,
  onCreateQuotation
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showStaffChangeModal, setShowStaffChangeModal] = React.useState(false);
  const navigate = useNavigate();

  // Add real-time updates
  useVideoCallRealtime(call.id, () => {
    // Refresh the component when data changes
    window.location.reload();
  });

  const handleDelete = () => {
    onDelete(call.id);
    setShowDeleteConfirm(false);
  };

  return (
    <div 
      className={`group relative backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border ${getCardStyle(call)}`}
      data-priority={priorityClass}
      data-status={call.status}
    >
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/5 to-gray-900/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative p-6 space-y-4">
        {/* Customer and Call Info */}
        <VideoCallHeader 
          call={call}
          priorityBadge={priorityBadge}
        />

        {/* Staff Assignment */}
        <VideoCallStaff
          call={call}
          assignedStaff={assignedStaff}
          staff_role={staff_role}
          onAssignStaff={onAssignStaff}
          onAssignmentComplete={() => window.location.reload()}
        />

        {/* Schedule Info */}
        <VideoCallSchedule call={call} />

        {/* Workflow Status */}
        <VideoCallWorkflow
          call={call}
          onCreateQuotation={onCreateQuotation}
        />

        {/* Action Buttons */}
        <VideoCallActions
          call={call}
          onCompleteCall={onCompleteCall}
          onDelete={() => setShowDeleteConfirm(true)}
        />
      </div>

      {/* Staff Change Modal */}
      {showStaffChangeModal && (
        <StaffChangeModal
          call={call}
          onClose={() => setShowStaffChangeModal(false)}
          onStaffChange={() => window.location.reload()}
        />
      )}

      {/* Delete Confirmation */}
      <VideoCallDeleteDialog
        call={call}
        assignedStaff={assignedStaff}
        showDialog={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
};
