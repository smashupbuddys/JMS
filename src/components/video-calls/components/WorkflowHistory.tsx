import React from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface WorkflowHistoryProps {
  history: Array<{
    step: string;
    old_status: string;
    new_status: string;
    changed_by: string;
    notes: string;
    created_at: string;
  }>;
}

export const WorkflowHistory: React.FC<WorkflowHistoryProps> = ({ history }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-gray-100">
      <h3 className="font-medium mb-4">Workflow History</h3>
      <div className="space-y-4">
        {history.map((entry, index) => (
          <div key={index} className="flex gap-4">
            <div className="flex-shrink-0 mt-1">
              {getStatusIcon(entry.new_status)}
            </div>
            <div className="flex-1">
              <div className="flex justify-between">
                <p className="text-sm font-medium">
                  {entry.step.replace('_', ' ')} → {entry.new_status}
                </p>
                <span className="text-xs text-gray-500">
                  {format(new Date(entry.created_at), 'PPp')}
                </span>
              </div>
              {entry.notes && (
                <p className="text-sm text-gray-600 mt-1">{entry.notes}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Changed by: {entry.changed_by}
              </p>
            </div>
          </div>
        ))}
        {history.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            No workflow history available
          </p>
        )}
      </div>
    </div>
  );
};
