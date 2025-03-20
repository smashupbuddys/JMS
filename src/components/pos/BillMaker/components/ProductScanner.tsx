import React, { useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { Product } from '../../../../types';
import { processScannedSku } from '../../../../utils/scannerUtils';

interface ProductScannerProps {
  scanning: boolean;
  scannedSku: string;
  onScannedSkuChange: (sku: string) => void;
  onProductSelect: (product: Product) => void;
}

const ProductScanner: React.FC<ProductScannerProps> = ({
  scanning,
  scannedSku,
  onScannedSkuChange,
  onProductSelect
}) => {
  const scanInputRef = useRef<HTMLInputElement>(null);
  const lastKeyTime = useRef<number>(0);
  const buffer = useRef<string>('');
  const SCAN_TIMEOUT = 50; // 50ms timeout for rapid scanning

  useEffect(() => {
    if (scanning) {
      scanInputRef.current?.focus();
      
      const handleKeyDown = (e: KeyboardEvent) => {
        const now = Date.now();
        
        // If it's been more than 50ms since the last keypress, reset the buffer
        if (now - lastKeyTime.current > SCAN_TIMEOUT) {
          buffer.current = '';
        }
        
        // Update last key time
        lastKeyTime.current = now;

        // Add character to buffer
        if (e.key === 'Enter') {
          e.preventDefault();
          if (buffer.current) {
            processScannedSku(buffer.current, onProductSelect, onScannedSkuChange);
            buffer.current = '';
          }
        } else {
          buffer.current += e.key;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [scanning, onScannedSkuChange, onProductSelect]);

  return scanning ? (
    <div className="relative scanning-container">
      <div className="absolute left-0 top-0 bottom-0 w-2">
        <div className="h-full w-full bg-green-500 opacity-25 animate-pulse" />
      </div>
      <input
        type="text"
        value={scannedSku}
        onChange={(e) => onScannedSkuChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            processScannedSku(scannedSku, onProductSelect, onScannedSkuChange);
          }
        }}
        placeholder="Scan barcode or enter SKU..."
        className="input w-full bg-gray-900 text-white font-mono text-lg tracking-wider pl-4"
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
      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
        <div className="text-white text-sm">Scanning Mode Active</div>
        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse">
          <div className="absolute w-3 h-3 bg-green-500 rounded-full animate-ping" />
        </div>
      </div>
    </div>
  ) : (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
      <input
        type="text"
        placeholder="Search products..."
        className="input pl-10 w-full"
        onChange={(e) => onScannedSkuChange(e.target.value)}
      />
    </div>
  );
};

export default ProductScanner;