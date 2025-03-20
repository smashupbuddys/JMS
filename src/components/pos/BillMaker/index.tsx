import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Calculator } from 'lucide-react';
import Swal from 'sweetalert2';
import { supabase } from '../../../lib/supabase';
import { useScanningMode } from '../../../hooks/useScanningMode';
import { useToast } from '../../../hooks/useToast';
import { playCashRegisterSound } from '../../../utils/soundUtils';
import { generateQuotationNumber } from '../../../utils/quotation';
import { completeSale } from '../../../utils/saleUtils';

// Components
import CustomerSection from './components/CustomerSection';
import ProductScanner from './components/ProductScanner';
import ItemsTable from './components/ItemsTable';
import OrderSummary from './components/OrderSummary';
import PrintPreview from './components/PrintPreview';
import CounterSaleModal from './components/CounterSaleModal';

// Types
import type { Customer, Product, QuotationItem } from '../../../types';

// Constants
const PAYMENT_STATUS = {
  PAID: 'paid',
  UNPAID: 'unpaid',
  PARTIALLY_PAID: 'partially_paid',
  CANCELLED: 'cancelled'
};

const PAYMENT_METHODS = {
  CASH: 'cash',
  UPI: 'upi',
  BANK_TRANSFER: 'bank_transfer',
  CARD: 'card'
};

// Retail purchase threshold that requires customer details
const RETAIL_THRESHOLD = 5000;

const BillMaker = () => {
  // State
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [customerType, setCustomerType] = useState<'wholesaler' | 'retailer'>('retailer');
  const [scanning, setScanning] = useState(false);
  const [scannedSku, setScannedSku] = useState('');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCounterSale, setIsCounterSale] = useState(true);
  const [discount, setDiscount] = useState(0);
  const [gstRate, setGstRate] = useState(18);
  const [includeGst, setIncludeGst] = useState(true);
  const [showCounterSaleModal, setShowCounterSaleModal] = useState(false);
  const [quotationNumber, setQuotationNumber] = useState(generateQuotationNumber());
  const [counterSaleDetails, setCounterSaleDetails] = useState({
    buyerName: '',
    buyerPhone: '',
    deliveryMethod: 'hand_carry',
    paymentStatus: PAYMENT_STATUS.PAID,
    paidAmount: 0,
    buyerCategory: [] as string[],
    paymentMethod: PAYMENT_METHODS.CASH
  });

  // Hooks
  const { setScanning: setScanningMode } = useScanningMode();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Calculate totals
  const totals = React.useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = customerType === 'retailer' 
      ? Math.min(discount, subtotal) // Fixed amount discount for retailers
      : (subtotal * discount) / 100; // Percentage discount for wholesalers
    const total = subtotal - discountAmount;
    const gstAmount = includeGst ? (total * gstRate) / 100 : 0;
    const finalTotal = total + gstAmount;

    return {
      subtotal,
      discountAmount,
      total,
      gstAmount,
      finalTotal
    };
  }, [items, discount, gstRate, includeGst, customerType]);

  // Handlers
  const handleAddProduct = (product: Product) => {
    setItems(prev => {
      const existingItem = prev.find(item => item.product.id === product.id);
      
      if (existingItem) {
        const newQuantity = existingItem.quantity + 1;
        
        if (newQuantity > product.stockLevel) {
          Swal.fire({
            title: 'Stock Limit Reached',
            text: `Cannot add more ${product.name}. Maximum stock level reached.`,
            icon: 'warning'
          });
          return prev;
        }

        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: newQuantity }
            : item
        );
      }

      const price = customerType === 'wholesaler' ? 
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

  // Helper function to send receipt via email
  const sendReceiptEmail = async (email: string, quotationNumber: string, items: QuotationItem[], totals: any) => {
    try {
      // Simulate email sending for now
      console.log(`Sending email receipt to ${email} for bill #${quotationNumber}`);
      
      // Show success message
      addToast({
        title: 'Receipt Sent',
        message: `Email receipt has been sent to ${email}`,
        type: 'success'
      });
      
      return true;
    } catch (error) {
      console.error('Error sending email receipt:', error);
      addToast({
        title: 'Email Failed',
        message: 'Could not send email receipt',
        type: 'error'
      });
      return false;
    }
  };

  // Helper function to reset the form after successful sale
  const resetForm = () => {
    setItems([]);
    setDiscount(0);
    setSelectedCustomer(null);
    setIsCounterSale(true);
    setCustomerType('retailer');
    setCounterSaleDetails({
      buyerName: '',
      buyerPhone: '',
      deliveryMethod: 'hand_carry',
      paymentStatus: PAYMENT_STATUS.PAID,
      paidAmount: 0,
      buyerCategory: [],
      paymentMethod: PAYMENT_METHODS.CASH
    });
    // Generate a new quotation number for the next sale
    setQuotationNumber(generateQuotationNumber());
  };

  const handleCompleteSale = async () => {
    try {
      if (items.length === 0) {
        Swal.fire({
          title: 'Error',
          text: 'Please add items to complete the sale',
          icon: 'error'
        });
        return;
      }

      // Step 1: Determine if we need to collect additional details
      if (customerType === 'wholesaler' && !selectedCustomer && !counterSaleDetails.buyerName) {
        // Show modal to collect wholesaler details
        setShowCounterSaleModal(true);
        return;
      }

      // Step 2: For retailers with high value purchase, show modal if exceeds threshold
      if (customerType === 'retailer' && !selectedCustomer && totals.finalTotal > RETAIL_THRESHOLD && !counterSaleDetails.buyerName) {
        setShowCounterSaleModal(true);
        return;
      }

      // Step 3: Prompt for payment method if not already selected
      let paymentMethod = counterSaleDetails.paymentMethod;
      
      if (counterSaleDetails.paymentStatus === PAYMENT_STATUS.PAID && !counterSaleDetails.paymentMethod) {
        const { value: selectedPaymentMethod } = await Swal.fire({
          title: 'Select Payment Method',
          input: 'radio',
          inputOptions: {
            [PAYMENT_METHODS.CASH]: 'Cash (Offline)',
            [PAYMENT_METHODS.UPI]: 'UPI',
            [PAYMENT_METHODS.BANK_TRANSFER]: 'Bank Transfer',
            [PAYMENT_METHODS.CARD]: 'Card'
          },
          inputValidator: (value) => {
            if (!value) {
              return 'You need to select a payment method!';
            }
            return null;
          },
          inputValue: PAYMENT_METHODS.CASH,
          confirmButtonText: 'Proceed',
          showCancelButton: true
        });
        
        if (!selectedPaymentMethod) return; // User cancelled
        paymentMethod = selectedPaymentMethod;
        
        // Update payment method in details
        setCounterSaleDetails(prev => ({
          ...prev,
          paymentMethod: selectedPaymentMethod
        }));
      }

      // Step 4: Handle payment amount calculations
      let paidAmount = totals.finalTotal;
      let paymentStatus = PAYMENT_STATUS.PAID;
      let pendingAmount = 0;
      
      // If we're dealing with a wholesaler who might have partial payment
      if (customerType === 'wholesaler') {
        if (counterSaleDetails.paymentStatus === PAYMENT_STATUS.PARTIALLY_PAID) {
          paidAmount = counterSaleDetails.paidAmount;
          pendingAmount = totals.finalTotal - paidAmount;
          paymentStatus = PAYMENT_STATUS.PARTIALLY_PAID;
        } else if (counterSaleDetails.paymentStatus === PAYMENT_STATUS.UNPAID) {
          paidAmount = 0;
          pendingAmount = totals.finalTotal;
          paymentStatus = PAYMENT_STATUS.UNPAID;
        }
      }
      
      // Step 5: Prepare payment details with correct structure
      const paymentDetails = {
        total_amount: totals.finalTotal,
        paid_amount: Number(Math.round(paidAmount * 100) / 100),
        pending_amount: Number(Math.round(pendingAmount * 100) / 100),
        payment_status: paymentStatus,
        payments: paidAmount > 0 ? [{
          amount: Number(Math.round(paidAmount * 100) / 100),
          date: new Date().toISOString(),
          type: paymentStatus === PAYMENT_STATUS.PAID ? 'full' : 'partial',
          method: paymentMethod
        }] : []
      };

      // Step 6: Prepare quotation data including manufacturer information
      const quotationData = {
        items: items.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          price: item.price,
          product: {
            name: item.product.name,
            sku: item.product.sku,
            description: item.product.description,
            manufacturer: item.product.manufacturer,
            category: item.product.category
          }
        })),
        total_amount: totals.finalTotal,
        quotation_number: quotationNumber,
        delivery_method: counterSaleDetails.deliveryMethod || 'hand_carry'
      };

      // Step 7: Process the sale
      const saleResult = await completeSale({
        sale_type: 'counter',
        customer_id: selectedCustomer?.id || null,
        video_call_id: null,
        quotation_data: quotationData,
        payment_details: paymentDetails
      });

      // Step 8: Play cash register sound
      playCashRegisterSound();

      // Step 9: Ask about receipt preference
      const { value: receiptPreference } = await Swal.fire({
        title: 'Receipt Options',
        html: 'How would you like to receive the receipt?',
        input: 'radio',
        inputOptions: {
          'print': 'Print physical receipt',
          'email': 'Email digital receipt',
          'both': 'Both print and email',
          'none': 'No receipt needed'
        },
        inputValue: 'print',
        showCancelButton: true,
        confirmButtonText: 'Confirm'
      });

      // Step 10: Handle receipt generation based on preference
      if (receiptPreference && receiptPreference !== 'none') {
        if (receiptPreference === 'print' || receiptPreference === 'both') {
          // Show print preview
          setShowPrintPreview(true);
        }
        
        if ((receiptPreference === 'email' || receiptPreference === 'both')) {
          const email = selectedCustomer?.email || counterSaleDetails.buyerEmail;
          
          if (email) {
            // Send email receipt
            await sendReceiptEmail(email, quotationNumber, items, totals);
          } else {
            // Prompt for email if not available
            const { value: emailAddress } = await Swal.fire({
              title: 'Enter Email Address',
              input: 'email',
              inputLabel: 'Where should we send the receipt?',
              inputPlaceholder: 'Enter email address',
              showCancelButton: true,
              confirmButtonText: 'Send Receipt'
            });
            
            if (emailAddress) {
              await sendReceiptEmail(emailAddress, quotationNumber, items, totals);
              
              // Save email for future reference if it's a counter sale
              if (!selectedCustomer && counterSaleDetails.buyerName) {
                setCounterSaleDetails(prev => ({
                  ...prev,
                  buyerEmail: emailAddress
                }));
              }
            }
          }
        }
      }

      // Step 11: Success message
      Swal.fire({
        title: 'Sale Completed!',
        text: `Bill #${quotationNumber} has been successfully created`,
        icon: 'success',
        confirmButtonText: 'Start New Sale'
      });

      // Step 12: Reset form for new sale
      resetForm();

    } catch (error) {
      console.error('Error completing sale:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }

      Swal.fire({
        title: 'Error',
        text: error instanceof Error ? error.message : 'Failed to complete sale. Please try again.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
          Bill Maker
        </h2>
        <button
          onClick={() => {
            const newScanningState = !scanning;
            setScanning(newScanningState);
            setScanningMode(newScanningState);
          }}
          className={`btn ${scanning ? 'btn-secondary' : 'btn-primary'} flex items-center gap-2`}
        >
          <Calculator className="h-4 w-4" />
          {scanning ? 'Stop Scanning' : 'Start Scanning'}
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100">
        <div className="p-6 space-y-6">
          {/* Customer Section */}
          <CustomerSection
            selectedCustomer={selectedCustomer}
            customerType={customerType}
            isCounterSale={isCounterSale}
            onCustomerChange={setSelectedCustomer}
            onCustomerTypeChange={setCustomerType}
            onCounterSaleChange={setIsCounterSale}
          />

          {/* Product Scanner/Search */}
          <ProductScanner
            scanning={scanning}
            scannedSku={scannedSku}
            onScannedSkuChange={setScannedSku}
            onProductSelect={handleAddProduct}
          />

          {/* Items Table */}
          <ItemsTable
            items={items}
            scanning={scanning}
            onUpdateQuantity={(index, change) => {
              setItems(prev => {
                const newItems = [...prev];
                const item = newItems[index];
                const newQuantity = item.quantity + change;

                if (newQuantity < 1) {
                  return prev.filter((_, i) => i !== index);
                }

                if (newQuantity > item.product.stockLevel) {
                  Swal.fire({
                    title: 'Stock Limit Reached',
                    text: `Cannot add more ${item.product.name}. Maximum stock level reached.`,
                    icon: 'warning'
                  });
                  return prev;
                }

                newItems[index] = {
                  ...item,
                  quantity: newQuantity
                };
                return newItems;
              });
            }}
            onRemoveItem={(index) => {
              setItems(prev => prev.filter((_, i) => i !== index));
            }}
          />

          {/* Order Summary */}
          <OrderSummary
            disabled={scanning}
            totals={totals}
            discount={discount}
            gstRate={gstRate}
            includeGst={includeGst}
            onDiscountChange={setDiscount}
            onGstToggle={() => setIncludeGst(!includeGst)}
            onCompleteSale={handleCompleteSale}
            onPrint={() => setShowPrintPreview(true)}
            itemsCount={items.length}
            customerType={customerType}
          />
        </div>
      </div>

      {/* Modals */}
      {showPrintPreview && (
        <PrintPreview
          onClose={() => setShowPrintPreview(false)}
          items={items}
          customerType={customerType}
          customer={selectedCustomer}
          totals={totals}
          discount={discount}
          gstRate={gstRate}
          includeGst={includeGst}
        />
      )}

      {showCounterSaleModal && (
        <CounterSaleModal
          counterSaleDetails={counterSaleDetails}
          setCounterSaleDetails={setCounterSaleDetails}
          customerType={customerType}
          total={totals.finalTotal}
          onClose={() => setShowCounterSaleModal(false)}
          onSubmit={handleCompleteSale}
        />
      )}
    </div>
  );
};

export default BillMaker;