import React from 'react';
import { UserCheck, UserX, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../hooks/useToast';

interface StaffSelectorProps {
  videoCallId: string;
  currentStaffId: string | null;
  assignedStaff: {
    primary: string | null;
    staff_name: string;
    staff_role: string | null;
    backup: string | null;
    history: Array<{
      staff_id: string;
      name: string;
      role: string;
      assigned_at: string;
      assigned_by: string;
    }>;
  } | null;
  refreshKey: number;
  onAssignmentComplete: () => void;
}

export const StaffSelector: React.FC<StaffSelectorProps> = ({
  videoCallId,
  currentStaffId,
  assignedStaff,
  refreshKey,
  onAssignmentComplete
}) => {
  const [loading, setLoading] = React.useState(false);
  const [availableStaff, setAvailableStaff] = React.useState<Array<{
    id: string;
    name: string;
    role: string;
    active: boolean;
    available: boolean;
  }>>([]);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  React.useEffect(() => {
    fetchAvailableStaff();
  }, [refreshKey]);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAvailableStaff = async () => {
    try {
      // Get video call details first
      const { data: videoCall } = await supabase
        .from('video_calls')
        .select('scheduled_at')
        .eq('id', videoCallId)
        .single();

      if (!videoCall) {
        throw new Error('Video call not found');
      }

      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('active', true)
        .not('role', 'eq', 'admin')
        .order('name');

      if (staffError) throw staffError;

      // Get scheduled time in proper format
      const scheduledDate = new Date(videoCall.scheduled_at);
      const startTime = scheduledDate.toISOString().split('T')[1].slice(0, 8);
      const endTime = startTime; // Use same time since we don't track duration

      // Check availability for each staff member at the scheduled time
      const staffWithAvailability = await Promise.all((staffData || []).map(async (staff) => {
        const { data: isAvailable } = await supabase
          .rpc('check_staff_availability', {
            p_staff_id: staff.id,
            p_date: scheduledDate.toISOString().split('T')[0],
            p_start_time: startTime,
            p_end_time: endTime
          });
        
        return {
          ...staff,
          available: isAvailable === true || staff.id === currentStaffId
        };
      }));

      setAvailableStaff(staffWithAvailability);
    } catch (error) {
      console.error('Error fetching available staff:', error);
      addToast({
        title: 'Error',
        message: 'Failed to check staff availability',
        type: 'error'
      });
    }
  };

  const handleStaffChange = async (staffId: string) => {
    try {
      setLoading(true);
      
      // Check if staff is available before assigning
      const staffMember = availableStaff.find(s => s.id === staffId);
      if (staffMember && !staffMember.available && staffId !== currentStaffId) {
        addToast({
          title: 'Error',
          message: 'Selected staff member is not available at this time',
          type: 'error'
        });
        return;
      }

      // Get staff details first
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('id', staffId)
        .single();

      if (staffError) throw staffError;

      // Update video call with new staff and assigned_staff details
      const { error: updateError } = await supabase.from('video_calls').update({
        staff_id: staffId,
        assigned_staff: {
          primary: staffId,
          staff_name: staffData.name,
          staff_role: staffData.role,
          backup: null,
          history: [
            ...(assignedStaff?.history || []),
            {
              staff_id: staffId,
              name: staffData.name,
              role: staffData.role,
              assigned_at: new Date().toISOString(),
              assigned_by: 'system'
            }
          ]
        }
      }).eq('id', videoCallId);

      if (updateError) throw updateError;

      addToast({
        title: 'Success',
        message: 'Staff reassigned successfully',
        type: 'success'
      });

      // Wait a bit before completing to allow state to update
      setTimeout(() => {
        onAssignmentComplete();
      }, 100);

      setShowDropdown(false);
    } catch (error) {
      console.error('Error reassigning staff:', error);
      addToast({
        title: 'Error',
        message: 'Failed to reassign staff',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Current Staff Display */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-full flex items-center justify-between p-2 bg-white rounded-lg border hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {assignedStaff?.staff_name ? (
            <>
              <UserCheck className="h-4 w-4 text-green-500" />
              <span className="font-medium">{assignedStaff.staff_name}</span>
              {assignedStaff.staff_role && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  {assignedStaff.staff_role}
                </span>
              )}
            </>
          ) : (
            <>
              <UserX className="h-4 w-4 text-red-500" />
              <span className="text-gray-500">Unassigned</span>
            </>
          )}
        </div>
        {showDropdown ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {/* Staff Selection Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="max-h-64 overflow-y-auto py-1">
            {availableStaff.map(staff => (
              <button
                key={staff.id}
                onClick={() => handleStaffChange(staff.id)}
                disabled={loading || (!staff.available && staff.id !== currentStaffId)} 
                className={`w-full text-left px-4 py-2 flex items-center justify-between ${
                  loading ? 'opacity-50 cursor-not-allowed' : 
                  !staff.available && staff.id !== currentStaffId ? 'opacity-75 bg-red-50/50' :
                  'hover:bg-gray-50/80'
                }`}
              >
                <div>
                  <div className="font-medium text-gray-900">{staff.name}</div>
                  <div className="text-xs text-gray-500">{staff.role}</div>
                </div>
                <div className="flex items-center gap-2">
                  {staff.id === currentStaffId && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                  {!staff.available && staff.id !== currentStaffId && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full whitespace-nowrap">
                      Unavailable
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
