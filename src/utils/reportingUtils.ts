import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

interface SalesSummary {
  totalSales: number;
  totalTransactions: number;
  averageOrderValue: number;
  retailSales: number;
  wholesaleSales: number;
  paymentMethodBreakdown: Record<string, number>;
  topProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  topCustomers: Array<{
    name: string;
    purchases: number;
    revenue: number;
  }>;
}

export async function getDailySalesSummary(date: string = format(new Date(), 'yyyy-MM-dd')): Promise<SalesSummary> {
  try {
    // Get all transactions for the day
    const { data: transactions, error: transactionError } = await supabase
      .from('sales_transactions')
      .select(`
        *,
        transaction_items (
          quantity,
          unit_price,
          total_amount,
          products (
            name
          )
        ),
        customers (
          name
        )
      `)
      .gte('created_at', `${date}T00:00:00`)
      .lt('created_at', `${date}T23:59:59`);

    if (transactionError) throw transactionError;

    // Calculate summary statistics
    const summary: SalesSummary = {
      totalSales: 0,
      totalTransactions: transactions?.length || 0,
      averageOrderValue: 0,
      retailSales: 0,
      wholesaleSales: 0,
      paymentMethodBreakdown: {},
      topProducts: [],
      topCustomers: []
    };

    // Process transactions
    const productSales: Record<string, { quantity: number; revenue: number }> = {};
    const customerSales: Record<string, { purchases: number; revenue: number }> = {};

    transactions?.forEach(transaction => {
      // Update total sales
      summary.totalSales += transaction.total_amount;

      // Update sales by type
      if (transaction.sale_type === 'wholesale') {
        summary.wholesaleSales += transaction.total_amount;
      } else {
        summary.retailSales += transaction.total_amount;
      }

      // Update payment method breakdown
      const paymentMethod = transaction.payment_terms || 'immediate';
      summary.paymentMethodBreakdown[paymentMethod] = 
        (summary.paymentMethodBreakdown[paymentMethod] || 0) + transaction.total_amount;

      // Process items for product sales
      transaction.transaction_items?.forEach(item => {
        const productName = item.products?.name || 'Unknown Product';
        if (!productSales[productName]) {
          productSales[productName] = { quantity: 0, revenue: 0 };
        }
        productSales[productName].quantity += item.quantity;
        productSales[productName].revenue += item.total_amount;
      });

      // Process customer sales
      const customerName = transaction.customers?.name || 'Counter Sale';
      if (!customerSales[customerName]) {
        customerSales[customerName] = { purchases: 0, revenue: 0 };
      }
      customerSales[customerName].purchases += 1;
      customerSales[customerName].revenue += transaction.total_amount;
    });

    // Calculate average order value
    summary.averageOrderValue = summary.totalTransactions > 0 
      ? summary.totalSales / summary.totalTransactions 
      : 0;

    // Get top products
    summary.topProducts = Object.entries(productSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Get top customers
    summary.topCustomers = Object.entries(customerSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return summary;
  } catch (error) {
    console.error('Error generating daily sales summary:', error);
    throw error;
  }
}

export async function getCustomerPurchaseHistory(customerId: string) {
  try {
    const { data: transactions, error } = await supabase
      .from('sales_transactions')
      .select(`
        *,
        transaction_items (
          quantity,
          unit_price,
          total_amount,
          products (
            name,
            category,
            manufacturer
          )
        )
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return transactions?.map(transaction => ({
      date: format(new Date(transaction.created_at), 'PPpp'),
      transactionNumber: transaction.transaction_number,
      type: transaction.sale_type,
      items: transaction.transaction_items,
      subtotal: transaction.subtotal,
      discount: transaction.discount_amount,
      tax: transaction.tax_amount,
      total: transaction.total_amount,
      paymentStatus: transaction.payment_status,
      paymentDue: transaction.payment_due_date ? 
        format(new Date(transaction.payment_due_date), 'PP') : 
        'Immediate'
    }));
  } catch (error) {
    console.error('Error fetching customer purchase history:', error);
    throw error;
  }
}

export async function getInventoryMovement(
  startDate: string,
  endDate: string,
  category?: string,
  manufacturer?: string
) {
  try {
    let query = supabase
      .from('transaction_items')
      .select(`
        quantity,
        unit_price,
        total_amount,
        created_at,
        products (
          name,
          category,
          manufacturer,
          stock_level
        ),
        sales_transactions (
          sale_type,
          transaction_number
        )
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (category) {
      query = query.eq('products.category', category);
    }

    if (manufacturer) {
      query = query.eq('products.manufacturer', manufacturer);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data?.reduce((acc: Record<string, any>, item) => {
      const category = item.products?.category || 'Uncategorized';
      const manufacturer = item.products?.manufacturer || 'Unknown';
      
      if (!acc[category]) {
        acc[category] = {
          totalQuantity: 0,
          totalRevenue: 0,
          manufacturers: {}
        };
      }
      
      if (!acc[category].manufacturers[manufacturer]) {
        acc[category].manufacturers[manufacturer] = {
          quantity: 0,
          revenue: 0
        };
      }
      
      acc[category].totalQuantity += item.quantity;
      acc[category].totalRevenue += item.total_amount;
      acc[category].manufacturers[manufacturer].quantity += item.quantity;
      acc[category].manufacturers[manufacturer].revenue += item.total_amount;
      
      return acc;
    }, {});
  } catch (error) {
    console.error('Error generating inventory movement report:', error);
    throw error;
  }
}

export async function getRevenueAnalysis(
  startDate: string,
  endDate: string
) {
  try {
    const { data, error } = await supabase
      .from('sales_transactions')
      .select(`
        sale_type,
        total_amount,
        payment_status,
        created_at,
        customer_id,
        customers (
          type
        )
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw error;

    const analysis = {
      totalRevenue: 0,
      revenueByType: {
        retail: 0,
        wholesale: 0
      },
      paymentStatus: {
        completed: 0,
        pending: 0,
        partial: 0,
        overdue: 0
      },
      customerSegments: {
        new: 0,
        returning: 0
      },
      averageOrderValue: {
        retail: 0,
        wholesale: 0
      },
      dailyRevenue: {} as Record<string, number>
    };

    // Process transactions
    const customerTransactions = new Map<string, number>();
    const typeOrders = { retail: 0, wholesale: 0 };

    data?.forEach(transaction => {
      // Update total revenue
      analysis.totalRevenue += transaction.total_amount;

      // Update revenue by type
      const saleType = transaction.sale_type === 'wholesale' ? 'wholesale' : 'retail';
      analysis.revenueByType[saleType] += transaction.total_amount;
      typeOrders[saleType]++;

      // Update payment status
      analysis.paymentStatus[transaction.payment_status] += transaction.total_amount;

      // Track customer transactions
      if (transaction.customer_id) {
        customerTransactions.set(
          transaction.customer_id,
          (customerTransactions.get(transaction.customer_id) || 0) + 1
        );
      }

      // Update daily revenue
      const date = format(new Date(transaction.created_at), 'yyyy-MM-dd');
      analysis.dailyRevenue[date] = (analysis.dailyRevenue[date] || 0) + transaction.total_amount;
    });

    // Calculate average order values
    analysis.averageOrderValue.retail = typeOrders.retail > 0 
      ? analysis.revenueByType.retail / typeOrders.retail 
      : 0;
    analysis.averageOrderValue.wholesale = typeOrders.wholesale > 0 
      ? analysis.revenueByType.wholesale / typeOrders.wholesale 
      : 0;

    // Calculate customer segments
    customerTransactions.forEach((count) => {
      analysis.customerSegments[count === 1 ? 'new' : 'returning']++;
    });

    return analysis;
  } catch (error) {
    console.error('Error generating revenue analysis:', error);
    throw error;
  }
}