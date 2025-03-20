import React from 'react';
import { useToast } from '../hooks/useToast';
import { Toast } from './ui/toast';
import { useEffect, useRef } from 'react';

const NOTIFICATION_DELAY = 2000; // 2 seconds between notifications

export const ToastContainer = () => {
  const { toasts, removeToast } = useToast();
  const toastQueue = useRef<string[]>([]);
  const isProcessing = useRef(false);

  useEffect(() => {
    const processToastQueue = async () => {
      if (toastQueue.current.length === 0) {
        isProcessing.current = false;
        return;
      }

      isProcessing.current = true;
      const toastId = toastQueue.current[0];

      await new Promise(resolve => setTimeout(resolve, NOTIFICATION_DELAY));
      removeToast(toastId);
      toastQueue.current.shift();

      if (toastQueue.current.length > 0) {
        processToastQueue();
      } else {
        isProcessing.current = false;
      }
    };

    if (toasts.length > 0 && !isProcessing.current) {
      toastQueue.current = toasts.map(t => t.id);
      processToastQueue();
    }
  }, [toasts, removeToast]);

  return (
    <div className="fixed bottom-0 right-0 z-50 p-4 space-y-4">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={removeToast} />
      ))}
    </div>
  );
};
