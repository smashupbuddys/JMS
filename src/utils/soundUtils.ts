// Audio context for beep sounds
let audioContext: AudioContext | null = null;

// Initialize audio context
const initAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Function to play notification sound
export const playNotificationSound = () => {
  try {
    const context = initAudioContext();
    if (!context) return;

    // Create oscillator for notification sound
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    // Configure sound
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(587.33, context.currentTime); // D5
    gainNode.gain.setValueAtTime(0, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, context.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 1);

    // Play sound
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 1);
  } catch (error) {
    console.warn('Could not play notification sound:', error);
  }
};

// Function to play success beep
export const playSuccessBeep = () => {
  try {
    const context = initAudioContext();
    if (!context) return;

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    // Higher frequency for success
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, context.currentTime);
    gainNode.gain.setValueAtTime(0.1, context.currentTime);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.1);
  } catch (error) {
    console.warn('Could not play success beep:', error);
  }
};

// Function to play error beep
export const playErrorBeep = () => {
  try {
    const context = initAudioContext();
    if (!context) return;

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    // Lower frequency for error
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(200, context.currentTime);
    gainNode.gain.setValueAtTime(0.1, context.currentTime);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.1);
  } catch (error) {
    console.warn('Could not play error beep:', error);
  }
};

// Function to play cash register sound
export const playCashRegisterSound = () => {
  try {
    const context = initAudioContext();
    if (!context) return;

    // Create oscillator for cash register "cha-ching" sound
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    // Configure sound
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(800, context.currentTime);
    oscillator.frequency.setValueAtTime(600, context.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, context.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 0.2);

    // Play sound
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.2);
  } catch (error) {
    console.warn('Could not play cash register sound:', error);
  }
};