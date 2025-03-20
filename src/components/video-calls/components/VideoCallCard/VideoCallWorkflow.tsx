import React from 'react';
import { Video, FileText, UserCheck, DollarSign, QrCode, Box, Truck, ArrowRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { VideoCall } from '../../../../types';
import { useToast } from '../../../../hooks/useToast';

const WORKFLOW_STEPS = [
  { key: 'video_call', label: 'Video Call', Icon: Video },
  { key: 'quotation', label: 'Quotation', Icon: FileText },
  { key: 'profiling', label: 'Profiling', Icon: UserCheck },
  { key: 'payment', label: 'Payment', Icon: DollarSign },
  { key: 'qc', label: 'Quality Check', Icon: QrCode },
  { key: 'packaging', label: 'Packaging', Icon: Box },
  { key: 'dispatch', label: 'Dispatch', Icon: Truck }
];

const STATUS_STYLES = {
  pending: 'bg-gray-100 text-gray-500',
  in_progress: 'bg-blue-100 text-blue-700 animate-pulse',
  skipped: 'bg-gray-100 text-gray-400',
  completed: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700'
};

const CONNECTOR_STYLES = {
  pending: 'bg-gray-200',
  in_progress: 'bg-blue-200',
  skipped: 'bg-gray-200',
  completed: 'bg-green-200',
  rejected: 'bg-red-200'
};

interface VideoCallWorkflowProps {
  call: VideoCall;
  onCreateQuotation: (call: VideoCall) => void;
}

export const VideoCallWorkflow: React.FC<VideoCallWorkflowProps> = ({ call, onCreateQuotation }) => {
  const { addToast } = useToast();
  const [showTooltip, setShowTooltip] = React.useState<string | null>(null);

  if (!call.workflow_status) return null;

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-2 text-sm mb-4">
        <FileText className="h-4 w-4 text-gray-500" />
        <span className="font-medium">Workflow Progress</span>
      </div>

      <div className="relative flex items-center justify-between">
        {/* Connector Line */}
        <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-200 -translate-y-1/2" />

        {/* Workflow Steps */}
        {WORKFLOW_STEPS.map((step, index) => {
          const status = call.workflow_status?.[step.key] || 'pending';
          const { Icon } = step;
          const isClickable = step.key === 'quotation' && status === 'pending';

          return (
            <div 
              key={step.key}
              className="relative flex flex-col items-center gap-2"
            >
              {/* Step Connector */}
              {index < WORKFLOW_STEPS.length - 1 && (
                <div 
                  className={`absolute left-[calc(50%+1rem)] w-[calc(100%-2rem)] h-0.5 top-4 -translate-y-1/2 ${
                    CONNECTOR_STYLES[status as keyof typeof CONNECTOR_STYLES]
                  }`} 
                />
              )}

              {/* Step Circle */}
              <div 
                className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${
                  STATUS_STYLES[status as keyof typeof STATUS_STYLES]
                } ${isClickable ? 'cursor-pointer hover:scale-110' : ''} transition-all duration-200`}
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
                onMouseEnter={() => isClickable && setShowTooltip(step.key)}
                onMouseLeave={() => setShowTooltip(null)}
              >
                <Icon className="h-4 w-4" />

                {/* Quotation Actions */}
                {step.key === 'quotation' && (
                  call.quotation_id && status === 'completed' ? (
                    <Link 
                      to={`/pos?quotation=${call.quotation_id}`}
                      className="absolute -top-1 -right-1 p-1 bg-blue-100 rounded-full hover:bg-blue-200 transition-colors"
                      title="View Quotation"
                    >
                      <FileText className="h-3 w-3 text-blue-600" />
                    </Link>
                  ) : status === 'pending' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateQuotation(call);
                      }}
                      className="absolute -top-1 -right-1 p-1 bg-blue-100 rounded-full hover:bg-blue-200 transition-colors"
                      title="Create Quotation"
                    >
                      <Plus className="h-3 w-3 text-blue-600" />
                    </button>
                  )
                )}

                {/* Tooltip */}
                {showTooltip === step.key && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-20">
                    Click to create quotation
                  </div>
                )}
              </div>

              {/* Step Label */}
              <div className="text-xs text-gray-600 whitespace-nowrap">
                {step.label}
                {status === 'skipped' && (
                  <span className="text-[10px] text-gray-400 block">(Skipped)</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
