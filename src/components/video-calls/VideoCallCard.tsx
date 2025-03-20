<div className="flex-1">
  <div className="font-semibold text-gray-900">{call.customers?.name}</div>
  <div className="text-gray-500">
    <div className="text-xs font-mono text-blue-600">Video Call #{call.video_call_number}</div>
    {formatDateTime(call.scheduled_at, call.time_zone || getLocalTimeZone()).local}
    <div className="text-xs text-blue-600">
      {formatDateTime(call.scheduled_at).utc} (UTC)
    </div>
  </div>
  <div className="flex items-center justify-between mt-4">
    <WorkflowStatus 
      status={call.workflow_status || {}} 
      callId={call.id}
      callNumber={call.video_call_number}
      quotationId={call.quotation_id}
    />
    <div className="flex gap-2">
      {call.status === 'scheduled' && call.workflow_status?.video_call === 'pending' && (
        <button
          onClick={() => onCompleteCall(call, 'start')}
          className="btn btn-primary bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2"
        >
          <Video className="h-4 w-4" />
          <span>Start</span>
        </button>
      )}
      {call.workflow_status?.video_call === 'in_progress' && (
        <div className="flex gap-2">
        <button
          onClick={() => onCompleteCall(call, 'complete')}
          className="btn btn-primary bg-gradient-to-r from-green-600 to-green-700 flex items-center gap-2"
        >
          <Video className="h-4 w-4" />
          <span>Complete</span>
        </button>
        <button
          onClick={() => onCompleteCall(call, 'reschedule')}
          className="btn btn-secondary flex items-center gap-2"
        >
          <Calendar className="h-4 w-4" />
          <span>Reschedule</span>
        </button>
        <button
          onClick={() => onCompleteCall(call, 'cancel')}
          className="btn btn-secondary bg-gradient-to-r from-red-600 to-red-700 text-white flex items-center gap-2"
        >
          <XCircle className="h-4 w-4" />
          <span>Cancel</span>
        </button>
        </div>
      )}
    </div>
  </div>
</div>
