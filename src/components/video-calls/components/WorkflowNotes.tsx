import React from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { format } from 'date-fns';

interface WorkflowNote {
  id: string;
  step: string;
  note: string;
  staff_id: string;
  staff_name: string;
  created_at: string;
}

interface WorkflowNotesProps {
  videoCallId: string;
  currentStep: string;
}

export const WorkflowNotes: React.FC<WorkflowNotesProps> = ({ videoCallId, currentStep }) => {
  const [notes, setNotes] = React.useState<WorkflowNote[]>([]);
  const [newNote, setNewNote] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    fetchNotes();
  }, [videoCallId, currentStep]);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('workflow_notes')
        .select(`
          id,
          step,
          note,
          staff_id,
          staff:staff_id (name),
          created_at
        `)
        .eq('video_call_id', videoCallId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      setLoading(true);
      const staffId = localStorage.getItem('staffId');
      
      const { error } = await supabase
        .from('workflow_notes')
        .insert([{
          video_call_id: videoCallId,
          step: currentStep,
          note: newNote,
          staff_id: staffId
        }]);

      if (error) throw error;
      
      setNewNote('');
      fetchNotes();
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Error adding note. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-gray-100">
      <h3 className="font-medium mb-4 flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        Workflow Notes
      </h3>

      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note..."
            className="input flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddNote();
              }
            }}
          />
          <button
            onClick={handleAddNote}
            disabled={loading || !newNote.trim()}
            className="btn btn-primary"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {notes.map((note) => (
            <div key={note.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{note.staff_name}</span>
                <span className="text-gray-500">
                  {format(new Date(note.created_at), 'PPp')}
                </span>
              </div>
              <p className="text-gray-600 mt-1">{note.note}</p>
              <div className="text-xs text-gray-500 mt-1">
                Step: {note.step.replace('_', ' ')}
              </div>
            </div>
          ))}

          {notes.length === 0 && (
            <p className="text-center text-gray-500 py-4">
              No notes yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
