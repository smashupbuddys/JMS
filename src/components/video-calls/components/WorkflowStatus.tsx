import React from 'react';
import { Video, FileText, UserCheck, DollarSign, QrCode, Box, Truck, ArrowRight, Plus, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getRelevantWorkflowSteps } from '../../../utils/workflowUtils';
import { useToast } from '../../../hooks/useToast';
import QuickQuotationModal from '../../pos/QuickQuotationModal';
import type { VideoCall } from '../../../types';
import { useVideoCallRealtime } from '../../../hooks/useVideoCallRealtime';

const WORKFLOW_ICONS = {
  video_call: Video,
  quotation: FileText,
  profiling: UserCheck,
  payment: DollarSign,
  qc: QrCode,
  packaging: Box,
  dispatch: Truck
};

const WORKFLOW_LABELS = {
  video_call: 'Video Call',
  quotation: 'Quotation',
  profiling: 'Profiling',
  payment: 'Payment',
  qc: 'Quality Check',
  packaging: 'Packaging',
  dispatch: 'Dispatch'
};

export const STATUS_STYLES = {
  pending: 'opacity-40 grayscale',
  in_progress: 'animate-pulse text-blue-600 font-medium',
  skipped: 'text-gray-400 line-through',
  completed: '',
  rejected: 'text-red-500'
};

interface WorkflowStatusProps {
  status: Record<string, any>;
  callId?: string;
  callNumber?: string;
  quotationId?: string;
  assignedStaff: {
    primary: string;
    staff_name: string;
    backup: string | null;
    history: Array<{
      staff_id: string;
      name: string;
      assigned_at: string;
      assigned_by: string;
    }>;
  } | null;
  call: VideoCall;
  onCreateQuotation: (call: VideoCall) => void;
}

export const WorkflowStatus: React.FC<WorkflowStatusProps> = ({
  status,
  callId,
  callNumber,
  quotationId,
  assignedStaff,
  call,
  onCreateQuotation
}) => {
  const { addToast } = useToast();
  const [showTooltip, setShowTooltip] = React.useState<string | null>(null);
  const [isHovered, setIsHovered] = React.useState(false);
  const workflowSteps = [
    'video_call',
    'quotation',
    'profiling', 
    'payment',
    'qc',
    'packaging',
    'dispatch'
  ];

  // Add real-time updates
  useVideoCallRealtime(callId, () => {
    // Refresh the parent component
    window.location.reload();
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Staff Assignment Badge */}
      {assignedStaff && (
        <div className="flex items-center gap-2 bg-blue-50 rounded-full px-3 py-1 mr-2">
          <User className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-600">
            {assignedStaff.staff_name || 'Unassigned'}
          </span>
        </div>
      )}

      {/* Workflow Steps */}
      <div className="grid grid-cols-7 gap-2">
        {/* Staff Assignment Badge */}
        {assignedStaff && (
          <div className="flex items-center gap-2 bg-blue-50 rounded-full px-3 py-1 mr-2">
            <User className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-600">
              {assignedStaff.staff_name || 'Unassigned'}
            </span>
          </div>
        )}

        {workflowSteps.map((key, index) => {
          const Icon = WORKFLOW_ICONS[key as keyof typeof WORKFLOW_ICONS];
          const stepStatus = status[key];
          const isClickable = key === 'quotation' && stepStatus === 'pending';
          const isSkipped = stepStatus === 'skipped';

          return (
            <div key={key} className="relative flex flex-col items-center">
              {/* Step Connector */}
              {index < workflowSteps.length - 1 && (
                <div className="absolute left-1/2 w-full h-0.5 top-4 -translate-y-1/2 bg-gray-200" />
              )}

              <div 
                className={`flex flex-col items-center gap-1 relative z-10 bg-white rounded-full p-2 ${STATUS_STYLES[stepStatus || 'pending']} ${
                  isClickable ? 'cursor-pointer hover:opacity-80' : ''
                }`}
                onClick={() => {
                  if (isClickable) {
                    onCreateQuotation(call);
                    addToast({
                      title: 'Creating Quotation',
                      message: 'Opening quotation form...',
                      type: 'info'
                    });
                  }
                }}
                onMouseEnter={() => {
                  setIsHovered(true);
                  if (isClickable) setShowTooltip(key);
                }}
                onMouseLeave={() => {
                  setIsHovered(false);
                  setShowTooltip(null);
                }}
              >
                {React.createElement(Icon, { className: "h-4 w-4" })}
                <div className="flex flex-col items-center">
                  <span className="text-xs text-gray-600">
                    {WORKFLOW_LABELS[key as keyof typeof WORKFLOW_LABELS]}
                  </span>
                  {showTooltip === key && (
                    <div className="absolute bottom-full mb-2 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                      Click to create quotation
                    </div>
                  )}
                  {isSkipped && (
                    <span className="text-[10px] text-gray-400">(Skipped)</span>
                  )}
                </div>
                {key === 'quotation' && (
                  quotationId && status[key] === 'completed' ? (
                  <Link 
                    to={`/pos?quotation=${quotationId}`}
                    className="absolute -top-1 -right-1 p-1.5 bg-blue-100 rounded-full hover:bg-blue-200 transition-colors shadow-sm hover:shadow flex items-center justify-center"
                    title="View Quotation"
                  >
                    <FileText className="h-3 w-3 text-blue-600" />
                  </Link>
                  ) : status[key] === 'pending' && (
                  <button
                    onClick={() => onCreateQuotation(call)}
                    className="absolute -top-1 -right-1 p-1.5 bg-blue-100 rounded-full hover:bg-blue-200 transition-colors shadow-sm hover:shadow"
                    title="Create Quotation"
                  >
                    <Plus className="h-3 w-3 text-blue-600" />
                  </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
