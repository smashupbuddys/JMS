import React, { useState } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface GSTRate {
  id: string;
  rate: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

const GSTSettings = () => {
  const [gstRates, setGstRates] = useState<GSTRate[]>([]);
  const [newRate, setNewRate] = useState<Partial<GSTRate>>({
    rate: 18,
    description: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    fetchGSTRates();
  }, []);

  const fetchGSTRates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('gst_rates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setError(error.message);
        console.error('Error fetching GST rates:', error);
      } else {
        setGstRates(data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newRate.rate) return;

    try {
      // Validate rate is between 0 and 100
      if (newRate.rate < 0 || newRate.rate > 100) {
        setError('GST rate must be between 0 and 100');
        return;
      }

      const { data, error } = await supabase
        .from('gst_rates')
        .insert([{
          rate: newRate.rate,
          description: newRate.description
        }])
        .select()
        .single();

      if (error) {
        setError(error.message);
        console.error('Error adding GST rate:', error);
      } else {
        setGstRates(prev => [...prev, data]);
        setNewRate({
          rate: 18,
          description: ''
        });
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred while adding the rate.');
      console.error('Unexpected error adding GST rate:', error);
    }
  };

  const handleRateChange = async (id: string, field: keyof GSTRate, value: string | number) => {
    try {
      const { data, error } = await supabase
        .from('gst_rates')
        .update({ [field]: value })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        setError(error.message);
        console.error('Error updating GST rate:', error);
      } else {
        setGstRates(prev => prev.map(rate => (rate.id === id ? data : rate)));
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred while updating the rate.');
      console.error('Unexpected error updating GST rate:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('gst_rates')
        .delete()
        .eq('id', id);

      if (error) {
        setError(error.message);
        console.error('Error deleting GST rate:', error);
      } else {
        setGstRates(prev => prev.filter(rate => rate.id !== id));
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred while deleting the rate.');
      console.error('Unexpected error deleting GST rate:', error);
    }
  };

  const handleSave = () => {
    alert('GST settings saved successfully!');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">GST Settings</h2>
        <button onClick={handleSave} className="btn btn-primary flex items-center gap-2">
          <Save className="h-4 w-4" />
          Save Changes
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {loading ? (
          <div className="text-center py-8">Loading GST settings...</div>
        ) : error ? (
          <div className="text-red-600 py-4">{error}</div>
        ) : (
          <>
            {/* Add New Rate */}
            <div className="flex gap-4 items-end border-b pb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate %</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="input w-24"
                    value={newRate.rate}
                    onChange={e => setNewRate(prev => ({ ...prev, rate: Number(e.target.value) }))}
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  <span className="text-gray-500">%</span>
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  className="input"
                  value={newRate.description}
                  onChange={e => setNewRate(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>
              <button
                onClick={handleAdd}
                className="btn btn-primary h-10"
                disabled={!newRate.rate}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* GST Rates List */}
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-4">GST Rates</h4>
              <div className="grid gap-4">
                {gstRates.map(rate => (
                  <div key={rate.id} className="grid grid-cols-3 gap-4 items-center">
                    <input
                      type="number"
                      className="input"
                      value={rate.rate}
                      onChange={e => handleRateChange(rate.id, 'rate', Number(e.target.value))}
                      min="0"
                      max="100"
                      step="0.1"
                      style={{ width: '120px' }}
                    />
                    <div className="flex-1">
                      <input
                        type="text"
                        className="input w-full"
                        value={rate.description}
                        onChange={e => handleRateChange(rate.id, 'description', e.target.value)}
                      />
                    </div>
                    <div className="text-gray-500 text-sm">Updated: {new Date(rate.updated_at || '').toLocaleDateString()}</div>
                    <button
                      onClick={() => handleDelete(rate.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GSTSettings;
