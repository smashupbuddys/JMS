import React from 'react';
import { Plus, Minus, Trash2, Box, AlertTriangle, QrCode } from 'lucide-react';
import type { QuotationItem } from '../../../../types';
import { formatCurrency } from '../../../../utils/quotation';
import { useSearchParams } from 'react-router-dom';

interface ItemsTableProps {
  items: QuotationItem[];
  scanning: boolean;
  onUpdateQuantity: (index: number, change: number) => void;
  onRemoveItem: (index: number) => void;
}
const ItemsTable: React.FC<ItemsTableProps> = ({
  items,
  scanning,
  onUpdateQuantity,
  onRemoveItem,
}) => {
  const [searchParams] = useSearchParams();
  const readonly = searchParams.get('readonly') === 'true';

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        {/* Check if we're in readonly mode */}
        {readonly && (
          <div className="absolute inset-0 bg-gray-100/50 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="bg-white/90 rounded-lg shadow-lg p-4 text-center">
              <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-gray-700">This quotation is in read-only mode</p>
            </div>
          </div>
        )}
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Image</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.map((item, index) => (
            <tr key={`${item.product.id}-${index}`}>
              <td className="px-6 py-4">
                <div className="text-sm font-medium text-gray-900">{item.product.category}</div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm font-medium text-gray-900 font-mono">
                  {item.product.sku.split('-').map((part, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && '-'}
                      <span className={i === 1 ? 'font-bold' : ''}>
                        {part}
                      </span>
                    </React.Fragment>
                  ))}
                  <span className="ml-2 text-xs text-gray-500">
                    (₹{Math.round(item.originalPrice).toLocaleString()})
                  </span>
                </div>
              </td>
              <td className="px-6 py-4">
                {item.product.imageUrl ? (
                  <img 
                    src={item.product.imageUrl} 
                    alt={item.product.sku}
                    className="h-12 w-12 object-cover rounded"
                  />
                ) : (
                  <div className="h-12 w-12 bg-gray-100 rounded flex items-center justify-center">
                    <Box className="h-6 w-6 text-gray-400" />
                  </div>
                )}
              </td>
              <td className="px-6 py-4">{formatCurrency(item.price)}</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <button
                    className={`p-2 rounded-lg transition-colors duration-200 transform active:scale-95 ${
                      scanning 
                        ? 'bg-gray-800 text-white hover:bg-gray-700 active:bg-gray-900' 
                        : 'bg-gray-100 hover:bg-gray-200 active:bg-gray-300'
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onUpdateQuantity(index, -1);
                    }}
                    disabled={readonly}
                    type="button" 
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center font-medium">{item.quantity}</span>
                  <button
                    className={`p-2 rounded-lg transition-colors duration-200 transform active:scale-95 ${
                      scanning 
                        ? 'bg-gray-800 text-white hover:bg-gray-700 active:bg-gray-900' 
                        : 'bg-gray-100 hover:bg-gray-200 active:bg-gray-300'
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onUpdateQuantity(index, 1);
                    }}
                    disabled={readonly}
                    type="button"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </td>
              <td className="px-6 py-4">{formatCurrency(item.price * item.quantity)}</td>
              <td className="px-6 py-4 text-right">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemoveItem(index);
                  }}
                  disabled={readonly}
                  type="button"
                  aria-label="Remove item"
                  className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors duration-200"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ItemsTable;
