export interface QuotationItem {
  product: {
    id: string;
    name: string;
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
  };
  quantity: number;
  price: number;
  originalPrice: number;
}

export interface SavedQuotation {
  id: string;
  customer_id: string | null;
  items: Array<{
    product_id: string;
    quantity: number;
    price: number;
    discount: number;
    product: {
      name: string;
      sku: string;
      description: string;
      manufacturer?: string;
      category?: string;
      image_url?: string;
    };
  }>;
  total_amount: number;
  status: 'draft' | 'accepted' | 'rejected' | 'expired';
  valid_until: string;
  video_call_id: string | null;
  bill_status: 'pending' | 'generated' | 'sent' | 'paid' | 'overdue';
  bill_generated_at: string | null;
  bill_sent_at: string | null;
  bill_paid_at: string | null;
  quotation_number: string;
  created_at: string;
  updated_at: string;
  customers?: {
    name: string;
    type: 'wholesaler' | 'retailer';
  };
}
