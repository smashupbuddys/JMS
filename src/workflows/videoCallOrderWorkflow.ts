import { supabase } from '../lib/supabase';
import type { QuotationItem, Customer } from '../types';

export const processVideoCallOrder = async (
  quotationId: string,
  customerId: string,
  items: QuotationItem[],
  total: number
) => {
  try {
    // Update customer total purchases if not a counter sale
    if (customerId) {
      const { error: customerError } = await supabase
        .from('customers')
        .update({
          total_purchases: (Number(customer.total_purchases) || 0) + total,
          last_purchase_date: new Date().toISOString()
        })
        .eq('id', customerId);

      if (customerError) throw customerError;
    }

    // Update stock levels
    for (const item of items) {
      const { error } = await supabase
        .from('products')
        .update({
          stock_level: Math.max(0, item.product.stockLevel - item.quantity)
        })
        .eq('id', item.product.id);

      if (error) throw error;
    }

    console.log('Video call order processed successfully!');
  } catch (error) {
    console.error('Error processing video call order:', error);
    throw error;
  }
};
