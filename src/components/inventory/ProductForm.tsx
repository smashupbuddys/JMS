import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Info, Printer, QrCode, AlertCircle, FileText, Check, Camera, Calculator,
  ChevronRight, ImageIcon, Tag, Package, DollarSign, Settings, RefreshCw
} from 'lucide-react';
import type { Product } from '../../types';
import { generateBarcodes, printQRCodes, PrintTemplate, encodeCode128 } from '../../utils/barcodeGenerator';
import { QRCodeSVG } from 'qrcode.react';
import { getMarkupForProduct } from '../../utils/markupSettings'; // Keep for compatibility but don't use
import { useToast } from '../../hooks/useToast';
import ImageUpload from './ImageUpload';
import { supabase } from '../../lib/supabase';

interface ProductFormProps {
  product?: Product;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

// Label size presets for different printer types
const LABEL_SIZES = [
  { name: 'Standard (1" × 2")', width: 1, height: 2 },
  { name: 'Small (0.5" × 1")', width: 0.5, height: 1 },
  { name: 'Large (2" × 3")', width: 2, height: 3 },
  { name: 'Dymo 30252', width: 1.125, height: 3.5 },
  { name: 'Avery 5160', width: 1, height: 2.625 },
  { name: 'Zebra 2x1', width: 2, height: 1 }
];

const MWP_MULTIPLIERS = [1.5, 2, 3, 4, 10];

const ProductForm: React.FC<ProductFormProps> = ({ product, onClose, onSubmit }) => {
  // Added debug logging
  console.log('Product data from database:', {
    product,
    productId: product?.id,
    buyPrice: product?.buyPrice,
    wholesalePrice: product?.wholesalePrice,
    retailPrice: product?.retailPrice
  });

  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    manufacturer: product?.manufacturer || '',
    category: product?.category || '',
    buy_price: product?.buyPrice ? product.buyPrice.toString() : '',
    wholesale_price: product?.wholesalePrice ? product.wholesalePrice.toString() : '',
    retail_price: product?.retailPrice ? product.retailPrice.toString() : '',
    stock_level: product?.stockLevel ? product.stockLevel.toString() : '',
    image_url: product?.imageUrl || '',
    additional_info: product?.additionalInfo || ''
  });

  const [selectedMultiplier, setSelectedMultiplier] = useState<number | null>(null);
  const [qrCode, setQrCode] = useState<string>(product?.qrCode || '');
  const [generatedSKU, setGeneratedSKU] = useState<string>(product?.sku || '');
  const [imageError, setImageError] = useState<string>('');
  const [showMarkupInfo, setShowMarkupInfo] = useState(false);
  const [manufacturers, setManufacturers] = useState<Array<{ name: string; markup: number; code: string }>>([]);
  const [categories, setCategories] = useState<Array<{ name: string; markup: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PrintTemplate>('thermal');
  const [selectedBarcodeType, setSelectedBarcodeType] = useState<'qr' | 'code128'>('code128');
  const [error, setError] = useState<string | null>(null);
  const [selectedManufacturer, setSelectedManufacturer] = useState<{name: string; code: string} | null>(null);
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrCanvasRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();
  
  // New states for enhanced UI functionality
  const [previewScale, setPreviewScale] = useState<number>(1);
  const [selectedLabelSize, setSelectedLabelSize] = useState<number>(0); // Index of LABEL_SIZES
  const [showPrintSettings, setShowPrintSettings] = useState<boolean>(false);
  const [printQuantity, setPrintQuantity] = useState<number>(Number(formData.stock_level) || 1);
  const [barcodeDimensions, setBarcodeDimensions] = useState({ width: 0, height: 0 });
  
  // NEW: Add flags to track if wholesale and retail prices have been manually edited
  const [wholesalePriceEdited, setWholesalePriceEdited] = useState<boolean>(!!product); // Start true when editing
  const [retailPriceEdited, setRetailPriceEdited] = useState<boolean>(false);
  
  // NEW: Calculator state
  const [showCalculator, setShowCalculator] = useState<boolean>(false);
  const [calculatorValue, setCalculatorValue] = useState<string>('');
  const [calculatorTarget, setCalculatorTarget] = useState<string | null>(null);
  const [calculatorMemory, setCalculatorMemory] = useState<number | null>(null);
  const [calculatorOperation, setCalculatorOperation] = useState<string | null>(null);
  
  // NEW: Add markup settings loaded flag
  const [markupSettingsLoaded, setMarkupSettingsLoaded] = useState<boolean>(false);
  
  // Add a ref to track if SKU has been generated in this session
  // Using a ref ensures the value persists across renders
  const skuGeneratedRef = useRef<boolean>(false);

  // ADD CONSOLE LOG HERE - after all useState declarations but before useEffect hooks
  console.log('ProductForm rendering', { 
    isEditMode: !!product, 
    manufacturer: formData.manufacturer,
    category: formData.category,
    buyPrice: formData.buy_price,
    wholesalePrice: formData.wholesale_price,
    settingsLoaded: markupSettingsLoaded,
    manufacturersCount: manufacturers.length,
    categoriesCount: categories.length
  });

  useEffect(() => {
    fetchMarkupSettings();
  }, []);


  useEffect(() => {
    if (formData.manufacturer && formData.category && formData.buy_price) {
      // Only update prices if the wholesale price hasn't been manually edited
      // or if this is a new product (not editing)
      if ((!wholesalePriceEdited && !product) || (!wholesalePriceEdited && markupSettingsLoaded)) {
        console.log('Triggering price calculation', { 
          isEditMode: !!product, 
          settingsLoaded: markupSettingsLoaded,
          wholesalePriceEdited
        });
        updatePricesBasedOnMarkup();
      } else {
        console.log('Skipping price calculation: wholesale price manually edited or waiting for settings to load');
      }
    }
  }, [markupSettingsLoaded, formData.manufacturer, formData.category, formData.buy_price, wholesalePriceEdited]);
  

  // Add improved effect for controlled barcode generation
  useEffect(() => {
    // If we're editing a product with an existing SKU, use that
    if (product?.sku) {
      console.log('Using existing SKU for edit mode:', product.sku);
      setQrCode(product.qrCode || product.sku);
      setGeneratedSKU(product.sku);
      return;
    }
    
    // For new products, only generate once when all fields are available
    if (
      !skuGeneratedRef.current && 
      formData.manufacturer && 
      formData.category && 
      formData.wholesale_price && 
      formData.retail_price
    ) {
      console.log('First-time SKU generation for new product');
      // Set the ref BEFORE generating to prevent any possibility of double generation
      skuGeneratedRef.current = true;
      generateBarcode();
    }
  }, [product, generatedSKU, formData.manufacturer, formData.category, formData.wholesale_price, formData.retail_price]);

  useEffect(() => {
    renderBarcode();
  }, [generatedSKU, selectedBarcodeType, previewScale]);

  // Update print quantity when stock level changes
  useEffect(() => {
    setPrintQuantity(Number(formData.stock_level) || 1);
  }, [formData.stock_level]);

  // Generate a more realistic Code 128 pattern
  const generateCode128Bars = (text: string) => {
    // This is a simplified version that creates a Code 128B-like pattern
    // Real Code 128 encoding is more complex, but this will create a visually similar result
    
    // Start with a Code 128B start character pattern
    const bars = [];
    
    // Add start pattern
    bars.push(2, 1, 1, 2, 3, 2); // Code 128B start
    
    // Add a simple pattern for each character
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) % 32; // Modulo to keep the pattern simple
      
      if (i % 2 === 0) {
        bars.push(1, 2, 2, 1, 1, 1);
      } else {
        bars.push(1, 1, 2, 2, 1, 1);
      }
      
      // Add some variation based on character
      if (charCode % 3 === 0) {
        bars.push(2, 1, 1, 1, 2, 1);
      } else if (charCode % 3 === 1) {
        bars.push(1, 2, 1, 1, 1, 2);
      } else {
        bars.push(1, 1, 2, 1, 2, 1);
      }
    }
    
    // Add stop pattern
    bars.push(2, 3, 3, 1, 1, 1, 2);
    
    return bars;
  };

  // Calculate the width of the barcode
  const calculateBarcodeWidth = (pattern: number[], moduleWidth: number) => {
    return pattern.reduce((sum, width) => sum + (width * moduleWidth), 0);
  };

  // Enhanced barcode rendering function
  const renderBarcode = () => {
    if (!barcodeCanvasRef.current || !generatedSKU) return;

    try {
      // Use JsBarcode library to render the barcode
      JsBarcode(barcodeCanvasRef.current, generatedSKU, {
        format: "CODE128",
        lineColor: "#000",
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 14,
        textMargin: 5,
        background: "#ffffff",
        font: "monospace",
        textAlign: "center"
      });

      setBarcodeDimensions({ 
        width: barcodeCanvasRef.current.width, 
        height: barcodeCanvasRef.current.height 
      });
    } catch (error) {
      console.error('Error rendering barcode:', error);
      
      // Fallback method if JsBarcode fails
      try {
        const canvas = barcodeCanvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // Clear canvas
          canvas.width = 300;
          canvas.height = 100;
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw SKU as text
          ctx.fillStyle = 'black';
          ctx.font = '16px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(generatedSKU, canvas.width / 2, 50);
          
          // Add message about barcode generation error
          ctx.font = '10px Arial';
          ctx.fillText('Barcode rendering failed', canvas.width / 2, 70);
        }
      } catch (fallbackError) {
        console.error('Fallback rendering also failed:', fallbackError);
      }
    }
  };

  // This function generates a more recognizable Code 128B-like pattern
  const generateBarcodePattern = (text: string) => {
    // Create a simplified but recognizable barcode pattern
    const bars = [];
    
    // Always start with quiet zone and start pattern
    // [space, bar, space, bar, space, bar, space]
    bars.push(1, 2, 1, 2, 3, 2, 1); // Start with quiet zone + Code 128B start pattern
    
    // For each character, add a recognizable pattern that scanners can detect
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      
      // Create simple encoding pattern based on character code
      // This isn't real Code 128B encoding but creates recognizable patterns
      let pattern;
      
      // Different patterns based on character type to make it more realistic
      if (charCode >= 48 && charCode <= 57) { // Numbers
        pattern = [2, 1, 1, 2, 1, 1];
      } else if (charCode >= 65 && charCode <= 90) { // Uppercase letters
        pattern = [1, 2, 1, 1, 2, 1];
      } else if (charCode >= 97 && charCode <= 122) { // Lowercase letters
        pattern = [1, 1, 2, 1, 1, 2];
      } else { // Special characters
        pattern = [1, 1, 1, 2, 2, 1];
      }
      
      // Add the pattern to our bars array (bar, space, bar, space, etc.)
      pattern.forEach(width => bars.push(width));
    }
    
    // Add stop pattern and quiet zone
    bars.push(2, 3, 3, 1, 1, 1, 2);
    
    return bars;
  };

  const fetchMarkupSettings = async () => {
    try {
      console.log('Starting to fetch markup settings');
      const { data, error } = await supabase.rpc('get_markup_settings');
      if (error) throw error;
  
      const manufacturerSettings = data.filter((s: any) => s.type === 'manufacturer');
      const categorySettings = data.filter((s: any) => s.type === 'category');
  
      console.log('Markup settings fetched successfully:', {
        manufacturers: manufacturerSettings,
        categories: categorySettings
      });
  
      setManufacturers(manufacturerSettings);
      setCategories(categorySettings);
  
      if (formData.manufacturer) {
        const selected = manufacturerSettings.find((m: any) => m.name === formData.manufacturer);
        setSelectedManufacturer(selected || null);
      }
      
      // IMPORTANT: Set the markup settings loaded flag to true
      setMarkupSettingsLoaded(true);
      
      // Only recalculate for new products or if wholesale price hasn't been manually edited
      if (product && !wholesalePriceEdited) {
        console.log('Edit mode with unedited wholesale price: Recalculating now that settings are loaded');
        const buyPrice = Number(formData.buy_price);
        if (buyPrice > 0) {
          updatePricesBasedOnMarkup();
        }
      }
    } catch (error) {
      console.error('Error fetching markup settings:', error);
      addToast({
        title: 'Error',
        message: 'Failed to load markup settings',
        type: 'error'
      });
    }
  };
  

  // MODIFIED: Improved generateBarcode function with better error handling
  const generateBarcode = async () => {
    // If we're editing a product and it already has a SKU, don't regenerate unless forced
    if (product?.sku && !skuGeneratedRef.current) {
      console.log('Using existing barcode for product edit:', product.sku);
      setQrCode(product.qrCode || '');
      setGeneratedSKU(product.sku);
      return;
    }
    
    if (formData.manufacturer && formData.category && formData.wholesale_price && formData.retail_price) {
      try {
        // Show a loading indicator or something to indicate barcode generation is in progress
        setLoading(true);
        
        const wholesalePrice = Number(formData.wholesale_price);
        const retailPrice = Number(formData.retail_price);
        
        console.log('Generating barcode with:', {
          category: formData.category,
          manufacturer: formData.manufacturer,
          wholesalePrice,
          retailPrice
        });
        
        const barcodes = await generateBarcodes(
          formData.category,
          formData.manufacturer,
          wholesalePrice,
          retailPrice,
          undefined, // No existing SKU for new products
          formData.additional_info
        );
        
        if (!barcodes || !barcodes.sku) {
          throw new Error('Barcode generation failed: No SKU returned');
        }
        
        console.log('Successfully generated barcode:', barcodes.sku);
        setQrCode(barcodes.qrCode);
        setGeneratedSKU(barcodes.sku);
        
        // Reset loading state
        setLoading(false);
        
        // Mark SKU as generated
        skuGeneratedRef.current = true;
        
        return barcodes;
      } catch (error) {
        console.error('Error generating barcode:', error);
        setError(`Failed to generate barcode: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setLoading(false);
        return null;
      }
    } else {
      console.log('Missing required fields for barcode generation');
      return null;
    }
  };

  // NEW: Add explicit function for manually regenerating the SKU when needed
  const handleRegenerateBarcode = () => {
    // Reset both states to force regeneration
    skuGeneratedRef.current = false;
    setGeneratedSKU(''); // Clear existing SKU
    setQrCode('');
    
    // Call generate barcode with a slight delay to ensure state updates are processed
    setTimeout(() => {
      console.log('Manually regenerating SKU...');
      generateBarcode();
    }, 100);
  };

// Direct calculation function that doesn't use getMarkupForProduct
const calculateDirectWholesalePrice = (buyPrice: number) => {
  // Don't calculate if no buy price
  if (!buyPrice) return 0;
  
  // Get markup values directly from the arrays we fetched from the database
  const manufacturerObj = manufacturers.find(m => m.name === formData.manufacturer);
  const categoryObj = categories.find(c => c.name === formData.category);
  
  console.log('Markup lookup for calculation:', {
    manufacturer: formData.manufacturer,
    category: formData.category,
    manufacturerObj,
    categoryObj,
    manufacturerMarkup: manufacturerObj?.markup,
    categoryMarkup: categoryObj?.markup
  });
  
  // Use manufacturer markup if available, otherwise category markup, finally default to 20%
  const markup = manufacturerObj?.markup !== undefined ? 
    manufacturerObj.markup : 
    categoryObj?.markup !== undefined ? 
    categoryObj.markup : 0.2;
  
  const markupAmount = Math.round(buyPrice * markup);
  const wholesalePrice = buyPrice + markupAmount;
  
  // Log detailed calculation
  console.log('Wholesale price calculation:', {
    buyPrice,
    markup,
    markupPercentage: (markup * 100).toFixed(0) + '%',
    markupAmount,
    wholesalePrice,
    formattedWholesale: wholesalePrice.toString()
  });
  
  return wholesalePrice;
};


  // MODIFIED: Updated markup calculation to correctly handle percentage markups
  const updatePricesBasedOnMarkup = () => {
    const buyPrice = Number(formData.buy_price);
    if (buyPrice > 0) {
      // Use our direct calculation instead of getMarkupForProduct
      const wholesalePrice = calculateDirectWholesalePrice(buyPrice);
      
      // Only update if not manually edited
      if (!wholesalePriceEdited) {
        console.log('Updating wholesale price based on markup calculation:', {
          from: formData.wholesale_price,
          to: wholesalePrice.toString()
        });
        
        setFormData(prev => ({
          ...prev,
          wholesale_price: wholesalePrice.toString()
        }));
      } else {
        console.log('Skipping wholesale price update - manually edited');
      }
      
      // Only update retail price if multiplier selected and not manually edited
      if (selectedMultiplier && !retailPriceEdited) {
        const wholesale = Number(formData.wholesale_price);
        setFormData(prev => ({
          ...prev,
          retail_price: Math.round(wholesale * selectedMultiplier).toString()
        }));
      }
    }
  };
  

  

  // MODIFIED: Handle multiplier change with respect to manual edits
  const handleMultiplierChange = (multiplier: number) => {
    setSelectedMultiplier(multiplier);
    const wholesale = Number(formData.wholesale_price);
    if (!isNaN(wholesale) && wholesale > 0) {
      setFormData(prev => ({
        ...prev,
        retail_price: Math.round(wholesale * multiplier).toString()
      }));
      // Reset retail price edited flag since we're explicitly setting it via multiplier
      setRetailPriceEdited(false);
    }
  };

  // MODIFIED: Enhanced change handler to track manual edits
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    try {
      const { name, value } = e.target;
      setError(null);
      
      let newValue = value;
      if (['buy_price', 'wholesale_price', 'retail_price', 'stock_level'].includes(name)) {
        newValue = value.replace(/[^\d]/g, '');
      }
      
      // Track manual edits to wholesale and retail prices
      if (name === 'wholesale_price') {
        setWholesalePriceEdited(true);
      } else if (name === 'retail_price') {
        setRetailPriceEdited(true);
      }

      setFormData(prev => {
        const newData = { ...prev, [name]: newValue };
        
        // Update print quantity when stock level changes
        if (name === 'stock_level') {
          setPrintQuantity(Number(newValue) || 1);
        }
        
        return newData;
      });
    } catch (error) {
      console.error('Error in handleChange:', error);
      setError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // NEW: Function to reset wholesale price to calculated value
  const resetWholesalePrice = () => {
    setWholesalePriceEdited(false);
    updatePricesBasedOnMarkup();
  };
  
  // NEW: Function to reset retail price to calculated value
  const resetRetailPrice = () => {
    setRetailPriceEdited(false);
    if (selectedMultiplier) {
      const wholesale = Number(formData.wholesale_price);
      if (!isNaN(wholesale) && wholesale > 0) {
        setFormData(prev => ({
          ...prev,
          retail_price: Math.round(wholesale * selectedMultiplier).toString()
        }));
      }
    }
  };
  
  // NEW: Calculator functions
  const openCalculator = (target: string) => {
    setCalculatorTarget(target);
    setCalculatorValue(formData[target as keyof typeof formData] || '');
    setShowCalculator(true);
  };
  
  const closeCalculator = () => {
    setShowCalculator(false);
    setCalculatorValue('');
    setCalculatorMemory(null);
    setCalculatorOperation(null);
    setCalculatorTarget(null);
  };
  
  const handleCalculatorInput = (input: string) => {
    if (input === 'clear') {
      setCalculatorValue('');
      setCalculatorMemory(null);
      setCalculatorOperation(null);
      return;
    }
    
    if (input === 'backspace') {
      setCalculatorValue(prev => prev.slice(0, -1));
      return;
    }
    
    if (['add', 'subtract', 'multiply', 'divide', 'percent'].includes(input)) {
      const currentValue = parseFloat(calculatorValue || '0');
      
      if (input === 'percent') {
        // Calculate percentage directly
        setCalculatorValue((currentValue / 100).toString());
        return;
      }
      
      setCalculatorMemory(currentValue);
      setCalculatorOperation(input);
      setCalculatorValue('');
      return;
    }
    
    if (input === 'calculate') {
      if (calculatorMemory === null || calculatorOperation === null) return;
      
      const currentValue = parseFloat(calculatorValue || '0');
      const memoryValue = calculatorMemory;
      let result = 0;
      
      switch (calculatorOperation) {
        case 'add':
          result = memoryValue + currentValue;
          break;
        case 'subtract':
          result = memoryValue - currentValue;
          break;
        case 'multiply':
          result = memoryValue * currentValue;
          break;
        case 'divide':
          result = memoryValue / currentValue;
          break;
        default:
          return;
      }
      
      // Round to 2 decimal places
      result = Math.round(result * 100) / 100;
      
      setCalculatorValue(result.toString());
      setCalculatorMemory(null);
      setCalculatorOperation(null);
      return;
    }
    
    // Handle numeric input and decimal point
    if (input === '.' && calculatorValue.includes('.')) {
      // Prevent multiple decimal points
      return;
    }
    
    setCalculatorValue(prev => prev + input);
  };
  
  const applyCalculatedValue = () => {
    if (!calculatorTarget || !calculatorValue) return;
    
    // Apply the calculated value to the target field
    setFormData(prev => ({
      ...prev,
      [calculatorTarget]: calculatorValue
    }));
    
    // Mark fields as manually edited
    if (calculatorTarget === 'wholesale_price') {
      setWholesalePriceEdited(true);
    } else if (calculatorTarget === 'retail_price') {
      setRetailPriceEdited(true);
    }
    
    closeCalculator();
  };

  // Replace your existing handlePrintBarcodes function with this
  const handlePrintBarcodes = () => {
    if (!generatedSKU) {
      addToast({
        title: 'Error',
        message: 'No barcode has been generated yet',
        type: 'error'
      });
      return;
    }
    
    try {
      // Get print quantity
      const quantity = Number(printQuantity || formData.stock_level) || 1;
      
      // Create a print window
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Could not open print window');
      }
      
      // Exact dimensions for the label
      const labelWidth = 34; // mm
      const labelHeight = 25; // mm
      const pageWidth = 102; // 3 × 34mm
      const pageHeight = 25; // Single row height
      
      // Parse the SKU 
      const skuParts = generatedSKU.split('-');
      const firstPart = skuParts[0] || '';
      const middlePart = skuParts[1] || '';
      const lastPart = skuParts[2] || '';
      
      // Create HTML content for printing
      let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Print QR Labels: ${generatedSKU}</title>
          <style>
            @page {
              size: ${pageWidth}mm ${pageHeight}mm;
              margin: 0;
            }
            
            body, html {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            
            .labels-container {
              display: flex;
              width: ${pageWidth}mm;
              height: ${labelHeight}mm;
            }
            
            .label-container {
              width: ${labelWidth}mm;
              height: ${labelHeight}mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              border: 0.1mm solid #ccc;
              box-sizing: border-box;
              background: white;
              padding: 0.5mm;
            }
            
            .qr-code {
              width: 16mm;
              height: 16mm;
              margin-bottom: 0.5mm;
            }
            
            .sku-code {
              font-size: 2.5mm;
              text-align: center;
              margin-bottom: 0.5mm;
              line-height: 1;
            }
            
            .sku-code .bold-section {
              font-weight: bold;
            }
            
            .mwp-price {
              font-size: 3mm;
              font-weight: bold;
              color: #0066FF;
              text-align: center;
              line-height: 1;
            }
            
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              
              .label-container {
                border: none;
              }
            }
          </style>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.0/build/qrcode.min.js"></script>
        </head>
        <body>
          <div id="labels-container">
            <!-- Labels will be dynamically added here -->
          </div>
          
          <script>
            function generateLabels() {
              const labelsContainer = document.getElementById('labels-container');
              const quantity = ${quantity};
              const generatedSKU = '${generatedSKU}';
              const retailPrice = '${formData.retail_price}';
              
              // Calculate full pages and remaining labels
              const fullPages = Math.floor(quantity / 3);
              const remainingLabels = quantity % 3;
              
              for (let page = 0; page < fullPages + (remainingLabels > 0 ? 1 : 0); page++) {
                const labelsToGenerate = page < fullPages ? 3 : remainingLabels;
                
                // Create labels container for this page
                const pageContainer = document.createElement('div');
                pageContainer.className = 'labels-container';
                
                for (let i = 0; i < labelsToGenerate; i++) {
                  const labelContainer = document.createElement('div');
                  labelContainer.className = 'label-container';
                  
                  const qrCodeCanvas = document.createElement('canvas');
                  qrCodeCanvas.className = 'qr-code';
                  qrCodeCanvas.id = \`qrcode-\${page * 3 + i}\`;
                  
                  const skuCode = document.createElement('div');
                  skuCode.className = 'sku-code';
                  skuCode.innerHTML = \`
                    ${firstPart}-<span class="bold-section">${middlePart}</span>-${lastPart}
                  \`;
                  
                  const mwpPrice = document.createElement('div');
                  mwpPrice.className = 'mwp-price';
                  mwpPrice.textContent = \`MWP: ₹\${retailPrice}\`;
                  
                  labelContainer.appendChild(qrCodeCanvas);
                  labelContainer.appendChild(skuCode);
                  labelContainer.appendChild(mwpPrice);
                  
                  pageContainer.appendChild(labelContainer);
                }
                
                labelsContainer.appendChild(pageContainer);
                
                // If not a full page, add page break
                if (page < fullPages + (remainingLabels > 0 ? 1 : 0) - 1) {
                  const pageBreak = document.createElement('div');
                  pageBreak.style.breakAfter = 'page';
                  labelsContainer.appendChild(pageBreak);
                }
              }
              
              // Generate QR codes after labels are added to DOM
              for (let i = 0; i < quantity; i++) {
                const qrCanvas = document.getElementById(\`qrcode-\${i}\`);
                if (qrCanvas) {
                  QRCode.toCanvas(
                    qrCanvas,
                    generatedSKU,
                    {
                      width: 60,
                      height: 60,
                      margin: 0,
                      errorCorrectionLevel: 'M',
                      color: {
                        dark: '#000000',
                        light: '#ffffff'
                      }
                    }
                  );
                }
              }
              
              // Automatically trigger print
              window.print();
            }
            
            // Call generate labels when the page loads
            window.onload = generateLabels;
          </script>
        </body>
        </html>
      `;
      
      // Write to the window
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      addToast({
        title: 'Success',
        message: `Print preview ready for ${quantity} labels`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error printing QR labels:', error);
      addToast({
        title: 'Error',
        message: 'Failed to print labels: ' + (error instanceof Error ? error.message : 'Unknown error'),
        type: 'error'
      });
    }
  };
  // If your existing printBarcodeLabels function doesn't work correctly,
  // here is a standalone implementation that directly creates valid barcode labels
  const printStandalone = () => {
    if (!generatedSKU) {
      addToast({
        title: 'Error',
        message: 'No barcode has been generated yet',
        type: 'error'
      });
      return;
    }
    
    try {
      // Get Code 128 pattern directly from encodeCode128
      const binaryPattern = encodeCode128(generatedSKU);
      
      // Open a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Could not open print window.');
      }
      
      // Split SKU into parts for colored sections
      const skuParts = generatedSKU.split('-');
      const firstPart = skuParts[0] || '';
      const middlePart = skuParts[1] || '';
      const lastPart = skuParts[2] || '';
      
      // Generate a canvas with the barcode inline
      const canvas = document.createElement('canvas');
      const moduleWidth = 2;
      const height = 80;
      canvas.width = binaryPattern.length * moduleWidth;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Cannot get canvas context');
      }
      
      // Draw barcode
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#000000';
      for (let i = 0; i < binaryPattern.length; i++) {
        if (binaryPattern[i] === '1') {
          ctx.fillRect(i * moduleWidth, 0, moduleWidth, height);
        }
      }
      
      // Convert to data URL
      const barcodeImage = canvas.toDataURL('image/png');
      
      // Setup label format
      const labelSize = LABEL_SIZES[selectedLabelSize];
      const quantity = Number(printQuantity || formData.stock_level);
      
      let printContent = `
        <html>
        <head>
          <title>Print Barcode: ${generatedSKU}</title>
          <style>
            @page {
              size: ${labelSize.width}in ${labelSize.height}in;
              margin: 0;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              background-color: white;
            }
            .page-container {
              display: flex;
              flex-wrap: wrap;
              justify-content: center;
              align-items: center;
            }
            .label {
              width: ${labelSize.width * 96 - 20}px;
              height: ${labelSize.height * 96 - 20}px;
              margin: 10px;
              padding: 10px;
              text-align: center;
              page-break-inside: avoid;
              background-color: white;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .sku {
              font-family: monospace;
              font-size: 12px;
              margin-bottom: 6px;
            }
            .barcode-container {
              margin: 5px 0;
              text-align: center;
            }
            .barcode-img {
              max-width: 100%;
              height: auto;
            }
            .price {
              color: #4169e1;
              font-weight: bold;
              font-size: 14px;
              margin: 5px 0;
            }
            .colored-sku span.middle {
              color: #4169e1;
            }
            @media print {
              body { margin: 0; padding: 0; }
              .label { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="page-container">
      `;
      
      // Generate labels
      for (let i = 0; i < quantity; i++) {
        printContent += `
          <div class="label">
            <div class="sku">${generatedSKU}</div>
            <div class="barcode-container">
              <img src="${barcodeImage}" alt="Barcode" class="barcode-img" />
            </div>
            <div class="sku">${generatedSKU}</div>
            <div class="price">MWP: ₹${formData.retail_price} ONLY</div>
            <div class="colored-sku">
              <span>${firstPart}</span>
              <span> - </span>
              <span class="middle">${middlePart}</span>
              <span> - </span>
              <span>${lastPart}</span>
            </div>
          </div>
        `;
      }
      
      printContent += `
          </div>
          <script>
            window.onload = function() { 
              setTimeout(function() { window.print(); }, 500);
            };
          </script>
        </body>
        </html>
      `;
      
      // Write to the window and print
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      addToast({
        title: 'Success',
        message: `Printing ${quantity} labels`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error printing barcodes:', error);
      addToast({
        title: 'Error',
        message: 'Failed to print barcodes: ' + (error instanceof Error ? error.message : 'Unknown error'),
        type: 'error'
      });
    }
  };

  // ADDED: handleSubmit function from the working version
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError(null);
  
  console.log('Starting form submission with data:', formData);
  
  try {
    const requiredFields = {
      manufacturer: 'Manufacturer',
      category: 'Category',
      buy_price: 'Buy Price',
      wholesale_price: 'Wholesale Price',
      retail_price: 'Retail Price',
      stock_level: 'Stock Level'
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key]) => !formData[key as keyof typeof formData]?.trim())
      .map(([, label]) => label);

    console.log('Checking required fields:', {
      missingFields,
      formData
    });

    if (missingFields.length > 0) {
      throw new Error(`Required fields missing: ${missingFields.join(', ')}`);
    }

    const buyPrice = Number(formData.buy_price);
    const wholesalePrice = Number(formData.wholesale_price);
    const retailPrice = Number(formData.retail_price);

    console.log('Price validation:', {
      buyPrice,
      wholesalePrice,
      retailPrice,
      isValid: buyPrice > 0 && wholesalePrice > buyPrice && retailPrice > wholesalePrice
    });

    if (buyPrice <= 0) throw new Error('Buy price must be greater than 0');
    if (wholesalePrice <= buyPrice) throw new Error('Wholesale price must be greater than buy price');
    if (retailPrice <= wholesalePrice) throw new Error('Retail price must be greater than wholesale price');

    // Use existing barcodes if this is an edit and we have a valid SKU
    let barcodes;
    if (product?.sku && generatedSKU === product.sku) {
      console.log('Using existing product barcodes:', {
        sku: product.sku,
        qrCode: product.qrCode,
        code128: product.code128
      });
      barcodes = {
        sku: product.sku,
        qrCode: product.qrCode || product.sku,
        code128: product.code128 || '',
        cipher: product.cipher || ''
      };
    } else {
      console.log('Generating new barcodes with data:', {
        category: formData.category,
        manufacturer: formData.manufacturer,
        wholesalePrice,
        retailPrice,
        additionalInfo: formData.additional_info
      });
      
      // Generate barcodes first to ensure they are valid
      try {
        barcodes = await generateBarcodes(
          formData.category,
          formData.manufacturer,
          wholesalePrice,
          retailPrice,
          undefined,
          formData.additional_info
        );
        console.log('Successfully generated barcodes:', barcodes);
      } catch (barcodeError) {
        console.error('Barcode generation failed:', {
          error: barcodeError,
          message: barcodeError instanceof Error ? barcodeError.message : JSON.stringify(barcodeError)
        });
        throw new Error(`Barcode generation failed: ${barcodeError instanceof Error ? barcodeError.message : JSON.stringify(barcodeError)}`);
      }
    }

    if (!barcodes || !barcodes.sku) {
      console.error('Invalid barcodes:', barcodes);
      throw new Error('Failed to generate valid product barcodes');
    }

    // Prepare the product data for submission
    const productData = {
      name: formData.name || '',
      description: formData.description || '',
      manufacturer: formData.manufacturer,
      category: formData.category,
      buyPrice: buyPrice,
      wholesalePrice: wholesalePrice,
      retailPrice: retailPrice,
      stockLevel: Number(formData.stock_level),
      imageUrl: formData.image_url || '',
      additionalInfo: formData.additional_info || '',
      sku: barcodes.sku,
      qrCode: barcodes.qrCode,
      code128: barcodes.code128 || '',
      cipher: barcodes.cipher || '',
      
      // Initialize any array fields if needed
      tags: [],
      images: formData.image_url ? [formData.image_url] : [],
      variants: [],
      attributes: []
    };

    console.log('Submitting product data:', productData);

    // Send to parent component for processing
    await onSubmit(productData);
    
    console.log('Form submission successful');
    
    addToast({
      title: 'Success',
      message: product ? 'Product updated successfully' : 'Product added successfully',
      type: 'success'
    });
  } catch (error) {
    console.error('Error submitting form:', {
      error,
      type: typeof error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    let errorMessage;
    if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = 'Unknown error occurred';
    }
    
    setError(errorMessage);
    
    addToast({
      title: 'Error',
      message: errorMessage,
      type: 'error',
      duration: 5000
    });
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-white to-blue-100 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 shadow-2xl rounded-3xl w-full max-w-6xl mx-4 max-h-[95vh] overflow-y-auto border border-blue-100 transform transition-all duration-300 ease-in-out">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-t-3xl shadow-md">
          <div className="flex justify-between items-center p-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <Package className="h-7 w-7" />
                {product ? 'Edit Product' : 'Add New Product'}
              </h2>
              <p className="text-sm text-blue-100 mt-1">
                Complete all necessary details for accurate product management
              </p>
            </div>
            <div className="flex items-center gap-3">
              {qrCode && (
                <button
                  type="button"
                  onClick={() => setShowPrintSettings(!showPrintSettings)}
                  className="btn bg-white/20 hover:bg-white/30 text-white flex items-center gap-2 rounded-full px-4 py-2"
                >
                  <Printer className="h-5 w-5" />
                  Print Labels
                </button>
              )}
              <button 
                onClick={onClose} 
                className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
          
          {/* Print Settings Panel */}
{/* Simplified Print Settings Panel */}
{showPrintSettings && (
  <div className="bg-white/10 backdrop-blur p-4 border-t border-white/20 animate-fadeIn">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-white/90 mb-2">
          Print Options
        </label>
        <div className="bg-white/5 rounded-md p-3">
          <div className="flex items-start gap-2 mb-3">
            <Info className="h-4 w-4 text-white/60 mt-0.5" />
            <div className="text-xs text-white/80">
              Labels will print as QR codes with text using the exact style shown in the example.
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-white/80">
              <span>Label size:</span>
              <span>25mm × 102mm</span>
            </div>
            <div className="flex items-center justify-between text-sm text-white/80">
              <span>Layout:</span>
              <span>3 columns × multiple rows</span>
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-white/90 mb-2">
          Print Quantity
        </label>
        <div className="flex flex-col gap-3">
          <div className="flex items-center">
            <input
              type="number"
              min="1"
              max="1000"
              value={printQuantity}
              onChange={(e) => setPrintQuantity(Number(e.target.value))}
              className="w-full bg-white/10 border border-white/20 rounded-l-md px-3 py-2 text-white/90 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
            <button
              type="button"
              onClick={handlePrintBarcodes}
              className="bg-white/20 hover:bg-white/30 border border-white/20 rounded-r-md px-4 py-2 text-white font-medium transition-colors"
            >
              Print
            </button>
          </div>
          
          <div className="bg-white p-2 rounded border border-gray-200 flex items-center justify-center space-x-2">
            <div className="h-8 w-8 bg-black rounded-sm flex items-center justify-center">
              <div className="h-6 w-6 bg-black"></div>
            </div>
            <div className="flex flex-col">
              <div className="text-xs text-gray-800">PE/MH-2399-AGZKO</div>
              <div className="text-sm text-blue-600 font-bold">MWP: ₹499</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mx-6 mt-4 rounded-r-lg flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Basic Info */}
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100 hover:border-blue-100 transition-colors">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  name="name"
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter product name (optional)"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100 hover:border-blue-100 transition-colors">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Manufacturer *
                  {selectedManufacturer && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-mono">
                      {selectedManufacturer.code}
                    </span>
                  )}
                </label>
                <select
                  name="manufacturer"
                  required
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={formData.manufacturer}
                  onChange={(e) => {
                    handleChange(e);
                    const selected = manufacturers.find(m => m.name === e.target.value);
                    setSelectedManufacturer(selected || null);
                  }}
                >
                  <option value="">Select Manufacturer</option>
                  {manufacturers.map(m => (
                    <option key={m.name} value={m.name}>
                      {m.name} ({m.code}) - {(m.markup * 100).toFixed(0)}% markup
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100 hover:border-blue-100 transition-colors">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  name="category"
                  required
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={formData.category}
                  onChange={handleChange}
                >
                  <option value="">Select Category</option>
                  {categories.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} - {(c.markup * 100).toFixed(0)}% markup
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-gray-50 p-5 rounded-lg shadow-sm border border-gray-100 hover:border-blue-100 transition-colors space-y-5">
                <div className="flex items-center mb-1">
                  <DollarSign className="h-5 w-5 text-blue-600 mr-2" />
                  <h3 className="font-medium text-gray-900">Pricing Information</h3>
                </div>
                
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Buy Price (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">₹</span>
                    <input
                      type="text"
                      name="buy_price"
                      required
                      className="w-full pl-8 pr-12 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      value={formData.buy_price}
                      onChange={handleChange}
                      placeholder="Enter buy price"
                    />
                    <button
                      type="button"
                      onClick={() => openCalculator('buy_price')}
                      className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-blue-600"
                      title="Open calculator"
                    >
                      <Calculator className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Wholesale Price (₹) *
                      <button 
                        type="button" 
                        onClick={() => setShowMarkupInfo(!showMarkupInfo)} 
                        className="ml-2 inline-flex text-blue-500 hover:text-blue-600 focus:outline-none"
                        aria-label="Show markup information"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </label>
                    {wholesalePriceEdited && (
                      <button
                        type="button"
                        onClick={resetWholesalePrice}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                        title="Reset to calculated value"
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">₹</span>
                    <input
                      type="text"
                      name="wholesale_price"
                      required
                      className={`w-full pl-8 pr-12 py-2 rounded-md border ${
                        wholesalePriceEdited 
                          ? 'border-blue-300 bg-blue-50' 
                          : 'border-gray-300'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                      value={formData.wholesale_price}
                      onChange={handleChange}
                      placeholder="Enter wholesale price"
                    />
                    <button
                      type="button"
                      onClick={() => openCalculator('wholesale_price')}
                      className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-blue-600"
                      title="Open calculator"
                    >
                      <Calculator className="h-5 w-5" />
                    </button>
                  </div>
                  {wholesalePriceEdited && (
                    <div className="mt-1 text-xs text-blue-600">
                      <span className="inline-flex items-center">
                        <Info className="h-3 w-3 mr-1" />
                        Custom value (differs from calculated price)
                      </span>
                    </div>
                  )}
                  
                  {/* Markup Info Panel - Completely Rewritten */}
                  {showMarkupInfo && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-100 text-sm text-blue-800 animate-fadeIn">
                      <div className="flex items-start">
                        <Info className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium mb-1">Markup Calculation</p>
                          <p>Wholesale price is calculated as Buy Price + (Buy Price × Markup).</p>
                          
                          {(() => {
                            // Get markup values directly from our arrays
                            const manufacturerObj = manufacturers.find(m => m.name === formData.manufacturer);
                            const categoryObj = categories.find(c => c.name === formData.category);
                            
                            // Get exact markup used for calculation
                            const markup = manufacturerObj?.markup !== undefined ? 
                              manufacturerObj.markup : 
                              categoryObj?.markup !== undefined ? 
                              categoryObj.markup : 0.2;
                            
                            // Calculate with the exact same logic as our main function
                            const buyPrice = Number(formData.buy_price) || 0;
                            const markupAmount = Math.round(buyPrice * markup);
                            const calculatedWholesale = buyPrice + markupAmount;
                            
                            return (
                              <>
                                <p className="mt-1">Current markup factors:</p>
                                <ul className="list-disc list-inside mt-1 space-y-1">
                                  {formData.manufacturer && (
                                    <li>
                                      Manufacturer ({formData.manufacturer}): 
                                      <span className="font-medium ml-1">
                                        {manufacturerObj ? 
                                          (manufacturerObj.markup * 100).toFixed(0) + '%' : 
                                          'Not available'}
                                      </span>
                                    </li>
                                  )}
                                  {formData.category && (
                                    <li>
                                      Category ({formData.category}): 
                                      <span className="font-medium ml-1">
                                        {categoryObj ? 
                                          (categoryObj.markup * 100).toFixed(0) + '%' : 
                                          'Not available'}
                                      </span>
                                    </li>
                                  )}
                                </ul>
                                
                                {buyPrice > 0 && (
                                  <div className="mt-2 p-2 bg-white rounded border border-blue-100">
                                    <p className="font-medium">Calculation for Buy Price ₹{buyPrice}:</p>
                                    <div className="font-mono text-xs mt-1">
                                      <div>Markup: {(markup * 100).toFixed(0)}% of ₹{buyPrice} = ₹{markupAmount}</div>
                                      <div className="border-t border-blue-100 mt-1 pt-1 font-medium">
                                        Wholesale Price: ₹{buyPrice} + ₹{markupAmount} = ₹{calculatedWholesale}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setShowMarkupInfo(false)}
                        className="mt-2 text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Close
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative mt-5">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      MWP (₹) *
                    </label>
                    {retailPriceEdited && (
                      <button
                        type="button"
                        onClick={resetRetailPrice}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                        title="Reset to calculated value"
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">₹</span>
                    <input
                      type="text"
                      name="retail_price"
                      required
                      className={`w-full pl-8 pr-12 py-2 rounded-md border ${
                        retailPriceEdited 
                          ? 'border-blue-300 bg-blue-50' 
                          : 'border-gray-300'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                      value={formData.retail_price}
                      onChange={handleChange}
                      placeholder="Enter retail price"
                    />
                    <button
                      type="button"
                      onClick={() => openCalculator('retail_price')}
                      className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-blue-600"
                      title="Open calculator"
                    >
                      <Calculator className="h-5 w-5" />
                    </button>
                  </div>
                  {retailPriceEdited && (
                    <div className="mt-1 text-xs text-blue-600">
                      <span className="inline-flex items-center">
                        <Info className="h-3 w-3 mr-1" />
                        Custom value (multiplier not applied)
                      </span>
                    </div>
                  )}
                  
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quick MWP Multiplier
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {MWP_MULTIPLIERS.map((multiplier) => (
                        <button
                          key={multiplier}
                          type="button"
                          onClick={() => handleMultiplierChange(multiplier)}
                          className={`px-3 py-1 rounded-full text-sm ${
                            selectedMultiplier === multiplier
                              ? 'bg-blue-600 text-white shadow-sm transform scale-105 font-medium'
                              : 'bg-white text-gray-700 hover:bg-gray-50 hover:text-blue-600 border shadow-sm'
                          } transition-all duration-200`}
                        >
                          {multiplier}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-gray-600">
                      <Tag className="h-4 w-4 mr-1 text-blue-500" />
                      <span>Calculated Price Summary</span>
                    </div>
                    <button 
                      type="button"
                      onClick={updatePricesBasedOnMarkup}
                      className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded flex items-center"
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      Recalculate
                    </button>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                    <div className="bg-gray-50 p-2 rounded border border-gray-200">
                      <div className="text-xs text-gray-500">Buy Price</div>
                      <div className="font-medium">₹{formData.buy_price || '0'}</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded border border-gray-200">
                      <div className="text-xs text-gray-500">Wholesale</div>
                      <div className="font-medium">₹{formData.wholesale_price || '0'}</div>
                    </div>
                    <div className="bg-blue-50 p-2 rounded border border-blue-100 shadow-sm">
                      <div className="text-xs text-blue-600">MWP</div>
                      <div className="font-bold text-blue-700">₹{formData.retail_price || '0'}</div>
                    </div>
                  </div>
                  
                  {formData.buy_price && formData.wholesale_price && formData.retail_price && (
                    <div className="mt-3 text-xs text-gray-500 flex items-center">
                      <Info className="h-3 w-3 mr-1 text-gray-400" />
                      Margin: {(() => {
                        const buyPrice = Number(formData.buy_price);
                        const wholesalePrice = Number(formData.wholesale_price);
                        const retailPrice = Number(formData.retail_price);
                        
                        if (buyPrice > 0 && wholesalePrice > 0) {
                          const wholesaleMargin = Math.round((wholesalePrice - buyPrice) / buyPrice * 100);
                          const retailMargin = Math.round((retailPrice - wholesalePrice) / wholesalePrice * 100);
                          return (
                            <span>
                              WS: <span className="font-medium">{wholesaleMargin}%</span>, 
                              Retail: <span className="font-medium">{retailMargin}%</span>
                            </span>
                          );
                        }
                        return 'N/A';
                      })()}
                    </div>
                  )}
                  
                  {/* Debug Action Button */}
                  <div className="mt-3 pt-2 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        // Log the raw product data
                        console.log('Product data:', product);
                        
                        // Log the markup settings
                        console.log('Markup settings:', {
                          manufacturers,
                          categories
                        });
                        
                        // Calculate the wholesale price with logs
                        const buyPrice = Number(formData.buy_price);
                        const wholesalePrice = calculateDirectWholesalePrice(buyPrice);
                        
                        // Show the result
                        addToast({
                          title: 'Debug',
                          message: `Buy ₹${buyPrice} with markup = ₹${wholesalePrice}`,
                          type: 'info'
                        });
                      }}
                      className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded flex items-center"
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Test Price Calculation
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100 hover:border-blue-100 transition-colors">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Level *
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    name="stock_level"
                    required
                    min="0"
                    className="w-full px-3 py-2 rounded-l-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    value={formData.stock_level}
                    onChange={handleChange}
                    placeholder="Enter stock quantity"
                  />
                  <div className="flex items-center -ml-1">
                    <button
                      type="button"
                      onClick={() => {
                        const currentValue = Number(formData.stock_level) || 0;
                        if (currentValue > 0) {
                          setFormData(prev => ({
                            ...prev, 
                            stock_level: (currentValue - 1).toString()
                          }));
                        }
                      }}
                      className="px-3 py-2 border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-600"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const currentValue = Number(formData.stock_level) || 0;
                        setFormData(prev => ({
                          ...prev, 
                          stock_level: (currentValue + 1).toString()
                        }));
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-r-md bg-gray-50 hover:bg-gray-100 text-gray-600"
                    >
                      +
                    </button>
                  </div>
                </div>
                
                {Number(formData.stock_level) > 0 && (
                  <div className="mt-2 text-sm flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs">
                      In Stock
                    </span>
                    {Number(formData.stock_level) < 5 && (
                      <span className="text-amber-600 text-xs ml-2">
                        Low Stock Warning
                      </span>
                    )}
                  </div>
                )}
                
                <div className="mt-3 text-xs text-gray-500">
                  Enter the number of units currently available in inventory
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100 hover:border-blue-100 transition-colors">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Information
                </label>
                <textarea
                  name="additional_info"
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  rows={2}
                  value={formData.additional_info}
                  onChange={handleChange}
                  placeholder="Enter any additional details (optional)"
                />
              </div>
            </div>

            {/* Right Column - Image & Barcode */}
            <div className="space-y-5">
              <div className="bg-gray-50 p-5 rounded-lg shadow-sm border border-gray-100 hover:border-blue-100 transition-colors">
                <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                  <ImageIcon className="h-5 w-5 text-blue-600 mr-2" />
                  Product Image
                </h3>
                <ImageUpload
                  value={formData.image_url}
                  onChange={(value) => setFormData(prev => ({ ...prev, image_url: value }))}
                  onError={setImageError}
                />
                {imageError && (
                  <p className="text-red-500 text-sm mt-2">{imageError}</p>
                )}
                <div className="mt-3 text-xs text-gray-500">
                  Upload a clear image of the product. Recommended size: 600×600 pixels.
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100 hover:border-blue-100 transition-colors">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter product description"
                />
              </div>

              {qrCode ? (
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-5 rounded-lg border border-blue-100 shadow-md">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="font-medium text-gray-900 flex items-center">
                        <QrCode className="h-5 w-5 text-blue-600 mr-2" />
                        Barcode Preview
                      </h3>
                      <p className="text-sm text-gray-500">Select format for printing</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedBarcodeType('qr')}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          selectedBarcodeType === 'qr'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white text-gray-700 border hover:border-blue-300 hover:bg-blue-50'
                        } transition-all duration-200`}
                      >
                        QR Code
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedBarcodeType('code128')}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          selectedBarcodeType === 'code128'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white text-gray-700 border hover:border-blue-300 hover:bg-blue-50'
                        } transition-all duration-200`}
                      >
                        Code 128
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col items-center bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
                    {selectedBarcodeType === 'qr' ? (
                      <div className="relative border p-2 bg-white" ref={qrCanvasRef}>
                        <QRCodeSVG 
                          value={qrCode} 
                          size={128 * previewScale}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                    ) : (
                      <div className="p-4 bg-white border-2 border-gray-200 rounded-md">
                        <div className="flex flex-col items-center">
                          <div className="mb-2 text-center text-xs text-gray-500">
                            {generatedSKU}
                          </div>
                          <canvas 
                            ref={barcodeCanvasRef} 
                            className="max-w-full border border-gray-100" 
                            style={{ minHeight: '80px', minWidth: '240px' }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-4 text-center">
                      <p className="text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                        MWP: ₹{formData.retail_price} ONLY
                      </p>
                      <div className="mt-2 font-mono font-bold tracking-wider">
                        {generatedSKU.split('-').map((part, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span className="text-gray-400 mx-1">-</span>}
                            <span className={i === 1 ? 'text-blue-600' : ''}>
                              {part}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                    
                    <div className="mt-4 flex flex-col w-full space-y-3">
                      <div className="text-sm font-medium text-gray-700">
                        Barcode Preview Options
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            Preview Scale
                          </label> 
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">50%</span>
                            <input
                              type="range"
                              min="0.5"
                              max="2"
                              step="0.1"
                              value={previewScale}
                              onChange={(e) => setPreviewScale(parseFloat(e.target.value))}
                              className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <span className="text-xs text-gray-500">200%</span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            Test Print
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setPrintQuantity(1);
                              handlePrintBarcodes();
                            }}
                            className="w-full px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded flex items-center justify-center gap-1"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Print Sample
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500 text-center">
                        Scale: {Math.round(previewScale * 100)}%
                      </div>
                    </div>
                    
                    <div className="w-full h-px bg-gray-200 my-4"></div>
                    
                    <div className="w-full">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                        <span>Barcode Details</span>
                        <button
                          type="button"
                          onClick={handleRegenerateBarcode}
                          className="text-blue-600 hover:text-blue-800 text-xs flex items-center"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
                        </button>
                      </div>
                      
                      <table className="w-full text-xs">
                        <tbody>
                          <tr>
                            <td className="py-1 text-gray-500">Type:</td>
                            <td className="py-1 font-medium">
                              {selectedBarcodeType === 'qr' ? 'QR Code' : 'Code 128B'}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1 text-gray-500">SKU:</td>
                            <td className="py-1 font-mono">
                              {generatedSKU}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1 text-gray-500">Format:</td>
                            <td className="py-1 font-medium">
                              {selectedBarcodeType === 'qr' 
                                ? 'ISO/IEC 18004:2015' 
                                : 'ISO/IEC 15417:2007'
                              }
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <button
                      type="button"
                      onClick={handlePrintBarcodes}
                      className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <Printer className="h-4 w-4" />
                      Print {printQuantity > 1 ? `${printQuantity} Labels` : 'Label'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 shadow-sm text-center">
                  <div className="mb-4">
                    <QrCode className="h-12 w-12 text-blue-300 mx-auto" />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-2">Barcode Preview</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Fill in all required product details to generate barcode
                  </p>
                  <div className="flex flex-col space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Check className={`h-4 w-4 ${formData.manufacturer ? 'text-green-500' : 'text-gray-300'}`} />
                      Manufacturer
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className={`h-4 w-4 ${formData.category ? 'text-green-500' : 'text-gray-300'}`} />
                      Category
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className={`h-4 w-4 ${formData.wholesale_price ? 'text-green-500' : 'text-gray-300'}`} />
                      Wholesale Price
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className={`h-4 w-4 ${formData.retail_price ? 'text-green-500' : 'text-gray-300'}`} />
                      Retail Price (MWP)
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center gap-3 pt-6 border-t mt-6">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <AlertCircle className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-gray-700">*</span> Required fields
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded-md shadow-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-md shadow-md font-medium transition-colors flex items-center gap-2"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </span>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    {product ? 'Update Product' : 'Add Product'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
      
      {/* NEW: Calculator Modal */}
      {showCalculator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-80 overflow-hidden">
            {/* Calculator Header */}
            <div className="bg-blue-600 text-white p-3 flex justify-between items-center">
              <h3 className="font-bold text-lg">Calculator</h3>
              <button onClick={closeCalculator} className="text-white hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Calculator Display */}
            <div className="p-3 bg-gray-100 border-b border-gray-300">
              <input
                type="text"
                className="w-full p-2 text-right text-lg font-mono bg-white border border-gray-300 rounded"
                value={calculatorValue}
                onChange={(e) => setCalculatorValue(e.target.value.replace(/[^0-9.]/g, ''))}
                readOnly
              />
              <div className="mt-1 text-xs text-gray-500 flex justify-between">
                <span>{calculatorTarget ? `Field: ${calculatorTarget.replace('_', ' ')}` : ''}</span>
                <span>{calculatorOperation ? `Operation: ${calculatorOperation}` : ''}</span>
              </div>
            </div>
            
            {/* Calculator Keypad */}
            <div className="grid grid-cols-4 gap-1 p-2 bg-gray-50">
              {/* First Row */}
              <button
                onClick={() => handleCalculatorInput('clear')}
                className="p-3 bg-red-100 text-red-700 rounded hover:bg-red-200 font-bold"
              >
                C
              </button>
              <button
                onClick={() => handleCalculatorInput('backspace')}
                className="p-3 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center justify-center"
              >
                ⌫
              </button>
              <button
                onClick={() => handleCalculatorInput('percent')}
                className="p-3 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                %
              </button>
              <button
                onClick={() => handleCalculatorInput('divide')}
                className="p-3 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                ÷
              </button>
              
              {/* Number Rows */}
              <button
                onClick={() => handleCalculatorInput('7')}
                className="p-3 bg-white text-gray-800 rounded hover:bg-gray-100"
              >
                7
              </button>
              <button
                onClick={() => handleCalculatorInput('8')}
                className="p-3 bg-white text-gray-800 rounded hover:bg-gray-100"
              >
                8
              </button>
              <button
                onClick={() => handleCalculatorInput('9')}
                className="p-3 bg-white text-gray-800 rounded hover:bg-gray-100"
              >
                9
              </button>
              <button
                onClick={() => handleCalculatorInput('multiply')}
                className="p-3 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                ×
              </button>
              
              <button
                onClick={() => handleCalculatorInput('4')}
                className="p-3 bg-white text-gray-800 rounded hover:bg-gray-100"
              >
                4
              </button>
              <button
                onClick={() => handleCalculatorInput('5')}
                className="p-3 bg-white text-gray-800 rounded hover:bg-gray-100"
              >
                5
              </button>
              <button
                onClick={() => handleCalculatorInput('6')}
                className="p-3 bg-white text-gray-800 rounded hover:bg-gray-100"
              >
                6
              </button>
              <button
                onClick={() => handleCalculatorInput('subtract')}
                className="p-3 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                -
              </button>
              
              <button
                onClick={() => handleCalculatorInput('1')}
                className="p-3 bg-white text-gray-800 rounded hover:bg-gray-100"
              >
                1
              </button>
              <button
                onClick={() => handleCalculatorInput('2')}
                className="p-3 bg-white text-gray-800 rounded hover:bg-gray-100"
              >
                2
              </button>
              <button
                onClick={() => handleCalculatorInput('3')}
                className="p-3 bg-white text-gray-800 rounded hover:bg-gray-100"
              >
                3
              </button>
              <button
                onClick={() => handleCalculatorInput('add')}
                className="p-3 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                +
              </button>
              
              {/* Last Row */}
              <button
                onClick={() => handleCalculatorInput('0')}
                className="p-3 bg-white text-gray-800 rounded hover:bg-gray-100 col-span-2"
              >
                0
              </button>
              <button
                onClick={() => handleCalculatorInput('.')}
                className="p-3 bg-white text-gray-800 rounded hover:bg-gray-100"
              >
                .
              </button>
              <button
                onClick={() => handleCalculatorInput('calculate')}
                className="p-3 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                =
              </button>
            </div>
            
            {/* Calculator Actions */}
            <div className="p-3 bg-gray-100 border-t border-gray-300 flex justify-between">
              <button
                onClick={closeCalculator}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={applyCalculatedValue}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                disabled={!calculatorValue}
              >
                <Check className="h-4 w-4 mr-1" />
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductForm;
