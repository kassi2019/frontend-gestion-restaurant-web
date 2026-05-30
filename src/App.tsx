import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider, useSelector } from 'react-redux';
import { store } from './store';
import type { RootState } from './store';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TablesPage from './pages/TablesPage';
import CommandesPage from './pages/CommandesPage';
import MenuPage from './pages/MenuPage';
import PlanningPage from './pages/PlanningPage';
import CaissePage from './pages/CaissePage';
import UsersPage from './pages/UsersPage';
import StatsPage from './pages/StatsPage';
import AbonnementPage from './pages/AbonnementPage';
import SuperCodesPage from './pages/SuperCodesPage';
import ParametresPage from './pages/ParametresPage';
import NotificationsPage from './pages/NotificationsPage';
import AssignTablesPage from './pages/AssignTablesPage';
import { ToastProvider } from './services/toast';
import { DialogProvider } from './services/dialog';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = useSelector((s: RootState) => s.auth.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function LoginGuard({ children }: { children: React.ReactNode }) {
  const token = useSelector((s: RootState) => s.auth.token);
  if (token) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Provider store={store}>
      <ToastProvider>
      <DialogProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginGuard><LoginPage /></LoginGuard>} />
          <Route element={<AuthGuard><Layout /></AuthGuard>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/tables" element={<TablesPage />} />
            <Route path="/commandes" element={<CommandesPage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/planning" element={<PlanningPage />} />
            <Route path="/caisse" element={<CaissePage />} />
            <Route path="/assign-tables" element={<AssignTablesPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/parametres" element={<ParametresPage />} />
            <Route path="/abonnement" element={<AbonnementPage />} />
            <Route path="/super/codes" element={<SuperCodesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </DialogProvider>
      </ToastProvider>
    </Provider>
  );
}
