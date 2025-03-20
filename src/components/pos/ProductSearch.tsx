import React, { useState, useCallback, useRef } from 'react';
import { Search } from 'lucide-react';
import type { Product } from '../../types';
import { supabase } from '../../lib/supabase';
import debounce from '../../utils/debounce';

interface ProductSearchProps {
  onSelect: (product: Product) => void;
}

const ProductSearch: React.FC<ProductSearchProps> = ({ onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  const searchProducts = useCallback(
    debounce(async (term: string) => {
      if (!term) {
        setSearchResults([]);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
          .limit(5);

        if (error) throw error;
        
        const formattedData = (data || []).map(item => ({
          id: item.id,
          name: item.name,
          description: item.description || '',
          manufacturer: item.manufacturer,
          sku: item.sku,
          buyPrice: Number(item.buy_price),
          wholesalePrice: Number(item.wholesale_price),
          retailPrice: Number(item.retail_price),
          stockLevel: Number(item.stock_level),
          category: item.category,
          imageUrl: item.image_url || '',
          qrCode: item.qr_code || '',
          code128: item.code128 || '',
          cipher: item.cipher || '',
          additionalInfo: item.additional_info || ''
        }));

        setSearchResults(formattedData);
      } catch (error) {
        console.error('Error searching products:', error);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setShowSearchResults(true);
          searchProducts(e.target.value);
        }}
        placeholder="Search products..."
        className="input w-full pl-10"
      />
      {showSearchResults && searchResults.length > 0 && (
        <div
          ref={searchResultsRef}
          className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {searchResults.map((product) => (
            <div
              key={product.id}
              className="p-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => {
                onSelect(product);
                setSearchTerm('');
                setShowSearchResults(false);
              }}
            >
              <div className="font-medium">{product.name}</div>
              <div className="text-sm text-gray-600">
                SKU: {product.sku} | Stock: {product.stockLevel}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductSearch;
