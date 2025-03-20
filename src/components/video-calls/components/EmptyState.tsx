import React from 'react';
import { Filter } from 'lucide-react';

interface EmptyStateProps {
  searchTerm: string;
  activeTab: string;
  tabLabel: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  searchTerm,
  activeTab,
  tabLabel
}) => {
  return (
    <div className="text-center py-12 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100">
      <div className="flex justify-center mb-4">
        <Filter className="h-12 w-12 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
        No video calls found
      </h3>
      <p className="mt-1 text-gray-500">
        {searchTerm 
          ? 'Try adjusting your search terms'
          : `No video calls in ${tabLabel.toLowerCase()} status`}
      </p>
    </div>
  );
};
