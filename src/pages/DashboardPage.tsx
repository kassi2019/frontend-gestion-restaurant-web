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

  // SUPER_ADMIN : états additionnels
  const [paiementsAttente, setPaiementsAttente] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [planForm, setPlanForm] = useState({ nom: '', dureeJours: '30', prix: '5000' });
  const [planSaving, setPlanSaving] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      if (isSuperAdmin) {
        const { data } = await authApi.getDashboard();
        setAdminStats(data);
        // Charger aussi les paiements en attente et les plans
        try {
          const [pRes, plRes] = await Promise.all([
            authApi.getPaiementsEnAttente(),
            authApi.getAllPlans(),
          ]);
          setPaiementsAttente(pRes.data || []);
          setPlans(plRes.data || []);
        } catch {}
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

  // Gestion des plans (Super Admin)
  const openNewPlan = () => { setEditingPlan(null); setPlanForm({ nom: '', dureeJours: '30', prix: '5000' }); setShowPlanForm(true); };
  const openEditPlan = (p: any) => { setEditingPlan(p); setPlanForm({ nom: p.nom, dureeJours: String(p.dureeJours || 30), prix: String(p.prix || 5000) }); setShowPlanForm(true); };
  const handleSavePlan = async () => {
    if (!planForm.nom || !planForm.dureeJours || !planForm.prix) return;
    setPlanSaving(true);
    try {
      if (editingPlan) {
        await authApi.updatePlan(editingPlan.id, { nom: planForm.nom, dureeJours: parseInt(planForm.dureeJours), prix: parseFloat(planForm.prix) });
      } else {
        await authApi.createPlan({ nom: planForm.nom, dureeJours: parseInt(planForm.dureeJours), prix: parseFloat(planForm.prix) });
      }
      setShowPlanForm(false);
      const { data } = await authApi.getAllPlans();
      setPlans(data || []);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors de l\'enregistrement du plan');
    } finally { setPlanSaving(false); }
  };
  const handleDeletePlan = async (p: any) => {
    if (!window.confirm(`Désactiver le plan "${p.nom}" ?`)) return;
    try {
      await authApi.deletePlan(p.id);
      const { data } = await authApi.getAllPlans();
      setPlans(data || []);
    } catch {}
  };

  // Raccourci pour rafraîchir les données super admin
  const refreshSuperAdmin = () => { loadStats(); };

  // ====== SUPER ADMIN ======
  if (isSuperAdmin && adminStats) {
    return (
      <div className="p-6 animate-fadeIn">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-800">📊 Super Administration</h1>
            <p className="text-gray-400 text-sm">{adminStats.totalRestos} restaurants</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/super/codes')} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer hover:bg-orange-600 transition-colors">
              🔑 Générer codes
            </button>
            <button onClick={refreshSuperAdmin} className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-sm cursor-pointer hover:bg-gray-200 transition-colors" title="Rafraîchir">
              🔄
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Paiements en attente */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">💳 Paiements en attente</h3>
              {paiementsAttente.length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">{paiementsAttente.length}</span>
              )}
            </div>
            {paiementsAttente.length > 0 ? (
              <div className="space-y-3">
                {paiementsAttente.slice(0, 5).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{p.restaurant?.nom || '—'}</p>
                      <p className="text-xs text-gray-400">{p.plan?.nom} · {p.dureeJours}j</p>
                    </div>
                    <p className="font-bold text-sm text-amber-600">{Number(p.montant).toLocaleString('fr-FR')} F</p>
                  </div>
                ))}
                {paiementsAttente.length > 5 && (
                  <button onClick={() => navigate('/super/codes')} className="text-sm text-orange-500 font-semibold cursor-pointer hover:underline">
                    Voir les {paiementsAttente.length} paiements →
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">Aucun paiement en attente</p>
            )}
          </div>

          {/* Codes d'activation */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">🔑 Codes d'activation</h3>
              <button onClick={() => navigate('/super/codes')} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer hover:bg-orange-600 transition-colors">+ Générer</button>
            </div>
            <div className="flex gap-4">
              <div className="bg-green-50 rounded-xl p-4 flex-1 text-center"><p className="text-2xl font-extrabold text-green-600">{adminStats.codes?.dispo ?? '—'}</p><p className="text-xs text-gray-500">Disponibles</p></div>
              <div className="bg-red-50 rounded-xl p-4 flex-1 text-center"><p className="text-2xl font-extrabold text-red-600">{adminStats.codes?.utilises ?? '—'}</p><p className="text-xs text-gray-500">Utilisés</p></div>
              <div className="bg-gray-50 rounded-xl p-4 flex-1 text-center"><p className="text-2xl font-extrabold text-gray-600">{adminStats.codes?.total ?? '—'}</p><p className="text-xs text-gray-500">Total</p></div>
            </div>
          </div>
        </div>

        {/* Plans d'abonnement */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">💎 Plans d'abonnement</h3>
            <button onClick={openNewPlan} className="bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer hover:bg-purple-600 transition-colors">+ Plan</button>
          </div>
          {plans.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Aucun plan configuré</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {plans.map((p: any) => (
                <div key={p.id} className={`rounded-xl p-4 border ${p.actif ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200 opacity-60'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-bold text-gray-800">{p.nom}</p>
                    <div className="flex gap-1">
                      <button onClick={() => openEditPlan(p)} className="text-sm cursor-pointer hover:scale-110 transition-transform" title="Modifier">✏️</button>
                      {p.actif && <button onClick={() => handleDeletePlan(p)} className="text-sm cursor-pointer hover:scale-110 transition-transform" title="Désactiver">🗑</button>}
                    </div>
                  </div>
                  <p className="text-xl font-extrabold text-purple-600">{Number(p.prix).toLocaleString('fr-FR')} F</p>
                  <p className="text-xs text-gray-400">{p.dureeJours} jours</p>
                  {!p.actif && <span className="text-xs text-red-500 font-bold">Inactif</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Restaurants */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">🏪 Restaurants</h3>
            <button onClick={() => navigate('/super/codes')} className="bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer hover:bg-green-600 transition-colors">+ Nouveau Restaurant</button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {adminStats.restaurants?.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between py-3 border-b border-gray-50 hover:bg-orange-50 px-3 rounded-lg transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800">{r.nom}</p>
                  <p className="text-xs text-gray-400">{r._count?.utilisateurs || 0} utilisateurs</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.typeAbonnement === 'TRIAL' ? 'bg-amber-100 text-amber-700' : r.typeAbonnement === 'ANNUEL' ? 'bg-purple-100 text-purple-700' : r.typeAbonnement === 'TRIMESTRIEL' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{r.typeAbonnement}</span>
                    <p className="text-xs text-gray-400 mt-0.5">expire {r.dateFinAbonnement ? new Date(r.dateFinAbonnement).toLocaleDateString('fr-FR') : '—'}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/super/codes?restaurantId=${r.id}&restaurantNom=${encodeURIComponent(r.nom)}`)}
                    className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg font-semibold cursor-pointer hover:bg-gray-200 transition-colors"
                    title="Gérer les codes et l'historique"
                  >📋 Détails</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Plan */}
        {showPlanForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowPlanForm(false)}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-slideUp" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-800 mb-4">{editingPlan ? '✏️ Modifier le plan' : '💎 Nouveau plan'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Nom</label>
                  <input type="text" value={planForm.nom} onChange={e => setPlanForm({ ...planForm, nom: e.target.value })}
                    placeholder="Ex: Mensuel" className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-gray-800 focus:outline-none focus:border-purple-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Durée (jours)</label>
                  <input type="number" value={planForm.dureeJours} onChange={e => setPlanForm({ ...planForm, dureeJours: e.target.value })}
                    className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-gray-800 focus:outline-none focus:border-purple-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Prix (FCFA)</label>
                  <input type="number" value={planForm.prix} onChange={e => setPlanForm({ ...planForm, prix: e.target.value })}
                    className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-gray-800 focus:outline-none focus:border-purple-400" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleSavePlan} disabled={planSaving}
                  className="flex-1 h-11 bg-purple-500 text-white font-bold rounded-xl hover:bg-purple-600 disabled:opacity-60 cursor-pointer transition-colors">
                  {planSaving ? 'Enregistrement...' : editingPlan ? 'Enregistrer' : 'Créer le plan'}
                </button>
                <button onClick={() => setShowPlanForm(false)}
                  className="flex-1 h-11 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 cursor-pointer transition-colors">Annuler</button>
              </div>
            </div>
          </div>
        )}
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
