import React, { useState, useEffect } from 'react';
import { Volume2, Globe } from 'lucide-react';
import { getAvailableVoices, setLanguage, getVoiceDisplayName } from '../../utils/speechUtils';

interface VoiceSettingsProps {
  onVoiceChange: (voiceURI: string) => void;
  onLanguageChange: (language: string) => void;
  currentVoice?: string;
  currentLanguage?: string;
}

const VoiceSettings: React.FC<VoiceSettingsProps> = ({
  onVoiceChange,
  onLanguageChange,
  currentVoice,
  currentLanguage = 'hi-IN'
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState(currentVoice);
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVoices = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check browser support
        if (!window.speechSynthesis) {
          throw new Error('Speech synthesis not supported in this browser');
        }

        const availableVoices = await getAvailableVoices();
        
        if (!Array.isArray(availableVoices) || availableVoices.length === 0) {
          throw new Error('No voices available. Please check your browser settings.');
        }

        setVoices(availableVoices);

        // Set default voice if none selected
        if (!selectedVoice && availableVoices.length > 0) {
          const defaultVoice = availableVoices.find(v => v.lang === selectedLanguage) || availableVoices[0];
          setSelectedVoice(defaultVoice.voiceURI);
          onVoiceChange(defaultVoice.voiceURI);
        }
      } catch (error) {
        console.error('Error loading voices:', error);
        setError(error instanceof Error ? error.message : 'Failed to load voices');
        setVoices([]); // Ensure voices is always an array
      } finally {
        setLoading(false);
      }
    };

    loadVoices();
  }, [selectedLanguage, onVoiceChange]);

  const handleVoiceChange = (voiceURI: string) => {
    setSelectedVoice(voiceURI);
    onVoiceChange(voiceURI);

    // Update language based on selected voice
    const voice = voices.find(v => v.voiceURI === voiceURI);
    if (voice) {
      setSelectedLanguage(voice.lang);
      onLanguageChange(voice.lang);
      setLanguage(voice.lang, voiceURI);
    }
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    onLanguageChange(language);

    // Find and set appropriate voice for language
    const voice = voices.find(v => v.lang === language);
    if (voice) {
      setSelectedVoice(voice.voiceURI);
      onVoiceChange(voice.voiceURI);
      setLanguage(language, voice.voiceURI);
    }
  };

  if (!window.speechSynthesis) {
    return (
      <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 p-4 rounded-lg">
        Speech synthesis is not supported in your browser. Voice features will be disabled.
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2">
        <Volume2 className="h-5 w-5 text-gray-500" />
        <select
          value={selectedVoice}
          onChange={(e) => handleVoiceChange(e.target.value)}
          className="input text-sm"
          disabled={loading}
        >
          {loading ? (
            <option>Loading voices...</option>
          ) : voices.length === 0 ? (
            <option>No voices available</option>
          ) : (
            voices.map(voice => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {getVoiceDisplayName(voice)}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-gray-500" />
        <select
          value={selectedLanguage}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="input text-sm"
          disabled={loading}
        >
          <option value="hi-IN">Hindi (India)</option>
          <option value="en-IN">English (India)</option>
          <option value="en-US">English (US)</option>
        </select>
      </div>
    </div>
  );
};

export default VoiceSettings;
