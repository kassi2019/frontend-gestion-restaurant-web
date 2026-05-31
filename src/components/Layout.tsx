import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { logout } from '../store/authSlice';
import { API_URL } from '../config';
import { connectSocket, disconnectSocket, onNotification } from '../services/socket';
import OfflineBanner from './OfflineBanner';

const allMenuItems = [
  { path: '/', label: 'Accueil', icon: '🏠', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SERVEUR', 'CUISINE', 'BAR', 'CAISSIER'] },
  { path: '/tables', label: 'Tables', icon: '🪑', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SERVEUR'] },
  { path: '/assign-tables', label: 'Affectation', icon: '🔄', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { path: '/commandes', label: 'Commandes', icon: '📋', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SERVEUR', 'CUISINE', 'BAR'] },
  { path: '/menu', label: 'Menu', icon: '🍽️', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { path: '/planning', label: 'Planning', icon: '📅', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SERVEUR', 'CUISINE', 'BAR', 'CAISSIER'] },
  { path: '/caisse', label: 'Caisse', icon: '💰', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CAISSIER'] },
  { path: '/users', label: 'Users', icon: '👥', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { path: '/notifications', label: 'Notifs', icon: '🔔', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SERVEUR', 'CUISINE', 'BAR', 'CAISSIER'] },
  { path: '/stats', label: 'Stats', icon: '📊', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { path: '/parametres', label: 'Paramètres', icon: '⚙️', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { path: '/abonnement', label: 'Abonnement', icon: '⭐', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { path: '/super/codes', label: 'Générer codes', icon: '🔑', roles: ['SUPER_ADMIN'] },
];

export default function Layout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((s: RootState) => s.auth.user);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifBadge, setNotifBadge] = useState(0);

  const handleLogout = () => { disconnectSocket(); dispatch(logout()); navigate('/login'); };

  useEffect(() => {
    if (user?.id && user?.role) {
      connectSocket(user.id, user.role);
      const unsub = onNotification(() => {
        setNotifBadge(n => n + 1);
      });
      return () => { unsub(); disconnectSocket(); };
    }
  }, [user?.id, user?.role]);

  const photoUrl = user?.photo
    ? (user.photo.startsWith('http') ? user.photo : `${API_URL}${user.photo}`)
    : null;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-[var(--border)] flex flex-col transition-all duration-300 shrink-0`}>
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-[var(--border)]">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-lg shrink-0">🍽</div>
          {sidebarOpen && <span className="font-extrabold text-gray-800 text-lg">RestoPro</span>}
        </div>

        {/* User */}
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-orange-200" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-orange-50 border-2 border-orange-200 flex items-center justify-center text-orange-500 font-bold text-sm">
                {user?.nom?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            {sidebarOpen && (
              <div className="overflow-hidden">
                <p className="font-semibold text-gray-800 text-sm truncate">{user?.nom || '—'}</p>
                <p className="text-xs text-gray-400 truncate">{user?.role}</p>
              </div>
            )}
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {allMenuItems
            .filter(m => m.roles.includes(user?.role || ''))
            .map((m) => (
            <NavLink key={m.path} to={m.path} end={m.path === '/'}
              onClick={() => { if (m.path === '/notifications') setNotifBadge(0); }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`
              }>
              <span className="text-lg shrink-0 relative">
                {m.icon}
                {m.path === '/notifications' && notifBadge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{notifBadge > 9 ? '9+' : notifBadge}</span>
                )}
              </span>
              {sidebarOpen && <span className="text-sm">{m.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-[var(--border)] space-y-1">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-all cursor-pointer">
            <span className="text-lg">🚪</span>
            {sidebarOpen && <span className="text-sm font-semibold">Quitter</span>}
          </button>
        </div>
      </aside>

      {/* Collapse toggle */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute left-0 bottom-6 z-20 bg-white border border-[var(--border)] rounded-r-xl px-2 py-3 shadow-sm cursor-pointer hover:bg-gray-50 transition-all"
        style={{ left: sidebarOpen ? '15rem' : '4.5rem' }}>
        <span className="text-xs">{sidebarOpen ? '◀' : '▶'}</span>
      </button>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        <OfflineBanner />
        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
