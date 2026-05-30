import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { statistiquesApi } from '../services/api';

type Tab = 'dashboard' | 'ventes' | 'plats' | 'serveurs';

export default function StatsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');

  useEffect(() => {
    setLoading(true);
    statistiquesApi.getDashboard()
      .then(({ data }) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const format = (n: any) => parseFloat(n || 0).toFixed(2);
  const d = user?.devise || '€';

  return (
    <div className="p-6 animate-fadeIn">
      <h1 className="text-2xl font-extrabold text-gray-800 mb-6">📊 Statistiques</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          { key: 'dashboard' as Tab, label: '📊 Dashboard', icon: '📊' },
          { key: 'ventes' as Tab, label: '💰 Ventes', icon: '💰' },
          { key: 'plats' as Tab, label: '🍽️ Plats populaires', icon: '🍽️' },
          { key: 'serveurs' as Tab, label: '👥 Serveurs', icon: '👥' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${tab === t.key ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>
      ) : stats ? (<>
        {/* ===== DASHBOARD ===== */}
        {tab === 'dashboard' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Revenus jour', value: `${format(stats.revenusJour)} ${d}`, icon: '💰', bg: 'bg-green-50', color: 'text-green-600' },
                { label: 'Commandes jour', value: stats.commandesJour ?? '—', icon: '📋', bg: 'bg-blue-50', color: 'text-blue-600' },
                { label: 'En attente', value: stats.enAttente ?? '—', icon: '⏳', bg: 'bg-amber-50', color: 'text-amber-600' },
                { label: 'Tables occupées', value: stats.tablesOccupees ?? '—', icon: '🪑', bg: 'bg-purple-50', color: 'text-purple-600' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-2xl p-5 shadow-sm border`}>
                  <span className="text-2xl">{s.icon}</span>
                  <p className={`text-2xl font-extrabold mt-2 ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Commandes récentes */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4">📋 Aperçu rapide</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Commandes aujourd\'hui', value: stats.commandesJour ?? '—', icon: '📝' },
                    { label: 'Revenus totaux', value: `${format(stats.revenusJour)} ${d}`, icon: '💰' },
                    { label: 'Taux d\'occupation', value: stats.tablesOccupees ? `${Math.round((stats.tablesOccupees / Math.max(1, (stats.tablesOccupees + (stats.tablesTotal || 0)))) * 100)}%` : '—', icon: '📊' },
                    { label: 'Panier moyen', value: stats.commandesJour ? `${format((parseFloat(stats.revenusJour || 0)) / Math.max(1, stats.commandesJour))} ${d}` : '—', icon: '🛒' },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-3"><span className="text-xl">{r.icon}</span><span className="text-sm text-gray-600">{r.label}</span></div>
                      <span className="font-extrabold text-gray-800">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CA par période */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4">📈 Chiffre d'affaires</h3>
                {stats.ventes?.length > 0 ? (
                  <div className="space-y-3">
                    {stats.ventes.slice(0, 7).map((v: any, i: number) => (
                      <div key={v.id || v.periode || v.date || i} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-20">{v.periode || v.date || '—'}</span>
                        <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full flex items-center justify-end pr-2" style={{ width: `${Math.min(100, (parseFloat(v.montant || v.total || 0) / Math.max(1, parseFloat(stats.revenusJour || 0))) * 100)}%` }}>
                            <span className="text-[10px] font-bold text-white">{v.montant || v.total || '—'} {d}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-6">Données insuffisantes</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ===== VENTES ===== */}
        {tab === 'ventes' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b">
              <h3 className="font-bold text-gray-800">💰 Historique des ventes</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Période</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Espèces</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Mobile</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Carte</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {stats.ventes?.length > 0 ? stats.ventes.map((v: any, i: number) => (
                  <tr key={v.id || v.periode || v.date || i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-semibold text-gray-800 text-sm">{v.periode || v.date || '—'}</td>
                    <td className="py-3 px-4 text-right text-sm">{format(v.especes || 0)} {d}</td>
                    <td className="py-3 px-4 text-right text-sm">{format(v.mobileMoney || 0)} {d}</td>
                    <td className="py-3 px-4 text-right text-sm">{format(v.carte || 0)} {d}</td>
                    <td className="py-3 px-4 text-right font-bold">{format(v.total || v.montant || 0)} {d}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="text-center text-gray-400 py-10">Aucune vente enregistrée</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== PLATS POPULAIRES ===== */}
        {tab === 'plats' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b">
              <h3 className="font-bold text-gray-800">🍽️ Plats les plus commandés</h3>
            </div>
            {stats.platsPopulaires?.length > 0 ? (
              <div className="divide-y">
                {stats.platsPopulaires.map((p: any, i: number) => (
                  <div key={p.id || p.nom || i} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{p.nom}</p>
                      <p className="text-xs text-gray-400">{p.categorie?.nom || ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-lg text-orange-500">{p.count || p._count?.commandeDetails || 0} ×</p>
                      <p className="text-xs text-gray-400">commandes</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 py-10">Aucune donnée</p>
            )}
          </div>
        )}

        {/* ===== SERVEURS ===== */}
        {tab === 'serveurs' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b">
              <h3 className="font-bold text-gray-800">👥 Performance des serveurs</h3>
            </div>
            {stats.performanceServeurs?.length > 0 ? (
              <div className="divide-y">
                {stats.performanceServeurs.map((s: any, i: number) => (
                  <div key={s.id || s.nom || i} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-sm font-bold text-orange-500">
                      {s.nom?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{s.nom || `Serveur #${i + 1}`}</p>
                      <p className="text-xs text-gray-400">{s.commandes || 0} commandes</p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-lg text-green-600">{format(s.montant || s.total || 0)} {d}</p>
                      <p className="text-xs text-gray-400">CA généré</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 py-10">Aucune donnée</p>
            )}
          </div>
        )}
      </>) : (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border">
          <span className="text-5xl block mb-4">📊</span>
          <p className="text-gray-500 font-semibold">Aucune statistique disponible</p>
        </div>
      )}
    </div>
  );
}
