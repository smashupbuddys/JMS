import React, { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Diamond, Users, ShoppingCart, Bell, Settings, LogOut, BarChart, Menu, X, Calculator, Video, FileText } from 'lucide-react';
import { signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useScanningMode } from '../hooks/useScanningMode';
import { useVideoCallNotifications } from '../hooks/useVideoCallNotifications';
import { Settings as SettingsIcon } from 'lucide-react';
import { format } from 'date-fns';
import { fetchWithRetry } from '../lib/supabase';
import { useToast } from '../hooks/useToast';

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [loading, setLoading] = useState(true);
  const [notificationGroups, setNotificationGroups] = useState<{
    video_calls: any[];
    inventory: any[];
    payments: any[];
    workflow: any[];
    other: any[];
  }>({
    video_calls: [],
    inventory: [],
    payments: [],
    workflow: [],
    other: []
  });
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const { toggleNotificationSetting, notificationSettings } = useVideoCallNotifications();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { isScanning } = useScanningMode();

  // Handle window resize without reload
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth >= 768) { // md breakpoint
        setIsMobileMenuOpen(false);
      }
    };

    // Throttle resize events
    let resizeTimeout: NodeJS.Timeout;
    const throttledResize = () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', throttledResize);
    return () => {
      window.removeEventListener('resize', throttledResize);
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
    };
  }, []);

  const handleNavigation = (e: React.MouseEvent, to: string) => {
    if (isScanning) {
      e.preventDefault();
      alert('Please turn off scanning mode first');
      return;
    }
    navigate(to);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setNotificationsError(null);
      const { data, error } = await fetchWithRetry(() => supabase
        .from('notifications')
        .select('*')
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order('created_at', { ascending: false })
        .limit(50));

      if (error) throw error;
      
      // Group notifications by type
      const groups = {
        video_calls: [],
        inventory: [],
        payments: [],
        workflow: [],
        other: []
      };

      (data || []).forEach(notification => {
        if (notification.type.startsWith('video_call')) {
          groups.video_calls.push(notification);
        } else if (notification.type.startsWith('inventory')) {
          groups.inventory.push(notification);
        } else if (notification.type.startsWith('payment')) {
          groups.payments.push(notification);
        } else if (notification.type.startsWith('workflow')) {
          groups.workflow.push(notification);
        } else {
          groups.other.push(notification);
        }
      });

      setNotificationGroups(groups);
    } catch (error) {
      setNotificationsError('Failed to load notifications');
      console.error('Error fetching notifications:', error);
      addToast({
        title: 'Error',
        message: 'Failed to load notifications. Please try again.',
        type: 'error',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetryNotifications = () => {
    fetchNotifications();
  };

  const handleLogout = async () => {
    if (isScanning) {
      alert('Please turn off scanning mode first');
      return;
    }
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const menuItems = [
    { to: '/', icon: Diamond, label: 'Dashboard' },
    { to: '/manufacturers', icon: BarChart, label: 'Manufacturers' },
    { to: '/inventory', icon: ShoppingCart, label: 'Inventory' },
    { to: '/bill', icon: Calculator, label: 'Bill Maker' },
    { to: '/bills', icon: FileText, label: 'Bill History' },
    { to: '/customers', icon: Users, label: 'Customers' },
    { to: '/video-calls', icon: Video, label: 'Video Calls' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Top Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-200/80">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-18">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-3 group">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-full group-hover:bg-blue-600/30 transition-colors duration-300" />
                  <Diamond className="h-9 w-9 text-blue-600 relative z-10 group-hover:scale-110 transition-transform duration-300" />
                </div>
                <span className="text-xl font-bold hidden sm:inline bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                  JMS
                </span>
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <nav className={`${windowWidth >= 768 ? 'flex' : 'hidden'} items-center space-x-1`}>
              {menuItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={(e) => {
                    if (isScanning) {
                      e.preventDefault();
                      alert('Please turn off scanning mode first');
                      return;
                    }
                  }}
                  className={`px-4 py-2.5 text-gray-600 rounded-lg hover:bg-gray-100/80 flex items-center gap-2.5 group transition-all duration-300 ${
                    isScanning ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/10 blur rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <item.icon className="h-5 w-5 relative z-10 group-hover:text-blue-600 transition-colors duration-300" />
                  </div>
                  <span className="font-medium group-hover:text-blue-600 transition-colors duration-300">{item.label}</span>
                </Link>
              ))}
              <Link
                to="/settings"
                onClick={(e) => {
                  if (isScanning) {
                    e.preventDefault();
                    alert('Please turn off scanning mode first');
                    return;
                  }
                }}
                className={`px-4 py-2.5 text-gray-600 rounded-lg hover:bg-gray-100/80 flex items-center gap-2.5 group transition-all duration-300 ${
                  isScanning ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/10 blur rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <Settings className="h-5 w-5 relative z-10 group-hover:text-blue-600 transition-colors duration-300" />
                </div>
                <span className="font-medium group-hover:text-blue-600 transition-colors duration-300">Settings</span>
              </Link>
            </nav>
            
            {/* Right Section */}
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    if (isScanning) {
                      e.preventDefault();
                      alert('Please turn off scanning mode first');
                      return;
                    }
                    setShowNotifications(!showNotifications);
                  }}
                  className={`p-2.5 rounded-lg hover:bg-gray-100/80 relative group transition-all duration-300 ${
                    isScanning ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/10 blur rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <Bell className="h-5 w-5 relative z-10 group-hover:text-blue-600 transition-colors duration-300" />
                  </div>
                  {Object.values(notificationGroups).some(group => group.length > 0) && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-gradient-to-br from-red-500 to-red-600 rounded-full text-white text-xs font-medium flex items-center justify-center shadow-lg animate-pulse">
                      {Object.values(notificationGroups).reduce((sum, group) => sum + group.length, 0)}
                    </span>
                  )}
                </button>
                
                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-96 bg-white/95 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/80 animate-in">
                    <div className="p-4 border-b">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold">Notifications</h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowNotificationSettings(!showNotificationSettings);
                          }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <SettingsIcon className="h-4 w-4 text-gray-500" />
                        </button>
                      </div>
                      {showNotificationSettings && (
                        <div className="mt-2 p-2 bg-gray-50 rounded-lg space-y-2">
                          <label className="flex items-center justify-between">
                            <span className="text-sm">Sound Alerts</span>
                            <input
                              type="checkbox"
                              checked={notificationSettings.sound}
                              onChange={() => toggleNotificationSetting('sound')}
                              className="rounded border-gray-300"
                            />
                          </label>
                          <label className="flex items-center justify-between">
                            <span className="text-sm">Voice Announcements</span>
                            <input
                              type="checkbox"
                              checked={notificationSettings.speech}
                              onChange={() => toggleNotificationSetting('speech')}
                              className="rounded border-gray-300"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notificationsError ? (
                        <div className="p-4 text-center">
                          <p className="text-red-600 mb-2">{notificationsError}</p>
                          <button
                            onClick={handleRetryNotifications}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Retry
                          </button>
                        </div>
                      ) : (
                        Object.entries(notificationGroups).some(([_, group]) => group.length > 0) ? (
                          <>
                            {/* Video Call Notifications */}
                            {notificationGroups.video_calls.length > 0 && (
                              <div className="border-b">
                                <div className="px-4 py-2 bg-blue-50/50">
                                  <h4 className="text-sm font-medium text-blue-800">Video Calls</h4>
                                </div>
                                {notificationGroups.video_calls.map(notification => (
                                  <div key={notification.id} className="p-4 hover:bg-gray-50">
                                    <p className="font-medium">{notification.title}</p>
                                    <p className="text-sm text-gray-600">{notification.message}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {format(new Date(notification.created_at), 'h:mm a')}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Inventory Notifications */}
                            {notificationGroups.inventory.length > 0 && (
                              <div className="border-b">
                                <div className="px-4 py-2 bg-yellow-50/50">
                                  <h4 className="text-sm font-medium text-yellow-800">Inventory</h4>
                                </div>
                                {notificationGroups.inventory.map(notification => (
                                  <div key={notification.id} className="p-4 hover:bg-gray-50">
                                    <p className="font-medium">{notification.title}</p>
                                    <p className="text-sm text-gray-600">{notification.message}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {format(new Date(notification.created_at), 'h:mm a')}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Payment Notifications */}
                            {notificationGroups.payments.length > 0 && (
                              <div className="border-b">
                                <div className="px-4 py-2 bg-green-50/50">
                                  <h4 className="text-sm font-medium text-green-800">Payments</h4>
                                </div>
                                {notificationGroups.payments.map(notification => (
                                  <div key={notification.id} className="p-4 hover:bg-gray-50">
                                    <p className="font-medium">{notification.title}</p>
                                    <p className="text-sm text-gray-600">{notification.message}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {format(new Date(notification.created_at), 'h:mm a')}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Workflow Notifications */}
                            {notificationGroups.workflow.length > 0 && (
                              <div className="border-b">
                                <div className="px-4 py-2 bg-purple-50/50">
                                  <h4 className="text-sm font-medium text-purple-800">Workflow Updates</h4>
                                </div>
                                {notificationGroups.workflow.map(notification => (
                                  <div key={notification.id} className="p-4 hover:bg-gray-50">
                                    <p className="font-medium">{notification.title}</p>
                                    <p className="text-sm text-gray-600">{notification.message}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {format(new Date(notification.created_at), 'h:mm a')}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Other Notifications */}
                            {notificationGroups.other.length > 0 && (
                              <div className="border-b">
                                <div className="px-4 py-2 bg-gray-50/50">
                                  <h4 className="text-sm font-medium text-gray-800">Other</h4>
                                </div>
                                {notificationGroups.other.map(notification => (
                                  <div key={notification.id} className="p-4 hover:bg-gray-50">
                                    <p className="font-medium">{notification.title}</p>
                                    <p className="text-sm text-gray-600">{notification.message}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {format(new Date(notification.created_at), 'h:mm a')}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="p-4 text-center text-gray-500">
                            No new notifications
                          </div>
                        )
                      )}
                    </div>
                    <div className="p-2 border-t bg-gray-50/50 text-center">
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-sm text-gray-600 hover:text-gray-800"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className={`hidden md:flex items-center px-4 py-2.5 text-gray-600 rounded-lg hover:bg-gray-100/80 group transition-all duration-300 ${
                  isScanning ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-red-500/10 blur rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <LogOut className="h-5 w-5 relative z-10 group-hover:text-red-600 transition-colors duration-300 mr-2.5" />
                </div>
                <span className="font-medium group-hover:text-red-600 transition-colors duration-300">Logout</span>
              </button>
              
              {/* Mobile Menu Button */}
              <button
                onClick={(e) => {
                  if (isScanning) {
                    e.preventDefault();
                    alert('Please turn off scanning mode first');
                    return;
                  }
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                }}
                className={`md:hidden p-2 rounded-lg hover:bg-gray-100 ${
                  isScanning ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {isMobileMenuOpen && windowWidth < 768 && (
        <div className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="absolute top-16 right-0 w-64 bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <nav className="py-2">
              {menuItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100"
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100"
              >
                <LogOut className="h-5 w-5 mr-3" />
                Logout
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="pt-20 flex-1">
        <main className="container mx-auto px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
