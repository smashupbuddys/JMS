import React, { useEffect, useRef } from 'react';
import ProductSearch from '../../ProductSearch';
import type { Product } from '../../../../types';

interface ProductSectionProps {
  scanning: boolean;
  scannedSku: string;
  setScannedSku: (sku: string) => void;
  scanInputRef: React.RefObject<HTMLInputElement>;
  onProductSelect: (product: Product) => void;
}

const ProductSection: React.FC<ProductSectionProps> = ({
  scanning,
  scannedSku,
  setScannedSku,
  scanInputRef,
  onProductSelect
}) => {
  const lastKeyTime = useRef<number>(0);
  const buffer = useRef<string>('');
  const SCAN_TIMEOUT = 50; // 50ms timeout for rapid scanning

  useEffect(() => {
    if (scanning) {
      // Focus input when scanning mode is enabled
      scanInputRef.current?.focus();

      // Add keyboard event listener for rapid scanning
      const handleKeyDown = (e: KeyboardEvent) => {
        const now = Date.now();
        
        // If it's been more than 50ms since the last keypress, reset the buffer
        if (now - lastKeyTime.current > SCAN_TIMEOUT) {
          buffer.current = '';
        }
        
        // Update last key time
        lastKeyTime.current = now;

        // Add character to buffer
        if (e.key !== 'Enter') {
          buffer.current += e.key;
        } else {
          // Process the complete scan
          if (buffer.current) {
            setScannedSku(buffer.current);
            buffer.current = '';
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [scanning, setScannedSku]);

  return scanning ? (
    <div className="relative">
      <input
        type="text"
        value={scannedSku}
        onChange={(e) => setScannedSku(e.target.value)}
        placeholder="Scan barcode or enter SKU..."
        className="input w-full bg-blue-50 font-mono text-lg tracking-wider"
        ref={scanInputRef}
        autoComplete="off"
        autoFocus
      />
      {scanning && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-pulse flex space-x-1">
            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animation-delay-100"></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animation-delay-200"></div>
          </div>
        </div>
      )}
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
        <div className={`w-3 h-3 rounded-full ${scannedSku ? 'bg-green-500' : 'bg-blue-500'} animate-ping`} />
      </div>
    </div>
  ) : (
    <ProductSearch onSelect={onProductSelect} />
  );
};

export default ProductSection
