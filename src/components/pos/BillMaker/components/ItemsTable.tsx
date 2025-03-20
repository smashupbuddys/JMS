import React from 'react';
import { Plus, Minus, Trash2, Box } from 'lucide-react';
import type { QuotationItem } from '../../../../types';
import { formatCurrency } from '../../../../utils/quotation';

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
  onRemoveItem
}) => {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
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
                    onClick={() => onUpdateQuantity(index, -1)}
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
                    onClick={() => onUpdateQuantity(index, 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </td>
              <td className="px-6 py-4">{formatCurrency(item.price * item.quantity)}</td>
              <td className="px-6 py-4 text-right">
                <button
                  onClick={() => onRemoveItem(index)}
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