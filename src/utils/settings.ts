interface CompanySettings {
  name: string;
  legal_name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  website: string;
  gst_number: string;
  pan_number: string;
  bank_details: {
    bank_name: string;
    account_name: string;
    account_number: string;
    ifsc_code: string;
    branch: string;
  };
  logo_url: string;
}

const defaultSettings: CompanySettings = {
  name: 'Jewelry Management System',
  legal_name: 'JMS Pvt Ltd',
  address: '123 Diamond Street',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  phone: '+91 98765 43210',
  email: 'contact@jms.com',
  website: 'www.jms.com',
  gst_number: '27AABCU9603R1ZX',
  pan_number: 'AABCU9603R',
  bank_details: {
    bank_name: 'HDFC Bank',
    account_name: 'JMS Pvt Ltd',
    account_number: '50100123456789',
    ifsc_code: 'HDFC0001234',
    branch: 'Diamond District'
  },
  logo_url: ''
};

export const getCompanySettings = (): CompanySettings => {
  const savedSettings = localStorage.getItem('companySettings');
  return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
};

export const getPrintSettings = () => {
  const defaultPrintSettings = {
    showHeader: true,
    showFooter: true,
    showLogo: true,
    headerText: getCompanySettings().name,
    footerText: 'Thank you for your business!',
    termsText: '1. Quotation valid for 7 days from the date of issue\n2. Prices are subject to change without prior notice\n3. GST will be charged as applicable\n4. Delivery timeline will be confirmed upon order confirmation',
    additionalNotes: '',
    showPriceBreakdown: true,
    showDiscount: false,
    discountPercent: 0
  };

  const savedSettings = localStorage.getItem('printSettings');
  return savedSettings ? { ...defaultPrintSettings, ...JSON.parse(savedSettings) } : defaultPrintSettings;
};
