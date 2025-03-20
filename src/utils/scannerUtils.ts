import { supabase } from '../lib/supabase';
import type { Product } from '../types';
import QrScanner from 'qr-scanner';

// Cache for recently scanned products
const productCache = new Map<string, Product>();

// Camera scanner instance
let qrScanner: QrScanner | null = null;

// Scanner buffer and timing
const SCAN_TIMEOUT = 50; // 50ms timeout for rapid scanning
let lastScanTime = 0;
let scanBuffer = '';

// Clear cache after 5 minutes
setInterval(() => productCache.clear(), 5 * 60 * 1000);

// Audio context for beep sounds
let audioContext: AudioContext | null = null;
let speechSynthesis: SpeechSynthesis | null = null;

const initAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

const speakMessage = (message: string) => {
  if (!speechSynthesis) {
    speechSynthesis = window.speechSynthesis;
  }

  // Cancel any ongoing speech
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 1.1; // Slightly faster than normal
  utterance.pitch = 1.0;
  utterance.volume = 0.8;
  
  speechSynthesis.speak(utterance);
};

const playBeep = (success: boolean) => {
  try {
    const context = initAudioContext();
    if (!context) return;

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(success ? 1000 : 500, context.currentTime);
    gainNode.gain.setValueAtTime(0.1, context.currentTime);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.1);
  } catch (error) {
    console.warn('Could not play beep sound:', error);
  }
};

export const startCameraScanning = async (
  videoElement: HTMLVideoElement,
  onScan: (result: string) => void,
  onError?: (error: Error) => void
) => {
  try {
    if (!qrScanner) {
      qrScanner = new QrScanner(
        videoElement,
        result => {
          playBeep(true);
          onScan(result.data);
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 2, // Limit scan rate to prevent duplicates
        }
      );
    }
    
    await qrScanner.start();
  } catch (error) {
    console.error('Error starting camera scanner:', error);
    onError?.(error as Error);
  }
};

export const stopCameraScanning = () => {
  if (qrScanner) {
    qrScanner.stop();
    qrScanner.destroy();
    qrScanner = null;
  }
};

export const processScannedSku = async (
  input: string,
  addProduct: (product: Product) => void,
  setScannedSku: (sku: string) => void,
  isRapidScan: boolean = false
): Promise<void> => {
  if (!input) return;

  // Handle rapid scanning
  const now = Date.now();
  if (isRapidScan && now - lastScanTime < SCAN_TIMEOUT) {
    scanBuffer += input;
    lastScanTime = now;
    return;
  }

  // Process complete scan
  const finalInput = isRapidScan ? scanBuffer + input : input;
  scanBuffer = '';
  lastScanTime = now;

  // Clean the input
  const cleanSku = finalInput.trim().toUpperCase();

  try {
    // Check cache first
    const cachedProduct = productCache.get(cleanSku);
    if (cachedProduct) {
      if (cachedProduct.stockLevel <= 0) {
        playBeep(false);
        speakMessage(`${cachedProduct.name} is out of stock`);
        alert(`Cannot add more ${cachedProduct.name}. Stock limit reached!`);
        return;
      }
      addProduct(cachedProduct);
      setScannedSku('');
      playBeep(true);
      return;
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('sku', cleanSku.replace(/\s+/g, ''))
      .maybeSingle();

    if (error) {
      console.error('Error processing SKU:', error);
      playBeep(false);
      alert('Error scanning product. Please try again.');
      return;
    }

    if (!data) {
      console.error('Product not found:', cleanSku);
      playBeep(false);
      alert(`Product not found: ${cleanSku}`);
      return;
    }

    const product: Product = {
      id: data.id,
      name: data.name,
      description: data.description || '',
      manufacturer: data.manufacturer,
      sku: data.sku,
      buyPrice: Number(data.buy_price),
      wholesalePrice: Number(data.wholesale_price),
      retailPrice: Number(data.retail_price),
      stockLevel: Number(data.stock_level),
      category: data.category,
      imageUrl: data.image_url || '',
      qrCode: data.qr_code || '',
      code128: data.code128 || '',
      cipher: data.cipher || '',
      additionalInfo: data.additional_info || ''
    };

    if (product.stockLevel <= 0) {
      playBeep(false);
      speakMessage(`${product.name} is out of stock`);
      alert(`Cannot add more ${product.name}. Stock limit reached!`);
      return;
    }

    // Cache the product
    productCache.set(cleanSku, product);

    // Reset scan state
    scanBuffer = '';
    lastScanTime = 0;

    addProduct(product);
    setScannedSku('');
    playBeep(true);
  } catch (error) {
    console.error('Error processing SKU:', error);
    playBeep(false);
    scanBuffer = '';
    lastScanTime = 0;
    alert('Error scanning product. Please try again.');
  }
};
