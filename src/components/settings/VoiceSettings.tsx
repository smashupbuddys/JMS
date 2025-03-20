import React, { useState, useEffect } from 'react';
import { Volume2, Globe, Save, Play, X, Check, Plus, Edit2, Trash2, MessageSquare, FastForward, Rewind } from 'lucide-react';
import { 
  getAvailableVoices, 
  speak, 
  setLanguage, 
  getVoiceDisplayName, 
  setSpeed,
  getSelectedSpeed,
  SPEED_PRESETS,
  TEMPLATES
} from '../../utils/speechUtils';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';

interface Template {
  id: string;
  name: string;
  text: string;
  language: string;
}

const VoiceSettings = () => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState('hi-IN');
  const [testMessage, setTestMessage] = useState(() => {
    const lang = localStorage.getItem('selectedLanguage') || 'hi-IN';
    return lang === 'hi-IN' ? 'नमस्ते! यह एक टेस्ट मैसेज है।' :
           lang === 'en-IN' ? 'Hello! This is a test message in Indian English.' :
           'Hello! This is a test message.';
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedSpeed, setSelectedSpeed] = useState(getSelectedSpeed());
  const [templates, setTemplates] = useState<Template[]>([
    {
      id: '1',
      name: 'Call Reminder (Hindi)',
      text: TEMPLATES.CALL_REMINDER_HINDI,
      language: 'hi-IN'
    },
    {
      id: '2', 
      name: 'Call Reminder (Hinglish)',
      text: TEMPLATES.CALL_REMINDER_HINGLISH,
      language: 'hi-IN'
    },
    {
      id: '3',
      name: 'Call Reminder (English)',
      text: TEMPLATES.CALL_REMINDER_ENGLISH,
      language: 'en-IN'
    }
  ]);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    // Load voice settings and templates
    loadVoiceSettings();
    loadTemplates();
  }, []);

  const loadVoiceSettings = async () => {
    const loadVoices = async () => {
      try {
        // Check browser support first
        if (!window.speechSynthesis) {
          throw new Error('Speech synthesis not supported in this browser');
        }
  
        setLoading(true);
        const availableVoices = await getAvailableVoices();
        
        if (availableVoices.length === 0) {
          throw new Error('No voices available. Please check your browser settings.');
        }
  
        setVoices(availableVoices);
  
        // Get saved settings from Supabase
        const staffId = localStorage.getItem('staffId');
        if (staffId) {
          // Instead of using .single(), use .maybeSingle() which won't error if no record is found
          const { data: staff, error: staffError } = await supabase
            .from('staff')
            .select('notification_preferences')
            .eq('id', staffId)
            .maybeSingle();
  
          if (staffError) {
            console.warn('Error fetching staff settings:', staffError);
            // Continue with default settings instead of throwing
          }
  
          const voiceSettings = staff?.notification_preferences?.voice_settings;
          if (voiceSettings) {
            const voice = availableVoices.find(v => v.voiceURI === voiceSettings.voice);
            if (voice) {
              setSelectedVoice(voice.voiceURI);
              setSelectedLanguage(voice.lang);
              setSpeed(voiceSettings.speed || 1);
              setSelectedSpeed(voiceSettings.speed || 1);
            }
          } else {
            // No settings found or error occurred, set default voice
            const defaultVoice = availableVoices.find(v => v.lang === 'hi-IN') || availableVoices[0];
            setSelectedVoice(defaultVoice.voiceURI);
            setSelectedLanguage(defaultVoice.lang);
          }
        }
      } catch (error) {
        console.error('Error loading voices:', error);
        setError('Failed to load voice options. Please try again.');
      } finally {
        setLoading(false);
      }
    };
  
    loadVoices();
  };
  

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('voice_templates')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setTemplates(data);
      } else {
        // Insert default templates if none exist
        const defaultTemplates = [
          {
            name: 'Call Reminder (Hindi)',
            text: TEMPLATES.CALL_REMINDER_HINDI,
            language: 'hi-IN'
          },
          {
            name: 'Call Reminder (Hinglish)', 
            text: TEMPLATES.CALL_REMINDER_HINGLISH,
            language: 'hi-IN'
          },
          {
            name: 'Call Reminder (English)',
            text: TEMPLATES.CALL_REMINDER_ENGLISH,
            language: 'en-IN'
          }
        ];

        const { data: insertedTemplates, error: insertError } = await supabase
          .from('voice_templates')
          .insert(defaultTemplates)
          .select();

        if (insertError) throw insertError;
        setTemplates(insertedTemplates || []);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      addToast({
        title: 'Error',
        message: 'Failed to load voice templates',
        type: 'error'
      });
    }
  };

  const handleVoiceChange = (voiceURI: string) => {
    setSelectedVoice(voiceURI);
    const voice = voices.find(v => v.voiceURI === voiceURI);
    if (voice) {
      setSelectedLanguage(voice.lang);
      setLanguage(voice.lang, voiceURI);
      
      // Update test message based on language
      if (voice.lang.startsWith('hi')) {
        setTestMessage('नमस्ते! यह एक टेस्ट मैसेज है।');
      } else if (voice.lang === 'en-IN') {
        setTestMessage('Hello! This is a test message in Indian English.');
      } else {
        setTestMessage('Hello! This is a test message.');
      }
    }
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    const voice = voices.find(v => v.lang === language);
    if (voice) {
      setSelectedVoice(voice.voiceURI);
      setLanguage(language, voice.voiceURI);

      // Update test message based on language
      if (language.startsWith('hi')) {
        setTestMessage('नमस्ते! यह एक टेस्ट मैसेज है।');
      } else if (language === 'en-IN') {
        setTestMessage('Hello! This is a test message in Indian English.');
      } else {
        setTestMessage('Hello! This is a test message.');
      }
    }
  };

  const handleSpeedChange = (speed: number) => {
    setSelectedSpeed(speed);
    setSpeed(speed);
  };

  const handleTestVoice = () => {
    if (!window.speechSynthesis) {
      setError('Speech synthesis not supported in this browser');
      return;
    }
    speak(testMessage);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
  
      const staffId = localStorage.getItem('staffId');
      if (!staffId) {
        throw new Error('Staff ID not found');
      }
  
      // First check if the staff record exists
      const { data: existingStaff, error: checkError } = await supabase
        .from('staff')
        .select('id')
        .eq('id', staffId)
        .maybeSingle();
  
      if (checkError) {
        console.error('Error checking staff record:', checkError);
        throw new Error('Failed to verify staff record');
      }
  
      // The settings we want to save
      const voiceSettings = {
        voice: selectedVoice,
        language: selectedLanguage,
        speed: selectedSpeed
      };
  
      if (!existingStaff) {
        // Staff doesn't exist, create a new record
        const { error: insertError } = await supabase
          .from('staff')
          .insert([{
            id: staffId,
            notification_preferences: { voice_settings: voiceSettings }
          }]);
  
        if (insertError) {
          console.error('Error creating staff record:', insertError);
          throw insertError;
        }
      } else {
        // Staff exists, update the record
        const { error: updateError } = await supabase
          .from('staff')
          .update({
            notification_preferences: {
              voice_settings: voiceSettings
            }
          })
          .eq('id', staffId);
  
        if (updateError) throw updateError;
      }
  
      setSuccess(true);
      addToast({
        title: 'Success',
        message: 'Voice settings saved successfully',
        type: 'success'
      });
      setTimeout(() => setSuccess(false), 3000);
  
    } catch (error) {
      console.error('Error saving voice settings:', error);
      setError('Failed to save voice settings. Please try again.');
      addToast({
        title: 'Error',
        message: 'Failed to save voice settings',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!window.speechSynthesis) {
    return (
      <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 p-4 rounded-lg">
        Speech synthesis is not supported in your browser. Voice features will be disabled.
      </div>
    );
  }

  const handleSaveTemplate = async (formData: FormData) => {
    try {
      const templateData = {
        name: formData.get('name') as string,
        text: formData.get('text') as string,
        language: formData.get('language') as string
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from('voice_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('voice_templates')
          .insert([templateData]);

        if (error) throw error;
      }

      await loadTemplates();
      setShowTemplateForm(false);
      addToast({
        title: 'Success',
        message: `Template ${editingTemplate ? 'updated' : 'added'} successfully`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error saving template:', error);
      addToast({
        title: 'Error',
        message: 'Failed to save template',
        type: 'error'
      });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('voice_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      await loadTemplates();
      addToast({
        title: 'Success',
        message: 'Template deleted successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      addToast({
        title: 'Error',
        message: 'Failed to delete template',
        type: 'error'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Voice Settings Section */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
          Voice Settings
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleTestVoice}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Test Voice
          </button>
          <button 
            onClick={handleSave}
            className="btn btn-primary bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2"
            disabled={loading}
          >
            <Save className="h-4 w-4" />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <X className="h-5 w-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-100 text-green-600 p-4 rounded-lg flex items-center gap-2">
          <Check className="h-5 w-5" />
          Voice settings saved successfully!
        </div>
      )}

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100">
        <div className="p-6 space-y-6">
          {/* Voice Selection */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-blue-500" />
              Voice Selection
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Language
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="input"
                >
                  <option value="hi-IN">Hindi (India)</option>
                  <option value="en-IN">English (India)</option>
                  <option value="en-US">English (US)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voice
                </label>
                {loading ? (
                  <div className="text-sm text-gray-500">Loading voices...</div>
                ) : (
                  <select
                    value={selectedVoice}
                    onChange={(e) => handleVoiceChange(e.target.value)}
                    className="input"
                  >
                    {voices.map(voice => (
                      <option 
                        key={voice.voiceURI} 
                        value={voice.voiceURI}
                        className={voice.lang === selectedLanguage ? 'font-medium' : ''}
                      >
                        {getVoiceDisplayName(voice)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Voice Speed */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <FastForward className="h-5 w-5 text-blue-500" />
              Voice Speed
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Rewind className="h-4 w-4 text-gray-500" />
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={selectedSpeed}
                  onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <FastForward className="h-4 w-4 text-gray-500" />
              </div>
              
              <div className="flex justify-between">
                {Object.entries(SPEED_PRESETS).map(([name, speed]) => (
                  <button
                    key={name}
                    onClick={() => handleSpeedChange(speed)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      selectedSpeed === speed
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {name.replace('-', ' ')}
                  </button>
                ))}
              </div>
              
              <div className="text-sm text-gray-500 text-center">
                Current Speed: {selectedSpeed.toFixed(1)}x
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Templates Section */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100">
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              Voice Templates
            </h3>
            <button
              onClick={() => {
                setEditingTemplate(null);
                setShowTemplateForm(true);
              }}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Template
            </button>
          </div>

          <div className="space-y-4">
            {templates.map((template) => (
              <div 
                key={template.id}
                className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900">{template.name}</h4>
                    <p className="text-sm text-gray-500">{template.language}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        speak(template.text.replace(/\{\{[^}]+\}\}/g, 'placeholder'));
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Test Template"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingTemplate(template);
                        setShowTemplateForm(true);
                      }}
                      className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg"
                      title="Edit Template"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this template?')) {
                          handleDeleteTemplate(template.id);
                        }
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete Template"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <pre className="text-sm bg-white p-3 rounded border overflow-x-auto">
                  {template.text}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Template Form Modal */}
      {showTemplateForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingTemplate ? 'Edit Template' : 'Add New Template'}
              </h2>
              <button
                onClick={() => setShowTemplateForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleSaveTemplate(formData);
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="input w-full"
                  defaultValue={editingTemplate?.name}
                  placeholder="Enter template name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Language
                </label>
                <select
                  name="language"
                  required
                  className="input w-full"
                  defaultValue={editingTemplate?.language || selectedLanguage}
                >
                  <option value="hi-IN">Hindi (India)</option>
                  <option value="en-IN">English (India)</option>
                  <option value="en-US">English (US)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Text
                </label>
                <div className="mb-2 text-sm text-gray-500">
                  Available tags: {'{'}{'{'} staff.name {'}'}{'}'},
                  {'{'}{'{'} customer.name {'}'}{'}'},
                  {'{'}{'{'} time {'}'}{'}'},
                  {'{'}{'{'} date {'}'}{'}'},
                  {'{'}{'{'} duration {'}'}{'}'} 
                </div>
                <textarea
                  name="text"
                  required
                  rows={5}
                  className="input w-full font-mono"
                  defaultValue={editingTemplate?.text}
                  placeholder="Enter template text with placeholders..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTemplateForm(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  {editingTemplate ? 'Update Template' : 'Add Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Voice */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-500" />
          Test Voice
        </h3>
        
        <div className="space-y-2">
          <textarea
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            className="input w-full"
            rows={3}
            placeholder="Enter text to test voice..."
          />
          
          <button
            onClick={handleTestVoice}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Test Voice
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceSettings;
