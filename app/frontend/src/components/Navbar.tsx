import { Link, useLocation } from 'react-router-dom';
import { Upload, Library, LogOut, User, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white shadow-md border-b border-blue-100">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/library" className="text-xl font-bold text-gray-800">
              Vietnamese OCR
            </Link>

            <div className="flex space-x-4">
              <Link
                to="/upload"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive('/upload')
                    ? 'bg-blue-100 text-blue-500'
                    : 'text-gray-700 hover:bg-blue-50'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Upload</span>
              </Link>

              <Link
                to="/library"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive('/library')
                    ? 'bg-blue-100 text-blue-500'
                    : 'text-gray-700 hover:bg-blue-50'
                }`}
              >
                <Library className="w-4 h-4" />
                <span>Library</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>{user?.email}</span>
            </div>

            <Link
              to="/settings"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isActive('/settings')
                  ? 'bg-blue-100 text-blue-500'
                  : 'text-gray-700 hover:bg-blue-50'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </Link>

            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
