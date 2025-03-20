export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'customer';
}

export interface MarkupSetting {
  id: string;
  type: 'manufacturer' | 'category';
  name: string;
  markup: number;
}

export interface Product {
  id: string;
  name?: string; // Name is now optional
  description: string;
  manufacturer: string;
  sku: string;
  buyPrice: number;
  wholesalePrice: number;
  retailPrice: number;
  stockLevel: number;
  category: string;
  imageUrl: string;
  qrCode: string;
  code128: string;
  cipher: string;
  additionalInfo?: string;
  lastSoldAt?: string | null;
  deadStockStatus?: 'normal' | 'warning' | 'critical';
  deadStockDays?: number;
  lastSoldAt?: string | null;
  deadStockStatus?: 'normal' | 'warning' | 'critical';
  deadStockDays?: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: 'wholesaler' | 'retailer';
  address: string;
  city: string;
  state: string;
  pincode: string;
  gst_number?: string;
  pan_number?: string;
  preferences: {
    categories: string[];
    priceRange: {
      min: number;
      max: number;
    };
    preferredContact: 'email' | 'phone' | 'whatsapp';
    profiled?: boolean;
    deviceId?: string;
    lastProfilingAttempt?: string | null;
  };
  notes: string;
  total_purchases: number;
  last_purchase_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  customerId: string;
  products: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  totalAmount: number;
  paidAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoCall {
  id: string;
  customer_id: string;
  staff_id: string;
  scheduled_at: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string;
  quotation_required: boolean;
  quotation_id?: string;
  payment_status: 'pending' | 'completed' | 'overdue';
  payment_due_date?: string;
}

export interface Quotation {
  id: string;
  video_call_id: string;
  customer_id: string;
  items: QuotationItem[];
  total_amount: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  valid_until: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  quotation_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  payment_method?: string;
  transaction_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data: Record<string, any>;
  created_at: string;
}

export interface GSTRate {
  id: string;
  rate: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
}
