import React from 'react';
import { X, Printer, Share2, FileText } from 'lucide-react';
import type { VideoCall } from '../../../types';
import { PDFService } from '../../../utils/pdfService';
import PrintTemplates from '../../pos/PrintTemplates';
import { supabase } from '../../../lib/supabase';
import QuickQuotation from '../../pos/QuickQuotation';

interface QuotationModalProps {
  call: VideoCall;
  onClose: () => void;
}

export const QuotationModal: React.FC<QuotationModalProps> = ({ call, onClose }) => {
  const [loading, setLoading] = React.useState(true);
  const [quotation, setQuotation] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<'create' | 'view'>(
    call.workflow_status?.quotation === 'pending' ? 'create' : 'view'
  );

  React.useEffect(() => {
    if (mode === 'view') {
      fetchQuotation();
    }
  }, [call.id]);

  const fetchQuotation = async () => {
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select(`
          id,
          quotation_number,
          items,
          total_amount,
          status,
          payment_details,
          workflow_status,
          created_at,
          customers (*)
        `)
        .eq('video_call_id', call.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      
      if (!data) {
        setError('No quotation found for this video call');
        return;
      }

      setQuotation(data);
    } catch (error) {
      console.error('Error fetching quotation:', error);
      setError('Failed to load quotation details');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!quotation) return;

    try {
      await PDFService.printContent({
        title: `Quotation #${quotation.quotation_number}`,
        filename: `Quotation_${quotation.quotation_number}.pdf`,
        contentId: 'quotation-preview'
      });
    } catch (error) {
      console.error('Error printing quotation:', error);
      alert('Error printing quotation. Please try again.');
    }
  };

  const handleShare = async () => {
    if (!quotation) return;

    try {
      await PDFService.sharePDF({
        title: `Quotation #${quotation.quotation_number}`,
        filename: `Quotation_${quotation.quotation_number}.pdf`,
        contentId: 'quotation-preview'
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Web Share API not supported') {
          alert('Sharing is not supported on this device/browser');
        } else if (error.name !== 'AbortError') {
          console.error('Error sharing quotation:', error);
          alert('Error sharing quotation. Please try again.');
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b bg-gradient-to-r from-gray-50/80 to-gray-100/80 backdrop-blur">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              {mode === 'create' ? 'Create Quotation' : 'Quotation Details'}
            </h2>
            <div className="text-sm text-gray-500 mt-1">
              <div className="font-mono text-blue-600">Video Call #{call.video_call_number}</div>
              {quotation && (
                <div>Quotation #{quotation.quotation_number}</div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {mode === 'view' && (
              <>
                <button
                  onClick={handlePrint}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
                {navigator.share && (
                  <button
                    onClick={handleShare}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                )}
              </>
            )}
            <button
              onClick={onClose}
              className="btn btn-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50">
          {mode === 'create' ? (
            <div className="p-6">
              <QuickQuotation
                videoCall={call}
                onComplete={onClose}
                customer={call.customers || null}
                disableCustomerSelect={true}
                initialCustomerType={call.customers?.type || 'retailer'}
              />
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
              <span className="ml-3 text-gray-500">Loading quotation...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 bg-red-50 rounded-lg">
              <p className="text-red-600 font-medium">{error}</p>
              <p className="text-sm text-red-500 mt-2">Please try again or contact support if the issue persists.</p>
            </div>
          ) : quotation ? (
            <div id="quotation-preview" className="bg-white shadow-lg rounded-lg p-6">
              <PrintTemplates
                items={quotation.items}
                customerType={quotation.customers?.type || 'retailer'}
                total={quotation.total_amount}
                customer={quotation.customers}
                discount={quotation.items[0]?.discount || 0}
                quotationNumber={quotation.quotation_number}
                gstRate={18}
                template="standard"
                includeGst={true}
              />
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No quotation found for this video call.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
