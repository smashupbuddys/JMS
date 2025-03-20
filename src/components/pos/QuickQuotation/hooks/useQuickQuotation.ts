import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { supabase, fetchWithRetry } from '../../../../lib/supabase';
import type { Product, Customer, VideoCall } from '../../../../types';
import { getCachedGSTRate } from '../../../../utils/gstUtils';
import type { QuickQuotationState, QuickQuotationActions } from '../types';
import { generateQuotationNumber, calculateTotals } from '../../../../utils/quotation';
import { completeSale } from '../../../../utils/saleUtils';

export const useQuickQuotation = (): { 
  state: QuickQuotationState; 
  actions: QuickQuotationActions;
} => {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [customerType, setCustomerType] = useState<'wholesaler' | 'retailer'>('retailer');
  const [scanning, setScanning] = useState(false);
  const [scannedSku, setScannedSku] = useState('');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [videoCall, setVideoCall] = useState<VideoCall | null>(null);
  const [isCounterSale, setIsCounterSale] = useState(true);
  const [discount, setDiscount] = useState(0);
  const [gstRate, setGstRate] = useState<number>(18);
  const [showCounterSaleModal, setShowCounterSaleModal] = useState(false);
  const [includeGst, setIncludeGst] = useState(true);
  const [gstError, setGstError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [counterSaleDetails, setCounterSaleDetails] = useState({
    buyerName: '',
    buyerPhone: '',
    deliveryMethod: 'hand_carry',
    paymentStatus: 'paid',
    paidAmount: 0
  });
  const [quotationNumber, setQuotationNumber] = useState(generateQuotationNumber());

  // Calculate totals
  const totals = React.useMemo(() => calculateTotals(items, discount, gstRate, includeGst), [
    items,
    discount,
    gstRate,
    includeGst
  ]);

  // Fetch initial data
  useEffect(() => {
    const customerId = searchParams.get('customer');
    const callId = searchParams.get('call');
    const readonly = searchParams.get('readonly') === 'true';
    
    // Fetch GST rate
    fetchGSTRate();
    
    if (customerId || callId) {
      fetchCustomerAndCall(customerId, callId);
    }
    fetchCustomers();
    fetchGSTRate();

    // If readonly mode, disable editing
    if (readonly) {
      setScanning(false);
    }
  }, [searchParams]);

  // Set initial customer if provided
  useEffect(() => {
    const customer = customers.find(c => c.id === searchParams.get('customer'));
    if (customer) {
      // Only set customer if not already set
      if (!selectedCustomer || selectedCustomer.id !== customer.id) {
        setSelectedCustomer(customer);
        setCustomerType(customer.type);
        setIsCounterSale(false);
      }
    }
  }, [customers, searchParams]);

  // Fetch GST rate
  const fetchGSTRate = async () => {
    try {
      setGstError(null);
      const rate = await getCachedGSTRate();
      setGstRate(rate);
      setRetryCount(0);
    } catch (error) {
      console.error('Error fetching GST rate:', error);
      setGstError('Failed to fetch GST rate. Using default rate (18%).');
      
      if (retryCount < 3) {
        const timeout = Math.pow(2, retryCount) * 1000;
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchGSTRate();
        }, timeout);
      }
    }
  };

  // Fetch customer and call data
  const fetchCustomerAndCall = async (customerId: string | null, callId: string | null) => {
    try {
      if (customerId) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();

        if (customerData) {
          setSelectedCustomer(customerData);
          setCustomerType(customerData.type);
          setIsCounterSale(false);
        }
      }

      if (callId) {
        const { data: callData } = await supabase
          .from('video_calls')
          .select('*')
          .eq('id', callId)
          .single();

        if (callData) {
          setVideoCall(callData);
        }
      }
    } catch (error) {
      console.error('Error fetching customer/call:', error);
    }
  };

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data } = await fetchWithRetry(() =>
        supabase
          .from('customers')
          .select('*')
          .order('name'),
        {
          maxRetries: 3,
          retryDelay: 1000,
          shouldRetry: (error) => {
            // Retry on network errors
            return error.message?.includes('Failed to fetch') ||
                   error.message?.includes('NetworkError') ||
                   error.message?.includes('network') ||
                   error.status === 503 ||
                   error.status === 504;
          },
          onRetry: (attempt) => {
            addToast({
              title: 'Connection Issue',
              message: `Retrying to load customers... (Attempt ${attempt + 1}/3)`,
              type: 'warning'
            });
          }
        }
      );

      if (data) {
        setCustomers(data);
        setError(null);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      setError('Failed to load customers. Please check your connection.');
      // Show user-friendly error message
      Swal.fire({
        title: 'Connection Error',
        text: 'Unable to load customers. Please check your internet connection and try again.',
        icon: 'error',
        confirmButtonText: 'Retry',
        showCancelButton: true,
        cancelButtonText: 'Cancel'
      }).then((result) => {
        if (result.isConfirmed) {
          fetchCustomers();
        }
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle customer selection
  const handleCustomerChange = (customerId: string) => {
    if (customerId === 'counter') {
      setSelectedCustomer(null);
      setIsCounterSale(true);
      setCustomerType('retailer');
    } else {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setSelectedCustomer(customer);
        setCustomerType(customer.type);
        setIsCounterSale(false);
      }
    }
  };

  // Handle product selection
  const addProduct = useCallback((product: Product) => {
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
  }, [customerType]);

  const handleCompleteSale = async () => {
    try {
      const now = new Date().toISOString();
      const readonly = searchParams.get('readonly') === 'true';
      
      if (readonly) {
        Swal.fire({
          title: 'Read-only Mode',
          text: 'This quotation is in read-only mode and cannot be modified.',
          icon: 'info',
          confirmButtonText: 'OK'
        });
        return;
      }

      // Prepare payment details
      const paymentDetails = {
        total_amount: totals.finalTotal,
        paid_amount: isCounterSale && customerType === 'retailer' ? totals.finalTotal : counterSaleDetails.paidAmount,
        pending_amount: isCounterSale && customerType === 'retailer' ? 0 : totals.finalTotal - counterSaleDetails.paidAmount,
        payment_status: isCounterSale && customerType === 'retailer' ? 'completed' : counterSaleDetails.paymentStatus,
        payments: []
      };

      // Add initial payment if any amount is paid
      if (paymentDetails.paid_amount > 0) {
        paymentDetails.payments.push({
          amount: paymentDetails.paid_amount,
          date: now,
          type: paymentDetails.paid_amount === totals.finalTotal ? 'full' : 'partial',
          method: 'cash'
        });
      }

      // For video calls, create quotation and update workflow
      if (videoCall) {
        const quotationData = {
          customer_id: selectedCustomer?.id,
          video_call_id: videoCall.id,
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
          total_amount: totals.finalTotal,
          status: 'draft',
          quotation_number: quotationNumber,
          valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          payment_details: paymentDetails
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
              ...videoCall.workflow_status,
              quotation: 'completed',
              profiling: 'pending'
            }
          })
          .eq('id', videoCall.id);

        if (workflowError) throw workflowError;
        
        Swal.fire({
          title: 'Success!',
          text: 'Quotation saved successfully',
          icon: 'success',
          confirmButtonText: 'OK'
        });
        window.location.href = `/video-calls/${videoCall.id}`;
      } else {
        // Regular counter sale
        if (!selectedCustomer && !counterSaleDetails.buyerName && customerType === 'wholesaler') {
          setShowCounterSaleModal(true);
          return;
        }

        // Complete sale using utility function
        await completeSale({
          items,
          selectedCustomer,
          videoCall: null,
          sale_type: 'counter',
          discount,
          quotationNumber,
          quotation_data: {
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
            total_amount: totals.finalTotal,
            delivery_method: counterSaleDetails.deliveryMethod,
            quotation_number: quotationNumber
          },
          payment_details: paymentDetails
        });

        // Reset form
        setItems([]);
        setDiscount(0);
        setQuotationNumber(generateQuotationNumber());
        setCounterSaleDetails({
          buyerName: '',
          buyerPhone: '',
          deliveryMethod: 'hand_carry',
          paymentStatus: customerType === 'retailer' ? 'paid' : 'pending',
          paidAmount: customerType === 'retailer' ? totals.finalTotal : 0
        });

        Swal.fire({
          title: 'Success!',
          text: 'Sale completed successfully',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      console.error('Error completing sale:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to complete sale. Please try again.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  };

  return {
    state: {
      items,
      customerType,
      scanning,
      scannedSku,
      showPrintPreview,
      customers,
      selectedCustomer,
      videoCall,
      isCounterSale,
      discount,
      gstRate,
      showCounterSaleModal,
      totals,
      quotationNumber,
      includeGst,
      gstError,
      counterSaleDetails,
    },
    actions: {
      setItems,
      setCustomerType,
      setScanning,
      setScannedSku,
      setShowPrintPreview,
      setSelectedCustomer,
      setVideoCall,
      setIsCounterSale,
      setDiscount,
      setShowCounterSaleModal,
      setQuotationNumber,
      handleCustomerChange,
      addProduct,
      fetchCustomers,
      fetchGSTRate,
      setIncludeGst,
      setCounterSaleDetails,
      handleCompleteSale
    },
  };
};
