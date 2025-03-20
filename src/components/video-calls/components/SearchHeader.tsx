import React from 'react';
import { Search, Plus, ArrowUp, ArrowDown } from 'lucide-react';

interface SearchHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  priorityFilter: 'all' | 'today' | 'upcoming' | 'overdue';
  onPriorityFilterChange: (value: 'all' | 'today' | 'upcoming' | 'overdue') => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: () => void;
  onScheduleClick: () => void;
}

export const SearchHeader: React.FC<SearchHeaderProps> = ({
  searchTerm,
  onSearchChange,
  priorityFilter,
  onPriorityFilterChange,
  sortOrder,
  onSortOrderChange,
  onScheduleClick
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
      <div className="flex-1 max-w-xl relative mb-2 sm:mb-0">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4">
          Video Call Management
        </h2>
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search video calls..."
              className="input pl-10 w-full bg-white/80 backdrop-blur-sm border-gray-200/80 focus:border-blue-500/50 focus:ring-blue-500/50"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <select
            value={priorityFilter}
            onChange={(e) => onPriorityFilterChange(e.target.value as any)}
            className="input bg-white/80 backdrop-blur-sm w-40"
          >
            <option value="all">All Calls</option>
            <option value="today">Today's Calls</option>
            <option value="upcoming">Upcoming Calls</option>
            <option value="overdue">Overdue Calls</option>
          </select>
          <button
            onClick={onSortOrderChange}
            className="btn btn-secondary flex items-center gap-2"
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {sortOrder === 'asc' ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
            Sort
          </button>
        </div>
      </div>
      <button 
        onClick={onScheduleClick}
        className="btn btn-primary bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2 w-full sm:w-auto"
      >
        <Plus className="h-5 w-5" />
        Schedule Call
      </button>
    </div>
  );
};
