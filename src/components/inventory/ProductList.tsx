import React, { useState, useEffect } from 'react';
import { 
  Edit, 
  Trash2, 
  QrCode, 
  Search, 
  Plus, 
  Filter, 
  ArrowUpDown, 
  Printer,
  AlertCircle,
  Check,
  X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import { printQRCodes } from '../../utils/barcodeGenerator';
import ProductForm from './ProductForm';
import type { Product } from '../../types';

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showQR, setShowQR] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof Product>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const { addToast } = useToast();

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('category')
        .not('category', 'is', null);

      if (error) throw error;

      const uniqueCategories = Array.from(new Set(data.map(item => item.category)));
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      addToast({
        title: 'Error',
        message: 'Failed to load categories',
        type: 'error'
      });
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order(sortField, { ascending: sortDirection === 'asc' });

      if (error) throw error;

      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError('Failed to load products');
      addToast({
        title: 'Error',
        message: 'Failed to load products',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof Product) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProducts(prev => prev.filter(product => product.id !== id));
      addToast({
        title: 'Success',
        message: 'Product deleted successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      addToast({
        title: 'Error',
        message: 'Failed to delete product',
        type: 'error'
      });
    }
  };

  const handleSubmit = async (productData: Partial<Product>) => {
    try {
      if (editProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editProduct.id);

        if (error) throw error;

        setProducts(prev =>
          prev.map(p => (p.id === editProduct.id ? { ...p, ...productData } : p))
        );
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert([productData])
          .select();

        if (error) throw error;

        setProducts(prev => [...prev, ...(data || [])]);
      }

      setShowForm(false);
      setEditProduct(null);
      fetchProducts(); // Refresh the list
    } catch (error) {
      console.error('Error saving product:', error);
      addToast({
        title: 'Error',
        message: 'Failed to save product',
        type: 'error'
      });
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = (
      (product.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (product.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (product.manufacturer?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    const matchesCategory = !selectedCategory || product.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handlePrintQR = (product: Product) => {
    try {
      if (!product.qrCode && !product.sku) {
        throw new Error('No QR code or SKU available');
      }
      printQRCodes([product.qrCode || product.sku]);
    } catch (error) {
      console.error('Error printing QR code:', error);
      addToast({
        title: 'Error',
        message: 'Failed to print QR code',
        type: 'error'
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Product Inventory</h1>
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Add Product
          </button>
        </div>

        {/* Filters and Search */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => fetchProducts()}
              className="btn btn-secondary flex items-center gap-2"
            >
              <ArrowUpDown className="h-5 w-5" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        /* Product Table */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="table-header cursor-pointer"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Product Name
                      {sortField === 'name' && (
                        <ArrowUpDown className="ml-1 h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th className="table-header">SKU</th>
                  <th 
                    className="table-header cursor-pointer"
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center">
                      Category
                      {sortField === 'category' && (
                        <ArrowUpDown className="ml-1 h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="table-header cursor-pointer"
                    onClick={() => handleSort('stockLevel')}
                  >
                    <div className="flex items-center">
                      Stock
                      {sortField === 'stockLevel' && (
                        <ArrowUpDown className="ml-1 h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="table-header cursor-pointer"
                    onClick={() => handleSort('retailPrice')}
                  >
                    <div className="flex items-center">
                      MWP
                      {sortField === 'retailPrice' && (
                        <ArrowUpDown className="ml-1 h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center">
                        {product.imageUrl && (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-10 w-10 rounded-lg object-cover mr-3"
                          />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">{product.manufacturer}</div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell font-mono text-sm">{product.sku}</td>
                    <td className="table-cell">
                      <span className="px-2 py-1 text-sm rounded-full bg-blue-100 text-blue-800">
                        {product.category}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={`px-2 py-1 text-sm rounded-full ${
                        product.stockLevel > 10
                          ? 'bg-green-100 text-green-800'
                          : product.stockLevel > 0
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {product.stockLevel} units
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="font-medium">₹{product.retailPrice}</span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setShowQR(product.id)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <QrCode className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditProduct(product);
                            setShowForm(true);
                          }}
                          className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this product?')) {
                              handleDelete(product.id);
                            }
                          }}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredProducts.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">No products found</div>
              <button
                onClick={() => setShowForm(true)}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Add your first product
              </button>
            </div>
          )}
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <ProductForm
          product={editProduct || undefined}
          onClose={() => {
            setShowForm(false);
            setEditProduct(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {/* QR Code Modal */}
      {showQR !== null && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowQR(null)}
        >
          <div 
            className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4 transform transition-all"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              {(() => {
                const product = products.find(p => p.id === showQR);
                if (!product) return null;

                return (
                  <>
                    <h3 className="text-lg font-semibold mb-4">QR Code: {product.sku}</h3>
                    <div className="flex justify-center mb-4">
                      <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                        <QRCodeSVG 
                          value={product.qrCode || product.sku}
                          size={200}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                    </div>
                    <div className="font-mono text-sm mb-4 break-all">
                      {product.sku.split('-').map((part, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && '-'}
                          <span className={i === 1 ? 'text-blue-600 font-bold' : ''}>
                            {part}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handlePrintQR(product)}
                        className="btn btn-secondary flex items-center gap-2"
                      >
                        <Printer className="h-4 w-4" />
                        Print
                      </button>
                      <button
                        onClick={() => setShowQR(null)}
                        className="btn btn-secondary"
                      >
                        Close
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductList;
