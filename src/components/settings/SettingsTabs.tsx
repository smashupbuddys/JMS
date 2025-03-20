import React from 'react';
import { Settings, Users, Calculator, Printer, Building, Award, Volume2 } from 'lucide-react';
import MarkupSettings from './MarkupSettings';
import StaffManagement from './StaffManagement';
import VoiceSettings from './VoiceSettings';
import PrintSettings from './PrintSettings';
import GSTSettings from './GSTSettings';
import CompanySettings from './CompanySettings';
import StaffPerformance from './StaffPerformance';
import { hasPermission } from '../../lib/auth';

const TABS = [
  hasPermission('manage_settings') && { id: 'markup', label: 'Markup', icon: Calculator, component: MarkupSettings },
  hasPermission('manage_settings') && { id: 'voice', label: 'Voice', icon: Volume2, component: VoiceSettings },
  hasPermission('manage_staff') && { id: 'staff', label: 'Staff', icon: Users, component: StaffManagement },
  hasPermission('manage_staff') && { id: 'performance', label: 'Performance', icon: Award, component: StaffPerformance },
  hasPermission('manage_settings') && { id: 'gst', label: 'GST', icon: Settings, component: GSTSettings },
  hasPermission('manage_settings') && { id: 'print', label: 'Print', icon: Printer, component: PrintSettings },
  hasPermission('manage_settings') && { id: 'company', label: 'Company', icon: Building, component: CompanySettings }
];

const SettingsTabs = () => {
  // Filter out falsy values and get valid tabs
  const validTabs = TABS.filter(Boolean);
  const [activeTab, setActiveTab] = React.useState(validTabs[0]?.id || '');

  const ActiveComponent = validTabs.find(tab => tab.id === activeTab)?.component || validTabs[0]?.component;

  return (
    validTabs.length === 0 ? (
      <div className="text-center py-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Unauthorized Access</h2>
        <p className="text-gray-600">You don't have permission to access settings.</p>
      </div>
    ) : (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {validTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm
                  ${isActive 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div>
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
    )
  );
};

export default SettingsTabs;
