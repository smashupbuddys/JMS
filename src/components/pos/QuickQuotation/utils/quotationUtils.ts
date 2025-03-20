import { supabase } from '../../../../lib/supabase';
import type { QuotationItem, Customer, VideoCall } from '../../../../types';
import { generateQuotationNumber } from '../../../../utils/quotation';

interface SaveQuotationParams {
  items: QuotationItem[];
  selectedCustomer: Customer | null;
  videoCall: VideoCall | null;
  discount: number;
  quotationNumber: string;
}

export const handleQuotationSave = async ({
  items,
  selectedCustomer,
  videoCall,
  discount,
  quotationNumber
}: SaveQuotationParams) => {
  try {
    const quotationData = {
      customer_id: selectedCustomer?.id || null,
      items: items.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
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
      total_amount: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      status: 'draft',
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      video_call_id: videoCall?.id || null,
      bill_status: 'pending',
      bill_generated_at: null,
      bill_sent_at: null,
      bill_paid_at: null,
      quotation_number: quotationNumber
    };

    const { data, error } = await supabase
      .from('quotations')
      .insert([quotationData])
      .select()
      .single();

    if (error) throw error;

    alert('Quotation saved successfully!');
    return data;
  } catch (error) {
    console.error('Error saving quotation:', error);
    alert('Error saving quotation. Please try again.');
  }
};

export const handleQuotationLoad = async (
  quotationId: string,
  setItems: (items: QuotationItem[]) => void,
  setDiscount: (discount: number) => void,
  setQuotationNumber: (number: string) => void,
  setSelectedCustomer: (customer: Customer | null) => void,
  setCustomerType: (type: 'wholesaler' | 'retailer') => void,
  setIsCounterSale: (isCounter: boolean) => void,
  setShowSavedQuotations: (show: boolean) => void
) => {
  try {
    const { data: quotation, error: quotationError } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', quotationId)
      .single();

    if (quotationError) throw quotationError;

    if (!quotation.items || !Array.isArray(quotation.items)) {
      throw new Error('Invalid quotation data');
    }

    const newItems = quotation.items.map((item: any) => ({
      product: {
        id: item.product_id,
        name: item.product.name,
        description: item.product.description || '',
        manufacturer: item.product.manufacturer || '',
        sku: item.product.sku,
        buyPrice: Number(item.price),
        wholesalePrice: Number(item.price),
        retailPrice: Number(item.price),
        stockLevel: 999,
        category: item.product.category || '',
        imageUrl: item.product.image_url || '',
        qrCode: '',
        code128: '',
        cipher: '',
        additionalInfo: ''
      },
      quantity: item.quantity,
      price: Number(item.price),
      originalPrice: Number(item.price)
    }));

    setItems(newItems);
    setDiscount(quotation.items[0]?.discount || 0);
    setQuotationNumber(quotation.quotation_number || generateQuotationNumber());
    setShowSavedQuotations(false);

    if (quotation.customer_id) {
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('id', quotation.customer_id)
        .single();

      if (customerData) {
        setSelectedCustomer(customerData);
        setCustomerType(customerData.type);
        setIsCounterSale(false);
      }
    }
  } catch (error) {
    console.error('Error loading quotation:', error);
    alert('Error loading quotation. Please try again.');
  }
};
