import React, { useRef, useEffect, useState } from 'react';
import ProductSearch from './ProductSearch';
import type { Product } from '../../types';
import { processScannedSku } from '../../utils/scannerUtils'; 
import { X, Search, Phone, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatPhoneNumber } from '../../utils/phoneUtils';

// SKU Pattern Guidelines - Updated for format like "EA/SG01-5688-WERJO"
const SKU_GUIDELINES = {
  // Pattern for single SKU validation
  VALID_PATTERN: /[A-Z]+\/[A-Z0-9]+-\d{4}-[A-Z]+/i,
  
  // Pattern to match at the beginning of a SKU
  SKU_START_PATTERN: /[A-Z]+\/[A-Z0-9]+/i,
  
  // Minimum length a valid SKU must have
  MIN_LENGTH: 12, 
  
  // Maximum length a valid SKU can have
  MAX_LENGTH: 30, 
  
  // Whether to automatically uppercase SKUs
  AUTO_UPPERCASE: true,
  
  // Whether to trim whitespace from SKUs
  TRIM_WHITESPACE: true,
  
  // Format function for raw input based on your SKU pattern
  formatSku: (raw: string): string => {
    // Remove any extra whitespace
    let cleaned = raw.trim();
    
    // Auto uppercase if needed
    if (SKU_GUIDELINES.AUTO_UPPERCASE) {
      cleaned = cleaned.toUpperCase();
    }
    
    // If already in the right format, return it
    if (SKU_GUIDELINES.VALID_PATTERN.test(cleaned)) {
      return cleaned;
    }
    
    // Try to fix common formatting issues
    if (!cleaned.includes('-') && cleaned.includes('/')) {
      // Add hyphens if missing
      const parts = cleaned.split('/');
      if (parts.length === 2) {
        const prefix = parts[0];
        const rest = parts[1];
        
        // For formats like EA/SG015688WERJO
        if (rest.length >= 10) {
          // Try to format as EA/SG01-5688-WERJO
          const part1 = rest.substring(0, 4);
          const part2 = rest.substring(4, 8);
          const part3 = rest.substring(8);
          cleaned = `${prefix}/${part1}-${part2}-${part3}`;
        }
      }
    }
    
    return cleaned;
  },
  
  // NEW: Function to split concatenated SKUs in bulk mode
  splitBulkSku: (bulkSku: string): string[] => {
    if (!bulkSku) return [];
    
    // First check if this is already a valid single SKU
    if (SKU_GUIDELINES.VALID_PATTERN.test(bulkSku)) {
      return [bulkSku];
    }
    
    // Pattern to match your typical SKU format: EA/SG01-5688-WERJO
    const skuPattern = /[A-Z]+\/[A-Z0-9]+-\d{4}-[A-Z]+/gi;
    
    // Find all matching SKUs in the string
    const matches = bulkSku.match(skuPattern) || [];
    
    if (matches.length > 0) {
      return matches;
    }
    
    // If no complete SKUs found, try to split at potential SKU boundaries
    // Look for patterns like EA/SG01 that could be the start of a new SKU
    const potentialBreaks = bulkSku.match(/[A-Z]+\/[A-Z0-9]+/gi) || [];
    
    if (potentialBreaks.length <= 1) {
      // If only one or no breaks found, return the original as a single SKU
      return [bulkSku];
    }
    
    // Extract SKUs based on identified break points
    const extractedSkus = [];
    let currentPos = 0;
    
    for (let i = 0; i < potentialBreaks.length; i++) {
      const breakPos = bulkSku.indexOf(potentialBreaks[i], currentPos);
      
      // If this isn't the first break, extract the previous SKU
      if (i > 0 && breakPos > currentPos) {
        const sku = bulkSku.substring(currentPos, breakPos);
        if (sku.length >= SKU_GUIDELINES.MIN_LENGTH) {
          extractedSkus.push(sku);
        }
      }
      
      // Update current position
      currentPos = breakPos;
      
      // For the last break, extract until the end
      if (i === potentialBreaks.length - 1) {
        const sku = bulkSku.substring(breakPos);
        if (sku.length >= SKU_GUIDELINES.MIN_LENGTH) {
          extractedSkus.push(sku);
        }
      }
    }
    
    // If we couldn't extract any SKUs, try the direct splitting approach
    if (extractedSkus.length === 0) {
      // Try breaking at potential SKU boundaries (looking for patterns like EA/)
      const parts = bulkSku.split(/(?=[A-Z]+\/)/g).filter(Boolean);
      
      if (parts.length > 1) {
        return parts;
      }
    }
    
    return extractedSkus.length > 0 ? extractedSkus : [bulkSku];
  },
  
  // Validate if a SKU meets all criteria
  isValid: (sku: string): boolean => {
    if (!sku) return false;
    
    // Check length
    if (sku.length < SKU_GUIDELINES.MIN_LENGTH || sku.length > SKU_GUIDELINES.MAX_LENGTH) {
      return false;
    }
    
    // Check pattern if needed
    if (SKU_GUIDELINES.VALID_PATTERN && !SKU_GUIDELINES.VALID_PATTERN.test(sku)) {
      return false;
    }
    
    return true;
  }
};

interface ProductScannerProps {
  scanning: boolean;
  scannedSku: string;
  onScannedSkuChange: (sku: string) => void;
  onProductSelect: (product: Product) => void;
  onCustomerSelect?: (customer: any) => void;
  onBulkScan?: (items: Array<{sku: string, quantity: number}>) => void;
  onScanningChange: (scanning: boolean) => void;
}

const ProductScanner: React.FC<ProductScannerProps> = ({
  scanning,
  scannedSku,
  onScannedSkuChange,
  onProductSelect,
  onCustomerSelect,
  onBulkScan,
  onScanningChange
}) => {
  const scanInputRef = useRef<HTMLInputElement>(null);
  const lastKeyTime = useRef<number>(0);
  const buffer = useRef<string>('');
  const isShiftPressed = useRef<boolean>(false);
  const [bulkItems, setBulkItems] = useState<Array<{sku: string, quantity: number}>>([]);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [showContactSearch, setShowContactSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout>();
  const SCAN_TIMEOUT = 30; // 30ms timeout for ultra-rapid scanning
  const [scanMode, setScanMode] = useState<'normal' | 'bulk' | 'count'>('normal');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<string>('0');

  // Pre-load audio for faster beep response
  const beepAudio = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    // Create and preload the audio element once
    beepAudio.current = new Audio('path/to/beep.mp3');
    beepAudio.current.preload = 'auto';
    
    // Cleanup on unmount
    return () => {
      beepAudio.current = null;
    };
  }, []);
  
  const playSuccessBeep = () => {
    // Use the preloaded audio element for faster response
    if (beepAudio.current) {
      // Clone the audio element for concurrent playback
      const audioClone = beepAudio.current.cloneNode() as HTMLAudioElement;
      audioClone.volume = 0.5; // Lower volume for better performance
      audioClone.play().catch(err => {
        if (debugMode) console.log('Audio play error:', err);
      });
    }
  };
  
  useEffect(() => {
    if (scanning) {
      scanInputRef.current?.focus();
      
      const handleKeyDown = (e: KeyboardEvent) => {
        // Check for ESC key
        if (e.key === 'Escape') {
          e.preventDefault();
          onScanningChange(false);
          return;
        }
        
        // Toggle debug mode with Ctrl+D
        if (e.ctrlKey && e.key === 'd') {
          e.preventDefault();
          setDebugMode(prev => !prev);
          console.log('Debug mode:', !debugMode);
          return;
        }
        
        // Track shift key press
        if (e.key === 'Shift') {
          isShiftPressed.current = true;
          return;
        }

        const now = Date.now();
        
        // If it's been more than SCAN_TIMEOUT since the last keypress, reset the buffer
        if (now - lastKeyTime.current > SCAN_TIMEOUT && e.key !== 'Shift') {
          if (debugMode) console.log('Buffer reset due to timeout');
          buffer.current = '';
        }
        
        // Update last key time (only for non-modifier keys)
        if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt') {
          lastKeyTime.current = now;
        }

        // Process keypress
        if (e.key === 'Enter') {
          e.preventDefault();
          processBuffer();
        } else if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt') {
          // Only add actual characters to the buffer, not modifier keys
          buffer.current += e.key;
          
          // Fast check if the buffer is getting too long
          if (buffer.current.length > 1000) {
            buffer.current = buffer.current.substring(buffer.current.length - 200);
          }
          
          if (debugMode) console.log('Buffer updated:', buffer.current);
        }
      };
      
      // Helper function to process the current buffer
      const processBuffer = () => {
        if (!buffer.current) return;
        
        if (debugMode) console.log('Processing scan buffer:', buffer.current);
        
        // First check for special command codes
        if (buffer.current.includes('S_CMD_020E')) {
          // Set to BULK FAST SCAN mode
          setScanMode('bulk');
          setBulkItems([]);
          playSuccessBeep();
          if (debugMode) console.log('Switched to BULK FAST SCAN mode');
          buffer.current = '';
          return;
        }
        
        if (buffer.current.includes('S_CMD_MT00')) {
          // Set to Normal mode
          setScanMode('normal');
          setBulkItems([]);
          playSuccessBeep();
          if (debugMode) console.log('Switched to Normal mode');
          buffer.current = '';
          return;
        }
        
        if (buffer.current.includes('%%SpecCode16')) {
          // BULK UPLOAD command
          handleBulkComplete();
          playSuccessBeep();
          if (debugMode) console.log('Processing bulk upload');
          buffer.current = '';
          return;
        }
        
        if (buffer.current.includes('%%SpecCode17')) {
          // TOTAL PRODUCT COUNT command
          setScanMode('count');
          setPendingCount(Number(totalCount) || 0);
          playSuccessBeep();
          if (debugMode) console.log('Expecting to count: ' + totalCount + ' items');
          buffer.current = '';
          return;
        }
        
        if (buffer.current.includes('%%SpecCode18')) {
          // CLEAR DATA command
          setBulkItems([]);
          setScanMode('normal');
          setPendingCount(0);
          playSuccessBeep();
          if (debugMode) console.log('Data cleared');
          buffer.current = '';
          return;
        }
        
        // Different processing based on scan mode
        if (scanMode === 'bulk') {
          // In bulk mode, try to process as multiple SKUs
          processBulkSku(buffer.current);
          buffer.current = '';
          return;
        } else if (scanMode === 'count') {
          // In count mode, also parse for multiple SKUs
          processBulkSku(buffer.current);
          buffer.current = '';
          return;
        }
        
        // Normal mode - look for a single SKU
        // Look for your specific SKU pattern first
        const skuMatch = buffer.current.match(SKU_GUIDELINES.VALID_PATTERN);
        if (skuMatch && skuMatch.length > 0) {
          const sku = skuMatch[0];
          if (debugMode) console.log('Matched exact SKU pattern:', sku);
          
          // Process as single SKU
          processScannedSku(sku, onProductSelect, onScannedSkuChange);
          buffer.current = '';
          return;
        }
        
        // If no exact pattern match, try to format and process
        const formattedSku = SKU_GUIDELINES.formatSku(buffer.current);
        if (SKU_GUIDELINES.isValid(formattedSku)) {
          if (debugMode) console.log('Formatted valid SKU:', formattedSku);
          processScannedSku(formattedSku, onProductSelect, onScannedSkuChange);
        } else {
          if (debugMode) console.log('Invalid SKU format:', formattedSku);
          // Could show an error or handle invalid SKU
        }
        
        // Clear buffer after processing
        buffer.current = '';
      };

      // Track key release for shift key
      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'Shift') {
          isShiftPressed.current = false;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [scanning, onScannedSkuChange, onProductSelect, bulkItems, debugMode, scanMode, totalCount, pendingCount, onBulkScan, onScanningChange]);

  // Updated processBulkSku to handle concatenated SKUs
  const processBulkSku = (sku: string) => {
    if (!sku) return;
    
    // Apply basic formatting first (uppercase, trim)
    let cleanedSku = sku.trim();
    if (SKU_GUIDELINES.AUTO_UPPERCASE) {
      cleanedSku = cleanedSku.toUpperCase();
    }
    
    // Split into multiple SKUs if needed
    const splitSkus = SKU_GUIDELINES.splitBulkSku(cleanedSku);
    
    if (debugMode) {
      console.log('Original bulk input:', sku);
      console.log('Split into SKUs:', splitSkus);
    }
    
    // Process each SKU found
    splitSkus.forEach(singleSku => {
      // Format each individual SKU
      const formattedSku = SKU_GUIDELINES.formatSku(singleSku);
      
      if (formattedSku.length < SKU_GUIDELINES.MIN_LENGTH) {
        if (debugMode) console.log(`Skipping invalid SKU: ${formattedSku} (too short)`);
        return;
      }
      
      // Add to the bulk items list
      setBulkItems(prev => {
        const existingItem = prev.find(item => item.sku === formattedSku);
        
        if (existingItem) {
          // Increment quantity of existing item
          return prev.map(item => 
            item.sku === formattedSku 
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        } else {
          // Add new item
          return [...prev, { sku: formattedSku, quantity: 1 }];
        }
      });
      
      if (debugMode) console.log('Added to bulk items:', formattedSku);
    });
    
    // Play success beep if we found at least one SKU
    if (splitSkus.length > 0) {
      playSuccessBeep();
    }
    
    // Check if we've reached the expected count in count mode
    if (scanMode === 'count') {
      setTimeout(() => {
        // Use a timeout to ensure state is updated
        if (bulkItems.length >= pendingCount && pendingCount > 0) {
          if (debugMode) console.log(`Reached target count: ${bulkItems.length}/${pendingCount}`);
          
          // If onBulkScan is provided, call it with the current items
          if (onBulkScan) {
            setTimeout(() => {
              onBulkScan(bulkItems);
              setBulkItems([]);
              setScanMode('normal');
              setPendingCount(0);
            }, 500);
          }
        }
      }, 100);
    }
  };

  const handleBulkComplete = async () => {
    if (bulkItems.length === 0) {
      if (debugMode) console.log('No bulk items to process');
      return;
    }
    
    if (debugMode) console.log(`Processing ${bulkItems.length} bulk items`);
    
    if (onBulkScan) {
      try {
        await onBulkScan(bulkItems);
        // Reset state after successful bulk scan
        setBulkItems([]);
        setScanMode('normal');
        setPendingCount(0);
        
        // Play success beep
        playSuccessBeep();
        
        if (debugMode) console.log('Bulk scan completed successfully');
      } catch (error) {
        console.error('Error in bulk scan:', error);
        alert('Error processing bulk items. Please try again.');
      }
    } else {
      // If no bulkScan handler, process items one by one
      if (debugMode) console.log('No bulk scan handler, processing items individually');
      
      for (const item of bulkItems) {
        for (let i = 0; i < item.quantity; i++) {
          await processScannedSku(item.sku, onProductSelect, onScannedSkuChange);
        }
      }
      
      // Reset state
      setBulkItems([]);
      setScanMode('normal');
      setPendingCount(0);
      
      // Play success beep
      playSuccessBeep();
    }
  };

  // For manual input submission
  const handleManualSubmit = (inputSku: string) => {
    if (!inputSku) return;
    
    if (scanMode === 'bulk' || scanMode === 'count') {
      processBulkSku(inputSku);
      onScannedSkuChange('');
    } else {
      // Format the manually entered SKU
      const formattedSku = SKU_GUIDELINES.formatSku(inputSku);
      processScannedSku(formattedSku, onProductSelect, onScannedSkuChange);
    }
  };

  // Handle contact search
  const handleContactSearch = async (term: string) => {
    setSearchTerm(term);
    
    // Clear previous timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    // Don't search if term is too short
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    // Debounce search
    searchTimeout.current = setTimeout(async () => {
      try {
        setSearching(true);
        
        // Search by name or phone
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
          .limit(5);

        if (error) throw error;
        setSearchResults(data || []);
      } catch (error) {
        console.error('Error searching contacts:', error);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleSelectContact = (customer: any) => {
    if (onCustomerSelect) {
      onCustomerSelect(customer);
    }
    setShowContactSearch(false);
    setSearchTerm('');
    setSearchResults([]);
  };

  const processCountSku = (sku: string) => {
    // For count mode, use the same logic as bulk mode
    processBulkSku(sku);
  };

  return scanning ? (
    <div className="relative scanning-container">
      <div className="absolute left-0 top-0 bottom-0 w-2">
        <div className={`h-full w-full ${
          scanMode === 'bulk' 
            ? 'bg-purple-500' 
            : scanMode === 'count' 
              ? 'bg-amber-500' 
              : 'bg-green-500'
        } opacity-25 animate-pulse`} />
      </div>
      
      {/* Contact Search Button */}
      <button
        onClick={() => setShowContactSearch(true)}
        className="absolute right-4 top-4 btn btn-secondary flex items-center gap-2 z-10"
      >
        <User className="h-4 w-4" />
        <span>Search Contacts</span>
      </button>

      {/* Contact Search Modal */}
      {showContactSearch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg mx-4">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-medium">Search Contacts</h3>
              <button
                onClick={() => {
                  setShowContactSearch(false);
                  setSearchTerm('');
                  setSearchResults([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  className="input pl-10 w-full"
                  value={searchTerm}
                  onChange={(e) => handleContactSearch(e.target.value)}
                />
              </div>

              <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                {searching ? (
                  <div className="text-center py-4 text-gray-500">
                    Searching...
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => handleSelectContact(customer)}
                      className="w-full text-left p-3 hover:bg-gray-50 rounded-lg flex items-center gap-3"
                    >
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">
                          {customer.name[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5" />
                          <span className="font-mono">
                            {formatPhoneNumber(customer.phone)}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            customer.type === 'wholesaler'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {customer.type}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                ) : searchTerm.length > 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No contacts found
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {debugMode && (
        <div className="bg-yellow-800 text-yellow-200 p-2 text-sm mb-2 rounded">
          <p>Debug Mode Active - Press Ctrl+D to toggle</p>
          <p>Current Buffer: {buffer.current}</p>
          <p>Current Mode: {scanMode}</p>
          <p>Items Scanned: {bulkItems.length}</p>
          {scanMode === 'count' && (
            <p>Count Progress: {bulkItems.length}/{pendingCount}</p>
          )}
          <p>SKU Pattern: {SKU_GUIDELINES.VALID_PATTERN.toString()}</p>
        </div>
      )}
      <div className="space-y-4">
        <input
          type="text"
          value={scannedSku}
          onChange={(e) => onScannedSkuChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleManualSubmit(scannedSku);
            }
          }}
          placeholder={
            scanMode === 'bulk' 
              ? "Bulk scan mode: scanning multiple items..." 
              : scanMode === 'count'
                ? `Counting mode: ${bulkItems.length}/${pendingCount} items scanned...`
                : "Scan barcode or enter SKU..."
          }
          className={`input w-full font-mono text-lg tracking-wider pl-4 ${
            scanMode === 'bulk'
              ? 'bg-purple-900 text-white'
              : scanMode === 'count'
                ? 'bg-amber-900 text-white'
                : 'bg-gray-900 text-white'
          }`}
          ref={scanInputRef}
          autoComplete="off"
          autoFocus
          spellCheck={false}
          onBlur={() => {
            // Re-focus the input when it loses focus
            if (scanning) {
              setTimeout(() => scanInputRef.current?.focus(), 100);
            }
          }}
        />

        {(scanMode === 'bulk' || scanMode === 'count') && (
          <div className={`${
            scanMode === 'bulk' ? 'bg-gray-800' : 'bg-amber-800'
          } rounded-lg p-4`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-medium">
                {scanMode === 'bulk' 
                  ? `Bulk Scanned Items (${bulkItems.length})` 
                  : `Counted Items: ${bulkItems.length}/${pendingCount}`
                }
              </h3>
              <div className="space-x-2">
                <button
                  onClick={() => setBulkItems([])}
                  className="btn btn-secondary text-sm"
                  disabled={bulkItems.length === 0}
                >
                  Clear All
                </button>
                <button
                  onClick={handleBulkComplete}
                  className="btn btn-primary text-sm"
                  disabled={bulkItems.length === 0}
                >
                  Complete {scanMode === 'bulk' ? 'Bulk Scan' : 'Count'}
                </button>
              </div>
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {bulkItems.map((item, index) => (
                <div key={index} className={`flex items-center justify-between ${
                  scanMode === 'bulk' ? 'bg-gray-700' : 'bg-amber-700'
                } p-2 rounded`}>
                  <span className="font-mono text-white">{item.sku}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white">×{item.quantity}</span>
                    <button
                      onClick={() => setBulkItems(prev => prev.filter((_, i) => i !== index))}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
        <div className="text-white text-sm">
          {scanMode === 'bulk'
            ? 'Bulk Scan Mode'
            : scanMode === 'count'
              ? `Counting Mode (${bulkItems.length}/${pendingCount})`
              : 'Normal Scan Mode'
          } Active
        </div>
        <div className={`w-3 h-3 ${
          scanMode === 'bulk'
            ? 'bg-purple-500'
            : scanMode === 'count'
              ? 'bg-amber-500'
              : 'bg-green-500'
        } rounded-full animate-pulse`}>
          <div className={`absolute w-3 h-3 ${
            scanMode === 'bulk'
              ? 'bg-purple-500'
              : scanMode === 'count'
                ? 'bg-amber-500'
                : 'bg-green-500'
          } rounded-full animate-ping`} />
        </div>
      </div>
    </div>
  ) : (
    <ProductSearch onSelect={onProductSelect} />
  );
};

export default ProductScanner;
