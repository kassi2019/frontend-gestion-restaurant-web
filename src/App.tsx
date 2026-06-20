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
import ReceptionPage from './pages/ReceptionPage';
import ReservationsPage from './pages/ReservationsPage';
import LivraisonsPage from './pages/LivraisonsPage';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './services/toast';
import { DialogProvider } from './services/dialog';

function ProtectedLayout() {
  const token = useSelector((s: RootState) => s.auth.token);
  if (!token) return <LoginPage />;
  return <Layout />;
}

export default function App() {
  return (
    <Provider store={store}>
      <ErrorBoundary>
      <ToastProvider>
      <DialogProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/tables" element={<TablesPage />} />
            <Route path="/commandes" element={<CommandesPage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/planning" element={<PlanningPage />} />
            <Route path="/caisse" element={<CaissePage />} />
            <Route path="/assign-tables" element={<AssignTablesPage />} />
            <Route path="/reception" element={<ReceptionPage />} />
            <Route path="/reservations" element={<ReservationsPage />} />
            <Route path="/livraisons" element={<LivraisonsPage />} />
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
      </ErrorBoundary>
    </Provider>
  );
}
