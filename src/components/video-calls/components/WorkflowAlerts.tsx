import React from 'react';
import { AlertTriangle, Bell, Clock } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import type { VideoCall } from '../../../types';

interface WorkflowAlertsProps {
  call: VideoCall;
}

export const WorkflowAlerts: React.FC<WorkflowAlertsProps> = ({ call }) => {
  const getStepDeadline = (step: string) => {
    switch (step) {
      case 'quotation':
        return 24; // 24 hours to complete quotation
      case 'payment':
        return 48; // 48 hours to complete payment
      case 'qc':
        return 12; // 12 hours to complete QC
      case 'packaging':
        return 12; // 12 hours to complete packaging
      case 'dispatch':
        return 24; // 24 hours to complete dispatch
      default:
        return 24;
    }
  };

  const getStepAlerts = () => {
    const alerts = [];
    const currentStep = Object.entries(call.workflow_status || {}).find(
      ([_, status]) => status === 'pending' || status === 'in_progress'
    );

    if (currentStep) {
      const [step, status] = currentStep;
      const stepStartTime = new Date(call.updated_at);
      const hoursElapsed = differenceInHours(new Date(), stepStartTime);
      const deadline = getStepDeadline(step);

      if (hoursElapsed >= deadline) {
        alerts.push({
          type: 'overdue',
          message: `${step.replace('_', ' ')} is overdue by ${hoursElapsed - deadline} hours`,
          severity: 'high'
        });
      } else if (hoursElapsed >= deadline * 0.75) {
        alerts.push({
          type: 'warning',
          message: `${step.replace('_', ' ')} deadline approaching in ${deadline - hoursElapsed} hours`,
          severity: 'medium'
        });
      }
    }

    // Check for payment status
    if (call.payment_status === 'overdue') {
      alerts.push({
        type: 'payment',
        message: 'Payment is overdue',
        severity: 'high'
      });
    }

    return alerts;
  };

  const alerts = getStepAlerts();

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert, index) => (
        <div
          key={index}
          className={`flex items-center gap-2 p-3 rounded-lg ${
            alert.severity === 'high'
              ? 'bg-red-50 text-red-700'
              : 'bg-yellow-50 text-yellow-700'
          }`}
        >
          {alert.severity === 'high' ? (
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          ) : (
            <Clock className="h-5 w-5 flex-shrink-0" />
          )}
          <div className="flex-1">{alert.message}</div>
          <Bell className="h-4 w-4 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
};
