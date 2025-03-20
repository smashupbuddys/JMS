import { getCountryByCode } from './countryUtils';

export function getCountryCode(country: string): string {
  const codes: Record<string, string> = {
    'IN': '91',
    'US': '1',
    'GB': '44',
    'AE': '971',
    'SG': '65'
  };
  return codes[country] || '91';
}

export function formatPhoneNumber(phone: string): string {
  // If phone is empty or undefined, return empty string
  if (!phone) {
    return '';
  }

  if (phone.startsWith('+')) {
    // Get country code and remaining digits
    const match = phone.match(/^\+(\d{1,3})\s*(\d+)$/);
    if (match) {
      const [_, countryCode, number] = match;
      const lastFour = number.slice(-4);
      const maskedLength = number.length - 4;
      return `+${countryCode} XXXX ${lastFour}`;
    }
  }

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // For Indian numbers (default)
  if (digits.length === 10) {
    return `+91 XXXX ${digits.slice(-4)}`;
  }

  // For other numbers, just add + prefix
  const lastFour = digits.slice(-4);
  const maskedLength = digits.length - 4;
  return `+XX XXXX ${lastFour}`;
}

export function searchPhoneNumber(phone: string, searchTerm: string): boolean {
  const phoneDigits = phone.replace(/\D/g, '');
  const searchDigits = searchTerm.replace(/\D/g, '');
  
  // Only search in the last 4 digits
  const lastFourDigits = phoneDigits.slice(-4);
  return lastFourDigits.includes(searchDigits);
}
