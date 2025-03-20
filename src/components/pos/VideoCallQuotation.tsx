import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Video, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ProductScanner from './QuickQuotation/components/ProductScanner';
import ItemsTable from './QuickQuotation/components/ItemsTable';
import OrderSummary from './QuickQuotation/components/OrderSummary';
import PrintPreview from './QuickQuotation/components/PrintPreview';
import { generateQuotationNumber } from '../../utils/quotation';
import type { VideoCall, QuotationItem } from '../../types';

interface VideoCallQuotationProps {
  callId: string;
  call: VideoCall;
}

const VideoCallQuotation: React.FC<VideoCallQuotationProps> = ({ callId, call }) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [videoCall, setVideoCall] = React.useState<VideoCall>(call);
  const [items, setItems] = React.useState<QuotationItem[]>([]);
  const [scanning, setScanning] = React.useState(false);
  const [scannedSku, setScannedSku] = React.useState('');
  const [showPrintPreview, setShowPrintPreview] = React.useState(false);
  const [discount, setDiscount] = React.useState(0);
  const [gstRate, setGstRate] = React.useState(18);
  const [includeGst, setIncludeGst] = React.useState(true);
  const [quotationNumber] = React.useState(generateQuotationNumber());

  // Fetch video call data when component mounts
  React.useEffect(() => {
    setLoading(false);
  }, []);

  const handleAddProduct = (product: any) => {
    setItems(prev => {
      const existingItem = prev.find(item => item.product.id === product.id);
      
      if (existingItem) {
        const newQuantity = existingItem.quantity + 1;
        
        if (newQuantity > product.stockLevel) {
          alert(`Cannot add more ${product.name}. Stock limit reached!`);
          return prev;
        }

        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: newQuantity }
            : item
        );
      }

      const price = videoCall?.customers?.type === 'wholesaler' ? 
        Number(product.wholesalePrice) : 
        Number(product.retailPrice);

      return [...prev, {
        product,
        quantity: 1,
        price,
        originalPrice: Number(product.wholesalePrice)
      }];
    });
  };

  const handleUpdateQuantity = (index: number, change: number) => {
    if (scanning && !items[index]) {
      return;
    }

    setItems(prev => {
      const newItems = [...prev];
      const item = newItems[index];
      const newQuantity = item.quantity + change;

      if (newQuantity < 1) {
        return prev.filter((_, i) => i !== index);
      }

      if (newQuantity > item.product.stockLevel) {
        alert(`Cannot add more ${item.product.name}. Stock limit reached!`);
        return prev;
      }

      newItems[index] = {
        ...item,
        quantity: newQuantity
      };
      return newItems;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (scanning) {
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handlePrint = () => {
    setShowPrintPreview(true);
  };

  const handleCompleteSale = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const discountAmount = (subtotal * discount) / 100;
      const total = subtotal - discountAmount;
      const gstAmount = includeGst ? (total * gstRate) / 100 : 0;
      const finalTotal = total + gstAmount;

      // Create quotation
      const quotationData = {
        customer_id: videoCall?.customer_id,
        video_call_id: callId,
        items: items.map(item => ({
          product_id: item.product.id,
          quantity: Number(item.quantity),
          price: Number(item.price),
          discount: Number(discount),
          product: {
            name: item.product.name,
            sku: item.product.sku,
            description: item.product.description,
            manufacturer: item.product.manufacturer,
            category: item.product.category,
            imageUrl: item.product.imageUrl
          }
        })),
        total_amount: finalTotal,
        status: 'draft',
        quotation_number: quotationNumber,
        valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const { data: quotation, error: quotationError } = await supabase
        .from('quotations')
        .insert([quotationData])
        .select()
        .single();

      if (quotationError) throw quotationError;

      // Update video call workflow status
      const { error: workflowError } = await supabase
        .from('video_calls')
        .update({
          quotation_id: quotation.id,
          workflow_status: {
            ...videoCall?.workflow_status,
            quotation: 'completed',
            profiling: 'pending'
          }
        })
        .eq('id', callId);

      if (workflowError) throw workflowError;

      alert('Quotation saved successfully!');
      window.location.href = `/video-calls/${callId}`;
    } catch (error) {
      console.error('Error saving quotation:', error);
      setError('Failed to save quotation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  if (error || !videoCall) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg">
        {error || 'Video call not found'}
      </div>
    );
  }

  const totals = {
    subtotal: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    discountAmount: (items.reduce((sum, item) => sum + (item.price * item.quantity), 0) * discount) / 100,
    total: items.reduce((sum, item) => sum + (item.price * item.quantity), 0) * (1 - discount / 100),
    gstAmount: includeGst ? (items.reduce((sum, item) => sum + (item.price * item.quantity), 0) * (1 - discount / 100) * gstRate / 100) : 0,
    finalTotal: items.reduce((sum, item) => sum + (item.price * item.quantity), 0) * (1 - discount / 100) * (1 + (includeGst ? gstRate / 100 : 0))
  };

  return (
    <div className={`bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 ${scanning ? 'scanning-mode' : ''}`}>
      <div className="p-4 space-y-4">
        {/* Header with Back Link */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to={`/video-calls/${callId}`}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2 group"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Video Call
              <span className="text-xs font-mono bg-blue-50 px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                #{videoCall.video_call_number}
              </span>
            </Link>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent flex items-center gap-2">
              <Video className="h-6 w-6" />
              Create Quotation
            </h2>
          </div>
          <button
            onClick={() => setScanning(!scanning)}
            className={`btn ${scanning ? 'btn-secondary' : 'btn-primary bg-gradient-to-r from-blue-600 to-blue-700'} flex items-center gap-2`}
          >
            {scanning ? 'Stop Scanning' : 'Start Scanning'}
          </button>
        </div>

        {/* Video Call Info */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Video Call Details</h3>
              <p className="text-sm text-gray-600">
                Customer: {videoCall.customers?.name} ({videoCall.customers?.type})
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">
                Scheduled: {new Date(videoCall.scheduled_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <ProductScanner
          scanning={scanning}
          scannedSku={scannedSku}
          onScannedSkuChange={setScannedSku}
          onProductSelect={handleAddProduct}
        />

        <ItemsTable
          items={items}
          scanning={scanning}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
        />

        <OrderSummary
          disabled={scanning || loading}
          totals={totals}
          discount={discount}
          gstRate={gstRate}
          includeGst={includeGst}
          gstError={null}
          isAdvancedDiscountEnabled={false}
          showSecretInput={false}
          secretCode=""
          onSecretCodeChange={() => {}}
          onSecretSubmit={() => {}}
          onDiscountChange={setDiscount}
          onGstToggle={() => setIncludeGst(!includeGst)}
          onCompleteSale={handleCompleteSale}
          onPrint={handlePrint}
          itemsCount={items.length}
          customerType={videoCall.customers?.type || 'retailer'}
          videoCall={videoCall}
        />
      </div>

      {showPrintPreview && (
        <PrintPreview
          onClose={() => setShowPrintPreview(false)}
          onPrint={handlePrint}
          items={items}
          customerType={videoCall.customers?.type || 'retailer'}
          customer={videoCall.customers || null}
          videoCall={videoCall}
          totals={totals}
          discount={discount}
          gstRate={gstRate}
          includeGst={includeGst}
        />
      )}
    </div>
  );
};

export default VideoCallQuotation;
