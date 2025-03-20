import type { Customer, VideoCall, QuotationItem, Product } from '../../../types';

export interface QuickQuotationState {
  items: QuotationItem[];
  customerType: 'wholesaler' | 'retailer';
  scanning: boolean;
  scannedSku: string;
  showPrintPreview: boolean;
  customers: Customer[];
  selectedCustomer: Customer | null;
  videoCall: VideoCall | null;
  isCounterSale: boolean;
  discount: number;
  gstRate: number;
  showCounterSaleModal: boolean;
  includeGst: boolean;
  gstError: string | null;
  counterSaleDetails: {
    buyerName: string;
    buyerPhone: string;
    deliveryMethod: string;
    paymentStatus: string;
    paidAmount: number;
  };
  quotationNumber: string;
  totals: {
    subtotal: number;
    discountAmount: number;
    total: number;
    gstAmount: number;
    finalTotal: number;
  };
}

export interface QuickQuotationActions {
  setItems: React.Dispatch<React.SetStateAction<QuotationItem[]>>;
  setCustomerType: (type: 'wholesaler' | 'retailer') => void;
  setScanning: (scanning: boolean) => void;
  setScannedSku: (sku: string) => void;
  setShowPrintPreview: (show: boolean) => void;
  setSelectedCustomer: (customer: Customer | null) => void;
  setVideoCall: (call: VideoCall | null) => void;
  setIsCounterSale: (isCounter: boolean) => void;
  setDiscount: (discount: number) => void;
  setShowCounterSaleModal: (show: boolean) => void;
  setQuotationNumber: (number: string) => void;
  handleCustomerChange: (customerId: string) => void;
  addProduct: (product: Product) => void;
  fetchCustomers: () => Promise<void>;
  fetchGSTRate: () => Promise<void>;
  setIncludeGst: (include: boolean) => void;
  setCounterSaleDetails: (details: QuickQuotationState['counterSaleDetails']) => void;
  handleCompleteSale: () => Promise<void>;
}
