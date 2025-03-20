import React from 'react';
import { AlertCircle } from 'lucide-react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

interface VideoCall {
  video_call_number: string;
  scheduled_at: string;
  customers?: {
    name: string;
  };
}

interface AssignedStaff {
  staff_name: string;
}

interface VideoCallDeleteDialogProps {
  call: VideoCall;
  assignedStaff: AssignedStaff | null;
  showDialog: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const VideoCallDeleteDialog: React.FC<VideoCallDeleteDialogProps> = ({
  call,
  assignedStaff,
  showDialog,
  onClose,
  onConfirm
}) => {
  const handleClose = () => {
    onClose();
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <AlertDialog open={showDialog} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Video Call</AlertDialogTitle>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <AlertDialogDescription className="!mt-0">
                This action cannot be undone.
              </AlertDialogDescription>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Video call details:</h3>
              <dl className="text-sm text-gray-600 space-y-1 ml-4">
                <div>
                  <dt className="sr-only">Call Number</dt>
                  <dd>Call Number: {call.video_call_number}</dd>
                </div>
                
                <div>
                  <dt className="sr-only">Customer</dt>
                  <dd>Customer: {call.customers?.name}</dd>
                </div>
                
                <div>
                  <dt className="sr-only">Scheduled Time</dt>
                  <dd>Scheduled: {format(new Date(call.scheduled_at), 'PPp')}</dd>
                </div>
                
                {assignedStaff?.staff_name && (
                  <div>
                    <dt className="sr-only">Assigned Staff</dt>
                    <dd>Assigned Staff: {assignedStaff.staff_name}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete Video Call
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default VideoCallDeleteDialog;
