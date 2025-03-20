import React from 'react';
import { UserCheck, UserX, ChevronDown, UserPlus } from 'lucide-react';
import { StaffSelector } from './StaffSelector';
import type { VideoCall, AssignedStaff } from '../../../../types';
import { format } from 'date-fns';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../hooks/useToast';

interface VideoCallStaffProps {
  call: VideoCall;
  assignedStaff: AssignedStaff | null;
  staff_role?: string;
  onAssignmentComplete: () => void;
  onAssignStaff?: (call: VideoCall) => void;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  active: boolean;
}

export const VideoCallStaff: React.FC<VideoCallStaffProps> = ({
  call,
  assignedStaff,
  staff_role,
  onAssignmentComplete,
  onAssignStaff
}) => {
  const [showStaffSelect, setShowStaffSelect] = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const { addToast } = useToast();
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStaffSelect(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Force refresh when assignedStaff changes
  React.useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [assignedStaff?.staff_name]);

  return (
    <div className="bg-gray-50/80 backdrop-blur-sm rounded-lg p-4 relative z-20" ref={dropdownRef}>
      <div className="flex items-center justify-between p-2 rounded-lg">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-blue-500" />
          <div>
            <span className="text-gray-700">Assigned to: </span>
            <span className="font-medium text-blue-600">{assignedStaff?.staff_name || 'Unassigned'}</span>
            {assignedStaff?.staff_role && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full ml-2">
                {assignedStaff.staff_role}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {assignedStaff?.history && assignedStaff.history.length > 0 && (
            <div className="text-xs text-gray-500">
              Assigned {format(new Date(assignedStaff.history[0].assigned_at), 'PP')}
            </div>
          )}
          <button
            onClick={() => setShowStaffChangeModal(true)}
            className="btn btn-secondary text-sm flex items-center gap-1"
          >
            <UserPlus className="h-4 w-4" />
            Change Staff
          </button>
          <UserPlus className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
        </div>
      </div>

      {showModal && (
        <StaffAssignmentModal
          call={call}
          onClose={() => setShowModal(false)}
          onAssign={() => {
            setShowModal(false);
            onAssignmentComplete();
          }}
        />
      )}
    </div>
  );
};
