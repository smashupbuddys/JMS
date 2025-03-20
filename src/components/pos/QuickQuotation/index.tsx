import React from 'react';
import { useQuickQuotation } from './hooks/useQuickQuotation';
import Header from './components/Header';
import CustomerSelector from './components/CustomerSelector';
import ProductScanner from './components/ProductScanner';
import ItemsTable from './components/ItemsTable';
import OrderSummary from './components/OrderSummary';
import PrintPreview from './components/PrintPreview';
import CounterSaleModal from './components/CounterSaleModal';
import { useScanningMode } from '../../../hooks/useScanningMode';

interface QuickQuotationProps {
  videoCall?: VideoCall | null;
  onComplete?: () => void;
  customer?: Customer | null;
  disableCustomerSelect?: boolean;
  initialCustomerType?: 'wholesaler' | 'retailer';
}

const QuickQuotation = ({
  videoCall,
  onComplete,
  customer,
  disableCustomerSelect = false,
  initialCustomerType
}: QuickQuotationProps) => {
  const { state, actions } = useQuickQuotation();
  const { setScanning } = useScanningMode();

  // Set initial customer if provided
  React.useEffect(() => {
    if (customer) {
      actions.handleCustomerChange(customer.id);
      actions.setCustomerType(initialCustomerType || customer.type);
      actions.setIsCounterSale(false);
    }
  }, [customer, initialCustomerType]);
  // Set initial video call if provided
  React.useEffect(() => {
    if (videoCall) {
      actions.setVideoCall(videoCall);
      if (videoCall.customers) {
        actions.handleCustomerChange(videoCall.customers.id);
        actions.setCustomerType(videoCall.customers.type);
        actions.setIsCounterSale(false);
      }
    }
  }, [videoCall]);

  const handleUpdateQuantity = (index: number, change: number) => {
    if (state.scanning && !state.items[index]) {
      return;
    }

    actions.setItems(prev => {
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
    if (state.scanning) {
      return;
    }
    actions.setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handlePrint = () => {
    actions.setShowPrintPreview(true);
  };

  const handleCounterSaleSubmit = () => {
    actions.handleCompleteSale();
  };

  return (
    <div className={`bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 ${state.scanning ? 'scanning-mode' : ''}`}>
      <div className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Quick Quotation
          </h2>
          <button
            onClick={() => {
              const newScanningState = !state.scanning;
              actions.setScanning(newScanningState);
              setScanning(newScanningState);
            }}
            className={`btn ${state.scanning ? 'btn-secondary' : 'btn-primary bg-gradient-to-r from-blue-600 to-blue-700'} flex items-center gap-2 w-full sm:w-auto`}
            aria-label={state.scanning ? 'Stop Scanning' : 'Start Scanning'}
          >
            <QrCode className="h-4 w-4" />
            {state.scanning ? 'Stop Scanning' : 'Start Scanning'}
          </button>
        </div>

        <CustomerSelector
          selectedCustomer={state.selectedCustomer}
          customerType={state.customerType}
          isCounterSale={state.isCounterSale}
          customers={state.customers}
          videoCall={state.videoCall}
          disabled={state.scanning || disableCustomerSelect}
          onCustomerChange={actions.handleCustomerChange}
          onCustomerTypeChange={actions.setCustomerType}
        />

        <ProductScanner
          scanning={state.scanning}
          scannedSku={state.scannedSku}
          onScannedSkuChange={actions.setScannedSku}
          onProductSelect={actions.addProduct}
        />

        <ItemsTable
          items={state.items}
          scanning={state.scanning}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
        />

        <OrderSummary
          disabled={state.scanning}
          totals={state.totals}
          discount={state.discount}
          gstRate={state.gstRate}
          includeGst={state.includeGst}
          gstError={state.gstError}
          isAdvancedDiscountEnabled={false}
          showSecretInput={false}
          secretCode=""
          onSecretCodeChange={() => {}}
          onSecretSubmit={() => {}}
          onDiscountChange={actions.setDiscount}
          onGstToggle={() => actions.setIncludeGst(!state.includeGst)}
          onCompleteSale={actions.handleCompleteSale}
          onPrint={handlePrint}
          itemsCount={state.items.length}
          customerType={state.customerType}
          videoCall={state.videoCall}
        />
      </div>

      {state.showPrintPreview && (
        <PrintPreview
          onClose={() => actions.setShowPrintPreview(false)}
          onPrint={handlePrint}
          items={state.items}
          customerType={state.customerType}
          customer={state.selectedCustomer}
          videoCall={state.videoCall}
          totals={state.totals}
          discount={state.discount}
          gstRate={state.gstRate}
          includeGst={state.includeGst}
        />
      )}

      {state.showCounterSaleModal && (
        <CounterSaleModal
          counterSaleDetails={state.counterSaleDetails}
          setCounterSaleDetails={actions.setCounterSaleDetails}
          customerType={state.customerType}
          total={state.totals.finalTotal}
          includeGst={state.includeGst}
          onClose={() => actions.setShowCounterSaleModal(false)}
          onSubmit={handleCounterSaleSubmit}
        />
      )}
    </div>
  );
};

export default QuickQuotation;
