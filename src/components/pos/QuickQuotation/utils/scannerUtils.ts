import { supabase } from '../../../../lib/supabase';
import type { Product } from '../../../../types';

// Cache for recently scanned products
const productCache = new Map<string, Product>();

// Clear cache after 5 minutes
setInterval(() => productCache.clear(), 5 * 60 * 1000);

// Success and error sounds
const BEEP_SUCCESS = new Audio('data:audio/wav;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAGDgYtAgAyN+QWaAAihwMWm4G8QQRDiMcCBcH3Cc+CDv/7xA4Tvh9Rz/y8QADBwMWgQAZG/ILNAARQ4GLTcDeIIIhxGOBAuD7hOfBB3/94gcJ3w+o5/5eIAIAAAVwWgQAVQ2ORaIQwEMAJiDg95G4nQL7mQVWI6GwRcfsZAcsKkJvxgxEjzFUgfHoSQ9Qq7KNwqHwuB13MA4a1q/DmBrHgPcmjiGoh//EwC5nGPEmS4RcfkVKOhJf+WOgoxJclFz3kgn//dBA+ya1GhurNn8zb//9NNutNuhz31f////9vt///z+IdAEAAAK4LQIAKobHItEIYCGAExBwe8jcToF9zIKrEdDYIuP2MgOWFSE34wYiR5iqQPj0JIeoVdlG4VD4XA67mAcNa1fhzA1jwHuTRxDUQ//iYBczjHiTJcIuPyKlHQkv/LHQUYkuSi57yQT//uggfZNajQ3Vmz+Zt//+mm3Wm3Q576v////+32///5/EOgAAADVghQAAAAA==');
const BEEP_ERROR = new Audio('data:audio/wav;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAGDgYtAgAyN+QWaAAihwMWm4G8QQRDiMcCBcH3Cc+CDv/7xA4Tvh9Rz/y8QADBwMWgQAZG/ILNAARQ4GLTcDeIIIhxGOBAuD7hOfBB3/94gcJ3w+o5/5eIAIAAAVwWgQAVQ2ORaIQwEMAJiDg95G4nQL7mQVWI6GwRcfsZAcsKkJvxgxEjzFUgfHoSQ9Qq7KNwqHwuB13MA4a1q/DmBrHgPcmjiGoh//EwC5nGPEmS4RcfkVKOhJf+WOgoxJclFz3kgn//dBA+ya1GhurNn8zb//9NNutNuhz31f////9vt///z+IdAEAAAK4LQIAKobHItEIYCGAExBwe8jcToF9zIKrEdDYIuP2MgOWFSE34wYiR5iqQPj0JIeoVdlG4VD4XA67mAcNa1fhzA1jwHuTRxDUQ//iYBczjHiTJcIuPyKlHQkv/LHQUYkuSi57yQT//uggfZNajQ3Vmz+Zt//+mm3Wm3Q576v////+32///5/EOgAAADVghQAAAAA==');

export const processScannedSku = async (
  input: string,
  addProduct: (product: Product) => void,
  setScannedSku: (sku: string) => void
) => {
  if (!input) return;

  // Clean the input
  const cleanSku = input.trim().toUpperCase();

  // Check cache first
  const cachedProduct = productCache.get(cleanSku);
  if (cachedProduct) {
    if (cachedProduct.stockLevel <= 0) {
      BEEP_ERROR.play();
      alert(`Cannot add more ${cachedProduct.name}. Stock limit reached!`);
      return;
    }
    addProduct(cachedProduct);
    setScannedSku('');
    BEEP_SUCCESS.play();
    return;
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('sku', cleanSku)
      .single();

    if (error) throw error;
    if (!data) {
      console.error('Product not found:', cleanSku);
      BEEP_ERROR.play();
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
      BEEP_ERROR.play();
      alert(`Cannot add more ${product.name}. Stock limit reached!`);
      return;
    }

    // Cache the product
    productCache.set(cleanSku, product);

    addProduct(product);
    setScannedSku('');
    BEEP_SUCCESS.play();
  } catch (error) {
    console.error('Error processing SKU:', error);
    BEEP_ERROR.play();
    alert('Error scanning product. Please try again.');
  }
};
