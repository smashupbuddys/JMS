import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Loader2, AlertCircle } from 'lucide-react';
import type { VideoCall } from '../../../types';
import PaymentStatus from '../../pos/PaymentStatus';
import PaymentTimeline from '../../pos/PaymentTimeline';

const VideoCallPayment = () => {
  const { callId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [call, setCall] = React.useState<VideoCall | null>(null);

  React.useEffect(() => {
    if (!callId) return;
    fetchVideoCall();
  }, [callId]);

  const fetchVideoCall = async () => {
    try {
      const { data, error } = await supabase
        .from('video_calls')
        .select(`
          *,
          customers (
            name,
            phone,
            type
          ),
          quotations (
            id,
            total_amount,
            payment_details,
            payment_timeline,
            staff_responses
          )
        `)
        .eq('id', callId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Video call not found');

      setCall(data);
    } catch (error) {
      console.error('Error fetching video call:', error);
      setError(
        error instanceof Error 
          ? error.message 
          : 'Failed to load video call details'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaymentNote = async (data: any) => {
    try {
      const { error } = await supabase
        .from('quotations')
        .update({
          payment_timeline: supabase.sql`array_append(payment_timeline, ${data})`,
          staff_responses: supabase.sql`array_append(staff_responses, ${data})`
        })
        .eq('id', call?.quotations[0].id);

      if (error) throw error;
      fetchVideoCall();
    } catch (error) {
      console.error('Error adding payment note:', error);
      alert('Error adding payment note. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !call || !call.quotations?.[0]) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-red-100 p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <div className="text-red-600 font-medium">{error || 'Video call or quotation not found'}</div>
      </div>
    );
  }

  const quotation = call.quotations[0];

  return (
    <div className="space-y-6">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
        <PaymentStatus
          quotationId={quotation.id}
          billStatus={call.bill_status || 'pending'}
          billAmount={quotation.total_amount}
          billGeneratedAt={call.bill_generated_at || new Date().toISOString()}
          paymentTimeline={quotation.payment_timeline || []}
          staffResponses={quotation.staff_responses || []}
          onAddNote={handleAddPaymentNote}
        />
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
        <PaymentTimeline
          timeline={quotation.payment_timeline || []}
          staffResponses={quotation.staff_responses || []}
        />
      </div>
    </div>
  );
};

export default VideoCallPayment;
