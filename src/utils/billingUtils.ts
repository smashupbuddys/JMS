import { supabase } from '../lib/supabase';
import type { Customer } from '../types';

interface BillingSettings {
  retail: {
    defaultTaxRate: number;
    minOrderAmount: number;
    paymentTerms: string;
    allowDiscounts: boolean;
    maxDiscountPercent: number;
  };
  wholesale: {
    defaultTaxRate: number;
    minOrderAmount: number;
    defaultPaymentTerms: string;
    volumeDiscountEnabled: boolean;
    creditCheckRequired: boolean;
  };
}

export async function getBillingSettings(): Promise<BillingSettings> {
  try {
    const { data, error } = await supabase
      .from('billing_settings')
      .select('*');

    if (error) throw error;

    const retailSettings = data?.find(s => s.setting_key === 'retail_settings')?.setting_value;
    const wholesaleSettings = data?.find(s => s.setting_key === 'wholesale_settings')?.setting_value;

    return {
      retail: {
        defaultTaxRate: retailSettings?.default_tax_rate || 18,
        minOrderAmount: retailSettings?.min_order_amount || 0,
        paymentTerms: retailSettings?.payment_terms || 'immediate',
        allowDiscounts: retailSettings?.allow_discounts || true,
        maxDiscountPercent: retailSettings?.max_discount_percent || 10
      },
      wholesale: {
        defaultTaxRate: wholesaleSettings?.default_tax_rate || 18,
        minOrderAmount: wholesaleSettings?.min_order_amount || 50000,
        defaultPaymentTerms: wholesaleSettings?.default_payment_terms || 'net_30',
        volumeDiscountEnabled: wholesaleSettings?.volume_discount_enabled || true,
        creditCheckRequired: wholesaleSettings?.credit_check_required || true
      }
    };
  } catch (error) {
    console.error('Error fetching billing settings:', error);
    throw error;
  }
}

export async function checkCreditLimit(
  customer: Customer,
  amount: number
): Promise<{ approved: boolean; message?: string }> {
  try {
    if (customer.type !== 'wholesaler') {
      return { approved: true };
    }

    const { data: creditLimit, error } = await supabase
      .from('credit_limits')
      .select('*')
      .eq('customer_id', customer.id)
      .single();

    if (error) throw error;

    if (!creditLimit) {
      return {
        approved: false,
        message: 'No credit limit established. Please contact your account manager.'
      };
    }

    if (creditLimit.status !== 'active') {
      return {
        approved: false,
        message: `Credit account ${creditLimit.status}. Please contact your account manager.`
      };
    }

    if (amount > creditLimit.available_credit) {
      return {
        approved: false,
        message: `Order amount exceeds available credit (₹${creditLimit.available_credit.toLocaleString()})`
      };
    }

    return { approved: true };
  } catch (error) {
    console.error('Error checking credit limit:', error);
    throw error;
  }
}

export async function calculateVolumeDiscount(
  quantity: number,
  unitPrice: number,
  customerType: 'wholesaler' | 'retailer'
): Promise<number> {
  try {
    const { data: tier, error } = await supabase.rpc(
      'calculate_volume_discount',
      {
        p_quantity: quantity,
        p_unit_price: unitPrice,
        p_customer_type: customerType
      }
    );

    if (error) throw error;
    return tier || unitPrice;
  } catch (error) {
    console.error('Error calculating volume discount:', error);
    return unitPrice;
  }
}

export async function validateMinimumOrder(
  productId: string,
  quantity: number,
  customerType: 'wholesaler' | 'retailer'
): Promise<boolean> {
  try {
    const { data: isValid, error } = await supabase.rpc(
      'validate_minimum_order_quantity',
      {
        p_product_id: productId,
        p_quantity: quantity,
        p_customer_type: customerType
      }
    );

    if (error) throw error;
    return isValid;
  } catch (error) {
    console.error('Error validating minimum order:', error);
    return false;
  }
}

export async function generateTransactionNumber(
  saleType: 'wholesale' | 'retail' | 'counter'
): Promise<string> {
  try {
    const { data: transactionNumber, error } = await supabase.rpc(
      'generate_transaction_number',
      { p_sale_type: saleType }
    );

    if (error) throw error;
    return transactionNumber;
  } catch (error) {
    console.error('Error generating transaction number:', error);
    throw error;
  }
}

export function calculatePaymentDueDate(
  paymentTerms: string,
  saleDate: Date = new Date()
): Date {
  const daysMap: { [key: string]: number } = {
    'immediate': 0,
    'net_15': 15,
    'net_30': 30,
    'net_60': 60
  };

  const days = daysMap[paymentTerms] || 0;
  const dueDate = new Date(saleDate);
  dueDate.setDate(dueDate.getDate() + days);
  return dueDate;
}

export function validateBillingDetails(
  customer: Customer,
  amount: number,
  settings: BillingSettings
): { valid: boolean; message?: string } {
  const isWholesale = customer.type === 'wholesaler';
  const minAmount = isWholesale ? settings.wholesale.minOrderAmount : settings.retail.minOrderAmount;

  if (amount < minAmount) {
    return {
      valid: false,
      message: `Minimum order amount for ${isWholesale ? 'wholesale' : 'retail'} is ₹${minAmount.toLocaleString()}`
    };
  }

  if (isWholesale && !customer.gst_number) {
    return {
      valid: false,
      message: 'GST number is required for wholesale transactions'
    };
  }

  return { valid: true };
}