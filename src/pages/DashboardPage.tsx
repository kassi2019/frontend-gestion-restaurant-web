import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../store';
import { statistiquesApi, commandesApi, authApi, tablesApi, planningApi } from '../services/api';
import { onNewCommande, onCommandeStatusChange } from '../services/socket';

export default function DashboardPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const navigate = useNavigate();
  const role = user?.role;
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [stats, setStats] = useState<any>(null);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [latestCommands, setLatest] = useState<any[]>([]);
  const [myTables, setMyTables] = useState<any[]>([]);
  const [myPlanning, setMyPlanning] = useState<any[]>([]);

  const loadStats = useCallback(async () => {
    try {
      if (isSuperAdmin) {
        const { data } = await authApi.getDashboard();
        setAdminStats(data);
      } else if (role === 'ADMIN' || role === 'MANAGER') {
        const { data } = await statistiquesApi.getDashboard();
        setStats(data);
      }
    } catch {}
  }, [role, isSuperAdmin]);

  const loadRoleData = useCallback(async () => {
    try {
      if (role === 'SERVEUR') {
        const [cmdRes, tableRes] = await Promise.all([
          commandesApi.getByServeur(),
          tablesApi.getAll(),
        ]);
        setLatest((cmdRes.data || []).slice(0, 8));
        // Filtrer les tables assignées à ce serveur
        const allTables = tableRes.data || [];
        setMyTables(allTables.filter((t: any) => t.serveurId === user?.id));
      } else if (role === 'CUISINE' || role === 'BAR') {
        const apiCall = role === 'CUISINE' ? commandesApi.getByCuisine : commandesApi.getByBar;
        const { data } = await apiCall();
        setLatest(data || []);
      } else if (role === 'CAISSIER') {
        const { data } = await statistiquesApi.getDashboard();
        setStats(data);
      }
      // Planning du jour pour serveur, cuisine, bar, caissier
      if (['SERVEUR', 'CUISINE', 'BAR', 'CAISSIER'].includes(role || '')) {
        try {
          const { data } = await planningApi.getMine();
          const today = new Date().toLocaleDateString('fr-FR');
          setMyPlanning((data || []).filter((p: any) =>
            new Date(p.jour).toLocaleDateString('fr-FR') === today
          ));
        } catch {}
      }
    } catch {}
  }, [role, user?.id]);

  useEffect(() => {
    loadStats();
    loadRoleData();
    const u1 = onNewCommande(() => { loadStats(); loadRoleData(); });
    const u2 = onCommandeStatusChange(() => { loadStats(); loadRoleData(); });
    return () => { u1(); u2(); };
  }, [loadStats, loadRoleData]);

  const format = (n: any) => parseFloat(n || 0).toFixed(2);
  const d = user?.devise || '€';

  const statutColor = (s: string) => {
    const map: Record<string, string> = {
      EN_ATTENTE: 'bg-gray-100 text-gray-700', VALIDEE: 'bg-blue-100 text-blue-700',
      EN_PREPARATION: 'bg-amber-100 text-amber-700', PRETE: 'bg-green-100 text-green-700',
      SERVIE: 'bg-teal-100 text-teal-700', PAYEE: 'bg-purple-100 text-purple-700', ANNULEE: 'bg-red-100 text-red-700',
    };
    return map[s] || 'bg-gray-100';
  };

  const formatTime = (d: string) => {
    try { return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch { return d; }
  };

  // ====== SUPER ADMIN ======
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
              <span className="text-2xl">{c.icon}</span><p className={`text-3xl font-extrabold mt-2 ${c.color}`}>{c.value}</p><p className="text-xs text-gray-500 mt-1">{c.label}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">🔑 Codes d'activation</h3>
              <button onClick={() => navigate('/super/codes')} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer hover:bg-orange-600">+ Générer</button>
            </div>
            <div className="flex gap-4">
              <div className="bg-green-50 rounded-xl p-4 flex-1 text-center"><p className="text-2xl font-extrabold text-green-600">{adminStats.codes?.dispo ?? '—'}</p><p className="text-xs text-gray-500">Disponibles</p></div>
              <div className="bg-red-50 rounded-xl p-4 flex-1 text-center"><p className="text-2xl font-extrabold text-red-600">{adminStats.codes?.utilises ?? '—'}</p><p className="text-xs text-gray-500">Utilisés</p></div>
              <div className="bg-gray-50 rounded-xl p-4 flex-1 text-center"><p className="text-2xl font-extrabold text-gray-600">{adminStats.codes?.total ?? '—'}</p><p className="text-xs text-gray-500">Total</p></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4">🏪 Restaurants</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {adminStats.restaurants?.slice(0, 10).map((r: any) => (
                <div key={r.id} onClick={() => navigate(`/historique-abonnement?restaurantId=${r.id}&restaurantNom=${encodeURIComponent(r.nom)}`)}
                  className="flex items-center justify-between py-2 border-b border-gray-50 cursor-pointer hover:bg-orange-50 px-2 rounded-lg transition-colors">
                  <div><p className="font-semibold text-sm text-gray-800">{r.nom}</p><p className="text-xs text-gray-400">{r._count?.utilisateurs || 0} utilisateurs</p></div>
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

  // ====== ADMIN / MANAGER ======
  if (role === 'ADMIN' || role === 'MANAGER') {
    return (
      <div className="p-6 animate-fadeIn">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-gray-800">Bonjour, {user?.nom || '—'} 👋</h1>
          <p className="text-gray-400 text-sm mt-1">{user?.restaurantNom || ''} · {role}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Commandes jour', value: stats?.commandesJour ?? '—', icon: '📋', bg: 'bg-blue-50', color: 'text-blue-600', path: '/commandes' },
            { label: 'Tables occupées', value: stats?.tablesOccupees ?? '—', icon: '🪑', bg: 'bg-orange-50', color: 'text-orange-600', path: '/tables' },
            { label: 'Revenus', value: stats?.revenusJour ? `${format(stats.revenusJour)} ${d}` : '—', icon: '💰', bg: 'bg-green-50', color: 'text-green-600', path: '/caisse' },
            { label: 'En attente', value: stats?.enAttente ?? '—', icon: '⏳', bg: 'bg-red-50', color: 'text-red-600', path: '/commandes' },
          ].map(c => (
            <div key={c.label} onClick={() => navigate(c.path)} className={`${c.bg} rounded-2xl p-5 shadow-sm border cursor-pointer hover:shadow-md hover:border-orange-200 transition-all`}>
              <span className="text-2xl">{c.icon}</span><p className={`text-2xl font-extrabold mt-2 ${c.color}`}>{c.value}</p><p className="text-xs text-gray-500 mt-1">{c.label}</p>
            </div>
          ))}
        </div>
        {/* Accès rapide Admin */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div onClick={() => navigate('/abonnement')}
            className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-5 shadow-sm border border-purple-200 cursor-pointer hover:shadow-md transition-all">
            <span className="text-2xl">⭐</span>
            <p className="font-bold text-purple-700 mt-2">Abonnement</p>
            <p className="text-xs text-purple-400 mt-1">Gérer l'abonnement et activer un code</p>
          </div>
          <div onClick={() => { navigate('/abonnement'); setTimeout(() => { const el = document.querySelector('#cloture-section'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 300); }}
            className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-5 shadow-sm border border-red-200 cursor-pointer hover:shadow-md transition-all">
            <span className="text-2xl">🔒</span>
            <p className="font-bold text-red-700 mt-2">Clôture Globale</p>
            <p className="text-xs text-red-400 mt-1">Fermer tout le restaurant</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">🔔 Dernières commandes</h3>
            <button onClick={() => navigate('/commandes')} className="text-sm text-orange-500 font-semibold cursor-pointer hover:underline">Voir tout →</button>
          </div>
          {latestCommands.length > 0 ? (
            <div className="space-y-2">
              {latestCommands.slice(0, 5).map((c) => (
                <div key={c.id} onClick={() => navigate('/commandes')} className="flex items-center gap-3 text-sm border-b border-gray-50 pb-3 last:border-0 cursor-pointer hover:bg-orange-50 px-2 py-1 rounded-lg">
                  <span className="text-lg">{c.typeCommande === 'A_EMPORTER' ? '🥡' : '🍽️'}</span>
                  <div className="flex-1"><p className="font-semibold text-gray-700">Table {c.table?.numero || '—'} · #{c.id}</p><p className="text-xs text-gray-400">{c.statut} · {format(c.montantTotal)} {d}</p></div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statutColor(c.statut)}`}>{c.statut?.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400 text-center py-6">Aucune commande récente</p>}
        </div>
      </div>
    );
  }

  // ====== SERVEUR ======
  return (
    <div className="p-6 animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-800">Bonjour, {user?.nom || '—'} 👋</h1>
        <p className="text-gray-400 text-sm mt-1">{role} · {user?.restaurantNom || ''}</p>
      </div>

      {role === 'SERVEUR' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <div className="bg-blue-50 rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/tables')}>
              <span className="text-2xl">🪑</span><p className="text-3xl font-extrabold text-blue-600 mt-2">{myTables.length}</p><p className="text-xs text-gray-500 mt-1">Tables assignées</p>
            </div>
            <div className="bg-amber-50 rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/commandes')}>
              <span className="text-2xl">📋</span><p className="text-3xl font-extrabold text-amber-600 mt-2">{latestCommands.filter((c: any) => c.statut !== 'PAYEE' && c.statut !== 'ANNULEE' && c.statut !== 'SERVIE').length}</p><p className="text-xs text-gray-500 mt-1">Commandes en cours</p>
            </div>
            <div className="bg-green-50 rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/commandes')}>
              <span className="text-2xl">✅</span><p className="text-3xl font-extrabold text-green-600 mt-2">{latestCommands.filter((c: any) => c.statut === 'SERVIE' || c.statut === 'PAYEE').length}</p><p className="text-xs text-gray-500 mt-1">Servies aujourd'hui</p>
            </div>
          </div>

          {myTables.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
              <h3 className="font-bold text-gray-800 mb-4">🪑 Mes tables</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {myTables.map((t: any) => (
                  <div key={t.id} onClick={() => navigate('/tables')} className="bg-gray-50 rounded-xl p-3 text-center cursor-pointer hover:bg-orange-50 transition-colors">
                    <span className="text-2xl">🪑</span><p className="font-bold text-gray-800">{t.numero}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${t.statut === 'OCCUPEE' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{t.statut}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {(role === 'CUISINE' || role === 'BAR') && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <div className="bg-amber-50 rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/commandes')}>
              <span className="text-2xl">🔥</span><p className="text-3xl font-extrabold text-amber-600 mt-2">{latestCommands.filter((c: any) => c.statut === 'EN_PREPARATION').length}</p><p className="text-xs text-gray-500 mt-1">En préparation</p>
            </div>
            <div className="bg-green-50 rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/commandes')}>
              <span className="text-2xl">✅</span><p className="text-3xl font-extrabold text-green-600 mt-2">{latestCommands.filter((c: any) => c.statut === 'PRETE').length}</p><p className="text-xs text-gray-500 mt-1">Prêtes</p>
            </div>
            <div className="bg-purple-50 rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/commandes')}>
              <span className="text-2xl">📊</span><p className="text-3xl font-extrabold text-purple-600 mt-2">{latestCommands.length}</p><p className="text-xs text-gray-500 mt-1">Total commandes</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">{role === 'CUISINE' ? '🍳' : '🍸'} Commandes à préparer</h3>
              <button onClick={() => navigate('/commandes')} className="text-sm text-orange-500 font-semibold cursor-pointer hover:underline">Voir tout →</button>
            </div>
            {latestCommands.filter((c: any) => c.statut !== 'PAYEE' && c.statut !== 'ANNULEE' && c.statut !== 'SERVIE').length > 0 ? (
              <div className="space-y-2">
                {latestCommands.filter((c: any) => c.statut !== 'PAYEE' && c.statut !== 'ANNULEE' && c.statut !== 'SERVIE').slice(0, 8).map((c: any) => (
                  <div key={c.id} onClick={() => navigate('/commandes')} className="flex items-center justify-between py-2 border-b border-gray-50 cursor-pointer hover:bg-orange-50 px-2 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{c.typeCommande === 'A_EMPORTER' ? '🥡' : '🍽️'}</span>
                      <div><p className="font-semibold text-sm">Table {c.table?.numero || '—'} · #{c.id}</p>
                        <p className="text-xs text-gray-400">{c.details?.length || 0} article(s) · {new Date(c.dateCommande).toLocaleTimeString('fr-FR')}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${statutColor(c.statut)}`}>{c.statut?.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-6">Aucune commande en attente</p>}
          </div>
        </>
      )}

      {role === 'CAISSIER' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Revenus jour', value: `${format(stats?.revenusJour || 0)} ${d}`, icon: '💰', bg: 'bg-green-50', color: 'text-green-600' },
              { label: 'Commandes payées', value: stats?.commandesJour ?? '—', icon: '✅', bg: 'bg-blue-50', color: 'text-blue-600' },
              { label: 'En attente', value: stats?.enAttente ?? '—', icon: '⏳', bg: 'bg-amber-50', color: 'text-amber-600' },
              { label: 'Tables occupées', value: stats?.tablesOccupees ?? '—', icon: '🪑', bg: 'bg-purple-50', color: 'text-purple-600' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} rounded-2xl p-5 shadow-sm border cursor-pointer hover:shadow-md transition-all`} onClick={() => navigate('/caisse')}>
                <span className="text-2xl">{c.icon}</span><p className={`text-2xl font-extrabold mt-2 ${c.color}`}>{c.value}</p><p className="text-xs text-gray-500 mt-1">{c.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">💰 Accès rapide</h3>
              <button onClick={() => navigate('/caisse')} className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-bold cursor-pointer hover:bg-orange-600">Aller en caisse →</button>
            </div>
          </div>
        </>
      )}

      {/* Planning du jour (commun à SERVEUR, CUISINE, BAR, CAISSIER) */}
      {myPlanning.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mt-6">
          <h3 className="font-bold text-gray-800 mb-3">📅 Mon planning aujourd'hui</h3>
          <div className="flex flex-wrap gap-3">
            {myPlanning.map((p: any) => (
              <div key={p.id} className="bg-orange-50 rounded-xl px-4 py-3 border border-orange-100">
                <p className="text-sm font-bold text-orange-700">{formatTime(p.heureDebut)} → {formatTime(p.heureFin)}</p>
                <p className="text-xs text-orange-500">{p.statut}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
