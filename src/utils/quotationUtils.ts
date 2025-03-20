import { supabase } from '../lib/supabase';
import type { QuotationItem, Customer } from '../types';

export async function saveQuotation(data: {
  items: QuotationItem[];
  selectedCustomer: Customer | null;
  videoCall: any;
  discount: number;
  quotationNumber: string;
}) {
  try {
    if (!data.items.length) {
      throw new Error('No items to save');
    }

    const quotationData = {
      customer_id: data.selectedCustomer?.id || null,
      items: data.items.map(item => ({
        product_id: item.product.id,
        quantity: Number(item.quantity),
        price: Number(item.price),
        discount: Number(data.discount),
        product: {
          name: item.product.name,
          sku: item.product.sku,
          description: item.product.description,
          manufacturer: item.product.manufacturer,
          category: item.product.category,
          imageUrl: item.product.imageUrl
        }
      })),
      total_amount: data.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0),
      status: 'draft',
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      video_call_id: data.videoCall?.id || null,
      bill_status: 'pending',
      bill_generated_at: null,
      bill_sent_at: null,
      bill_paid_at: null,
      quotation_number: data.quotationNumber
    };

    const { data: savedQuotation, error } = await supabase
      .from('quotations')
      .insert([quotationData])
      .select()
      .single();

    if (error) throw error;
    if (!savedQuotation) throw new Error('Failed to save quotation');

    return { data: savedQuotation, error: null };
  } catch (error) {
    console.error('Error saving quotation:', error);
    return { data: null, error };
  }
}

export async function loadSavedQuotation(quotationId: string) {
  try {
    const { data: quotation, error } = await supabase
      .from('quotations')
      .select(`
        *,
        customers (
          id,
          name,
          email,
          phone,
          type,
          address,
          city,
          state,
          pincode,
          gst_number
        )
      `)
      .eq('id', quotationId)
      .single();

    if (error) throw error;
    if (!quotation) throw new Error('Quotation not found');

    // Transform quotation items into the format expected by the UI
    const items: QuotationItem[] = quotation.items.map((item: any) => ({
      product: {
        id: item.product_id,
        name: item.product.name,
        description: item.product.description || '',
        manufacturer: item.product.manufacturer,
        sku: item.product.sku,
        buyPrice: Number(item.price),
        wholesalePrice: Number(item.price),
        retailPrice: Number(item.price),
        stockLevel: 999, // We'll fetch the actual stock level later
        category: item.product.category,
        imageUrl: item.product.imageUrl || '',
        qrCode: '',
        code128: '',
        cipher: '',
        additionalInfo: ''
      },
      quantity: item.quantity,
      price: Number(item.price),
      originalPrice: Number(item.price)
    }));

    return {
      data: {
        items,
        discount: quotation.items[0]?.discount || 0,
        quotation_number: quotation.quotation_number,
        customer: quotation.customers
      },
      error: null
    };
  } catch (error) {
    console.error('Error loading quotation:', error);
    return { data: null, error };
  }
}
