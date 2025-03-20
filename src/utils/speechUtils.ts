// Cache for available voices
let availableVoices: SpeechSynthesisVoice[] = [];
let currentUtterance: SpeechSynthesisUtterance | null = null;

// Speed presets
export const SPEED_PRESETS = {
  'very-slow': 0.5,
  'slow': 0.8,
  'normal': 1.0,
  'fast': 1.2,
  'very-fast': 1.5
};

// Initialize speech synthesis
let selectedVoice: SpeechSynthesisVoice | null = null;
let selectedSpeed = 1.0;
let isSpeechEnabled = localStorage.getItem('speechEnabled') !== 'false';
let notificationQueue: string[] = [];
let isProcessingQueue = false;

// Template strings
export const TEMPLATES = {
  CALL_REMINDER_HINDI: '{{staff.name}}, आपकी कॉल {{customer.name}} के साथ {{time}} मिनट में है। तैयार हो जाइए!',
  CALL_REMINDER_HINGLISH: '{{staff.name}}, aapki call {{customer.name}} ke saath {{time}} minute mein hai! Ready ho jaiye!',
  CALL_REMINDER_ENGLISH: '{{staff.name}}, your call with {{customer.name}} is in {{time}} minutes. Please get ready!',
  CALL_STARTED: '{{staff.name}}, {{customer.name}} is waiting in the video call.',
  CALL_COMPLETED: 'Video call with {{customer.name}} has been completed successfully.'
};

// Function to process template
const processTemplate = (template: string, data: Record<string, any>): string => {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const keys = key.trim().split('.');
    let value = data;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || match;
  });
};

// Hindi voice identifiers in order of preference
const HINDI_VOICES = [
  { name: 'Microsoft Swara', lang: 'hi-IN' },
  { name: 'Microsoft Madhur', lang: 'hi-IN' },
  { name: 'Microsoft Kalpana', lang: 'hi-IN' },
  { name: 'Microsoft Hemant', lang: 'hi-IN' },
  { name: 'Google हिन्दी', lang: 'hi-IN' },
  { name: 'Hindi India', lang: 'hi-IN' }
];

// Function to get available voices
export const getAvailableVoices = async (): Promise<SpeechSynthesisVoice[]> => {
  // Check if speech synthesis is supported
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('Speech synthesis not supported');
    return [];
  }

  return new Promise((resolve) => {
    // If we already have voices cached, return them
    if (availableVoices.length > 0) {
      resolve(availableVoices);
      return;
    }

    // Try to get voices immediately
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      availableVoices = voices;
      resolve(voices);
      return;
    }

    // If no voices available yet, wait for them to load
    const timeoutId = setTimeout(() => {
      // If voices haven't loaded after timeout, return empty array
      if (availableVoices.length === 0) {
        console.warn('No voices loaded after timeout');
        resolve([]);
      }
    }, 3000);

    // Listen for voices to be loaded
    window.speechSynthesis.onvoiceschanged = () => {
      clearTimeout(timeoutId);
      const newVoices = window.speechSynthesis.getVoices();
      availableVoices = newVoices;
      resolve(newVoices);
    };
  });
};

// Function to add notification to queue
const addToNotificationQueue = (message: string) => {
  notificationQueue.push(message);
  if (!isProcessingQueue) {
    processNotificationQueue();
  }
};

// Function to process notification queue
const processNotificationQueue = async () => {
  if (notificationQueue.length === 0) {
    isProcessingQueue = false;
    return;
  }

  isProcessingQueue = true;
  const message = notificationQueue[0];

  try {
    await new Promise<void>((resolve) => {
      speak(message, () => {
        setTimeout(resolve, 2000); // 2 second delay between notifications
      });
    });

    notificationQueue.shift(); // Remove processed message
    
    if (notificationQueue.length > 0) {
      processNotificationQueue();
    } else {
      isProcessingQueue = false;
    }
  } catch (error) {
    console.error('Error processing notification:', error);
    isProcessingQueue = false;
  }
};

// Function to set language and voice
export const setLanguage = (language: string, voiceURI?: string) => {
  if (!window.speechSynthesis) return;
  
  const voices = window.speechSynthesis.getVoices();
  
  if (voiceURI) {
    selectedVoice = voices.find(voice => voice.voiceURI === voiceURI) || null;
  } else {
    selectedVoice = voices.find(voice => voice.lang === language) || null;
  }

  // Log voice selection for debugging
  if (selectedVoice) {
    console.log('Selected voice:', {
      name: selectedVoice.name,
      lang: selectedVoice.lang,
      voiceURI: selectedVoice.voiceURI
    });
  } else {
    console.warn('No matching voice found for:', { language, voiceURI });
  }
};

// Function to set speech speed
export const setSpeed = (speed: number) => {
  selectedSpeed = Math.max(0.1, Math.min(2, speed));
};

// Function to get selected speed
export const getSelectedSpeed = () => selectedSpeed;

// Function to toggle speech
export const toggleSpeech = (enabled: boolean) => {
  isSpeechEnabled = enabled;
  localStorage.setItem('speechEnabled', enabled.toString());
  if (!enabled && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};

// Function to speak text with improved error handling
export const speak = (text: string, onEnd?: () => void) => {
  if (!isSpeechEnabled || !text || !window.speechSynthesis) {
    console.warn('Speech synthesis unavailable or disabled', {
      isSpeechEnabled,
      hasText: !!text,
      hasSpeechSynthesis: !!window.speechSynthesis
    });
    onEnd?.();
    return;
  }

  try {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    if (currentUtterance) {
      currentUtterance = null;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Initialize voices if needed
    if (!selectedVoice) {
      const voices = window.speechSynthesis.getVoices();
      
      // Log available voices for debugging
      console.log('Available voices:', voices.map(v => ({
        name: v.name,
        lang: v.lang,
        voiceURI: v.voiceURI
      })));

      // Try to find preferred Hindi voices
      for (const preferredVoice of HINDI_VOICES) {
        const voice = voices.find(v => 
          v.name.includes(preferredVoice.name) && 
          v.lang === preferredVoice.lang
        );
        if (voice) {
          selectedVoice = voice;
          console.log('Selected preferred Hindi voice:', voice.name);
          break;
        }
      }

      // Fallback chain if no preferred voice found
      if (!selectedVoice) {
        selectedVoice = 
          // Try any Hindi voice
          voices.find(v => v.lang.startsWith('hi')) ||
          // Try Indian English
          voices.find(v => v.lang === 'en-IN') ||
          // Try any English voice
          voices.find(v => v.lang.startsWith('en')) ||
          // Last resort: first available voice
          voices[0];

        if (selectedVoice) {
          console.log('Selected fallback voice:', selectedVoice.name);
        }
      }
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    }

    utterance.rate = selectedSpeed;
    // Adjust pitch based on voice type
    utterance.pitch = HINDI_VOICES.some(v => 
      selectedVoice?.name.includes(v.name) && 
      selectedVoice?.lang === v.lang
    ) ? 1.0 : 1.2;
    utterance.volume = 0.8;

    // Add error handling
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      currentUtterance = null;
      onEnd?.();
    };

    utterance.onend = () => {
      currentUtterance = null;
      onEnd?.();
    };

    // Log speech attempt
    console.log('Speaking:', {
      text,
      voice: selectedVoice?.name,
      lang: utterance.lang,
      rate: utterance.rate
    });

    // Store current utterance
    currentUtterance = utterance;

    // Speak with a small delay to ensure proper initialization
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error('Error starting speech:', error);
        currentUtterance = null;
        onEnd?.();
      }
    }, 100);

  } catch (error) {
    console.error('Error speaking text:', error);
    currentUtterance = null;
    onEnd?.();
  }
};

// Function to schedule call reminders
export const scheduleCallReminders = (callData: {
  staff: { name: string },
  customer: { name: string },
  scheduledAt: Date
}) => {
  const timeUntilCall = callData.scheduledAt.getTime() - Date.now();
  const minutesUntilCall = Math.floor(timeUntilCall / (1000 * 60));

  // Schedule reminders at 5, 3, and 1 minute marks
  [5, 3, 1].forEach(minutes => {
    if (minutesUntilCall <= minutes) return;

    setTimeout(() => {
      const message = processTemplate(TEMPLATES.CALL_REMINDER_HINGLISH, {
        staff: callData.staff,
        customer: callData.customer,
        time: minutes
      });
      addToNotificationQueue(message);
    }, timeUntilCall - (minutes * 60 * 1000));
  });
};

// Function to get voice display name
export const getVoiceDisplayName = (voice: SpeechSynthesisVoice): string => {
  const voiceIndex = HINDI_VOICES.findIndex(v => 
    voice.name.includes(v.name) && 
    voice.lang === v.lang
  );
  const isHindi = voice.lang.startsWith('hi');
  let label = '';
  
  if (voiceIndex === 0) label = ' - Recommended';
  else if (voiceIndex > 0) label = ' - Hindi';
  else if (isHindi) label = ' - Hindi (Generic)';
  
  return `${voice.name} (${voice.lang})${label}`;
};

// Function to check speech synthesis support
export const isSpeechSynthesisSupported = (): boolean => {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
};

// Function to initialize speech synthesis
export const initSpeechSynthesis = async (): Promise<boolean> => {
  try {
    if (!isSpeechSynthesisSupported()) {
      console.warn('Speech synthesis not supported');
      return false;
    }

    const voices = await getAvailableVoices();
    
    // Log available voices
    console.log('Available voices:', voices.map(v => ({
      name: v.name,
      lang: v.lang,
      default: v.default
    })));
    
    return voices.length > 0;
  } catch (error) {
    console.error('Error initializing speech synthesis:', error);
    return false;
  }
};
