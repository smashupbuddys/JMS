import React from 'react';
import { Plus, Search, UserCheck, UserX, Edit, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ROLE_PERMISSIONS, hasPermission } from '../../lib/auth';

interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  last_active: string | null;
}

interface StaffFormData {
  name: string;
  email: string;
  role: string;
  password: string;
}

const StaffManagement = () => {
  const [staff, setStaff] = React.useState<Staff[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [editingStaff, setEditingStaff] = React.useState<Staff | null>(null);
  const [formData, setFormData] = React.useState<StaffFormData>({
    name: '',
    email: '',
    role: 'sales',
    password: ''
  });
  const [searchTerm, setSearchTerm] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!hasPermission('manage_staff')) {
      return;
    }
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('name');

      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (editingStaff) {
        // Update existing staff
        const { error } = await supabase
          .from('staff')
          .update({
            name: formData.name,
            email: formData.email,
            role: formData.role
          })
          .eq('id', editingStaff.id);

        if (error) throw error;
      } else {
        // Create new staff member
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              role: formData.role
            }
          }
        });

        if (authError) throw authError;

        const { error: staffError } = await supabase
          .from('staff')
          .insert([{
            name: formData.name,
            email: formData.email,
            role: formData.role,
            active: true
          }]);

        if (staffError) throw staffError;
      }

      setShowForm(false);
      setEditingStaff(null);
      setFormData({ name: '', email: '', role: 'sales', password: '' });
      fetchStaff();
    } catch (error) {
      console.error('Error managing staff:', error);
      setError(error.message);
    }
  };

  const handleToggleActive = async (staffMember: Staff) => {
    try {
      const { error } = await supabase
        .from('staff')
        .update({ active: !staffMember.active })
        .eq('id', staffMember.id);

      if (error) throw error;
      fetchStaff();
    } catch (error) {
      console.error('Error toggling staff status:', error);
    }
  };

  const filteredStaff = staff.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-8">Loading staff data...</div>;
  }

  return (
    !hasPermission('manage_staff') ? (
      <div className="text-center py-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Unauthorized Access</h2>
        <p className="text-gray-600">You don't have permission to manage staff.</p>
      </div>
    ) : (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search staff..."
            className="input pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Add Staff
        </button>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredStaff.map((staffMember) => (
              <tr key={staffMember.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-lg">
                        {staffMember.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{staffMember.name}</div>
                      <div className="text-sm text-gray-500">{staffMember.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {staffMember.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-500">
                    {ROLE_PERMISSIONS[staffMember.role as keyof typeof ROLE_PERMISSIONS]?.map((permission) => (
                      <span key={permission} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 mr-1 mb-1">
                        {permission.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    staffMember.active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {staffMember.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {staffMember.last_active
                    ? new Date(staffMember.last_active).toLocaleDateString()
                    : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end items-center space-x-3">
                    <button
                      onClick={() => {
                        setEditingStaff(staffMember);
                        setFormData({
                          name: staffMember.name,
                          email: staffMember.email,
                          role: staffMember.role,
                          password: ''
                        });
                        setShowForm(true);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                      title="Edit"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(staffMember)}
                      className={`${
                        staffMember.active
                          ? 'text-red-600 hover:text-red-900'
                          : 'text-green-600 hover:text-green-900'
                      }`}
                      title={staffMember.active ? 'Deactivate' : 'Activate'}
                    >
                      {staffMember.active ? (
                        <UserX className="h-5 w-5" />
                      ) : (
                        <UserCheck className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showForm || editingStaff) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingStaff(null);
                  setFormData({ name: '', email: '', role: 'sales', password: '' });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <Shield className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  className="input"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  required
                  className="input"
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="sales">Sales</option>
                  <option value="qc">Quality Control</option>
                  <option value="packaging">Packaging</option>
                  <option value="dispatch">Dispatch</option>
                </select>
              </div>

              {!editingStaff && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    className="input"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
              )}

              {error && (
                <div className="text-sm text-red-600 bg-red-50 rounded-md p-3">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingStaff(null);
                    setFormData({ name: '', email: '', role: 'sales', password: '' });
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  {editingStaff ? 'Update Staff' : 'Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    )
  );
};

export default StaffManagement;
