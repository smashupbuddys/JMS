import React from 'react';
import { Calendar, Video, FileText, UserCheck, DollarSign, QrCode, Box, Truck, CheckCircle } from 'lucide-react';

export const WORKFLOW_TABS = [
  { id: 'scheduled', label: 'Scheduled', icon: Calendar },
  { id: 'video_call', label: 'In Progress', icon: Video },
  { id: 'quotation', label: 'Pending Quotation', icon: FileText },
  { id: 'profiling', label: 'Pending Profiling', icon: UserCheck },
  { id: 'payment', label: 'Pending Payment', icon: DollarSign },
  { id: 'qc', label: 'Quality Check', icon: QrCode },
  { id: 'packaging', label: 'Packaging', icon: Box },
  { id: 'dispatch', label: 'Dispatch', icon: Truck },
  { id: 'completed', label: 'Completed', icon: CheckCircle }
];

interface WorkflowTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  getTabCount: (tabId: string) => number;
}

export const WorkflowTabs: React.FC<WorkflowTabsProps> = ({
  activeTab,
  onTabChange,
  getTabCount
}) => {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100">
      <nav className="flex flex-wrap gap-1 p-2">
        {WORKFLOW_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = getTabCount(tab.id);
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                relative flex flex-1 sm:flex-none sm:min-w-[120px] flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl font-medium text-xs transition-all duration-200
                ${isActive 
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md' 
                  : 'text-gray-600 hover:bg-gray-100/80'}
              `}
            >
              <Icon className="h-5 w-5" />
              <span className="text-center">{tab.label}</span>
              {count > 0 && (
                <span className={`absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full text-xs font-medium ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
