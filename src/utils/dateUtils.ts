import { Sun, Moon, Sunrise, Sunset } from 'lucide-react';
import { format, formatInTimeZone } from 'date-fns-tz';
import { enUS, addMinutes } from 'date-fns/locale';

export function getTimeOfDay(date: Date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return { icon: Sunrise, label: 'Morning', color: 'text-orange-500' };
  if (hour >= 12 && hour < 17) return { icon: Sun, label: 'Afternoon', color: 'text-yellow-500' };
  if (hour >= 17 && hour < 20) return { icon: Sunset, label: 'Evening', color: 'text-purple-500' };
  return { icon: Moon, label: 'Night', color: 'text-blue-500' };
}

export function formatDateTime(date: string | Date, timeZone: string = 'UTC') {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return {
    local: formatInTimeZone(dateObj, timeZone, 'PPpp', { locale: enUS }),
    utc: format(dateObj, 'PPpp (O)', { locale: enUS })
  };
}

export function getLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function isOverlapping(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && end1 > start2;
}

export function validateFutureTime(scheduledTime: Date, minMinutes: number = 5): {
  isValid: boolean;
  message?: string;
} {
  try {
    // Handle invalid date
    if (!(scheduledTime instanceof Date) || isNaN(scheduledTime.getTime())) {
      return {
        isValid: false,
        message: 'Invalid date format'
      };
    }

    const now = new Date();
    
    // Calculate time difference in minutes
    const diffInMinutes = (scheduledTime.getTime() - now.getTime()) / (1000 * 60);
    
    if (diffInMinutes < minMinutes) {
      const timeStr = format(new Date(now.getTime() + minMinutes * 60 * 1000), 'h:mm a');
      return {
        isValid: false,
        message: `Please select a time at least ${minMinutes} minutes from now (after ${timeStr})`
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Error validating future time:', error);
    return {
      isValid: false,
      message: 'Error validating scheduled time'
    };
  }
}
