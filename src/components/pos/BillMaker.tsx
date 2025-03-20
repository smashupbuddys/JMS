import React, { useState, useEffect } from 'react';
import { Plus, Search, Phone, User, Calculator, QrCode, Scan, Package, Trash2, UploadCloud, X } from 'lucide-react';
import Swal from 'sweetalert2';
import type { Product, Customer } from '../../types';
import { supabase, fetchWithRetry } from '../../lib/supabase';
import { getCachedGSTRate } from '../../utils/gstUtils'; 
import { calculateTotals, validateQuotation, validateBilling } from '../../utils/quotation';
import { QRCodeSVG } from 'qrcode.react';
import CounterSaleModal from './CounterSaleModal'; 
import ProductScanner from './ProductScanner';
import { useScanningMode } from '../../hooks/useScanningMode';
import { formatPhoneNumber, searchPhoneNumber } from '../../utils/phoneUtils';
import { completeSale, formatPaymentDetails } from '../../utils/saleUtils';
import ProductSearch from './ProductSearch';
import ItemsTable from './QuickQuotation/components/ItemsTable';
import OrderSummary from './QuickQuotation/components/OrderSummary';
import PrintPreview from './QuickQuotation/components/PrintPreview';
import { generateQuotationNumber } from '../../utils/quotation';

interface CounterSaleDetails {
  buyerName: string;
  buyerPhone: string;
  deliveryMethod: string;
  paymentStatus: string;
  paidAmount: number;
}

interface QuotationItem {
  product: Product;
  quantity: number;
  price: number;
  originalPrice: number;
}

const BillMaker = () => {
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [customerType, setCustomerType] = useState<'wholesaler' | 'retailer'>('retailer');
  const [scanning, setScanning] = useState(false);
  const [scannedSku, setScannedSku] = useState('');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCounterSale, setIsCounterSale] = useState(true);
  const [discount, setDiscount] = useState(0);
  const [gstRate, setGstRate] = useState<number>(18);
  const [gstError, setGstError] = useState<string | null>(null);
  const [showCounterSaleModal, setShowCounterSaleModal] = useState(false);
  const [includeGst, setIncludeGst] = useState(true);
  const [counterSaleDetails, setCounterSaleDetails] = useState<CounterSaleDetails>({
    buyerName: "",
    buyerPhone: "",
    deliveryMethod: "hand_carry",
    paymentStatus: "paid",
    paidAmount: 0,
  });
  const [quotationNumber] = useState(generateQuotationNumber());
  const [phoneSearch, setPhoneSearch] = useState('');
  const { setScanning: setScanningMode } = useScanningMode();
  const [retryCount, setRetryCount] = useState(0);
  const [showQR, setShowQR] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<string>('0');
  
  // Calculate totals
  const totals = React.useMemo(() => calculateTotals(items, selectedCustomer, discount, gstRate, includeGst), [
    items,
    selectedCustomer,
    discount,
    gstRate,
    includeGst
  ]);

  useEffect(() => {
    fetchGSTRate();
  }, []);

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

  const handlePhoneSearch = async (phone: string) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .filter('phone', 'ilike', `%${phone}%`)
        .limit(1)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116') {
          // No customer found
          setSelectedCustomer(null);
          setIsCounterSale(true);
        } else {
          throw error;
        }
      } else if (data) {
        setSelectedCustomer(data);
        setCustomerType(data.type);
        setIsCounterSale(false);
      }
    } catch (error) {
      console.error('Error searching customer:', error);
      if (error.message?.includes('Failed to fetch')) {
        Swal.fire({
          title: 'Connection Error',
          text: 'Unable to search customers. Please check your internet connection.',
          icon: 'warning',
          confirmButtonText: 'OK'
        });
      }
    }
  };

  const handleAddProduct = (product: Product) => {
    setItems(prev => {
      const existingItem = prev.find(item => item.product.id === product.id);
      
      if (existingItem) {
        const newQuantity = existingItem.quantity + 1;
        
        if (newQuantity > product.stockLevel) {
          Swal.fire({
            title: 'Stock Limit Reached',
            text: `Cannot add more ${product.name}. Maximum stock level reached.`,
            icon: 'warning',
            confirmButtonText: 'OK'
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

  const handleUpdateQuantity = (index: number, change: number) => {
    // Prevent updates if item doesn't exist
    if (!items[index]) {
      return;
    }

    setItems(prev => {
      const newItems = [...prev];
      const item = newItems[index];
      
      // Calculate new quantity
      const newQuantity = item.quantity + change;

      // Remove item if quantity would be less than 1
      if (newQuantity < 1) {
        return prev.filter((_, i) => i !== index);
      }

      // Check stock limit
      if (newQuantity > item.product.stockLevel) {
        Swal.fire({
          title: 'Stock Limit Reached',
          text: `Cannot add more ${item.product.name}. Maximum stock level reached.`,
          icon: 'warning',
          confirmButtonText: 'OK'
        });
        return prev;
      }

      // Update quantity and recalculate totals
      newItems[index] = {
        ...item,
        quantity: newQuantity
      };

      return newItems;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
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

      // Validate items and quantities
      const validationError = validateQuotation(items);
      if (validationError) {
        throw new Error(validationError);
      }

      // Validate billing details
      const billingValidation = await validateBilling(selectedCustomer, items, totals.finalTotal);
      if (!billingValidation.valid) {
        throw new Error(billingValidation.message);
      }

      // Show counter sale modal for wholesalers without customer details
      if (customerType === 'wholesaler' && !selectedCustomer && !counterSaleDetails.buyerName) {
        setShowCounterSaleModal(true);
        return;
      }

      // Format payment details
      const paymentDetails = formatPaymentDetails({
        total_amount: totals.finalTotal,
        paid_amount: customerType === 'retailer' ? totals.finalTotal : counterSaleDetails.paidAmount,
        pending_amount: customerType === 'retailer' ? 0 : Math.max(0, totals.finalTotal - counterSaleDetails.paidAmount),
        payment_status: customerType === 'retailer' ? 'completed' : (
          counterSaleDetails.paidAmount === 0 ? 'pending' :
          Math.abs(counterSaleDetails.paidAmount - totals.finalTotal) < 0.01 ? 'completed' : 'partial'
        ),
        payments: [{
          amount: customerType === 'retailer' ? totals.finalTotal : counterSaleDetails.paidAmount,
          date: new Date().toISOString(),
          type: customerType === 'retailer' ? 'full' : 'partial',
          method: counterSaleDetails.paymentMethod || 'cash'
        }]
      });

      // Complete sale using utility function
      await completeSale({
        sale_type: 'counter',
        customer_id: selectedCustomer?.id || null,
        video_call_id: null,
        quotation_data: {
          items: items.map(item => ({
            product_id: item.product.id,
            quantity: Number(item.quantity),
            price: Number(item.price),
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
        },
        payment_details: paymentDetails,
        customer_analytics: {
          categories: counterSaleDetails.buyerCategory,
          email: counterSaleDetails.buyerEmail,
          customerType,
          buyerName: counterSaleDetails.buyerName,
          buyerPhone: counterSaleDetails.buyerPhone
        }
      });

      // Show success message with print option
      await Swal.fire({
        title: 'Success!',
        text: `Bill #${quotationNumber} has been generated successfully.`,
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Print Bill',
        cancelButtonText: 'Close'
      }).then((result) => {
        if (result.isConfirmed) {
          setShowPrintPreview(true);
        }
      });

      // Reset form
      setItems([]);
      setDiscount(0);
      setSelectedCustomer(null);
      setIsCounterSale(true);
      setCustomerType('retailer');
      setCounterSaleDetails({
        buyerName: '',
        buyerPhone: '',
        deliveryMethod: 'hand_carry',
        paymentStatus: 'paid',
        paidAmount: 0,
        paymentMethod: 'cash',
        buyerCategory: [],
        buyerEmail: ''
      });
    } catch (error) {
      console.error('Error completing sale:', error);
      Swal.fire({
        title: 'Error',
        text: error instanceof Error ? error.message : 'Failed to complete sale. Please try again.',
        icon: 'error'
      });
    }
  };
  
  const handleBulkScan = async (items: Array<{sku: string, quantity: number}>) => {
    if (!items || items.length === 0) return;
    
    try {
      // Show loading indicator
      Swal.fire({
        title: 'Processing...',
        text: `Processing ${items.length} scanned items`,
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Process items in batches to avoid overwhelming the server
      const batchSize = 5;
      const batches = [];

      for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
      }

      let totalProcessed = 0;
      let errorCount = 0;

      for (const batch of batches) {
        await Promise.all(batch.map(async (item) => {
          try {
            // Get product details from database
            const { data, error } = await supabase
              .from('products')
              .select('*')
              .eq('sku', item.sku)
              .maybeSingle();

            if (error) throw error;
            if (!data) throw new Error(`Product not found: ${item.sku}`);

            // Convert to Product type
            const product: Product = {
              id: data.id,
              name: data.name || item.sku,
              description: data.description || '',
              manufacturer: data.manufacturer || '',
              category: data.category || '',
              sku: data.sku,
              buyPrice: Number(data.buy_price || 0),
              wholesalePrice: Number(data.wholesale_price || 0),
              retailPrice: Number(data.retail_price || 0),
              stockLevel: Number(data.stock_level || 0),
              imageUrl: data.image_url || '',
              qrCode: data.qr_code || '',
              code128: data.code128 || '',
              cipher: data.cipher || '',
              additionalInfo: data.additional_info || ''
            };

            // Add the product with the specified quantity
            for (let i = 0; i < item.quantity; i++) {
              handleAddProduct(product);
            }

            totalProcessed += item.quantity;
          } catch (err) {
            console.error(`Error processing SKU ${item.sku}:`, err);
            errorCount++;
          }
        }));

        // Update progress
        Swal.update({
          title: 'Processing...',
          text: `Processed ${totalProcessed} items (${Math.round((totalProcessed / items.reduce((sum, item) => sum + item.quantity, 0)) * 100)}%)`
        });
      }

      // Close the loading popup
      Swal.close();

      // Show result
      if (errorCount > 0) {
        Swal.fire({
          title: 'Bulk Scan Complete',
          text: `Successfully added ${totalProcessed} items. ${errorCount} items could not be processed.`,
          icon: 'warning',
          confirmButtonText: 'OK'
        });
      } else {
        Swal.fire({
          title: 'Bulk Scan Complete',
          text: `Successfully added ${totalProcessed} items.`,
          icon: 'success',
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      console.error('Error in bulk scan:', error);
      Swal.fire({
        title: 'Error',
        text: 'An error occurred during bulk scan. Please try again.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  };

  return (
    <div className="flex">
      {/* Sidebar */}
      <div className="w-64 bg-white/90 backdrop-blur-sm rounded-l-2xl shadow-lg border-r border-gray-100 p-4">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Scan Commands</h3>
          
          <button
            onClick={() => {
              const input = document.createElement('input');
              setShowQR('S_CMD_020E');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-gray-50 rounded-lg group transition-colors"
          >
            <Scan className="h-5 w-5 text-blue-500" />
            <div>
              <div className="font-medium">BULK FAST SCAN</div>
              <div className="text-xs text-gray-500 font-mono">S_CMD_020E</div>
            </div>
          </button>

          <button
            onClick={() => {
              const input = document.createElement('input');
              setShowQR('S_CMD_MT00');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-gray-50 rounded-lg group transition-colors"
          >
            <QrCode className="h-5 w-5 text-green-500" />
            <div>
              <div className="font-medium">Normal Mode</div>
              <div className="text-xs text-gray-500 font-mono">S_CMD_MT00</div>
            </div>
          </button>

          <button
            onClick={() => {
              const input = document.createElement('input');
              setShowQR('%%SpecCode17'); 
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-gray-50 rounded-lg group transition-colors"
          >
            <Package className="h-5 w-5 text-purple-500" />
            <div>
              <div className="font-medium">TOTAL PRODUCT COUNT</div>
              <div className="flex flex-col gap-1">
                <div className="text-xs text-gray-500 font-mono">%%SpecCode17</div>
                <input
                  type="text"
                  value={totalCount}
                  onChange={(e) => setTotalCount(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-mono bg-gray-100 rounded px-2 py-1 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Count: 0"
                />
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              const input = document.createElement('input');
              setShowQR('%%SpecCode16');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-gray-50 rounded-lg group transition-colors"
          >
            <UploadCloud className="h-5 w-5 text-amber-500" />
            <div>
              <div className="font-medium">BULK UPLOAD</div>
              <div className="text-xs text-gray-500 font-mono">%%SpecCode16</div>
            </div>
          </button>

          <button
            onClick={() => {
              const input = document.createElement('input');
              setShowQR('%%SpecCode18');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-gray-50 rounded-lg group transition-colors"
          >
            <Trash2 className="h-5 w-5 text-red-500" />
            <div>
              <div className="font-medium">CLEAR DATA</div>
              <div className="text-xs text-gray-500 font-mono">%%SpecCode18</div>
            </div>
          </button>

          {/* QR Code Modal */}
          {showQR && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Scan Command</h3>
                  <button
                    onClick={() => setShowQR(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <QRCodeSVG 
                    value={showQR}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                  {showQR === '%%SpecCode17' && (
                    <div className="mt-4 flex flex-col items-center gap-2">
                      <p className="text-sm text-gray-600">Total Count</p>
                      <input
                        type="text"
                        value={totalCount}
                        onChange={(e) => setTotalCount(e.target.value)}
                        className="text-lg font-mono bg-gray-100 rounded px-3 py-2 w-32 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Count: 0"
                      />
                    </div>
                  )}
                  <p className="text-sm text-gray-600 font-mono text-center">
                    {showQR}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 bg-white rounded-r-2xl shadow ${scanning ? 'scanning-mode' : ''}`}>
        <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Bill Maker</h2>
          <button
            onClick={() => {
              const newScanningState = !scanning;
              setScanning(newScanningState);
              setScanningMode(newScanningState);
            }}
            className={`btn ${scanning ? 'btn-secondary' : 'btn-primary'} flex items-center gap-2`} 
            data-scanning-control="true"
          >
            <Calculator className="h-4 w-4" />
            {scanning ? 'Stop Scanning' : 'Start Scanning'}
          </button>
        </div>

        {/* Customer Search */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="tel"
              placeholder="Search customer by phone number..."
              className="input pl-10 w-full"
              value={phoneSearch}
              onChange={(e) => {
                setPhoneSearch(e.target.value);
                handlePhoneSearch(e.target.value);
              }}
            />
          </div>
          <select
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value as 'wholesaler' | 'retailer')}
            className="input w-40"
            disabled={!isCounterSale}
          >
            <option value="retailer">Retail</option>
            <option value="wholesaler">Wholesale</option>
          </select>
        </div>

        {/* Selected Customer Info */}
        {selectedCustomer && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-blue-500" />
              <div>
                <div className="font-medium">{selectedCustomer.name}</div>
                <div className="text-sm text-gray-600">
                  {formatPhoneNumber(selectedCustomer.phone)}
                  {selectedCustomer.city && ` • ${selectedCustomer.city}`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Product Scanner/Search */}
        <ProductScanner
          scanning={scanning}
          scannedSku={scannedSku}
          onScannedSkuChange={setScannedSku}
          onProductSelect={handleAddProduct}
          onScanningChange={(newState) => {
            setScanning(newState);
            setScanningMode(newState);
          }}
          onBulkScan={handleBulkScan}
        />

        {/* Items Table */}
        <ItemsTable
          items={items}
          scanning={scanning}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
        />

        {/* Order Summary */}
        <OrderSummary
          disabled={scanning}
          totals={totals}
          discount={discount}
          gstRate={gstRate}
          includeGst={includeGst}
          gstError={gstError}
          isAdvancedDiscountEnabled={false}
          showSecretInput={false}
          secretCode=""
          onSecretCodeChange={() => {}}
          onSecretSubmit={() => {}}
          onDiscountChange={setDiscount}
          onGstToggle={() => setIncludeGst(!includeGst)}
          onCompleteSale={() => {
            if (items.length === 0) {
              Swal.fire({
                title: 'Error',
                text: 'Please add items to complete the sale',
                icon: 'error',
                confirmButtonText: 'OK'
              });
              return;
            }
            handleCompleteSale();
          }}
          onPrint={() => setShowPrintPreview(true)}
          itemsCount={items.length}
          customerType={customerType}
        />
      </div>

      {/* Print Preview Modal */}
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

      {/* Counter Sale Modal */}
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
    </div>
  );
};

export default BillMaker;