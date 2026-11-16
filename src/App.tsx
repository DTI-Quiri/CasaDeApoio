import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Navbar from './components/Navbar';
import LoginPage from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';
import ChangePasswordModal from './components/ChangePasswordModal';

const PainelPage = lazy(() => import('./pages/Painel'));
const RecepcaoPage = lazy(() => import('./pages/Recepcao'));
const HospedesPage = lazy(() => import('./pages/Hospedes'));
const RelatoriosPage = lazy(() => import('./pages/Relatorios'));
const GuestFormPage = lazy(() => import('./pages/GuestForm'));
const GuestDetailsPage = lazy(() => import('./pages/GuestDetails'));
const GuestHistoryPage = lazy(() => import('./pages/GuestHistory'));
const UserManagementPage = lazy(() => import('./pages/UserManagement'));
const DiagnosticsPage = lazy(() => import('./pages/Diagnostics'));
const ConfiguracoesPage = lazy(() => import('./pages/Configuracoes'));

function PageLoader() {
  return (
    <div className="container-page py-16 flex flex-col items-center justify-center gap-2.5 text-slate-500">
      <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      <p className="text-xs font-medium">Carregando...</p>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <PageLoader />;
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <PageLoader />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== 'admin') {
    return <Navigate to="/painel" replace />;
  }
  return <>{children}</>;
}

function AppShell() {
  const location = useLocation();
  const hideNavbar = location.pathname === '/login';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <>
      {!hideNavbar && <Navbar />}
      <ChangePasswordModal />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/painel" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/painel"
            element={
              <PrivateRoute>
                <PainelPage />
              </PrivateRoute>
            }
          />
          <Route path="/dashboard" element={<Navigate to="/painel" replace />} />
          <Route
            path="/recepcao"
            element={
              <PrivateRoute>
                <RecepcaoPage />
              </PrivateRoute>
            }
          />
          <Route path="/operacao" element={<Navigate to="/recepcao" replace />} />
          <Route
            path="/hospedes"
            element={
              <PrivateRoute>
                <HospedesPage />
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
            path="/relatorios"
            element={
              <PrivateRoute>
                <RelatoriosPage />
              </PrivateRoute>
            }
          />
          <Route path="/historico" element={<Navigate to="/relatorios" replace />} />
          <Route path="/editar" element={<Navigate to="/hospedes" replace />} />
          <Route path="/excluir" element={<Navigate to="/hospedes" replace />} />
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
          <Route
            path="/admin/configuracoes"
            element={
              <AdminRoute>
                <ConfiguracoesPage />
              </AdminRoute>
            }
          />
          <Route
            path="*"
            element={
              <div className="container-page py-16">
                <div className="card max-w-md mx-auto p-6 text-center space-y-3">
                  <h1 className="text-base font-semibold text-slate-900 dark:text-white">
                    Página não encontrada
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    O endereço acessado não existe ou foi movido.
                  </p>
                  <div className="pt-1">
                    <Link to="/painel" className="btn-primary inline-flex">
                      Voltar ao Painel
                    </Link>
                  </div>
                </div>
              </div>
            }
          />
        </Routes>
      </Suspense>
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
