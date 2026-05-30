import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../store';
import { statistiquesApi, commandesApi, authApi } from '../services/api';
import { onNewCommande, onCommandeStatusChange } from '../services/socket';

export default function DashboardPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [stats, setStats] = useState<any>(null);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [latestCommands, setLatest] = useState<any[]>([]);

  const loadStats = useCallback(async () => {
    try {
      if (isSuperAdmin) {
        const { data } = await authApi.getDashboard();
        setAdminStats(data);
      } else {
        const { data } = await statistiquesApi.getDashboard();
        setStats(data);
      }
    } catch {}
  }, [isSuperAdmin]);

  useEffect(() => {
    loadStats();
    const loadLatest = async () => {
      try { const { data } = await commandesApi.getAll(); setLatest((data || []).slice(0, 5)); } catch {}
    };
    loadLatest();
    const u1 = onNewCommande(() => { loadStats(); loadLatest(); });
    const u2 = onCommandeStatusChange(() => { loadStats(); loadLatest(); });
    return () => { u1(); u2(); };
  }, [loadStats]);

  // SUPER ADMIN Dashboard
  if (isSuperAdmin && adminStats) {
    return (
      <div className="p-6 animate-fadeIn">
        <h1 className="text-2xl font-extrabold text-gray-800 mb-2">📊 Gestion Abonnements</h1>
        <p className="text-gray-400 text-sm mb-6">Super Admin · {adminStats.totalRestos} restaurants</p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Restos', value: adminStats.totalRestos, icon: '🏪', bg: 'bg-blue-50', color: 'text-blue-600' },
            { label: 'En règle', value: adminStats.restosValides, icon: '✅', bg: 'bg-green-50', color: 'text-green-600' },
            { label: 'En essai', value: adminStats.restosEssai, icon: '🆓', bg: 'bg-amber-50', color: 'text-amber-600' },
            { label: 'Expirés', value: adminStats.restosExpires, icon: '❌', bg: 'bg-red-50', color: 'text-red-600' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} rounded-2xl p-5 shadow-sm border`}>
              <span className="text-2xl">{c.icon}</span>
              <p className={`text-3xl font-extrabold mt-2 ${c.color}`}>{c.value}</p>
              <p className="text-xs text-gray-500 mt-1">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">🔑 Codes d'activation</h3>
              <button onClick={() => navigate('/super/codes')}
                className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer hover:bg-orange-600">+ Générer</button>
            </div>
            <div className="flex gap-4">
              <div className="bg-green-50 rounded-xl p-4 flex-1 text-center">
                <p className="text-2xl font-extrabold text-green-600">{adminStats.codes?.dispo ?? '—'}</p><p className="text-xs text-gray-500">Disponibles</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 flex-1 text-center">
                <p className="text-2xl font-extrabold text-red-600">{adminStats.codes?.utilises ?? '—'}</p><p className="text-xs text-gray-500">Utilisés</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 flex-1 text-center">
                <p className="text-2xl font-extrabold text-gray-600">{adminStats.codes?.total ?? '—'}</p><p className="text-xs text-gray-500">Total</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4">🏪 Restaurants</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {adminStats.restaurants?.slice(0, 10).map((r: any) => (
                <div key={r.id}
                  onClick={() => navigate(`/historique-abonnement?restaurantId=${r.id}&restaurantNom=${encodeURIComponent(r.nom)}`)}
                  className="flex items-center justify-between py-2 border-b border-gray-50 cursor-pointer hover:bg-orange-50 px-2 rounded-lg transition-colors">
                  <div>
                    <p className="font-semibold text-sm text-gray-800">{r.nom}</p>
                    <p className="text-xs text-gray-400">{r._count?.utilisateurs || 0} utilisateurs</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.typeAbonnement === 'TRIAL' ? 'bg-amber-100 text-amber-700' : r.typeAbonnement === 'ANNUEL' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{r.typeAbonnement}</span>
                      <p className="text-xs text-gray-400 mt-0.5">expire {r.dateFinAbonnement ? new Date(r.dateFinAbonnement).toLocaleDateString('fr-FR') : '—'}</p>
                    </div>
                    <span className="text-lg text-gray-300">›</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Regular dashboard
  const cards = [
    { label: 'Commandes du jour', value: stats?.commandesJour ?? '—', icon: '📋', bg: 'bg-blue-50', color: 'text-blue-600' },
    { label: 'Tables occupées', value: stats?.tablesOccupees ?? '—', icon: '🪑', bg: 'bg-orange-50', color: 'text-orange-600' },
    { label: 'Revenus', value: stats?.revenusJour ? `${parseFloat(stats.revenusJour).toFixed(2)} ${user?.devise || '€'}` : '—', icon: '💰', bg: 'bg-green-50', color: 'text-green-600' },
    { label: 'En attente', value: stats?.enAttente ?? '—', icon: '⏳', bg: 'bg-red-50', color: 'text-red-600' },
  ];

  return (
    <div className="p-6 animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-800">Bonjour, {user?.nom || '—'} 👋</h1>
        <p className="text-gray-400 text-sm mt-1">{user?.restaurantNom || ''} · {user?.role}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} onClick={() => { if (c.label.includes('Commandes')) navigate('/commandes'); else if (c.label.includes('Tables')) navigate('/tables'); else if (c.label.includes('Revenus') || c.label.includes('En attente')) navigate('/caisse'); }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer hover:border-orange-200">
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${c.bg}`}>{c.icon}</span>
            <p className={`text-2xl font-extrabold mt-3 ${c.color}`}>{c.value}</p>
            <p className="text-sm text-gray-400 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">⚡ Actions rapides</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Nouvelle commande', icon: '📝', path: '/commandes' },
              { label: 'Voir les tables', icon: '🪑', path: '/tables' },
              { label: 'Gérer le menu', icon: '🍽️', path: '/menu' },
              { label: 'Aller en caisse', icon: '💰', path: '/caisse' },
            ].map((a) => (
              <a key={a.label} href={a.path}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-orange-50 transition-colors text-sm font-semibold text-gray-700 hover:text-orange-600 no-underline">
                <span className="text-xl">{a.icon}</span> {a.label}
              </a>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">🔔 Dernières commandes</h3>
          {latestCommands.length > 0 ? (
            <div className="space-y-3">
              {latestCommands.map((c) => (
                <div key={c.id} onClick={() => navigate('/commandes')}
                  className="flex items-center gap-3 text-sm border-b border-gray-50 pb-3 last:border-0 cursor-pointer hover:bg-orange-50 px-2 py-1 rounded-lg transition-colors">
                  <span className="text-lg">{c.typeCommande === 'A_EMPORTER' ? '🥡' : '🍽️'}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-700">Table {c.table?.numero || '—'} · #{c.id}</p>
                    <p className="text-xs text-gray-400">{c.statut} · {c.montantTotal} {user?.devise || '€'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">Aucune commande récente</p>
          )}
        </div>
      </div>
    </div>
  );
}
