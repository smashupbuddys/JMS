import { supabase } from '../../../../lib/supabase';
import type { QuotationItem, Customer } from '../../../../types';
import { calculateTotals } from '../../../../utils/quotation';

interface CompleteSaleParams {
  items: QuotationItem[];
  selectedCustomer: Customer | null;
  videoCall: any;
  discount: number;
  quotationNumber: string;
  counterSaleDetails: {
    buyerName: string;
    buyerPhone: string;
    deliveryMethod: string;
    paymentStatus: string;
    paidAmount: number;
  };
}

export const handleCompleteSale = async ({
  items,
  selectedCustomer,
  videoCall,
  discount,
  quotationNumber,
  counterSaleDetails
}: CompleteSaleParams) => {
  try {
    const now = new Date().toISOString();
    const { total } = calculateTotals(items, discount);
    const isWholesale = selectedCustomer?.type === 'wholesaler';
    
    const quotationData = {
      customer_id: selectedCustomer?.id || null,
      buyer_name: counterSaleDetails.buyerName || null,
      buyer_phone: counterSaleDetails.buyerPhone || null,
      delivery_method: counterSaleDetails.deliveryMethod,
      customer_type: selectedCustomer?.type || (isWholesale ? 'wholesaler' : 'retailer'),
      payment_details: {
        total_amount: total,
        paid_amount: isWholesale ? counterSaleDetails.paidAmount : total,
        pending_amount: isWholesale ? total - counterSaleDetails.paidAmount : 0,
        payment_status: counterSaleDetails.paymentStatus,
        payments: [{
          amount: counterSaleDetails.paidAmount,
          date: now,
          type: isWholesale && counterSaleDetails.paymentStatus === 'pending' ? 'advance' : 'full'
        }]
      },
      workflow_status: {
        qc: counterSaleDetails.deliveryMethod === 'hand_carry' ? 'completed' : 'pending',
        packaging: counterSaleDetails.deliveryMethod === 'hand_carry' ? 'completed' : 'pending',
        dispatch: counterSaleDetails.deliveryMethod === 'hand_carry' ? 'completed' : 'pending'
      },
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
      total_amount: total,
      status: 'accepted',
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      video_call_id: videoCall?.id || null,
      bill_status: isWholesale && counterSaleDetails.paymentStatus === 'pending' ? 'pending' : 'completed',
      bill_generated_at: now,
      bill_sent_at: null,
      bill_paid_at: isWholesale && counterSaleDetails.paymentStatus === 'pending' ? null : now,
      quotation_number: quotationNumber
    };

    const { data: quotation, error: quotationError } = await supabase
      .from('quotations')
      .insert([quotationData])
      .select()
      .single();

    if (quotationError) throw quotationError;

    // Update customer total purchases
    if (selectedCustomer) {
      const { error: customerError } = await supabase
        .from('customers')
        .update({
          total_purchases: (Number(selectedCustomer.total_purchases) || 0) + total,
          last_purchase_date: now
        })
        .eq('id', selectedCustomer.id);

      if (customerError) throw customerError;
    }

    // Update product stock levels
    for (const item of items) {
      const { error } = await supabase
        .from('products')
        .update({
          stock_level: Math.max(0, item.product.stockLevel - item.quantity)
        })
        .eq('id', item.product.id);

      if (error) throw error;
    }

    return quotation;
  } catch (error) {
    console.error('Error completing sale:', error);
    throw error;
  }
};
