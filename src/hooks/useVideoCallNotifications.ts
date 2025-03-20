import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { speak, toggleSpeech, scheduleCallReminders } from '../utils/speechUtils';
import { fetchWithRetry } from '../lib/supabase';
import { useToast } from './useToast';
import { playNotificationSound } from '../utils/soundUtils';

export const useVideoCallNotifications = () => {
  const checkInterval = useRef<NodeJS.Timeout>();
  const lastNotifiedCalls = useRef<Set<string>>(new Set());
  const retryCount = useRef<number>(0);
  const { addToast } = useToast();
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second
  const notificationSettings = useRef(JSON.parse(localStorage.getItem('notificationSettings') || '{"sound": true, "speech": true}'));

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window) {
      Notification.requestPermission();
    }

    // Start checking for upcoming calls
    startNotificationCheck();

    return () => {
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
    };
  }, []);

  const toggleNotificationSetting = (setting: 'sound' | 'speech') => {
    notificationSettings.current = {
      ...notificationSettings.current,
      [setting]: !notificationSettings.current[setting]
    };
    localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings.current));
    
    if (setting === 'speech') {
      toggleSpeech(notificationSettings.current.speech);
    }
  };

  const startNotificationCheck = () => {
    // Check immediately
    checkUpcomingCalls();
    
    // Then check every minute
    checkInterval.current = setInterval(checkUpcomingCalls, 60 * 1000);
  };

  const checkUpcomingCalls = async () => {
    try {
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      const { data: upcomingCalls, error } = await fetchWithRetry(() => supabase 
        .from('video_calls')
        .select(`
          *,
          customers (
            name,
            phone
          ),
          staff (
            name,
            notification_preferences
          )
        `)
        .eq('status', 'scheduled')
        .gte('scheduled_at', now.toISOString())
        .lte('scheduled_at', fiveMinutesFromNow.toISOString())
      );

      if (error) throw error;

      // Send notification for each upcoming call
      upcomingCalls?.forEach(async call => {
        const timeUntilCall = new Date(call.scheduled_at).getTime() - now.getTime();
        const minutesUntilCall = Math.floor(timeUntilCall / (1000 * 60));

        // Only notify at 5 minutes if not already notified
        if (minutesUntilCall <= 5 && !lastNotifiedCalls.current.has(call.id)) {
          lastNotifiedCalls.current.add(call.id);
          await showNotification(call);
          
          // Play sound if enabled
          if (notificationSettings.current.sound) {
            playNotificationSound();
          }

          // Schedule voice reminders if enabled
          if (notificationSettings.current.speech) {
            scheduleCallReminders({
              staff: { name: call.staff?.name || 'Staff' },
              customer: { name: call.customers?.name || 'Customer' },
              scheduledAt: new Date(call.scheduled_at)
            });
          }

          // Remove from notified set after 10 minutes
          setTimeout(() => {
            lastNotifiedCalls.current.delete(call.id);
          }, 10 * 60 * 1000);
        }
      });

      // Reset retry count on success
      retryCount.current = 0;

    } catch (error) {
      console.error('Error checking upcoming calls:', error);
      
      // Don't retry immediately - wait for next interval
      retryCount.current = 0;
    }
  };

  const showNotification = (call: any) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const scheduledTime = format(new Date(call.scheduled_at), 'h:mm a');
    const timeUntilCall = new Date(call.scheduled_at).getTime() - new Date().getTime();
    const minutesUntilCall = Math.floor(timeUntilCall / (1000 * 60));
    
    const title = `🎥 Upcoming Video Call in ${minutesUntilCall} minutes`;
    const body = `Video call with ${call.customers.name} scheduled for ${scheduledTime}.\n` +
                 `Call Number: ${call.video_call_number}\n` +
                 `Assigned Staff: ${call.staff?.name}\n` +
                 `Please be ready for the call.`;

    // Show toast notification
    addToast({
      title,
      message: body,
      type: 'info',
      duration: 10000 // 10 seconds
    });

    // Create and show notification
    const notification = new Notification(title, {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: `video-call-${call.id}`, // Prevent duplicate notifications
      renotify: true,
      requireInteraction: true, // Keep notification until user interacts
      silent: !notificationSettings.current.sound // Respect sound setting
    });

    // Handle notification click
    notification.onclick = () => {
      window.focus();
      window.location.href = `/video-calls/${call.id}`;
    };

    // Also send to WhatsApp if staff has WhatsApp integration enabled
    sendWhatsAppNotification(call);
  };

  const sendWhatsAppNotification = async (call: any) => {
    try {
      const staffId = localStorage.getItem('staffId');
      if (!staffId || staffId === 'undefined') return;

      const { data: staff } = await fetchWithRetry(() => supabase
        .from('staff')
        .select('*')
        .eq('id', staffId)
      );

      if (!staff || staff.length === 0) {
        console.warn('Staff member not found:', staffId);
        return;
      }

      const staffMember = staff[0];
      if (!staffMember.phone || !staffMember.notification_preferences?.whatsapp_enabled) {
        return;
      }

      const message = `🎥 Upcoming Video Call in 5 minutes!\n\n` +
                     `Customer: ${call.customers.name}\n` +
                     `Time: ${format(new Date(call.scheduled_at), 'h:mm a')}\n` +
                     `Call #: ${call.video_call_number}`;

      // Open WhatsApp with pre-filled message
      const whatsappUrl = `https://wa.me/${staffMember.phone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');

    } catch (error) {
      // Log error but don't throw - notifications should fail gracefully
      console.warn('Error sending WhatsApp notification:', error);
    }
  };

  return {
    toggleNotificationSetting,
    notificationSettings: notificationSettings.current
  };
};
