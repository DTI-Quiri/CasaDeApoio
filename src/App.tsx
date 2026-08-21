import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import GuestFormPage from './pages/GuestForm';
import GuestDetailsPage from './pages/GuestDetails';
import GuestHistoryListPage from './pages/GuestHistoryList';
import GuestHistoryPage from './pages/GuestHistory';
import GuestEditListPage from './pages/GuestEditList';
import GuestDeleteListPage from './pages/GuestDeleteList';
import UserManagementPage from './pages/UserManagement';
import DiagnosticsPage from './pages/Diagnostics';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';
import ChangePasswordModal from './components/ChangePasswordModal';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="container-page py-10 text-sm text-gray-500">Carregando...</div>;
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="container-page py-10 text-sm text-gray-500">Carregando...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function AppShell() {
  const location = useLocation();
  const hideNavbar = location.pathname === '/login';

  return (
    <>
      {!hideNavbar && <Navbar />}
      <ChangePasswordModal />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/cadastro"
          element={
            <PrivateRoute>
              <GuestFormPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/hospedes/:id"
          element={
            <PrivateRoute>
              <GuestDetailsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/historico"
          element={
            <PrivateRoute>
              <GuestHistoryListPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/editar"
          element={
            <PrivateRoute>
              <GuestEditListPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/excluir"
          element={
            <PrivateRoute>
              <GuestDeleteListPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/hospedes/:id/historico"
          element={
            <PrivateRoute>
              <GuestHistoryPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/usuarios"
          element={
            <AdminRoute>
              <UserManagementPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/diagnostics"
          element={
            <AdminRoute>
              <DiagnosticsPage />
            </AdminRoute>
          }
        />
        <Route path="*" element={<div className="container-page py-10">Página não encontrada.</div>} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <Toaster richColors position="top-right" />
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
