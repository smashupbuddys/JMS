import React from 'react';
import { QrCode } from 'lucide-react';

interface HeaderProps {
  scanning: boolean;
  onToggleScanning: () => void;
}

const Header: React.FC<HeaderProps> = ({ scanning, onToggleScanning }) => {
  return (
    <div className="flex justify-between items-center">
      <h2 className="text-xl font-bold">Quick Quotation</h2>
      <button
        onClick={onToggleScanning}
        className={`btn ${scanning ? 'btn-secondary' : 'btn-primary'} flex items-center gap-2`}
        aria-label={scanning ? 'Stop Scanning' : 'Start Scanning'}
      >
        <QrCode className="h-4 w-4" />
        {scanning ? 'Stop Scanning' : 'Start Scanning'}
      </button>
    </div>
  );
};

export default Header;
