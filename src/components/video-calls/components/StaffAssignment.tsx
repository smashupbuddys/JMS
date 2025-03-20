import React from 'react';
import { User, UserPlus, UserCheck } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { VideoCall } from '../../../types';

interface StaffAssignmentProps {
  call: VideoCall;
  onAssign: () => void;
  onError?: (error: string) => void;
}

export const StaffAssignment: React.FC<StaffAssignmentProps> = ({ call, onAssign, onError }) => {
  const [availableStaff, setAvailableStaff] = React.useState<Array<{
    id: string;
    name: string;
    role: string;
    available: boolean;
  }>>([]);
  const [selectedStaffId, setSelectedStaffId] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);
  const [checkingAvailability, setCheckingAvailability] = React.useState(false);

  React.useEffect(() => {
    fetchAvailableStaff();
  }, []);

  // Check staff availability when call date changes
  React.useEffect(() => {
    if (call.scheduled_at) {
      checkStaffAvailability();
    }
  }, [call.scheduled_at]);

  const checkStaffAvailability = async () => {
    try {
      setCheckingAvailability(true);
      const startTime = new Date(call.scheduled_at);
      const endTime = new Date(startTime.getTime() + 30 * 60000); // 30 minutes

      // Check availability for all active staff
      const availabilityPromises = availableStaff.map(async (staff) => {
        const { data: isAvailable } = await supabase
          .rpc('check_staff_availability', {
            p_staff_id: staff.id,
            p_date: startTime.toISOString().split('T')[0],
            p_start_time: startTime.toISOString().split('T')[1].slice(0, 8),
            p_end_time: endTime.toISOString().split('T')[1].slice(0, 8)
          });
        
        return { ...staff, available: isAvailable };
      });

      const staffWithAvailability = await Promise.all(availabilityPromises);
      setAvailableStaff(staffWithAvailability);
    } catch (error) {
      console.error('Error checking staff availability:', error);
      onError?.('Failed to check staff availability');
    } finally {
      setCheckingAvailability(false);
    }
  };

  const fetchAvailableStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('id, name, role')
        .eq('active', true)
        .not('role', 'eq', 'admin') // Exclude admin from assignments
        .order('name');

      if (error) throw error;
      setAvailableStaff(data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
      onError?.('Failed to load available staff');
    }
  };

  const handleAssign = async () => {
    if (!selectedStaffId) return;

    try {
      setLoading(true);
      // First get staff details
      const { data: staffMember, error: staffError } = await supabase
        .from('staff')
        .select('id, name, role')
        .eq('id', selectedStaffId)
        .single();

      if (staffError || !staffMember) {
        throw new Error('Selected staff member not found');
      }

      const { error } = await supabase
        .from('video_calls')
        .update({
          staff_id: selectedStaffId, // Set staff_id directly
          assigned_staff: {
            primary: selectedStaffId,
            staff_name: staffMember.name,
            staff_role: staffMember.role,
            backup: null,
            history: [
              ...(call.assigned_staff?.history || []),
              {
                staff_id: selectedStaffId,
                name: staffMember.name,
                role: staffMember.role,
                assigned_at: new Date().toISOString(),
                assigned_by: localStorage.getItem('staffId')
              }
            ]
          }
        })
        .eq('id', call.id);

      if (error) throw error;
      onAssign();
      setSelectedStaffId('');
    } catch (error) {
      console.error('Error assigning staff:', error);
      onError?.('Error assigning staff. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-gray-100">
      <h3 className="font-medium mb-4">Staff Assignment</h3>

      <div className="space-y-4">
        {call.assigned_staff?.staff_name ? (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <div className="text-blue-600 font-bold text-lg">
                {call.assigned_staff?.staff_name?.[0]?.toUpperCase() || <UserCheck className="h-5 w-5" />}
              </div>
            </div>
            <div>
              <p className="font-medium">{call.assigned_staff?.staff_name || 'Loading...'}</p>
              <p className="text-sm text-gray-500">
                {call.assigned_staff?.staff_role}
                <span className="text-blue-600 ml-2">• Currently Assigned</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-gray-500">No Staff Assigned</p>
              <p className="text-sm text-gray-500">Select staff member below</p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="input flex-1"
            disabled={loading}
          >
            <option value="">
              {checkingAvailability ? 'Checking availability...' : 'Select Staff Member'}
            </option>
            {availableStaff
              .sort((a, b) => a.role.localeCompare(b.role))
              .map(staff => (
                <option 
                  key={staff.id} 
                  value={staff.id}
                  disabled={!staff.available && staff.id !== call.staff_id}
                >
                  {staff.name} • {staff.role} 
                  {staff.id === call.staff_id ? ' (Currently Assigned)' : ''}
                  {!staff.available && staff.id !== call.staff_id ? ' (Unavailable)' : ''}
                </option>
              ))}
          </select>
          <button
            onClick={handleAssign}
            disabled={!selectedStaffId || loading}
            className={`btn btn-primary ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
          </button>
        </div>

        {call.assigned_staff?.history && call.assigned_staff.history.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Assignment History</h4>
            <div className="space-y-2">
              {call.assigned_staff.history.map((entry, index) => (
                <div key={index} className="text-sm text-gray-600 flex items-center gap-2">
                  <span className="font-medium">{entry.name}</span>
                  <span className="text-gray-400">→</span>
                  <span>{entry.role}</span>
                  <span className="text-gray-400">•</span>
                  <span>{new Date(entry.assigned_at).toLocaleDateString()}</span>
                  {entry.assigned_by && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-xs text-gray-500">by {entry.assigned_by}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
