import React from 'react';
import { X } from 'lucide-react';

interface ToastProps {
  id: string;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose: (id: string) => void;
}

const TOAST_STYLES = {
  success: 'bg-green-50 border-green-100 text-green-800',
  error: 'bg-red-50 border-red-100 text-red-800',
  warning: 'bg-yellow-50 border-yellow-100 text-yellow-800',
  info: 'bg-blue-50 border-blue-100 text-blue-800'
};

export const Toast: React.FC<ToastProps> = ({
  id,
  title,
  message,
  type = 'info',
  duration = 5000,
  onClose
}) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  return (
    <div className={`fixed bottom-4 right-4 w-96 rounded-lg shadow-lg border p-4 animate-in slide-in-from-right ${TOAST_STYLES[type]}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-medium">{title}</h3>
          <p className="text-sm mt-1 opacity-90">{message}</p>
        </div>
        <button
          onClick={() => onClose(id)}
          className="p-1 hover:bg-black/5 rounded-lg transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
