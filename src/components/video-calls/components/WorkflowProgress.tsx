import React from 'react';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import type { VideoCall } from '../../../types';

interface WorkflowProgressProps {
  call: VideoCall;
}

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({ call }) => {
  const calculateProgress = () => {
    const steps = Object.values(call.workflow_status || {});
    const completedSteps = steps.filter(step => step === 'completed' || step === 'skipped').length;
    return Math.round((completedSteps / steps.length) * 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-500';
      case 'in_progress':
        return 'text-blue-500';
      case 'skipped':
        return 'text-gray-400';
      case 'rejected':
        return 'text-red-500';
      default:
        return 'text-gray-300';
    }
  };

  const progress = calculateProgress();

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">Workflow Progress</h3>
        <span className="text-sm font-medium">{progress}% Complete</span>
      </div>

      <div className="relative pt-1">
        <div className="flex mb-2 items-center justify-between">
          <div>
            <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
              {progress < 100 ? 'In Progress' : 'Completed'}
            </span>
          </div>
        </div>
        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-100">
          <div
            style={{ width: `${progress}%` }}
            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
          />
        </div>
      </div>

      <div className="space-y-2">
        {Object.entries(call.workflow_status || {}).map(([step, status]) => (
          <div key={step} className="flex items-center justify-between text-sm">
            <span className="capitalize">{step.replace('_', ' ')}</span>
            <span className={`flex items-center gap-1 ${getStatusColor(status)}`}>
              {status === 'completed' && <CheckCircle className="h-4 w-4" />}
              {status === 'in_progress' && <Clock className="h-4 w-4 animate-spin" />}
              {status === 'rejected' && <AlertCircle className="h-4 w-4" />}
              {status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
