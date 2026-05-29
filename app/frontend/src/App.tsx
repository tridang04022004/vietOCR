import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { Library } from './components/Library';
import { DocumentView } from './components/DocumentView';
import { Settings } from './components/Settings';
import { UploadPage } from './pages/UploadPage';
import { AutoCorrectPage } from './pages/AutoCorrectPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/upload"
            element={
              <ProtectedRoute>
                <>
                  <Navbar />
                  <UploadPage />
                </>
              </ProtectedRoute>
            }
          />

          <Route
            path="/autocorrect"
            element={
              <ProtectedRoute>
                <>
                  <Navbar />
                  <AutoCorrectPage />
                </>
              </ProtectedRoute>
            }
          />

          <Route
            path="/library"
            element={
              <ProtectedRoute>
                <>
                  <Navbar />
                  <Library />
                </>
              </ProtectedRoute>
            }
          />

          <Route
            path="/library/:id"
            element={
              <ProtectedRoute>
                <>
                  <Navbar />
                  <DocumentView />
                </>
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <>
                  <Navbar />
                  <Settings />
                </>
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/library" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
