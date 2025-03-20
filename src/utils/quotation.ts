import { format } from 'date-fns';
import type { QuotationItem, Customer } from '../types';
import { getBillingSettings, validateBillingDetails, calculateVolumeDiscount } from './billingUtils';

export const generateQuotationNumber = () => {
  return `Q${format(new Date(), 'yyyyMMdd')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
};

export const calculateTotals = (
  items: QuotationItem[],
  selectedCustomer: Customer | null,
  customer: Customer | null,
  discount: number,
  gstRate: number = 18,
  includeGst: boolean = true
) => {
  // Calculate base subtotal
  let subtotal = items.reduce((sum, item) => {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 0;
    return sum + (price * quantity);
  }, 0);

  // Apply volume discounts ```diff
  let volumeDiscountAmount = 0;
  if (selectedCustomer?.type === 'wholesaler') {
    // Calculate volume discounts per item
    volumeDiscountAmount = items.reduce(async (sum, item) => {
      const basePrice = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      // Apply standard wholesale discount
      const discountedPrice = basePrice * 0.9; // 10% wholesale discount
      return sum + ((basePrice - discountedPrice) * quantity);
    }, 0);
  }

  // Apply manual discount
  const manualDiscountAmount = (subtotal * discount) / 100;
  const totalDiscountAmount = manualDiscountAmount + volumeDiscountAmount;

  const total = subtotal - totalDiscountAmount;
  const gstAmount = includeGst ? (total * gstRate) / 100 : 0;
  const finalTotal = total + gstAmount;

  return {
    subtotal,
    discountAmount: totalDiscountAmount,
    volumeDiscountAmount,
    manualDiscountAmount,
    total,
    gstAmount,
    finalTotal,
    gstRate
  };
};

export function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  function convert(n: number): string {
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  
  let result = 'Rupees ' + convert(rupees);
  if (paise > 0) {
    result += ' and ' + convert(paise) + ' Paise';
  }
  
  return result;
}
export const formatCurrency = (amount: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    amount = 0;
  }
  return `₹${amount.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })}`;
};

export const validateQuotation = (items: QuotationItem[]) => {
  if (items.length === 0) {
    return 'Please add items to the quotation';
  }

  for (const item of items) {
    // Check stock availability
    if (item.quantity > item.product.stockLevel) {
      return `Insufficient stock for ${item.product.name}`;
    }

    // Validate minimum order quantity
    const minQuantity = item.product.wholesale_min_quantity || 1;
    if (item.quantity < minQuantity) {
      return `Minimum order quantity for ${item.product.name} is ${minQuantity}`;
    }

    if (item.quantity <= 0) {
      return `Invalid quantity for ${item.product.name}`;
    }
    if (item.price <= 0) {
      return `Invalid price for ${item.product.name}`;
    }
  }

  return null;
};

export const getDiscountLimits = async (
  customerType: 'wholesaler' | 'retailer',
  isAdvancedDiscountEnabled: boolean
): Promise<{ max: number; presets: number[] }> => {
  const settings = await getBillingSettings();

  if (customerType === 'retailer') {
    return {
      max: isAdvancedDiscountEnabled ? 100 : settings.retail.maxDiscountPercent,
      presets: [1, 2, 3, 5, 7, 10]
    };
  }

  // Get wholesale pricing tiers for presets
  const { data: tiers } = await supabase
    .from('pricing_tiers')
    .select('discount_percent')
    .eq('type', 'wholesale')
    .order('discount_percent');

  return {
    max: isAdvancedDiscountEnabled ? 100 : Math.max(...(tiers?.map(t => t.discount_percent) || [15])),
    presets: tiers?.map(t => t.discount_percent) || [5, 10, 15]
  };
};

export const validateBilling = async (
  customer: Customer | null,
  items: QuotationItem[],
  total: number
): Promise<{ valid: boolean; message?: string }> => {
  try {
    if (!customer) {
      return { valid: true };
    }

    const settings = await getBillingSettings();
    
    // Validate billing details
    const billingValidation = validateBillingDetails(customer, total, settings);
    if (!billingValidation.valid) {
      return billingValidation;
    }

    // For wholesale customers, check credit limit
    if (customer.type === 'wholesaler') {
      const creditCheck = await checkCreditLimit(customer, total);
      if (!creditCheck.approved) {
        return {
          valid: false,
          message: creditCheck.message
        };
      }
    }

    return { valid: true };
  } catch (error) {
    console.error('Error validating billing:', error);
    return {
      valid: false,
      message: 'Error validating billing details. Please try again.'
    };
  }
};
