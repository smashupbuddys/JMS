import { supabase } from '../lib/supabase';

// Payment status constants
export const PAYMENT_STATUS = {
  COMPLETED: 'completed',
  PENDING: 'pending',
  PARTIAL: 'partial'
} as const;

// Payment types
const PAYMENT_TYPE = {
  FULL: 'full',
  PARTIAL: 'partial',
  ADVANCE: 'advance'
};

// Payment methods
const PAYMENT_METHOD = {
  CASH: 'cash',
  CARD: 'card',
  UPI: 'upi',
  BANK_TRANSFER: 'bank_transfer'
};

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  manufacturer: string;
  category: string;
  stock_level: number;
  imageUrl?: string;
}

interface QuotationItem {
  product_id: string;
  quantity: number;
  price: number;
  product: Product;
}

interface PaymentDetails {
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  payment_status: 'completed' | 'pending' | 'partial';
  payments: Array<{
    amount: number;
    date: string;
    type: 'full' | 'partial' | 'advance';
    method: string;
  }>;
}

interface CompleteSaleParams {
  sale_type: 'counter' | 'video_call';
  customer_id?: string;
  video_call_id?: string;
  quotation_data: {
    items: QuotationItem[];
    total_amount: number;
    quotation_number: string;
    delivery_method: 'hand_carry' | 'delivery';
  };
  payment_details: PaymentDetails;
  customer_analytics?: {
    categories?: string[];
    email?: string;
    country?: string;
  };
}

/**
 * Formats and validates payment details to ensure they meet the expected structure
 */
export const formatPaymentDetails = (details: any) => {
  // Ensure all numeric values are properly formatted
  const formattedDetails = {
    total_amount: Number(Math.round(details.total_amount * 100) / 100),
    paid_amount: Number(Math.round(details.paid_amount * 100) / 100),
    pending_amount: Number(Math.round(details.pending_amount * 100) / 100),
    payment_status: details.payment_status,
    payments: Array.isArray(details.payments) 
      ? details.payments.map((payment: any) => ({
          amount: Number(Math.round(payment.amount * 100) / 100),
          date: payment.date,
          type: Object.values(PAYMENT_TYPE).includes(payment.type) ? payment.type : PAYMENT_TYPE.FULL,
          method: Object.values(PAYMENT_METHOD).includes(payment.method) ? payment.method : PAYMENT_METHOD.CASH
        }))
      : []
  };

  // Validate payment status
  const validPaymentStatuses = Object.values(PAYMENT_STATUS);
  
  if (!validPaymentStatuses.includes(formattedDetails.payment_status)) {
    throw new Error(`Invalid payment status: ${formattedDetails.payment_status}`);
  }

  // Validate amounts match
  if (Math.abs(formattedDetails.total_amount - 
      (formattedDetails.paid_amount + formattedDetails.pending_amount)) > 0.01) {
    throw new Error('Payment amounts do not reconcile');
  }

  return formattedDetails;
};

/**
 * Updates manufacturer statistics when a sale is made
 */
export const updateManufacturerStatistics = async (items: any[]) => {
  try {
    // Group items by manufacturer
    const manufacturerSales: { [key: string]: { totalAmount: number, totalItems: number, categories: Set<string> } } = {};

    // Calculate totals by manufacturer
    items.forEach(item => {
      const manufacturerName = item.product.manufacturer;
      if (!manufacturerSales[manufacturerName]) {
        manufacturerSales[manufacturerName] = {
          totalAmount: 0,
          totalItems: 0,
          categories: new Set()
        };
      }
      
      manufacturerSales[manufacturerName].totalAmount += item.price * item.quantity;
      manufacturerSales[manufacturerName].totalItems += item.quantity;
      manufacturerSales[manufacturerName].categories.add(item.product.category);
    });

    // Update stats for each manufacturer
    for (const [manufacturer, stats] of Object.entries(manufacturerSales)) {
      // Get existing manufacturer
      const { data: existingManufacturer, error: fetchError } = await supabase
        .from('manufacturers')
        .select('id, sales_stats')
        .eq('name', manufacturer)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching manufacturer:', fetchError);
        continue;
      }

      if (existingManufacturer) {
        // Update existing manufacturer stats
        const existingStats = existingManufacturer.sales_stats || {
          total_sales: 0,
          total_items_sold: 0,
          last_sale_date: null,
          categories: {}
        };

        // Update totals
        existingStats.total_sales = (existingStats.total_sales || 0) + stats.totalAmount;
        existingStats.total_items_sold = (existingStats.total_items_sold || 0) + stats.totalItems;
        existingStats.last_sale_date = new Date().toISOString();
        
        // Update category stats
        const categories = existingStats.categories || {};
        Array.from(stats.categories).forEach(category => {
          categories[category] = (categories[category] || 0) + 1;
        });
        existingStats.categories = categories;

        // Update manufacturer record
        const { error: updateError } = await supabase
          .from('manufacturers')
          .update({
            sales_stats: existingStats,
            total_sales: stats.totalAmount,
            items_sold: stats.totalItems,
            last_sale_date: new Date().toISOString()
          })
          .eq('id', existingManufacturer.id);

        if (updateError) {
          console.error('Error updating manufacturer stats:', updateError);
        }
      } else {
        // Create new manufacturer record with stats
        const initialStats = {
          total_sales: stats.totalAmount,
          total_items_sold: stats.totalItems,
          last_sale_date: new Date().toISOString(),
          categories: Array.from(stats.categories).reduce((acc: {[key: string]: number}, category) => {
            acc[category] = 1;
            return acc;
          }, {})
        };

        const { error: insertError } = await supabase
          .from('manufacturers')
          .insert({
            name: manufacturer,
            sales_stats: initialStats,
            total_sales: stats.totalAmount,
            items_sold: stats.totalItems,
            last_sale_date: new Date().toISOString()
          });

        if (insertError) {
          console.error('Error creating manufacturer record:', insertError);
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error updating manufacturer statistics:', error);
    return false;
  }
};

/**
 * Updates customer purchase analytics
 */
export const updateCustomerAnalytics = async (
  customerId: string | null, 
  items: any[], 
  totalAmount: number,
  customerAnalytics?: {
    categories?: string[];
    email?: string;
    country?: string;
  }
) => {
  try {
    if (!customerId) return true; // Skip if no customer ID
    
    // Group items by manufacturer and category
    const manufacturerPurchases: { [key: string]: number } = {};
    const categoryPurchases: { [key: string]: number } = {};
    
    // Calculate purchase amounts by manufacturer and category
    items.forEach(item => {
      const manufacturer = item.product.manufacturer;
      const category = item.product.category;
      const itemTotal = item.price * item.quantity;
      
      manufacturerPurchases[manufacturer] = (manufacturerPurchases[manufacturer] || 0) + itemTotal;
      categoryPurchases[category] = (categoryPurchases[category] || 0) + itemTotal;
    });
    
    // Get existing customer data
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('id, purchase_history, category_preferences, manufacturer_preferences, email, country')
      .eq('id', customerId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching customer data:', fetchError);
      return false;
    }
    
    // Update purchase history
    const purchaseHistory = customer.purchase_history || [];
    purchaseHistory.push({
      date: new Date().toISOString(),
      amount: totalAmount,
      items_count: items.reduce((sum, item) => sum + item.quantity, 0),
      manufacturers: Object.keys(manufacturerPurchases),
      categories: Object.keys(categoryPurchases)
    });
    
    // Update manufacturer preferences (weighted by purchase amount)
    const manufacturerPrefs = customer.manufacturer_preferences || {};
    for (const [manufacturer, amount] of Object.entries(manufacturerPurchases)) {
      manufacturerPrefs[manufacturer] = (manufacturerPrefs[manufacturer] || 0) + amount;
    }
    
    // Update category preferences (weighted by purchase amount)
    const categoryPrefs = customer.category_preferences || {};
    for (const [category, amount] of Object.entries(categoryPurchases)) {
      categoryPrefs[category] = (categoryPrefs[category] || 0) + amount;
    }
    
    // Include additional customer analytics if provided
    const additionalCategories = customerAnalytics?.categories || [];
    additionalCategories.forEach(category => {
      if (!categoryPrefs[category]) {
        categoryPrefs[category] = 0;
      }
    });
    
    // Update customer record
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        purchase_history: purchaseHistory,
        manufacturer_preferences: manufacturerPrefs,
        category_preferences: categoryPrefs,
        total_purchases: totalAmount,
        last_purchase_date: new Date().toISOString(),
        // Only update email and country if provided and not already set
        ...(customerAnalytics?.email && !customer.email ? { email: customerAnalytics.email } : {}),
        ...(customerAnalytics?.country && !customer.country ? { country: customerAnalytics.country } : {})
      })
      .eq('id', customerId);
    
    if (updateError) {
      console.error('Error updating customer analytics:', updateError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error updating customer analytics:', error);
    return false;
  }
};

/**
 * Creates a counter sale customer record for future tracking
 */
export const createCounterSaleCustomer = async (
  counterSaleDetails: {
    buyerName: string;
    buyerPhone: string;
    buyerEmail?: string;
    buyerCategory?: string[];
    country?: string;
  },
  customerType: 'wholesaler' | 'retailer',
  items: any[],
  totalAmount: number
) => {
  try {
    if (!counterSaleDetails.buyerName || !counterSaleDetails.buyerPhone) {
      return { success: false, customerId: null };
    }
    
    // Check if customer already exists with this phone number
    const { data: existingCustomer, error: fetchError } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', counterSaleDetails.buyerPhone)
      .maybeSingle();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing customer:', fetchError);
      return { success: false, customerId: null };
    }
    
    // If customer exists, update analytics and return
    if (existingCustomer) {
      const customerAnalytics = {
        categories: counterSaleDetails.buyerCategory,
        email: counterSaleDetails.buyerEmail,
        country: counterSaleDetails.country
      };
      
      await updateCustomerAnalytics(
        existingCustomer.id,
        items,
        totalAmount,
        customerAnalytics
      );
      
      return { success: true, customerId: existingCustomer.id };
    }
    
    // Create new customer record
    // Calculate initial preferences
    const manufacturerPrefs: { [key: string]: number } = {};
    const categoryPrefs: { [key: string]: number } = {};
    
    items.forEach(item => {
      const manufacturer = item.product.manufacturer;
      const category = item.product.category;
      const itemTotal = item.price * item.quantity;
      
      manufacturerPrefs[manufacturer] = (manufacturerPrefs[manufacturer] || 0) + itemTotal;
      categoryPrefs[category] = (categoryPrefs[category] || 0) + itemTotal;
    });
    
    // Add additional categories if provided
    if (counterSaleDetails.buyerCategory) {
      counterSaleDetails.buyerCategory.forEach(category => {
        if (!categoryPrefs[category]) {
          categoryPrefs[category] = 0;
        }
      });
    }
    
    // Initial purchase history entry
    const purchaseHistory = [{
      date: new Date().toISOString(),
      amount: totalAmount,
      items_count: items.reduce((sum, item) => sum + item.quantity, 0),
      manufacturers: Object.keys(manufacturerPrefs),
      categories: Object.keys(categoryPrefs)
    }];
    
    // Create new customer
    const { data: newCustomer, error: insertError } = await supabase
      .from('customers')
      .insert({
        name: counterSaleDetails.buyerName,
        phone: counterSaleDetails.buyerPhone,
        email: counterSaleDetails.buyerEmail || null,
        type: customerType,
        category_preferences: categoryPrefs,
        manufacturer_preferences: manufacturerPrefs,
        purchase_history: purchaseHistory,
        total_purchases: totalAmount,
        last_purchase_date: new Date().toISOString(),
        registration_date: new Date().toISOString(),
        country: counterSaleDetails.country || null,
        source: 'counter_sale'
      })
      .select('id')
      .single();
    
    if (insertError) {
      console.error('Error creating counter sale customer:', insertError);
      return { success: false, customerId: null };
    }
    
    return { success: true, customerId: newCustomer.id };
  } catch (error) {
    console.error('Error creating counter sale customer:', error);
    return { success: false, customerId: null };
  }
};

/**
 * Main function to process a sale
 */
export const completeSale = async (params: CompleteSaleParams) => {
  try {
    if (!params.quotation_data.items?.length) {
      throw new Error('Please add items to complete the sale');
    }

    // Step 1: Validate stock availability first
    for (const item of params.quotation_data.items) {
      const productId = item.product_id || item.product.id;
      if (!productId) {
        throw new Error(`Missing product ID for item: ${item.product.name || 'Unknown Product'}`);
      }

      // Get current stock level
      const { data: product, error: stockCheckError } = await supabase
        .from('products')
        .select('stock_level, name')
        .eq('id', productId)
        .single();

      if (stockCheckError) {
        throw new Error(`Failed to check stock for ${item.product.name}: ${stockCheckError.message}`);
      }

      if (!product) {
        throw new Error(`Product not found: ${item.product.name}`);
      }

      if (product.stock_level < item.quantity) {
        throw new Error(`Insufficient stock for ${item.product.name}. Available: ${product.stock_level}, Requested: ${item.quantity}`);
      }
    }

    // Step 2: Validate payment details
    const validatedPaymentDetails = {
      ...params.payment_details,
      total_amount: Number(params.payment_details.total_amount),
      paid_amount: Number(params.payment_details.paid_amount),
      pending_amount: Number(params.payment_details.pending_amount)
    };

    // Payment validation
    if (validatedPaymentDetails.payment_status === 'completed' && validatedPaymentDetails.pending_amount > 0) {
      throw new Error('Completed payment cannot have pending amount');
    }

    if (validatedPaymentDetails.payment_status === 'pending' && validatedPaymentDetails.paid_amount > 0) {
      throw new Error('Pending payment cannot have paid amount');
    }

    if (validatedPaymentDetails.payment_status === 'partial') {
      if (validatedPaymentDetails.paid_amount <= 0) {
        throw new Error('Partial payment must have paid amount greater than 0');
      }
      if (validatedPaymentDetails.paid_amount >= validatedPaymentDetails.total_amount) {
        throw new Error('Partial payment cannot have paid amount equal to or greater than total amount');
      }
    }

    // Step 3: Create quotation with transaction
    const { data: quotation, error: quotationError } = await supabase
      .from('quotations')
      .insert([{
        customer_id: params.customer_id,
        video_call_id: params.video_call_id,
        items: params.quotation_data.items,
        total_amount: validatedPaymentDetails.total_amount,
        status: 'accepted',
        payment_details: validatedPaymentDetails,
        workflow_status: {
          qc: params.quotation_data.delivery_method === 'hand_carry' ? 'completed' : 'pending',
          packaging: params.quotation_data.delivery_method === 'hand_carry' ? 'completed' : 'pending',
          dispatch: params.quotation_data.delivery_method === 'hand_carry' ? 'completed' : 'pending'
        },
        quotation_number: params.quotation_data.quotation_number,
        valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        bill_status: validatedPaymentDetails.payment_status === 'completed' ? 'paid' : 
                    validatedPaymentDetails.payment_status === 'partial' ? 'partial' : 'pending',
        bill_generated_at: new Date().toISOString(),
        bill_paid_at: validatedPaymentDetails.payment_status === 'completed' ? new Date().toISOString() : null
      }])
      .select()
      .single();

    if (quotationError) {
      console.error('Quotation creation error:', quotationError);
      throw quotationError;
    }

    // Step 4: Update stock levels with retries
    for (const item of params.quotation_data.items) {
      const productId = item.product_id || item.product.id;
      let retries = 3;
      let success = false;

      while (retries > 0 && !success) {
        const { error: stockError } = await supabase
          .rpc('update_product_stock', {
            p_product_id: productId,
            p_quantity: item.quantity,
            p_manufacturer: item.product.manufacturer,
            p_category: item.product.category,
            p_price: item.price
          });

        if (!stockError) {
          success = true;
        } else {
          console.warn(`Retry ${4 - retries} updating stock for ${item.product.name}:`, stockError);
          retries--;
          if (retries === 0) {
            throw new Error(`Failed to update stock for ${item.product.name} after 3 attempts: ${stockError.message}`);
          }
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        }
      }
    }

    // Step 5: Create sale record
    const { error: saleError } = await supabase
      .from('sales')
      .insert([{
        sale_type: params.sale_type,
        customer_id: params.customer_id,
        video_call_id: params.video_call_id,
        quotation_id: quotation.id,
        sale_number: params.quotation_data.quotation_number,
        total_amount: validatedPaymentDetails.total_amount,
        payment_status: validatedPaymentDetails.payment_status,
        payment_details: validatedPaymentDetails,
        analytics: {
          hour_of_day: new Date().getHours(),
          day_of_week: new Date().getDay(),
          items_count: params.quotation_data.items.reduce((sum, item) => sum + item.quantity, 0),
          categories: params.quotation_data.items.reduce((acc: Record<string, number>, item) => {
            acc[item.product.category] = (acc[item.product.category] || 0) + item.quantity;
            return acc;
          }, {}),
          payment_method: params.payment_details.payments[0]?.method || 'cash',
          customer_type: params.customer_id ? 'registered' : 'walk_in'
        }
      }]);

    if (saleError) {
      console.error('Sale record creation error:', saleError);
      throw saleError;
    }

    // Step 6: Update video call if applicable
    if (params.video_call_id) {
      const { error: videoCallError } = await supabase
        .from('video_calls')
        .update({
          quotation_id: quotation.id,
          quotation_required: true,
          workflow_status: {
            video_call: 'completed',
            quotation: 'completed',
            profiling: 'pending',
            payment: validatedPaymentDetails.payment_status === 'completed' ? 'completed' : 'pending',
            qc: params.quotation_data.delivery_method === 'hand_carry' ? 'completed' : 'pending',
            packaging: params.quotation_data.delivery_method === 'hand_carry' ? 'completed' : 'pending',
            dispatch: params.quotation_data.delivery_method === 'hand_carry' ? 'completed' : 'pending'
          },
          bill_status: validatedPaymentDetails.payment_status === 'completed' ? 'paid' : 'pending',
          bill_amount: validatedPaymentDetails.total_amount,
          bill_generated_at: new Date().toISOString(),
          bill_paid_at: validatedPaymentDetails.payment_status === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', params.video_call_id);

      if (videoCallError) {
        console.error('Video call update error:', videoCallError);
        throw videoCallError;
      }
    }

    // Step 7: Check for low stock alerts
    const lowStockItems = params.quotation_data.items.filter(item => {
      const remainingStock = item.product.stock_level - item.quantity;
      return remainingStock <= 5; // Low stock threshold
    });

    if (lowStockItems.length > 0) {
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert(
          lowStockItems.map(item => ({
            type: 'inventory_alert',
            title: 'Low Stock Alert',
            message: `${item.product.name} is running low on stock (${item.product.stock_level - item.quantity} remaining)`,
            data: {
              product_id: item.product_id,
              current_stock: item.product.stock_level - item.quantity,
              threshold: 5
            }
          }))
        );

      if (notificationError) {
        console.warn('Failed to create low stock notifications:', notificationError);
      }
    }

    return {
      success: true,
      quotationId: quotation.id,
      customerId: params.customer_id
    };

  } catch (error) {
    console.error('Error completing sale:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    throw error;
  }
};

/**
 * Checks for low stock after a sale and triggers alerts if needed
 */
export const checkLowStockAlerts = async (items: any[]) => {
  try {
    const LOW_STOCK_THRESHOLD = 5; // Example threshold
    
    for (const item of items) {
      // Get current stock level
      const { data: product, error } = await supabase
        .from('products')
        .select('id, name, stock_level, manufacturer, category')
        .eq('id', item.product_id)
        .single();
        
      if (error) {
        console.error('Error fetching product stock:', error);
        continue;
      }
      
      // Check if stock is below threshold
      if (product.stock_level <= LOW_STOCK_THRESHOLD) {
        // Create low stock alert
        const { error: alertError } = await supabase
          .from('inventory_alerts')
          .insert({
            product_id: product.id,
            product_name: product.name,
            alert_type: 'low_stock',
            current_level: product.stock_level,
            threshold: LOW_STOCK_THRESHOLD,
            manufacturer: product.manufacturer,
            category: product.category,
            created_at: new Date().toISOString()
          });
          
        if (alertError) {
          console.error('Error creating low stock alert:', alertError);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error checking low stock alerts:', error);
    return false;
  }
};