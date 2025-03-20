import React from 'react';
import type { PrintTemplate } from './PrintTemplates';
import { Receipt, Smartphone, FileText, Sparkles, Diamond, FileBarChart } from 'lucide-react';

interface PrintTemplateSelectorProps {
  value: PrintTemplate;
  onChange: (template: PrintTemplate) => void;
}

const PrintTemplateSelector: React.FC<PrintTemplateSelectorProps> = ({
  value,
  onChange
}) => {
  const templates = [
    { id: 'thermal', name: '3" Thermal', icon: Receipt, description: '3-inch thermal printer format' },
    { id: 'compact', name: 'PDF Share', icon: FileText, description: 'PDF format for sharing' }
  ];

  return (
    <div className="space-y-2">
      {templates.map((template) => {
        const Icon = template.icon;
        return (
          <button
            key={template.id}
            onClick={() => onChange(template.id as PrintTemplate)}
            className={`w-full px-4 py-3 text-sm border rounded-lg transition-all flex items-center gap-3 ${
              value === template.id
                ? 'border-blue-500 bg-blue-50 text-blue-600'
                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            }`}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            <div className="text-left">
              <div className="font-medium">{template.name}</div>
              <div className="text-xs text-gray-500">{template.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default PrintTemplateSelector;
