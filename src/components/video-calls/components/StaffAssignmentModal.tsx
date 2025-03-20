import React from 'react';
import { X, UserCheck, Search, AlertCircle } from 'lucide-react';
import type { VideoCall, Staff } from '../../../types';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../hooks/useToast';

interface StaffAssignmentModalProps {
  call: VideoCall;
  onClose: () => void;
  onAssign: () => void;
}

export const StaffAssignmentModal: React.FC<StaffAssignmentModalProps> = ({
  call,
  onClose,
  onAssign
}) => {
  const [availableStaff, setAvailableStaff] = React.useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = React.useState<string>('');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { addToast } = useToast();

  React.useEffect(() => {
    fetchAvailableStaff();
  }, []);

  const fetchAvailableStaff = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;

      // Filter out currently assigned staff
      const filteredStaff = data?.filter(staff => 
        staff.id !== call.staff_id
      ) || [];

      setAvailableStaff(filteredStaff);
    } catch (error) {
      console.error('Error fetching staff:', error);
      setError('Failed to load available staff');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!selectedStaffId) {
        throw new Error('Please select a staff member');
      }

      const { error } = await supabase
        .from('video_calls')
        .update({ staff_id: selectedStaffId })
        .eq('id', call.id);

      if (error) throw error;

      addToast({
        title: 'Success',
        message: 'Staff assigned successfully',
        type: 'success'
      });

      onAssign();
    } catch (error) {
      console.error('Error assigning staff:', error);
      setError(error.message || 'Failed to assign staff');
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
              Assign Staff
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
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Search Staff */}
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
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      selectedStaffId === staff.id
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`} />
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
                onClick={handleAssign}
                disabled={loading || !selectedStaffId}
                className="btn btn-primary bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2"
              >
                <UserCheck className="h-4 w-4" />
                {loading ? 'Assigning...' : 'Assign Staff'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
