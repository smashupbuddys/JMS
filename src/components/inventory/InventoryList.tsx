import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, QrCode, Printer, Edit, Trash2, Copy, Filter,
  ArrowUpDown, AlertCircle, Package, Tag, DollarSign, BarChart2,
  Calendar, Clock, Info, RefreshCw, Download, Upload, Settings,
  X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format, differenceInDays } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { hasPermission } from '../../lib/auth';
import ProductForm from './ProductForm';
import { printQRCodes } from '../../utils/barcodeGenerator';
import { useToast } from '../../hooks/useToast';
import type { Product } from '../../types';

interface FilterOptions {
  deadStock: boolean;
  slowMoving: boolean;
  category: string;
  manufacturer: string;
  priceRange: {
    min: number;
    max: number;
  };
  stockLevel: {
    min: number;
    max: number;
  };
  lastSold: number | null; // days
}

interface SortOption {
  field: keyof Product;
  direction: 'asc' | 'desc';
}

const InventoryList: React.FC = () => {
  // State Management
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showQR, setShowQR] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const { addToast } = useToast();
  
  // Enhanced filtering and sorting
  const [filters, setFilters] = useState<FilterOptions>({
    deadStock: false,
    slowMoving: false,
    category: '',
    manufacturer: '',
    priceRange: { min: 0, max: Infinity },
    stockLevel: { min: 0, max: Infinity },
    lastSold: null
  });
  
  const [sort, setSort] = useState<SortOption>({
    field: 'name',
    direction: 'asc'
  });
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkActionMode, setBulkActionMode] = useState(false);

  // Analytics data
  const [analytics, setAnalytics] = useState({
    totalProducts: 0,
    totalValue: 0,
    lowStock: 0,
    deadStock: 0,
    averagePrice: 0
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchManufacturers();
  }, []);

  useEffect(() => {
    if (products.length > 0) {
      calculateAnalytics();
    }
  }, [products]);

  // Transform function to map database fields to frontend model
  const transformProduct = (data: any): Product => ({
    id: data.id,
    name: data.name,
    description: data.description,
    manufacturer: data.manufacturer,
    sku: data.sku,
    buyPrice: data.buy_price,
    wholesalePrice: data.wholesale_price,
    retailPrice: data.retail_price,
    stockLevel: data.stock_level,
    category: data.category,
    imageUrl: data.image_url,
    qrCode: data.qr_code,
    code128: data.code128,
    cipher: data.cipher,
    additionalInfo: data.additional_info,
    lastSoldAt: data.last_sold_at,
    deadStockStatus: data.dead_stock_status,
    deadStockDays: data.dead_stock_days
  });

  // Inverse transform for updating/creating products
  const transformForDatabase = (product: Partial<Product>) => {
    return {
      name: product.name,
      description: product.description,
      manufacturer: product.manufacturer,
      sku: product.sku,
      buy_price: product.buyPrice,
      wholesale_price: product.wholesalePrice,
      retail_price: product.retailPrice,
      stock_level: product.stockLevel,
      category: product.category,
      image_url: product.imageUrl,
      qr_code: product.qrCode,
      code128: product.code128,
      cipher: product.cipher,
      additional_info: product.additionalInfo,
      last_sold_at: product.lastSoldAt,
      dead_stock_status: product.deadStockStatus,
      dead_stock_days: product.deadStockDays
    };
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order(snake_case(sort.field.toString()), { ascending: sort.direction === 'asc' });

      if (error) throw error;

      const transformedProducts = (data || []).map(transformProduct);
      setProducts(transformedProducts);
      calculateAnalytics();
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
    }
  };

  const fetchManufacturers = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('manufacturer')
        .not('manufacturer', 'is', null);

      if (error) throw error;

      const uniqueManufacturers = Array.from(new Set(data.map(item => item.manufacturer)));
      setManufacturers(uniqueManufacturers);
    } catch (error) {
      console.error('Error fetching manufacturers:', error);
    }
  };

  const calculateAnalytics = () => {
    const analytics = {
      totalProducts: products.length,
      totalValue: products.reduce((sum, p) => sum + ((p.buyPrice || 0) * (p.stockLevel || 0)), 0),
      lowStock: products.filter(p => (p.stockLevel || 0) < 5).length,
      deadStock: products.filter(p => {
        const daysSinceLastSold = p.lastSoldAt 
          ? differenceInDays(new Date(), new Date(p.lastSoldAt))
          : Infinity;
        return daysSinceLastSold > 90;
      }).length,
      averagePrice: products.length > 0 
        ? products.reduce((sum, p) => sum + (p.retailPrice || 0), 0) / products.length 
        : 0
    };

    setAnalytics(analytics);
  };

const handleAddProduct = async (productData: any) => {
  try {
    console.log('Starting product addition with data:', productData);

    // Validate required fields
    const requiredFields = ['name', 'manufacturer', 'category', 'buy_price', 'wholesale_price', 'retail_price', 'stock_level'];
    const missingFields = requiredFields.filter(field => !productData[field]);
    
    console.log('Required fields validation:', {
      requiredFields,
      missingFields,
      productData
    });
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate prices
    const buyPrice = Number(productData.buy_price);
    const wholesalePrice = Number(productData.wholesale_price);
    const retailPrice = Number(productData.retail_price);

    console.log('Price validation:', {
      buyPrice,
      wholesalePrice,
      retailPrice,
      isValid: buyPrice > 0 && wholesalePrice > buyPrice && retailPrice > wholesalePrice
    });

    if (buyPrice <= 0) {
      throw new Error('Buy price must be greater than 0');
    }
    if (wholesalePrice <= buyPrice) {
      throw new Error('Wholesale price must be greater than buy price');
    }
    if (retailPrice <= wholesalePrice) {
      throw new Error('Retail price must be greater than wholesale price');
    }

    // Check if manufacturer exists
    console.log('Checking manufacturer existence:', productData.manufacturer);
    let { data: manufacturerData, error: manufacturerError } = await supabase
      .from('manufacturer_analytics')
      .select('manufacturer')
      .eq('manufacturer', productData.manufacturer)
      .single();

    if (manufacturerError || !manufacturerData) {
      // Manufacturer doesn't exist, create it
      console.log('Creating new manufacturer:', productData.manufacturer);
      const { error: createManufacturerError } = await supabase
        .from('manufacturer_analytics')
        .insert([{
          manufacturer: productData.manufacturer,
          total_sales: 0,
          total_items: 0,
          month: new Date().toISOString()
        }]);

      if (createManufacturerError) {
        throw new Error(`Failed to create manufacturer: ${createManufacturerError.message}`);
      }
    }

    // Check if category exists
    console.log('Checking category existence:', productData.category);
    let { data: categoryData, error: categoryError } = await supabase
      .from('category_analytics')
      .select('category')
      .eq('category', productData.category)
      .single();

    if (categoryError || !categoryData) {
      // Category doesn't exist, create it
      console.log('Creating new category:', productData.category);
      const { error: createCategoryError } = await supabase
        .from('category_analytics')
        .insert([{
          category: productData.category,
          total_sales: 0,
          total_items: 0,
          month: new Date().toISOString()
        }]);

      if (createCategoryError) {
        throw new Error(`Failed to create category: ${createCategoryError.message}`);
      }
    }

    // Transform data for database
    const dbData = {
      name: productData.name,
      description: productData.description || '',
      manufacturer: productData.manufacturer,
      category: productData.category,
      sku: productData.sku,
      buy_price: buyPrice,
      wholesale_price: wholesalePrice,
      retail_price: retailPrice,
      stock_level: Number(productData.stock_level),
      image_url: productData.image_url || '',
      qr_code: productData.qr_code || '',
      code128: productData.code128 || '',
      cipher: productData.cipher || '',
      additional_info: productData.additional_info || '',
      attributes: productData.attributes || {}
    };

    console.log('Inserting product with data:', dbData);
    const { data, error } = await supabase
      .from('products')
      .insert([dbData])
      .select()
      .single();

    if (error) throw error;

    console.log('Product added successfully:', data);
    addToast({
      title: 'Success',
      message: 'Product added successfully',
      type: 'success'
    });

    // Add markup settings if they don't exist
    const { error: markupError } = await supabase
      .from('markup_settings')
      .insert([
        {
          type: 'manufacturer',
          name: productData.manufacturer,
          markup: 1.5 // Default markup
        },
        {
          type: 'category',
          name: productData.category,
          markup: 2.0 // Default markup
        }
      ])
      .onConflict(['type', 'name'])
      .ignore();

    if (markupError) {
      console.warn('Failed to add markup settings:', markupError);
    }

    // Refresh the products list
    await fetchProducts();
    setShowForm(false);
  } catch (error: any) {
    console.error('Error adding product:', error);
    addToast({
      title: 'Error',
      message: error.message || 'Failed to add product',
      type: 'error'
    });
  }
};

const handleEditProduct = async (productData: any) => {
  if (!editingProduct) {
    console.error('No product selected for editing');
    return;
  }
  
  try {
    console.log('Starting product edit:', {
      editingProduct,
      newData: productData
    });

    // Validate required numeric fields
    const requiredFields = ['buyPrice', 'wholesalePrice', 'retailPrice', 'stockLevel'];
    const invalidFields = requiredFields.filter(field => !productData[field] || isNaN(Number(productData[field])));
    
    console.log('Required fields validation:', {
      requiredFields,
      invalidFields,
      productData
    });

    if (invalidFields.length > 0) {
      throw new Error(`Invalid ${invalidFields.map(f => f.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}`);
    }

    // Ensure all prices are positive numbers
    const buyPrice = Number(productData.buyPrice);
    const wholesalePrice = Number(productData.wholesalePrice);
    const retailPrice = Number(productData.retailPrice);

    console.log('Price validation:', {
      buyPrice,
      wholesalePrice,
      retailPrice,
      isValid: buyPrice > 0 && wholesalePrice > buyPrice && retailPrice > wholesalePrice
    });

    if (buyPrice <= 0) throw new Error('Buy price must be greater than 0');
    if (wholesalePrice <= buyPrice) {
      throw new Error('Wholesale price must be greater than buy price');
    }
    if (retailPrice <= wholesalePrice) {
      throw new Error('Retail price must be greater than wholesale price');
    }

    // Check if manufacturer has changed
    const manufacturerChanged = productData.manufacturer !== editingProduct.manufacturer;
    const categoryChanged = productData.category !== editingProduct.category;

    console.log('Checking for manufacturer/category changes:', {
      manufacturerChanged,
      categoryChanged,
      oldManufacturer: editingProduct.manufacturer,
      newManufacturer: productData.manufacturer,
      oldCategory: editingProduct.category,
      newCategory: productData.category
    });

    // If manufacturer or category has changed, verify that the new ones exist
    if (manufacturerChanged || categoryChanged) {
      // Check if manufacturer exists if it has changed
      if (manufacturerChanged) {
        console.log('Checking new manufacturer existence:', productData.manufacturer);
        const { data: manufacturerData, error: manufacturerError } = await supabase
          .from('manufacturer_analytics')
          .select('manufacturer')
          .eq('manufacturer', productData.manufacturer)
          .single();

        console.log('New manufacturer check result:', {
          data: manufacturerData,
          error: manufacturerError
        });

        if (!manufacturerData && (manufacturerError && manufacturerError.code === 'PGRST116')) {
          throw new Error(`The manufacturer '${productData.manufacturer}' doesn't exist in the system. Please select an existing manufacturer.`);
        } else if (manufacturerError && manufacturerError.code !== 'PGRST116') {
          throw manufacturerError;
        }
      }

      // Check if category exists if it has changed
      if (categoryChanged) {
        console.log('Checking new category existence:', productData.category);
        const { data: categoryData, error: categoryError } = await supabase
          .from('category_analytics')
          .select('category')
          .eq('category', productData.category)
          .single();

        console.log('New category check result:', {
          data: categoryData,
          error: categoryError
        });

        if (!categoryData && (categoryError && categoryError.code === 'PGRST116')) {
          throw new Error(`The category '${productData.category}' doesn't exist in the system. Please select an existing category.`);
        } else if (categoryError && categoryError.code !== 'PGRST116') {
          throw categoryError;
        }
      }
    }

    // Transform data for database
    const dbData = transformForDatabase(productData);
    console.log('Transformed data for database:', dbData);
    
    // Ensure all array fields are properly initialized before sending to Supabase
    const safeDbData = {
      ...dbData,
      // Add any potential array fields with safety checks
      tags: Array.isArray(dbData.tags) ? dbData.tags : [],
      images: Array.isArray(dbData.images) ? dbData.images : [],
      variants: Array.isArray(dbData.variants) ? dbData.variants : [],
      related_products: Array.isArray(dbData.related_products) ? dbData.related_products : [],
      attributes: Array.isArray(dbData.attributes) ? dbData.attributes : [],
      categories: Array.isArray(dbData.categories) ? dbData.categories : []
    };

    console.log('Final data being sent to database:', safeDbData);

    // Make the Supabase request with the sanitized data
    const { data, error } = await supabase
      .from('products')
      .update(safeDbData)
      .eq('id', editingProduct.id)
      .select()
      .single();

    console.log('Database update result:', {
      data,
      error
    });

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to update product: ${error.message}`);
    }

    const transformedProduct = transformProduct(data);
    console.log('Successfully updated product:', transformedProduct);

    setProducts(prev => prev.map(p => p.id === editingProduct.id ? transformedProduct : p));
    setEditingProduct(undefined);
    addToast({
      title: 'Success',
      message: 'Product updated successfully',
      type: 'success'
    });
  } catch (error: any) {
    console.error('Error updating product:', {
      error,
      message: error.message,
      stack: error.stack
    });
    addToast({
      title: 'Error',
      message: error.message || 'Failed to update product',
      type: 'error'
    });
  }
};

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProducts(prev => prev.filter(p => p.id !== id));
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

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedProducts.size} products?`)) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', Array.from(selectedProducts));

      if (error) throw error;

      setProducts(prev => prev.filter(p => !selectedProducts.has(p.id)));
      setSelectedProducts(new Set());
      setBulkActionMode(false);
      addToast({
        title: 'Success',
        message: `${selectedProducts.size} products deleted successfully`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error bulk deleting products:', error);
      addToast({
        title: 'Error',
        message: 'Failed to delete products',
        type: 'error'
      });
    }
  };

  const handlePrintLabel = (product: Product) => {
    if (!product.sku) return;
    try {
      // Create an array of SKUs with length equal to the product's stock level
      const skuArray = Array(product.stockLevel || 1).fill(product.sku);
      printQRCodes(skuArray, `Print Labels - ${product.sku}`);
      
      addToast({
        title: 'Success',
        message: `Printing ${product.stockLevel || 1} labels for ${product.name || product.sku}`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error printing label:', error);
      addToast({
        title: 'Error',
        message: 'Failed to print label',
        type: 'error'
      });
    }
  };

  const handleBulkPrint = () => {
    try {
      const selectedProductsArray = products.filter(p => selectedProducts.has(p.id));
      
      if (selectedProductsArray.length === 0) {
        throw new Error('No products selected');
      }
      
      // Create an array of SKUs, repeating each SKU based on the product's stock level
      const skuArray = selectedProductsArray.flatMap(product => 
        Array(product.stockLevel || 1).fill(product.sku)
      ).filter(Boolean);
      
      if (skuArray.length === 0) {
        throw new Error('No valid SKUs found for selected products');
      }

      printQRCodes(skuArray, 'Bulk Print Labels');
      
      const totalLabels = skuArray.length;
      addToast({
        title: 'Success',
        message: `Printing ${totalLabels} labels for ${selectedProductsArray.length} products`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error bulk printing labels:', error);
      addToast({
        title: 'Error',
        message: 'Failed to print labels',
        type: 'error'
      });
    }
  };

  const handleCopyToClipboard = (text: string) => {
    // First try to use the Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => {
          addToast({
            title: 'Success',
            message: 'SKU copied to clipboard',
            type: 'success',
            duration: 2000
          });
        },
        (err) => {
          console.error('Failed to copy:', err);
          // Fallback method
          fallbackCopyTextToClipboard(text);
        }
      );
    } else {
      // Fallback method for browsers that don't support the Clipboard API
      fallbackCopyTextToClipboard(text);
    }
  };

  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        addToast({
          title: 'Success',
          message: 'SKU copied to clipboard',
          type: 'success',
          duration: 2000
        });
      } else {
        addToast({
          title: 'Error',
          message: 'Failed to copy SKU',
          type: 'error'
        });
      }
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
      addToast({
        title: 'Error',
        message: 'Failed to copy SKU',
        type: 'error'
      });
    }

    document.body.removeChild(textArea);
  };

  const handleExportCSV = () => {
    try {
      const headers = [
        'SKU',
        'Name',
        'Category',
        'Manufacturer',
        'Stock Level',
        'Buy Price',
        'Wholesale Price',
        'Retail Price',
        'Last Sold',
        'Description'
      ];

      const csvContent = [
        headers.join(','),
        ...products.map(p => [
          p.sku || '',
          `"${p.name || ''}"`,
          p.category || '',
          p.manufacturer || '',
          p.stockLevel || 0,
          p.buyPrice || 0,
          p.wholesalePrice || 0,
          p.retailPrice || 0,
          p.lastSoldAt || '',
          `"${p.description || ''}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `inventory_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
    } catch (error) {
      console.error('Error exporting CSV:', error);
      addToast({
        title: 'Error',
        message: 'Failed to export inventory',
        type: 'error'
      });
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Skip items that don't exist
      if (!product) return false;
      
      // Basic search
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === '' || (
        ((product.name || '').toLowerCase()).includes(searchLower) ||
        ((product.sku || '').toLowerCase()).includes(searchLower) ||
        ((product.category || '').toLowerCase()).includes(searchLower) ||
        ((product.manufacturer || '').toLowerCase()).includes(searchLower) ||
        ((product.description || '').toLowerCase()).includes(searchLower)
      );

      // Category and manufacturer filters
      const matchesCategory = !filters.category || product.category === filters.category;
      const matchesManufacturer = !filters.manufacturer || product.manufacturer === filters.manufacturer;

      // Price range filter
      const matchesPriceRange = 
        (product.retailPrice || 0) >= filters.priceRange.min &&
        (product.retailPrice || 0) <= filters.priceRange.max;

      // Stock level filter
      const matchesStockLevel =
        (product.stockLevel || 0) >= filters.stockLevel.min &&
        (product.stockLevel || 0) <= filters.stockLevel.max;

      // Dead stock and slow moving filters
      const daysSinceLastSold = product.lastSoldAt
        ? differenceInDays(new Date(), new Date(product.lastSoldAt))
        : Infinity;

      const matchesDeadStock = !filters.deadStock || daysSinceLastSold >= 90;
      const matchesSlowMoving = !filters.slowMoving || (daysSinceLastSold >= 30 && daysSinceLastSold < 90);
      const matchesLastSold = !filters.lastSold || daysSinceLastSold <= filters.lastSold;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesManufacturer &&
        matchesPriceRange &&
        matchesStockLevel &&
        matchesDeadStock &&
        matchesSlowMoving &&
        matchesLastSold
      );
    });
  }, [products, searchTerm, filters]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      const aValue = a[sort.field];
      const bValue = b[sort.field];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sort.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sort.direction === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }

      return 0;
    });
  }, [filteredProducts, sort]);

  const handleSort = (field: keyof Product) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(productId);
      } else {
        next.delete(productId);
      }
      return next;
    });
  };

  // Helper function to convert camelCase to snake_case for database queries
  const snake_case = (str: string) => {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl shadow-sm">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Inventory Management
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {products.length} products • {analytics.lowStock} low stock • 
            {analytics.deadStock} dead stock
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <BarChart2 className="h-5 w-5" />
            Analytics
          </button>

          <button
            onClick={() => handleExportCSV()}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Download className="h-5 w-5" />
            Export
          </button>

          <button
            onClick={() => setBulkActionMode(!bulkActionMode)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <CheckSquare className="h-5 w-5" />
            {bulkActionMode ? "Exit Bulk Mode" : "Bulk Actions"}
          </button>

          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Add Product
          </button>
        </div>
      </div>

      {/* Analytics Panel */}
      {showAnalytics && (
        <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Inventory Analytics
            </h3>
            <button
              onClick={() => setShowAnalytics(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-blue-600 text-sm font-medium">Total Value</div>
              <div className="text-2xl font-bold">₹{analytics.totalValue.toLocaleString()}</div>
              <div className="text-blue-500 text-sm mt-1">Inventory Cost</div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-green-600 text-sm font-medium">Average Price</div>
              <div className="text-2xl font-bold">₹{analytics.averagePrice.toLocaleString()}</div>
              <div className="text-green-500 text-sm mt-1">Per Product</div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-yellow-600 text-sm font-medium">Low Stock</div>
              <div className="text-2xl font-bold">{analytics.lowStock}</div>
              <div className="text-yellow-500 text-sm mt-1">Products</div>
            </div>

            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-red-600 text-sm font-medium">Dead Stock</div>
              <div className="text-2xl font-bold">{analytics.deadStock}</div>
              <div className="text-red-500 text-sm mt-1">Products</div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search inventory..."
                className="input pl-10 w-full bg-white/80 backdrop-blur-sm border-gray-200/80 focus:border-blue-500/50 focus:ring-blue-500/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <select
              className="input w-40 bg-white/80 backdrop-blur-sm border-gray-200/80"
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            <select
              className="input w-40 bg-white/80 backdrop-blur-sm border-gray-200/80"
              value={filters.manufacturer}
              onChange={(e) => setFilters(prev => ({ ...prev, manufacturer: e.target.value }))}
            >
              <option value="">All Manufacturers</option>
              {manufacturers.map(manufacturer => (
                <option key={manufacturer} value={manufacturer}>{manufacturer}</option>
              ))}
            </select>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              {showAdvancedFilters ? 'Hide Filters' : 'Advanced Filters'}
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  className="input w-full"
                  value={filters.priceRange.min || ''}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    priceRange: { ...prev.priceRange, min: Number(e.target.value) }
                  }))}
                />
                <span className="text-gray-500">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  className="input w-full"
                  value={filters.priceRange.max === Infinity ? '' : filters.priceRange.max}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    priceRange: { ...prev.priceRange, max: Number(e.target.value) || Infinity }
                  }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock Level
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  className="input w-full"
                  value={filters.stockLevel.min || ''}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    stockLevel: { ...prev.stockLevel, min: Number(e.target.value) }
                  }))}
                />
                <span className="text-gray-500">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  className="input w-full"
                  value={filters.stockLevel.max === Infinity ? '' : filters.stockLevel.max}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    stockLevel: { ...prev.stockLevel, max: Number(e.target.value) || Infinity }
                  }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Sold Within
              </label>
              <select
                className="input w-full"
                value={filters.lastSold || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  lastSold: e.target.value ? Number(e.target.value) : null
                }))}
              >
                <option value="">Any time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="180">Last 180 days</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.deadStock}
                  onChange={(e) => setFilters(prev => ({ ...prev, deadStock: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">Show Dead Stock</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.slowMoving}
                  onChange={(e) => setFilters(prev => ({ ...prev, slowMoving: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">Show Slow Moving</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {bulkActionMode && (
        <div className="bg-blue-50 p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              checked={selectedProducts.size === filteredProducts.length}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-blue-700 font-medium">
              {selectedProducts.size} products selected
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleBulkPrint}
              className="btn btn-secondary flex items-center gap-2"
              disabled={selectedProducts.size === 0}
            >
              <Printer className="h-4 w-4" />
              Print Labels
            </button>

            <button
              onClick={handleBulkDelete}
              className="btn btn-danger flex items-center gap-2"
              disabled={selectedProducts.size === 0}
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected
            </button>

            <button
              onClick={() => {
                setBulkActionMode(false);
                setSelectedProducts(new Set());
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sortedProducts.map((product) => (
          <div 
            key={product.id} 
            className={`group relative bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
              selectedProducts.has(product.id) ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            {bulkActionMode && (
              <div className="absolute top-2 left-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedProducts.has(product.id)}
                  onChange={(e) => handleSelectProduct(product.id, e.target.checked)}
                  className="rounded border-gray-300"
                />
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-br from-gray-900/5 to-gray-900/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div onClick={() => setEditingProduct(product)} className="cursor-pointer">
              <div className="relative h-40 overflow-hidden">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name || 'Product'}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <Package className="h-12 w-12 text-gray-400" />
                  </div>
                )}
                
                {/* Stock Level Badge */}
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    (product.stockLevel || 0) > 10
                      ? 'bg-green-100 text-green-800'
                      : (product.stockLevel || 0) > 0
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {product.stockLevel || 0} in stock
                  </span>
                </div>
              </div>

              <div className="relative p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {product.name || 'Unnamed Product'}
                  </h3>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      ₹{(product.retailPrice || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-900">MRP</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">SKU:</span>
                    {hasPermission('view_sensitive_info') ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyToClipboard(product.sku || '');
                        }}
                        className="font-mono text-gray-900 hover:text-blue-600 flex items-center gap-1"
                        title="Copy SKU to clipboard"
                      >
                        {(product.sku || '').split('-').map((part, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && '-'}
                            <span className={i === 1 ? 'font-bold' : ''}>
                              {part}
                            </span>
                          </React.Fragment>
                        ))}
                        <Copy className="h-3 w-3 ml-1" />
                      </button>
                    ) : (
                      <span className="font-mono text-gray-900">
                        {(product.sku || '').split('-').map((part, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && '-'}
                            <span className={i === 1 ? 'font-bold' : ''}>
                              {part}
                            </span>
                          </React.Fragment>
                        ))}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Category:</span>
                    <span className="font-medium">{product.category || '-'}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Manufacturer:</span>
                    <span className="font-medium">{product.manufacturer || '-'}</span>
                  </div>

                  {hasPermission('view_sensitive_info') && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Buy Price:</span>
                        <span className="font-medium">₹{(product.buyPrice || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Wholesale:</span>
                        <span className="font-medium">₹{(product.wholesalePrice || 0).toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>

                {product.lastSoldAt && (
                  <div className="mt-3 text-xs">
                    <div className={`px-2 py-1 rounded-full inline-flex items-center gap-1 ${
                      getDaysSinceLastSold(product.lastSoldAt) >= 90
                        ? 'bg-red-100 text-red-800'
                        : getDaysSinceLastSold(product.lastSoldAt) >= 30
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      <Clock className="h-3 w-3" />
                      Last sold: {format(new Date(product.lastSoldAt), 'dd/MM/yyyy')}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrintLabel(product);
                }}
                className="p-2 bg-white/90 backdrop-blur rounded-full shadow-lg hover:bg-white transition-colors duration-200"
                title="Print Label"
              >
                <Printer className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowQR(showQR === product.id ? null : product.id);
                }}
                className="p-2 bg-white/90 backdrop-blur rounded-full shadow-lg hover:bg-white transition-colors duration-200"
                title="Show QR Code"
              >
                <QrCode className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingProduct(product);
                }}
                className="p-2 bg-white/90 backdrop-blur rounded-full shadow-lg hover:bg-white transition-colors duration-200"
                title="Edit Product"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteProduct(product.id);
                }}
                className="p-2 bg-white/90 backdrop-blur rounded-full shadow-lg hover:bg-white transition-colors duration-200"
                title="Delete Product"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {sortedProducts.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || Object.values(filters).some(Boolean)
              ? "Try adjusting your search or filters"
              : "Start by adding your first product"}
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setFilters({
                deadStock: false,
                slowMoving: false,
                category: '',
                manufacturer: '',
                priceRange: { min: 0, max: Infinity },
                stockLevel: { min: 0, max: Infinity },
                lastSold: null
              });
              setShowForm(true);
            }}
            className="btn btn-primary"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Product
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Product Form Modal */}
      {(showForm || editingProduct) && (
        <ProductForm
          product={editingProduct}
          onClose={() => {
            setShowForm(false);
            setEditingProduct(undefined);
          }}
          onSubmit={editingProduct ? handleEditProduct : handleAddProduct}
        />
      )}

      {/* QR Code Modal */}
      {showQR && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowQR(null)}
        >
          <div 
            className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const product = products.find(p => p.id === showQR);
              if (!product) return null;

              return (
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-4">
                    Product QR Code
                  </h3>
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block mb-4">
                    <QRCodeSVG
                      value={product.sku || ''}
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <div className="font-mono text-sm mb-4">
                    {(product.sku || '').split('-').map((part, i) => (
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
                      onClick={() => handlePrintLabel(product)}
                      className="btn btn-primary flex items-center gap-2"
                    >
                      <Printer className="h-4 w-4" />
                      Print Label
                    </button>
                    <button
                      onClick={() => setShowQR(null)}
                      className="btn btn-secondary"
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

const getDaysSinceLastSold = (lastSoldAt: string | null) => {
  if (!lastSoldAt) return Infinity;
  return differenceInDays(new Date(), new Date(lastSoldAt));
};

// Need to import this for the bulk actions button
import { CheckSquare } from 'lucide-react';

export default InventoryList;
