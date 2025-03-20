import { create } from 'zustand';

interface ScanningModeState {
  isScanning: boolean;
  setScanning: (scanning: boolean) => void;
}

export const useScanningMode = create<ScanningModeState>((set) => ({
  isScanning: false,
  setScanning: (scanning) => set({ isScanning: scanning }),
}
)
)
