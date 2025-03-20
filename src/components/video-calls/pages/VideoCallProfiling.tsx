import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Loader2, AlertCircle, Save } from 'lucide-react';
import type { VideoCall } from '../../../types';

const PROFILING_QUESTIONS = [
  {
    id: 'purpose',
    question: 'What is the primary purpose of your purchase?',
    options: ['Personal Use', 'Gift', 'Investment', 'Special Occasion', 'Business']
  },
  {
    id: 'country',
    question: 'Which country are you from?',
    options: [
      'INDIA',
      'UNITED STATES',
      'UNITED KINGDOM',
      'UNITED ARAB EMIRATES',
      'SINGAPORE',
      'AUSTRALIA',
      'CANADA',
      'BRAZIL',
      'GERMANY',
      'FRANCE',
      'ITALY',
      'SPAIN',
      'JAPAN',
      'SOUTH KOREA',
      'MALAYSIA',
      'INDONESIA'
    ]
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

const VideoCallProfiling = () => {
  const { callId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [call, setCall] = React.useState<VideoCall | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [currentQuestion, setCurrentQuestion] = React.useState(0);

  React.useEffect(() => {
    if (!callId) return;
    fetchVideoCall();
  }, [callId]);

  const fetchVideoCall = async () => {
    try {
      const { data, error } = await supabase
        .from('video_calls')
        .select(`
          *,
          customers (
            name,
            phone,
            type
          )
        `)
        .eq('id', callId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Video call not found');

      setCall(data);
    } catch (error) {
      console.error('Error fetching video call:', error);
      setError(
        error instanceof Error 
          ? error.message 
          : 'Failed to load video call details'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    const newAnswers = {
      ...answers,
      [PROFILING_QUESTIONS[currentQuestion].id]: answer
    };
    setAnswers(newAnswers);

    if (currentQuestion < PROFILING_QUESTIONS.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      try {
        // Save profiling answers
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            preferences: {
              ...call?.customers?.preferences,
              profiling: newAnswers,
              profiled: true,
              lastProfilingAttempt: new Date().toISOString(),
              country: newAnswers.country
            }
          })
          .eq('id', call?.customer_id);

        if (updateError) throw updateError;

        // Update workflow status
        const { error: workflowError } = await supabase
          .from('video_calls')
          .update({
            workflow_status: {
              ...call?.workflow_status,
              profiling: 'completed',
              payment: 'pending'
            }
          })
          .eq('id', callId);

        if (workflowError) throw workflowError;

        navigate(`/video-calls/${callId}`);
      } catch (error) {
        console.error('Error saving profiling:', error);
        setError('Failed to save profiling data');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-red-100 p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <div className="text-red-600 font-medium">{error || 'Video call not found'}</div>
      </div>
    );
  }

  const currentQ = PROFILING_QUESTIONS[currentQuestion];

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100">
      <div className="p-6">
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Question {currentQuestion + 1} of {PROFILING_QUESTIONS.length}</span>
            <span>{Math.round(((currentQuestion + 1) / PROFILING_QUESTIONS.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
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
  );
};

export default VideoCallProfiling;
