import React, { useState, useEffect } from 'react';
import { Plus, Save, Info, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';

interface MarkupSetting {
  id: string;
  type: 'manufacturer' | 'category';
  name: string;
  code: string;
  markup: number;
}

const MarkupSettings = () => {
  const [settings, setSettings] = useState<MarkupSetting[]>([]);
  const [newSetting, setNewSetting] = useState<Partial<MarkupSetting>>({
    type: 'manufacturer',
    name: '',
    code: '',
    markup: 0.2
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.rpc('get_markup_settings');

      if (error) throw error;
      setSettings(data || []);
    } catch (error) {
      console.error('Error fetching markup settings:', error);
      addToast({
        title: 'Error',
        message: 'Failed to load markup settings',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newSetting.name) return;

    try {
      // For manufacturers, ensure code is in correct format
      if (newSetting.type === 'manufacturer') {
        if (!newSetting.code || !newSetting.code.match(/^[A-Z]{2}\d{2}$/)) {
          throw new Error('Manufacturer code must be 2 letters followed by 2 digits (e.g., PJ02)');
        }
      } else {
        // For categories, ensure code is 2 letters
        if (!newSetting.code || !newSetting.code.match(/^[A-Z]{2}$/)) {
          throw new Error('Category code must be exactly 2 letters (e.g., RG)');
        }
      }

      // Validate markup percentage
      if (typeof newSetting.markup !== 'number' || newSetting.markup < 0 || newSetting.markup > 1) {
        throw new Error('Markup must be between 0 and 1');
      }

      const { error } = await supabase
        .from('markup_settings')
        .insert([newSetting]);

      if (error) throw error;
      
      setNewSetting({
        type: 'manufacturer',
        name: '',
        code: '',
        markup: 0.2
      });
      
      addToast({
        title: 'Success',
        message: 'Markup setting added successfully',
        type: 'success'
      });
      
      fetchSettings();
    } catch (error: any) {
      console.error('Error adding markup setting:', error);
      addToast({
        title: 'Error',
        message: error.message || 'Failed to add markup setting',
        type: 'error'
      });
    }
  };

  const handleSettingChange = async (id: string, field: keyof MarkupSetting, value: string | number) => {
    try {
      // Validate code format
      if (field === 'code') {
        const setting = settings.find(s => s.id === id);
        if (setting?.type === 'manufacturer' && !value.toString().match(/^[A-Z]{2}\d{2}$/)) {
          throw new Error('Manufacturer code must be 2 letters followed by 2 digits (e.g., PJ02)');
        }
        if (setting?.type === 'category' && !value.toString().match(/^[A-Z]{2}$/)) {
          throw new Error('Category code must be exactly 2 letters (e.g., RG)');
        }
      }

      // Validate markup
      if (field === 'markup') {
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < 0 || numValue > 1) {
          throw new Error('Markup must be between 0 and 1');
        }
      }

      const { error } = await supabase
        .from('markup_settings')
        .update({ [field]: value })
        .eq('id', id);

      if (error) throw error;

      setSettings(prev => prev.map(setting => 
        setting.id === id ? { ...setting, [field]: value } : setting
      ));

      addToast({
        title: 'Success',
        message: 'Setting updated successfully',
        type: 'success'
      });
    } catch (error: any) {
      console.error('Error updating markup setting:', error);
      addToast({
        title: 'Error',
        message: error.message || 'Failed to update setting',
        type: 'error'
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this setting?')) return;

    try {
      const { error } = await supabase
        .from('markup_settings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setSettings(prev => prev.filter(setting => setting.id !== id));
      
      addToast({
        title: 'Success',
        message: 'Setting deleted successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Error deleting markup setting:', error);
      addToast({
        title: 'Error',
        message: 'Failed to delete setting',
        type: 'error'
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
          Markup Settings
        </h2>
        <button 
          onClick={() => setShowInfo(!showInfo)}
          className="btn btn-secondary flex items-center gap-2"
        >
          <Info className="h-4 w-4" />
          Format Guide
        </button>
      </div>

      {showInfo && (
        <div className="bg-blue-50 p-6 rounded-xl space-y-4">
          <h3 className="font-medium text-blue-900">SKU Format Guide</h3>
          <div className="space-y-2 text-blue-800">
            <p className="font-mono">Format: PE/PJ02-2399-AGZKO</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><span className="font-mono text-blue-600">PE</span> = Category code (2 letters)</li>
              <li><span className="font-mono text-blue-600">/</span> = Separator</li>
              <li><span className="font-mono text-blue-600">PJ02</span> = Manufacturer code (2 letters + 2 digits)</li>
              <li><span className="font-mono text-blue-600">2399</span> = Price code</li>
              <li><span className="font-mono text-blue-600">AGZKO</span> = Random unique code</li>
            </ul>
            <p className="mt-4 text-sm">Example: <span className="font-mono">NE/MO07-1299-XYZAB</span></p>
          </div>
        </div>
      )}

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100">
        <div className="p-6 space-y-6">
          {/* Add New Setting */}
          <div className="flex gap-4 items-end border-b pb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                className="input"
                value={newSetting.type}
                onChange={e => setNewSetting(prev => ({ ...prev, type: e.target.value as 'manufacturer' | 'category' }))}
              >
                <option value="manufacturer">Manufacturer</option>
                <option value="category">Category</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                className="input"
                value={newSetting.name}
                onChange={e => setNewSetting(prev => ({ ...prev, name: e.target.value }))}
                placeholder={newSetting.type === 'manufacturer' ? 'e.g., DS BHAI' : 'e.g., Rings'}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code
                <span className="text-xs text-gray-500 ml-1">
                  ({newSetting.type === 'manufacturer' ? 'e.g., PJ02' : 'e.g., RG'})
                </span>
              </label>
              <input
                type="text"
                className="input uppercase"
                value={newSetting.code}
                onChange={e => setNewSetting(prev => ({ 
                  ...prev, 
                  code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, newSetting.type === 'manufacturer' ? 4 : 2)
                }))}
                placeholder={newSetting.type === 'manufacturer' ? 'PJ02' : 'RG'}
                maxLength={newSetting.type === 'manufacturer' ? 4 : 2}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Markup %</label>
              <input
                type="number"
                className="input"
                value={newSetting.markup ? (newSetting.markup * 100) : ''}
                onChange={e => setNewSetting(prev => ({ ...prev, markup: Number(e.target.value) / 100 }))}
                min="0"
                max="100"
                step="1"
              />
            </div>
            <button
              onClick={handleAdd}
              className="btn btn-primary h-10"
              disabled={!newSetting.name}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Manufacturer Settings */}
          <div className="mt-6">
            <h4 className="text-lg font-semibold mb-4">Manufacturer Codes & Markups</h4>
            <div className="grid gap-4">
              {settings
                .filter(setting => setting.type === 'manufacturer')
                .map(setting => (
                  <div key={setting.id} className="flex gap-4 items-center">
                    <input
                      type="text"
                      className="input w-48"
                      value={setting.name}
                      onChange={e => handleSettingChange(setting.id, 'name', e.target.value)}
                    />
                    <div className="w-32">
                      <input
                        type="text"
                        className="input font-mono text-center uppercase"
                        value={setting.code}
                        onChange={e => handleSettingChange(setting.id, 'code', e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        className="input"
                        value={Math.round(setting.markup * 100)}
                        onChange={e => handleSettingChange(setting.id, 'markup', Number(e.target.value) / 100)}
                        min="0"
                        max="100"
                        step="1"
                      />
                    </div>
                    <button
                      onClick={() => handleDelete(setting.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* Category Settings */}
          <div className="mt-6">
            <h4 className="text-lg font-semibold mb-4">Category Codes & Markups</h4>
            <div className="grid gap-4">
              {settings
                .filter(setting => setting.type === 'category')
                .map(setting => (
                  <div key={setting.id} className="flex gap-4 items-center">
                    <input
                      type="text"
                      className="input w-48"
                      value={setting.name}
                      onChange={e => handleSettingChange(setting.id, 'name', e.target.value)}
                    />
                    <div className="w-32">
                      <input
                        type="text"
                        className="input font-mono text-center uppercase"
                        value={setting.code}
                        onChange={e => handleSettingChange(setting.id, 'code', e.target.value.toUpperCase())}
                        maxLength={2}
                      />
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        className="input"
                        value={Math.round(setting.markup * 100)}
                        onChange={e => handleSettingChange(setting.id, 'markup', Number(e.target.value) / 100)}
                        min="0"
                        max="100"
                        step="1"
                      />
                    </div>
                    <button
                      onClick={() => handleDelete(setting.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkupSettings;
