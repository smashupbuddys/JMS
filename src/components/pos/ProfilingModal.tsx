import React from 'react';
import { X } from 'lucide-react';
import type { Customer } from '../../types';
import { supabase } from '../../lib/supabase';

interface ProfilingModalProps {
  customer: Customer;
  onClose: () => void;
}

const PROFILING_QUESTIONS = [
  {
    id: 'purpose',
    question: 'What is the primary purpose of your purchase?',
    options: ['Personal Use', 'Gift', 'Investment', 'Special Occasion', 'Business']
  },
  {
    id: 'style',
    question: 'What jewelry style do you prefer?',
    options: ['Classic', 'Modern', 'Vintage', 'Minimalist', 'Statement']
  },
  {
    id: 'metal',
    question: 'Which metal type do you prefer?',
    options: ['Yellow Gold', 'White Gold', 'Rose Gold', 'Platinum', 'Silver']
  },
  {
    id: 'budget',
    question: 'What is your typical budget range for jewelry?',
    options: ['Under ₹10,000', '₹10,000-50,000', '₹50,000-1,00,000', 'Above ₹1,00,000']
  },
  {
    id: 'frequency',
    question: 'How often do you purchase jewelry?',
    options: ['Monthly', 'Quarterly', 'Yearly', 'Only on Special Occasions']
  }
];

const ProfilingModal: React.FC<ProfilingModalProps> = ({ customer, onClose }) => {
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [currentQuestion, setCurrentQuestion] = React.useState(0);

  const handleAnswer = (answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [PROFILING_QUESTIONS[currentQuestion].id]: answer
    }));

    if (currentQuestion < PROFILING_QUESTIONS.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      saveAnswers();
    }
  };

  const saveAnswers = async () => {
    try {
      const deviceId = await getDeviceId();
      
      const { error } = await supabase
        .from('customers')
        .update({
          preferences: {
            ...customer.preferences,
            profiling: answers,
            profiled: true,
            deviceId,
            lastProfilingAttempt: new Date().toISOString()
          }
        })
        .eq('id', customer.id);

      if (error) throw error;
      onClose();
    } catch (error) {
      console.error('Error saving profiling answers:', error);
      alert('Failed to save answers. Please try again.');
    }
  };

  const getDeviceId = async () => {
    // In a real app, you would use a more robust device fingerprinting solution
    const nav = window.navigator;
    const screen = window.screen;
    const fingerprint = [
      nav.userAgent,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset()
    ].join('|');
    
    // Hash the fingerprint (in a real app, use a proper hashing function)
    return btoa(fingerprint);
  };

  const currentQ = PROFILING_QUESTIONS[currentQuestion];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Customer Profiling</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>Question {currentQuestion + 1} of {PROFILING_QUESTIONS.length}</span>
              <span>{Math.round(((currentQuestion + 1) / PROFILING_QUESTIONS.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestion + 1) / PROFILING_QUESTIONS.length) * 100}%` }}
              />
            </div>
          </div>

          <h3 className="text-lg font-medium mb-4">{currentQ.question}</h3>

          <div className="space-y-3">
            {currentQ.options.map((option) => (
              <button
                key={option}
                onClick={() => handleAnswer(option)}
                className="w-full text-left p-4 rounded-lg border hover:border-blue-500 hover:bg-blue-50
                         transition-colors duration-200"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilingModal;
