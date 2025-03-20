import React from 'react';
import { X } from 'lucide-react';

interface AlertDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

interface AlertDialogContentProps {
  children: React.ReactNode;
}

interface AlertDialogHeaderProps {
  children: React.ReactNode;
}

interface AlertDialogTitleProps {
  children: React.ReactNode;
}

interface AlertDialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogFooterProps {
  children: React.ReactNode;
}

interface AlertDialogActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

interface AlertDialogCancelProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({ 
  open, 
  onOpenChange, 
  children 
}) => {
  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => {
        // Only close if clicking the backdrop
        if (e.target === e.currentTarget) {
          onOpenChange?.(false);
        }
      }}
    >
      {children}
    </div>
  );
};

export const AlertDialogContent: React.FC<AlertDialogContentProps> = ({ 
  children 
}) => {
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl w-full max-w-md mx-4 shadow-xl border border-gray-100 animate-in" role="alertdialog">
      {children}
    </div>
  );
};

export const AlertDialogHeader: React.FC<AlertDialogHeaderProps> = ({ 
  children 
}) => {
  return (
    <div className="p-6 border-b">
      {children}
    </div>
  );
};

export const AlertDialogTitle: React.FC<AlertDialogTitleProps> = ({ 
  children 
}) => {
  return (
    <h2 className="text-xl font-semibold text-gray-900">
      {children}
    </h2>
  );
};

export const AlertDialogDescription: React.FC<AlertDialogDescriptionProps> = ({ 
  children,
  className = ''
}) => {
  return (
    <div className={`mt-2 text-sm text-gray-600 ${className}`}>
      {children}
    </div>
  );
};

export const AlertDialogFooter: React.FC<AlertDialogFooterProps> = ({ 
  children 
}) => {
  return (
    <div className="p-6 flex justify-end gap-3">
      {children}
    </div>
  );
};

export const AlertDialogAction: React.FC<AlertDialogActionProps> = ({ 
  children,
  className = '',
  ...props
}) => {
  return (
    <button
      className={`btn btn-primary ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const AlertDialogCancel: React.FC<AlertDialogCancelProps> = ({ 
  children,
  className = '',
  onClick,
  ...props
}) => {
  return (
    <button
      className={`btn btn-secondary ${className}`}
      onClick={(e) => {
        onClick?.(e);
        // Find closest AlertDialog and trigger its onOpenChange
        const dialog = e.currentTarget.closest('[role="alertdialog"]')?.parentElement;
        if (dialog) {
          const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true
          });
          dialog.dispatchEvent(event);
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
};
