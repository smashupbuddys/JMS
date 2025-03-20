import type { QuotationItem, Customer, VideoCall } from '../../../types';

export interface PrintTemplatesProps {
  items: QuotationItem[];
  customerType: 'wholesaler' | 'retailer';
  total: number;
  customer?: Customer | null;
  discount: number;
  videoCall?: VideoCall | null;
  quotationNumber: string;
  gstRate: number;
  includeGst?: boolean;
}
