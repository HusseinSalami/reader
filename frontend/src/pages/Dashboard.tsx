import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { customerService, Customer } from '../services/customer';
import { authService } from '../services/auth';
import { TrendingUp, Users, FileText, Zap, Sparkles, LogOut, User as UserIcon, FileType, FileCode } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = authService.getUser();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await customerService.getProfile();
      setCustomer(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">DocuFlow</h1>
              <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </nav>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    {
      name: 'Documents This Month',
      value: '0',
      limit: customer?.settings.maxDocumentsPerMonth.toLocaleString() || '0',
      icon: FileText,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      name: 'Team Members',
      value: '1',
      limit: customer?.settings.maxUsers.toString() || '1',
      icon: Users,
      color: 'from-purple-500 to-pink-500',
    },
    {
      name: 'API Calls',
      value: '0',
      limit: customer?.settings.apiEnabled ? 'Unlimited' : 'Disabled',
      icon: Zap,
      color: 'from-orange-500 to-red-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">DocuFlow</span>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center px-1 pt-1 border-b-2 border-indigo-500 text-sm font-medium text-gray-900"
                >
                  Dashboard
                </Link>
                <Link
                  to="/upload"
                  className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                >
                  Upload
                </Link>
                <Link
                  to="/documents"
                  className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                >
                  Documents
                </Link>
                <Link
                  to="/search"
                  className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                >
                  Search
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700 hidden sm:block">{user?.email}</span>
              <Link
                to="/profile"
                className="text-gray-500 hover:text-gray-700"
                title="Profile"
              >
                <UserIcon className="h-5 w-5" />
              </Link>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                Welcome back, {user?.email?.split('@')[0]}!
                <Sparkles className="ml-2 h-6 w-6 text-yellow-500" />
              </h1>
              <p className="mt-2 text-gray-600">
                Here's what's happening with your account today
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat) => (
            <div
              key={stat.name}
              className="bg-white rounded-2xl shadow-lg p-6 transform hover:scale-105 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color}`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">{stat.name}</h3>
              <div className="flex items-baseline">
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <span className="ml-2 text-sm text-gray-500">/ {stat.limit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Company Info Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Company Information</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              customer?.subscriptionTier === 'ENTERPRISE' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' :
              customer?.subscriptionTier === 'PRO' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' :
              'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
            }`}>
              {customer?.subscriptionTier}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Company Name</p>
                <p className="text-lg font-semibold text-gray-900">{customer?.companyName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-lg font-semibold text-gray-900">{customer?.contactInfo.email}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                  customer?.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {customer?.status}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Member Since</p>
                <p className="text-lg font-semibold text-gray-900">
                  {customer?.createdAt ? new Date(customer.createdAt).toLocaleDateString('en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                  }) : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Your Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: 'API Access', enabled: customer?.settings.apiEnabled },
              { name: 'Webhooks', enabled: customer?.settings.webhooksEnabled },
              { name: 'ML Enhancement', enabled: customer?.settings.mlEnabled },
            ].map((feature) => (
              <div
                key={feature.name}
                className={`p-4 rounded-xl border-2 ${
                  feature.enabled
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{feature.name}</span>
                  <span className={`text-sm font-semibold ${
                    feature.enabled ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {feature.enabled ? '✓ Enabled' : '✗ Disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg p-8 text-white mb-6">
          <h2 className="text-2xl font-bold mb-2">Ready to get started?</h2>
          <p className="text-indigo-100 mb-6">
            Configure your document types and templates, then start processing
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Link
              to="/document-types"
              className="flex items-center justify-center px-6 py-3 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 transition-all font-semibold"
            >
              <FileType className="mr-2 h-5 w-5" />
              Document Types
            </Link>
            <Link
              to="/templates"
              className="flex items-center justify-center px-6 py-3 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 transition-all font-semibold"
            >
              <FileCode className="mr-2 h-5 w-5" />
              Templates
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/upload"
              className="flex items-center justify-center px-6 py-3 bg-white bg-opacity-20 backdrop-blur-sm text-white rounded-lg hover:bg-opacity-30 transition-all font-semibold"
            >
              <FileText className="mr-2 h-5 w-5" />
              Upload
            </Link>
            <Link
              to="/documents"
              className="flex items-center justify-center px-6 py-3 bg-white bg-opacity-20 backdrop-blur-sm text-white rounded-lg hover:bg-opacity-30 transition-all font-semibold"
            >
              View Documents
            </Link>
            <Link
              to="/search"
              className="flex items-center justify-center px-6 py-3 bg-white bg-opacity-20 backdrop-blur-sm text-white rounded-lg hover:bg-opacity-30 transition-all font-semibold"
            >
              Search
            </Link>
          </div>
        </div>
        
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            © 2026 DocuFlow - Multi-Tenant Document Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
