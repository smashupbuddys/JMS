import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Video, Trash2, Calendar, XCircle, UserCheck,
  Clock, Phone, Mail, AlertCircle, FileText,
  ArrowRight, DollarSign, QrCode, Box, Truck, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { formatDateTime, getLocalTimeZone } from '../../../utils/dateUtils'; 
import { formatPhoneNumber } from '../../../utils/phoneUtils';
import { supabase } from '../../../lib/supabase';
import { useVideoCallRealtime } from '../../../hooks/useVideoCallRealtime';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '../../../components/ui/alert-dialog';

interface AssignedStaffHistory {
  staff_id: string;
  name: string;
  assigned_at: string;
  assigned_by: string;
}

interface AssignedStaff {
  primary: string;
  staff_name: string;
  staff_role?: string;
  backup: string | null;
  history: AssignedStaffHistory[];
}

interface VideoCall {
  id: string;
  video_call_number: string;
  scheduled_at: string;
  time_zone?: string;
  customer_time_zone?: string;
  status: string;
  quotation_id?: string;
  customers?: {
    name: string;
    phone?: string;
    email?: string;
    city?: string;
    state?: string;
  };
  assigned_staff?: AssignedStaff | null;
  workflow_status?: Record<string, string>;
  staff_id?: string; // Added for assignment
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  active: boolean;
}

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
  key?: string; // Explicit key prop to force re-render
}

const WORKFLOW_ICONS = {
  video_call: Video,
  quotation: FileText,
  profiling: UserCheck,
  payment: DollarSign,
  qc: QrCode,
  packaging: Box,
  dispatch: Truck
};

export const VideoCallCard = ({
  call,
  onCompleteCall,
  onDelete,
  priorityClass,
  priorityBadge,
  assignedStaff,
  staff_role,
  onAssignStaff,
  onCreateQuotation
}: VideoCallCardProps) => {
  // Component state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [displayedStaff, setDisplayedStaff] = useState<AssignedStaff | null>(assignedStaff);
  
  // Refs and navigation
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Add real-time updates
  useVideoCallRealtime(call.id, () => {
    // Fetch latest staff assignment
    fetchLatestCallData();
  });

  // Function to fetch latest call data
  const fetchLatestCallData = async () => {
    try {
      const { data, error } = await supabase
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
          ),
          assigned_staff,
          staff_id
        `)
        .eq('id', call.id)
        .single();

      if (error) throw error;
      
      if (data) {
        // Update displayed staff
        setDisplayedStaff(data.assigned_staff);
        
        // Update other call data if needed
        if (onAssignStaff) {
          onAssignStaff(data);
        }
      }
    } catch (error) {
      console.error('Error fetching staff assignment:', error);
      setAssignError('Failed to refresh staff assignment');
    }
  };

  // Update displayed staff when assignedStaff prop changes or on initial load
  useEffect(() => {
    if (assignedStaff && !displayedStaff) {
      setDisplayedStaff(assignedStaff);
    } else if (assignedStaff && assignedStaff.primary !== displayedStaff?.primary) {
      // Only update if the assigned staff actually changed
      setDisplayedStaff(assignedStaff);
    }
  }, [assignedStaff]);

  // Reset success message after 3 seconds
  useEffect(() => {
    if (assignSuccess) {
      const timer = setTimeout(() => {
        setAssignSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [assignSuccess]);

  // Reset error message after 5 seconds
  useEffect(() => {
    if (assignError) {
      const timer = setTimeout(() => {
        setAssignError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [assignError]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStaffDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Fetch available staff on mount and when component loads
  useEffect(() => {
    // Only fetch if we haven't loaded staff yet or if we need to refresh
    if (availableStaff.length === 0 && !staffLoading) {
      fetchAvailableStaff();
    }
  }, []);

  // Handler functions
  const fetchAvailableStaff = async () => {
    try {
      setStaffLoading(true);
      setStaffError(null);
      
      const { data, error } = await supabase
        .from('staff')
        .select('id, name, role, active')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      
      // Success - store the staff data
      setAvailableStaff(data || []);
      
      // If we already have a staff assigned, make sure they're in our list
      if (assignedStaff?.primary && displayedStaff?.staff_name) {
        const found = data?.some(staff => staff.id === assignedStaff.primary);
        if (!found && assignedStaff.primary) {
          // Try to fetch the assigned staff member specifically
          const { data: staffData } = await supabase
            .from('staff')
            .select('id, name, role')
            .eq('id', assignedStaff.primary)
            .single();
            
          if (staffData) {
            // Add the currently assigned staff to the available list even if inactive
            setAvailableStaff(prev => [...prev, staffData]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
      setStaffError('Failed to load staff members');
    } finally {
      setStaffLoading(false);
    }
  };

  const handleStaffChange = async (staffId: string) => {
    if (staffLoading) return; // Prevent multiple calls while loading
    
    try {
      setStaffLoading(true);
      setStaffError(null);
      
      // Update staff assignment in database
      const { error } = await supabase
        .from('video_calls')
        .update({ staff_id: staffId })
        .eq('id', call.id);

      if (error) {
        throw error;
      }
      
      // Close the dropdown
      setShowStaffDropdown(false);
      setAssignSuccess(true);

    } catch (error) {
      console.error('Error updating staff:', error);
      setAssignError('Failed to update staff assignment');
    } finally {
      setStaffLoading(false);
    }
  };

  const handleDelete = () => {
    onDelete(call.id);
    setShowDeleteConfirm(false);
  };

  // Derived values
  const customerTime = formatDateTime(call.scheduled_at, call.time_zone || getLocalTimeZone()).local;
  const utcTime = formatDateTime(call.scheduled_at).utc;
  
  // Call timing status
  const getCallTimingStatus = () => {
    const now = new Date();
    const scheduledTime = new Date(call.scheduled_at);
    const timeDiff = scheduledTime.getTime() - now.getTime();
    const minutesDiff = Math.floor(timeDiff / (1000 * 60));
    
    if (now > scheduledTime && call.status !== 'completed' && call.status !== 'cancelled') {
      return 'overdue';
    } else if (minutesDiff <= 5 && minutesDiff >= 0) {
      return 'upcoming';
    }
    return 'normal';
  };
  
  const callTimingStatus = getCallTimingStatus();
  const isOverdue = callTimingStatus === 'overdue';
  const isUpcoming = callTimingStatus === 'upcoming';

  // Render component
  return (
    <div className={`border border-gray-200 rounded-lg bg-white shadow-sm 
      ${isOverdue ? 'border-red-300 bg-red-50' : ''} 
      ${isUpcoming ? 'border-yellow-200 bg-yellow-50' : ''}`}>
      {/* Header with customer info */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="h-5 w-5 text-blue-600" />
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">{call.customers?.name || "Loading..."}</h3>
              <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                #{call.video_call_number}
              </span>
            </div>
            
            {call.customers?.phone && (
              <a 
                href={`tel:${call.customers.phone}`} 
                className="text-sm text-gray-600"
                title="Click to call"
              >
                {formatPhoneNumber(call.customers.phone)}
              </a>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-end">
          {isOverdue && (
            <span className="text-xs font-medium text-red-600 mb-1 flex items-center">
              <AlertCircle className="h-3 w-3 mr-1" />
              Overdue
            </span>
          )}
          {isUpcoming && (
            <span className="text-xs font-medium text-amber-700 mb-1 flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              In 5 minutes
            </span>
          )}
          <span className={`text-xs font-medium ${
            call.status === 'scheduled' ? 'text-blue-600' :
            call.status === 'in_progress' ? 'text-amber-600' :
            call.status === 'completed' ? 'text-green-600' :
            'text-red-600'
          }`}>
            {call.status === 'scheduled' ? 'Scheduled' : 
             call.status === 'in_progress' ? 'In Progress' :
             call.status === 'completed' ? 'Completed' : 'Cancelled'}
          </span>
          {isOverdue && (
            <span className="text-xs text-red-700 mt-1 flex items-center">
              <AlertCircle className="h-3 w-3 mr-1" /> Overdue
            </span>
          )}
          {isUpcoming && (
            <span className="text-xs text-amber-700 mt-1 flex items-center">
              <Clock className="h-3 w-3 mr-1" /> Starting soon
            </span>
          )}
        </div>
      </div>
      
      <div className="border-t border-gray-200">
        {/* Staff Assignment */}
        <div className="px-4 py-3 border-b border-gray-100" ref={dropdownRef}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Assigned to:</span>
              <div className="relative">
                <button
                  onClick={() => !staffLoading && setShowStaffDropdown(!showStaffDropdown)}
                  disabled={staffLoading}
                  className={`flex items-center gap-1 text-sm font-medium ${
                    staffLoading ? 'text-gray-400 cursor-not-allowed' :
                    'text-blue-600 hover:text-blue-800 cursor-pointer'
                  }`}
                  title="Assign staff"
                >
                  {staffLoading && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  )}
                  
                  {displayedStaff?.staff_name ? (
                    <>
                      <UserCheck className="h-4 w-4" />
                      <span>{displayedStaff.staff_name}</span>
                      {displayedStaff.staff_role && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded ml-1">
                          {displayedStaff.staff_role}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-400">Unassigned</span>
                  )}
                  {showStaffDropdown ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                {showStaffDropdown && (
                  <div className="absolute right-0 mt-1 w-56 bg-white rounded shadow-lg border border-gray-200 z-10">
                  <div className="p-2 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Select staff member</span>
                    <button 
                      onClick={() => fetchAvailableStaff()} 
                      disabled={staffLoading}
                      className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                      title="Refresh staff list"
                    >
                      Refresh
                    </button>
                  </div>
                    <div className="max-h-56 overflow-y-auto">
                      {staffLoading ? (
                        <div className="p-3 text-center">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                          <span className="text-sm text-gray-500">Loading staff...</span>
                        </div>
                      ) : staffError ? (
                        <div className="p-3 text-center text-sm text-red-600">
                          {staffError}
                          <button
                            onClick={fetchAvailableStaff}
                            className="block w-full mt-2 text-blue-600 hover:text-blue-800"
                          >
                            Retry
                          </button>
                        </div>
                      ) : availableStaff.length === 0 ? (
                        <div className="p-3 text-center text-sm text-gray-500">
                          No staff members available
                        </div>
                      ) : (
                        availableStaff.map(staff => (
                          <button
                            key={staff.id}
                            onClick={() => !staffLoading && handleStaffChange(staff.id)}
                            disabled={staffLoading}
                            className={`w-full text-left p-2 text-sm hover:bg-gray-50 ${
                              staff.id === displayedStaff?.primary ? 'bg-blue-50 text-blue-700' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{staff.name}</div>
                                <div className="text-xs text-gray-500">{staff.role}</div>
                              </div>
                              {staff.id === displayedStaff?.primary && (
                                <div className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                  Current
                                </div>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Assignment status messages */}
            {assignSuccess && (
              <div className="mt-1 text-xs text-green-600 text-center animate-fadeIn">
                Staff assigned successfully
              </div>
            )}
            
            {assignError && (
              <div className="mt-1 text-xs text-red-600 text-center animate-fadeIn">
                {assignError}
              </div>
            )}
            
            {staffLoading && !showStaffDropdown && !assignSuccess && !assignError && (
              <div className="mt-1 text-xs text-blue-600 text-center flex justify-center items-center">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                <span>Updating staff...</span>
              </div>
            )}
        </div>

        {/* Time Section */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              <span>Scheduled Time</span>
            </div>
            {isOverdue && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" /> Overdue
              </span>
            )}
            {isUpcoming && (
              <span className="text-xs bg-yellow-100 text-amber-700 px-2 py-0.5 rounded flex items-center">
                <Clock className="h-3 w-3 mr-1" /> Soon
              </span>
            )}
          </div>
          <div className="mt-1">
            <div className="text-sm font-medium">{customerTime}</div>
            <div className="text-xs text-blue-600">{utcTime} (UTC)</div>
          </div>
        </div>

        {/* Workflow Status */}
        {call.workflow_status && Object.keys(call.workflow_status).length > 0 && (
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-1 mb-2 text-sm text-gray-500">
              <FileText className="h-4 w-4" />
              <span>Workflow Status</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {Object.entries(call.workflow_status).map(([step, status], index) => (
                <React.Fragment key={step}>
                  <div 
                    className={`flex items-center gap-1 px-2 py-1 rounded ${
                      status === 'completed' ? 'bg-green-50 text-green-700' :
                      status === 'in_progress' ? 'bg-blue-50 text-blue-700' :
                      status === 'pending' ? 'bg-gray-50 text-gray-500' :
                      'bg-gray-50 text-gray-400'
                    }`}
                    title={`Status: ${status}`}
                  >
                    {React.createElement(WORKFLOW_ICONS[step as keyof typeof WORKFLOW_ICONS], { 
                      className: "h-3.5 w-3.5" 
                    })}
                    <span className="text-xs whitespace-nowrap">{step.replace('_', ' ')}</span>
                  </div>
                  {index < Object.entries(call.workflow_status).length - 1 && (
                    <ArrowRight className="h-3 w-3 text-gray-300 flex-shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Actions Section */}
        <div className="p-3 flex items-center gap-2">          
          {/* Show Ready/Reschedule/Cancel buttons for scheduled calls */}
          {call.status === 'scheduled' && (
            <>
              <button
                onClick={() => onCompleteCall(call, 'start')}
                className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded flex items-center gap-1"
              >
                <Video className="h-4 w-4" />
                <span>Ready</span>
              </button>
              <button
                onClick={() => onCompleteCall(call, 'reschedule')}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded flex items-center gap-1"
              >
                <Calendar className="h-4 w-4" />
                <span>Reschedule</span>
              </button>
              <button
                onClick={() => onCompleteCall(call, 'cancel')}
                className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded flex items-center gap-1"
              >
                <XCircle className="h-4 w-4" />
                <span>Cancel</span>
              </button>
            </>
          )}
          
          {/* Show Complete/Reschedule/Cancel for in-progress calls */}
          {call.status === 'in_progress' && (
            <>
              <button
                onClick={() => onCompleteCall(call, 'complete')}
                className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded flex items-center gap-1"
              >
                <Video className="h-4 w-4" />
                <span>Complete</span>
              </button>
              <button
                onClick={() => onCompleteCall(call, 'reschedule')}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded flex items-center gap-1"
              >
                <Calendar className="h-4 w-4" />
                <span>Reschedule</span>
              </button>
              <button
                onClick={() => onCompleteCall(call, 'cancel')}
                className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded flex items-center gap-1"
              >
                <XCircle className="h-4 w-4" />
                <span>Cancel</span>
              </button>
            </>
          )}

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="ml-auto p-1.5 text-red-500 hover:bg-red-50 rounded"
            aria-label="Delete video call"
            title="Delete video call"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Video Call</AlertDialogTitle>
            <AlertDialogDescription>
              <p className="text-red-600 flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5" />
                This action cannot be undone.
              </p>
              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="font-medium">Call Number:</span> {call.video_call_number}</p>
                <p><span className="font-medium">Customer:</span> {call.customers?.name}</p>
                <p><span className="font-medium">Scheduled:</span> {format(new Date(call.scheduled_at), 'PPp')}</p>
                {displayedStaff?.staff_name && (
                  <p><span className="font-medium">Assigned Staff:</span> {displayedStaff.staff_name}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
