import React, { useState, useEffect } from 'react';
import { X, UserCheck, Search, Clock } from 'lucide-react';
import type { VideoCall, Staff } from '../../../types';
import { supabase } from '../../../lib/supabase';
import Swal from 'sweetalert2';

interface StaffChangeModalProps {
  call: VideoCall;
  onClose: () => void;
  onStaffChange: () => void;
}

const StaffChangeModal: React.FC<StaffChangeModalProps> = ({
  call,
  onClose,
  onStaffChange
}) => {
  const [availableStaff, setAvailableStaff] = useState<Array<{
    id: string;
    name: string;
    role: string;
    active: boolean;
    available: boolean;
  }>>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAvailableStaff();
  }, []);

  const fetchAvailableStaff = async () => {
    try {
      setLoading(true);
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('active', true)
        .order('name');

      if (staffError) throw staffError;

      // Check availability for each staff member
      const staffWithAvailability = await Promise.all((staffData || []).map(async (staff) => {
        const { data: isAvailable } = await supabase
          .rpc('check_staff_availability', {
            p_staff_id: staff.id,
            p_date: new Date(call.scheduled_at).toISOString().split('T')[0],
            p_start_time: new Date(call.scheduled_at).toISOString().split('T')[1].slice(0, 8),
            p_end_time: new Date(new Date(call.scheduled_at).getTime() + 30 * 60000).toISOString().split('T')[1].slice(0, 8)
          });

        return {
          ...staff,
          available: isAvailable || staff.id === call.staff_id
        };
      }));

      setAvailableStaff(staffWithAvailability);
    } catch (error) {
      console.error('Error fetching staff:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to load available staff. Please try again.',
        icon: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStaffChange = async () => {
    try {
      setLoading(true);

      if (!selectedStaffId) {
        throw new Error('Please select a staff member');
      }

      // Get selected staff details
      const selectedStaff = availableStaff.find(s => s.id === selectedStaffId);
      if (!selectedStaff) {
        throw new Error('Selected staff member not found');
      }

      // Update video call with new staff
      const { error: updateError } = await supabase
        .from('video_calls')
        .update({
          staff_id: selectedStaffId,
          assigned_staff: {
            primary: selectedStaffId,
            staff_name: selectedStaff.name,
            staff_role: selectedStaff.role,
            backup: null,
            history: [
              ...(call.assigned_staff?.history || []),
              {
                staff_id: selectedStaffId,
                name: selectedStaff.name,
                role: selectedStaff.role,
                assigned_at: new Date().toISOString(),
                assigned_by: localStorage.getItem('staffId')
              }
            ]
          }
        })
        .eq('id', call.id);

      if (updateError) throw updateError;

      // Create notifications for both staff members
      await Promise.all([
        // Notify new staff
        supabase.from('notifications').insert([{
          user_id: selectedStaffId,
          type: 'video_call_assignment',
          title: 'New Video Call Assignment',
          message: `You have been assigned to video call #${call.video_call_number}`,
          data: {
            video_call_id: call.id,
            video_call_number: call.video_call_number,
            scheduled_at: call.scheduled_at
          }
        }]),
        // Notify previous staff if exists
        call.staff_id && supabase.from('notifications').insert([{
          user_id: call.staff_id,
          type: 'video_call_unassignment',
          title: 'Video Call Reassigned',
          message: `Video call #${call.video_call_number} has been reassigned to ${selectedStaff.name}`,
          data: {
            video_call_id: call.id,
            video_call_number: call.video_call_number,
            new_staff_name: selectedStaff.name
          }
        }])
      ]);

      Swal.fire({
        title: 'Success',
        text: 'Staff member changed successfully',
        icon: 'success'
      });

      onStaffChange();
      onClose();
    } catch (error) {
      console.error('Error changing staff:', error);
      Swal.fire({
        title: 'Error',
        text: error.message || 'Failed to change staff. Please try again.',
        icon: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredStaff = availableStaff.filter(staff =>
    staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl w-full max-w-md mx-4 shadow-xl border border-gray-100">
        <div className="flex justify-between items-center p-6 border-b relative">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-50/80 to-gray-100/80 opacity-50 rounded-t-2xl -z-10" />
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
              Change Staff Assignment
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
          {/* Current Assignment */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="text-sm text-gray-600">Currently Assigned To:</div>
            <div className="font-medium mt-1">
              {call.assigned_staff?.staff_name || 'Unassigned'}
              {call.assigned_staff?.staff_role && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  {call.assigned_staff.staff_role}
                </span>
              )}
            </div>
          </div>

          {/* Search Staff */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search staff by name or role..."
                className="input pl-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Staff List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {loading ? (
                <div className="text-center py-4 text-gray-500">
                  Loading available staff...
                </div>
              ) : filteredStaff.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  No staff members found
                </div>
              ) : (
                filteredStaff.map((staff) => (
                  <label
                    key={staff.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedStaffId === staff.id
                        ? 'bg-blue-50 border-blue-200'
                        : 'hover:bg-gray-50 border-transparent'
                    } border`}
                  >
                    <input
                      type="radio"
                      name="staff"
                      value={staff.id}
                      checked={selectedStaffId === staff.id}
                      onChange={() => setSelectedStaffId(staff.id)}
                      className="hidden"
                    />
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-lg">
                        {staff.name[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{staff.name}</div>
                      <div className="text-sm text-gray-500">{staff.role}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {staff.id === call.staff_id && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                      {!staff.available && staff.id !== call.staff_id && (
                        <div className="flex items-center gap-1 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                          <Clock className="h-3 w-3" />
                          <span>Unavailable</span>
                        </div>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={onClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleStaffChange}
                disabled={loading || !selectedStaffId}
                className="btn btn-primary bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2"
              >
                <UserCheck className="h-4 w-4" />
                {loading ? 'Changing...' : 'Change Staff'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffChangeModal;
