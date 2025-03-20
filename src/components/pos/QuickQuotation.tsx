import React from 'react';
import { useQuickQuotation } from './QuickQuotation/hooks/useQuickQuotation';
import Header from './QuickQuotation/components/Header';
import CustomerSelector from './QuickQuotation/components/CustomerSelector';
import ProductScanner from './QuickQuotation/components/ProductScanner';
import ItemsTable from './QuickQuotation/components/ItemsTable';
import OrderSummary from './QuickQuotation/components/OrderSummary';
import PrintPreview from './QuickQuotation/components/PrintPreview';
import CounterSaleModal from './QuickQuotation/components/CounterSaleModal';
import { useScanningMode } from '../../hooks/useScanningMode';

const QuickQuotation = () => {
  const { state, actions } = useQuickQuotation();
  const { setScanning } = useScanningMode();

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
    <div className={`bg-white rounded-lg shadow ${state.scanning ? 'scanning-mode' : ''}`}>
      <div className="p-4 space-y-4">
        <Header
          scanning={state.scanning}
          onToggleScanning={() => {
            const newScanningState = !state.scanning;
            actions.setScanning(newScanningState);
            setScanning(newScanningState);
          }}
        />

        <CustomerSelector
          selectedCustomer={state.selectedCustomer}
          customerType={state.customerType}
          isCounterSale={state.isCounterSale}
          customers={state.customers}
          videoCall={state.videoCall}
          disabled={state.scanning}
          onCustomerChange={actions.handleCustomerChange}
          onCustomerTypeChange={(type) => actions.setCustomerType(type)}
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
          onClose={() => actions.setShowCounterSaleModal(false)}
          onSubmit={handleCounterSaleSubmit}
          customerType={state.customerType}
          total={state.totals.finalTotal}
          includeGst={state.includeGst}
        />
      )}
    </div>
  );
};

export default QuickQuotation;
