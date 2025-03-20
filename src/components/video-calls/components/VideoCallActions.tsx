interface VideoCallActionsProps {
  call: VideoCall;
  onCompleteCall: (call: VideoCall, action: 'start' | 'complete' | 'reschedule' | 'cancel') => void;
  onDelete: () => void;
}

export const VideoCallActions: React.FC<VideoCallActionsProps> = ({
  call,
  onCompleteCall,
  onDelete,
}) => {
  return (
    <div className="flex items-center justify-between pt-2 border-t">
      <div className="flex gap-2">
        {call.status === 'scheduled' && (
          <div className="flex gap-2">
            <button
              className="btn btn-primary bg-gradient-to-r from-green-600 to-green-700 flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <Video className="h-4 w-4" />
              <span>Ready</span>
            </button>
            <button
              onClick={() => onCompleteCall(call, 'reschedule')}
              className="btn btn-secondary flex items-center gap-2 shadow hover:shadow-md transition-shadow"
            >
              <Calendar className="h-4 w-4" />
              <span>Reschedule</span>
            </button>
            <button
              onClick={() => onCompleteCall(call, 'cancel')}
              className="btn btn-secondary bg-gradient-to-r from-red-600 to-red-700 text-white flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <XCircle className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          </div>
        )}
        
        {/* Show End/Reschedule/Cancel for in-progress calls */}
        {call.status === 'in_progress' && (
          <div className="flex gap-2">
            <button
              onClick={() => onCompleteCall(call, 'complete')}
              className="btn btn-primary bg-gradient-to-r from-green-600 to-green-700 flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <Video className="h-4 w-4" />
              <span>Complete</span>
            </button>
            <button
              onClick={() => onCompleteCall(call, 'reschedule')}
              className="btn btn-secondary flex items-center gap-2 shadow hover:shadow-md transition-shadow"
            >
              <Calendar className="h-4 w-4" />
              <span>Reschedule</span>
            </button>
            <button
              onClick={() => onCompleteCall(call, 'cancel')}
              className="btn btn-secondary bg-gradient-to-r from-red-600 to-red-700 text-white flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <XCircle className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          </div>
        )}

        <button
          onClick={onDelete}
          className="p-2 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110"
          title="Delete Video Call"
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </button>
      </div>
    </div>
  );
};
