import React, { useState } from 'react';
import { X, Share2, Printer } from 'lucide-react';
import type { Customer, VideoCall, QuotationItem } from '../../../../types';
import PrintTemplates, { PrintTemplate } from '../../PrintTemplates';
import PrintTemplateSelector from '../../PrintTemplateSelector';
import { PDFService } from '../../../../utils/pdfService';
import { formatCurrency } from '../../../../utils/quotation';

interface PrintPreviewProps {
  onClose: () => void;
  onPrint: () => void;
  items: QuotationItem[];
  customerType: 'wholesaler' | 'retailer';
  customer: Customer | null;
  videoCall: VideoCall | null;
  totals: {
    subtotal: number;
    discountAmount: number;
    total: number;
    gstAmount: number;
    finalTotal: number;
  };
  discount: number;
  gstRate: number;
  includeGst: boolean;
}

const PrintPreview: React.FC<PrintPreviewProps> = ({
  onClose,
  items,
  customerType,
  customer,
  videoCall,
  totals,
  discount,
  gstRate,
  includeGst
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<PrintTemplate>('thermal');
  const [quotationNumber] = useState(() => 
    `Q${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
  );
  const [loading, setLoading] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);

  const pdfOptions = {
    title: `Quotation #${quotationNumber}`,
    filename: `Quotation_${quotationNumber}.pdf`,
    contentId: 'preview-content'
  };

  const handleShare = async () => {
    setLoading(true);
    try {
      await PDFService.sharePDF(pdfOptions);
      onClose();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Web Share API not supported') {
          alert('Sharing is not supported on this device/browser');
        } else if (error.name !== 'AbortError') {
          console.error('Error sharing PDF:', error);
          alert('Error sharing PDF. Please try again.');
        }
      } else {
        alert('Error sharing PDF. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    setLoading(true);
    try {
      await PDFService.printContent(pdfOptions);
      onClose();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">Print Preview</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              disabled={loading}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              {loading ? 'Printing...' : 'Print'}
            </button>
            {navigator.share && (
              <button
                onClick={handleShare}
                disabled={loading}
                className="btn btn-primary flex items-center gap-2"
              >
                <Share2 className="h-4 w-4" />
                {loading ? 'Generating PDF...' : 'Share PDF'}
              </button>
            )}
            <button
              onClick={onClose}
              className="btn btn-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden flex">
          {/* Template Selector */}
          <div className="w-64 border-r p-4 overflow-y-auto">
            <h3 className="font-medium mb-2">Select Template</h3>
            <PrintTemplateSelector
              value={selectedTemplate}
              onChange={setSelectedTemplate}
            />
            
            <div className="mt-4">
              <h3 className="font-medium mb-2">Preview Scale</h3>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={previewScale}
                onChange={(e) => setPreviewScale(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-sm text-gray-500 mt-1 text-center">
                {(previewScale * 100).toFixed(0)}%
              </div>
            </div>
          </div>
          
          {/* Preview */}
          <div className="flex-1 overflow-y-auto p-8 bg-gray-100">
            <div 
              id="preview-content"
              className={`bg-white shadow-lg mx-auto font-mono transform origin-top ${
                selectedTemplate === 'thermal' ? 'thermal-receipt' : ''
              }`}
              style={{ 
                width: selectedTemplate === 'thermal' ? '80mm' : '100%',
                minHeight: 'fit-content',
                padding: selectedTemplate === 'thermal' ? '0' : '2mm',
                boxSizing: 'border-box',
                transform: `scale(${previewScale})`,
                marginBottom: `${(previewScale - 1) * 100}%`
              }}
            >
              <PrintTemplates
                items={items}
                customerType={customerType}
                total={totals.total}
                customer={customer}
                discount={discount}
                videoCall={videoCall}
                quotationNumber={quotationNumber}
                gstRate={gstRate}
                template={selectedTemplate}
                includeGst={includeGst}
              />
            </div>
          </div>
        </div>
        
        {/* Preview Info */}
        {selectedTemplate === 'thermal' && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 text-sm text-gray-600">
            <p>3-inch thermal printer format (80mm width)</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrintPreview;
