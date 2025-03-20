import { getTimeZones } from 'date-fns-tz';
import {
  GB as GBFlag,
  US as USFlag,
  IN as INFlag,
  AU as AUFlag,
  CA as CAFlag,
  DE as DEFlag,
  FR as FRFlag,
  JP as JPFlag,
  SG as SGFlag,
  AE as AEFlag,
  CN as CNFlag,
  HK as HKFlag,
  NZ as NZFlag,
  IE as IEFlag,
  IT as ITFlag,
  ES as ESFlag,
  NL as NLFlag,
  SE as SEFlag,
  CH as CHFlag
} from 'country-flag-icons/react/3x2';

export interface Country {
  code: string;
  name: string;
  flag: any;
  timezone: string;
  phoneCode: string;
}

export const COUNTRIES: Country[] = [
  {
    code: 'AE',
    name: 'United Arab Emirates',
    flag: AEFlag,
    timezone: 'Asia/Dubai',
    phoneCode: '+971'
  },
  {
    code: 'AU',
    name: 'Australia',
    flag: AUFlag,
    timezone: 'Australia/Sydney',
    phoneCode: '+61'
  },
  {
    code: 'CA',
    name: 'Canada',
    flag: CAFlag,
    timezone: 'America/Toronto',
    phoneCode: '+1'
  },
  {
    code: 'CH',
    name: 'Switzerland',
    flag: CHFlag,
    timezone: 'Europe/Zurich',
    phoneCode: '+41'
  },
  {
    code: 'CN',
    name: 'China',
    flag: CNFlag,
    timezone: 'Asia/Shanghai',
    phoneCode: '+86'
  },
  {
    code: 'DE',
    name: 'Germany',
    flag: DEFlag,
    timezone: 'Europe/Berlin',
    phoneCode: '+49'
  },
  {
    code: 'ES',
    name: 'Spain',
    flag: ESFlag,
    timezone: 'Europe/Madrid',
    phoneCode: '+34'
  },
  {
    code: 'FR',
    name: 'France',
    flag: FRFlag,
    timezone: 'Europe/Paris',
    phoneCode: '+33'
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: GBFlag,
    timezone: 'Europe/London',
    phoneCode: '+44'
  },
  {
    code: 'HK',
    name: 'Hong Kong',
    flag: HKFlag,
    timezone: 'Asia/Hong_Kong',
    phoneCode: '+852'
  },
  {
    code: 'IE',
    name: 'Ireland',
    flag: IEFlag,
    timezone: 'Europe/Dublin',
    phoneCode: '+353'
  },
  {
    code: 'IN',
    name: 'India',
    flag: INFlag,
    timezone: 'Asia/Kolkata',
    phoneCode: '+91'
  },
  {
    code: 'IT',
    name: 'Italy',
    flag: ITFlag,
    timezone: 'Europe/Rome',
    phoneCode: '+39'
  },
  {
    code: 'JP',
    name: 'Japan',
    flag: JPFlag,
    timezone: 'Asia/Tokyo',
    phoneCode: '+81'
  },
  {
    code: 'NL',
    name: 'Netherlands',
    flag: NLFlag,
    timezone: 'Europe/Amsterdam',
    phoneCode: '+31'
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    flag: NZFlag,
    timezone: 'Pacific/Auckland',
    phoneCode: '+64'
  },
  {
    code: 'SE',
    name: 'Sweden',
    flag: SEFlag,
    timezone: 'Europe/Stockholm',
    phoneCode: '+46'
  },
  {
    code: 'SG',
    name: 'Singapore',
    flag: SGFlag,
    timezone: 'Asia/Singapore',
    phoneCode: '+65'
  },
  {
    code: 'US',
    name: 'United States',
    flag: USFlag,
    timezone: 'America/New_York',
    phoneCode: '+1'
  }
].sort((a, b) => a.name.localeCompare(b.name));

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find(country => country.code === code);
}

export function getCountryByPhone(phone: string): Country | undefined {
  return COUNTRIES.find(country => phone.startsWith(country.phoneCode));
}

export function formatPhoneForCountry(phone: string, countryCode: string): string {
  const country = getCountryByCode(countryCode);
  if (!country) return phone;
  
  // Remove any non-digit characters from the phone number
  const cleanPhone = phone.replace(/\D/g, '');
  
  // If the phone number already includes the country code, return it as is
  if (cleanPhone.startsWith(country.phoneCode.replace('+', ''))) {
    return `+${cleanPhone}`;
  }
  
  // Add the country code if it's not present
  return `${country.phoneCode}${cleanPhone}`;
}
