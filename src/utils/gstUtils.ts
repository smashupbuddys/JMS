import { supabase } from '../lib/supabase';

export const getGSTRate = async (category?: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('gst_rates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    
    // Return the most recent GST rate
    return data?.[0]?.rate || 18;
  } catch (error) {
    console.error('Error fetching GST rate:', error);
    return 18; // Default to 18% in case of error
  }
};

// Cache GST rate for 5 minutes
let cachedGSTRate: number | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getCachedGSTRate = async (): Promise<number> => {
  const now = Date.now();
  
  // Return cached rate if valid
  if (cachedGSTRate !== null && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedGSTRate;
  }

  // Fetch fresh rate
  const rate = await getGSTRate();
  cachedGSTRate = rate;
  lastFetchTime = now;
  return rate;
};
