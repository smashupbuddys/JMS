import React from 'react';
import type { QuotationItem, Customer, VideoCall } from '../../../types';
import ThermalTemplate from './ThermalTemplate';
import CompactTemplate from './CompactTemplate';
import StandardTemplate from './StandardTemplate';
import ModernTemplate from './ModernTemplate';
import LuxuryTemplate from './LuxuryTemplate';
import DetailedTemplate from './DetailedTemplate';

export type PrintTemplate = 'thermal' | 'compact' | 'standard' | 'modern' | 'luxury' | 'detailed';

interface PrintTemplatesProps {
  items: QuotationItem[];
  customerType: 'wholesaler' | 'retailer';
  total: number;
  customer?: Customer | null;
  discount: number;
  videoCall?: VideoCall | null;
  quotationNumber: string;
  gstRate: number;
  template: PrintTemplate;
  includeGst?: boolean;
}

const templates = {
  thermal: ThermalTemplate,
  compact: CompactTemplate,
  standard: StandardTemplate,
  modern: ModernTemplate,
  luxury: LuxuryTemplate,
  detailed: DetailedTemplate
};

const PrintTemplates: React.FC<PrintTemplatesProps> = (props) => {
  const SelectedTemplate = templates[props.template];
  return <SelectedTemplate {...props} />;
};

export default PrintTemplates;
