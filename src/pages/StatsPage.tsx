import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { statistiquesApi } from '../services/api';

type Tab = 'dashboard' | 'ventes-jour' | 'ventes-mois' | 'plats' | 'serveurs' | 'marges' | 'moins-vendus';

export default function StatsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const devise = user?.devise || '€';
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');

  const [stats, setStats] = useState<any>({});
  const [dateDebut, setDateDebut] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [dateFin, setDateFin] = useState(() => new Date().toISOString().split('T')[0]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: dash } = await statistiquesApi.getDashboard(dateDebut, dateFin);
      const { data: ventesJour } = await statistiquesApi.getVentesParJour(dateDebut, dateFin);
      const { data: ventesMois } = await statistiquesApi.getVentesParMois(dateDebut, dateFin);
      const { data: platsPop } = await statistiquesApi.getPlatsPopulaires(10, dateDebut, dateFin);
      const { data: serveurs } = await statistiquesApi.getPerformanceServeurs(dateDebut, dateFin);
      const { data: marge } = await statistiquesApi.getMargeBrute(dateDebut, dateFin);
      const { data: moinsVendus } = await statistiquesApi.getPlatsMoinsVendus(10, dateDebut, dateFin);
      setStats({ dash, ventesJour, ventesMois, platsPop, serveurs, marge, moinsVendus });
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [dateDebut, dateFin]);

  const fmt = (n: any) => parseFloat(n || 0).toFixed(2);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: '📊 Dashboard' },
    { key: 'ventes-jour', label: '📅 CA / Jour' },
    { key: 'ventes-mois', label: '🗓️ CA / Mois' },
    { key: 'plats', label: '⭐ Plats populaires' },
    { key: 'moins-vendus', label: '📉 Moins vendus' },
    { key: 'serveurs', label: '👥 Serveurs' },
    { key: 'marges', label: '💎 Marges' },
  ];

  return (
    <div className="p-6 animate-fadeIn">
      <h1 className="text-2xl font-extrabold text-gray-800 mb-4">📊 Statistiques</h1>

      {/* Filtres période */}
      <div className="flex gap-3 mb-4 items-center">
        <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className="h-10 bg-white border rounded-xl px-4 text-sm" />
        <span className="text-gray-400">→</span>
        <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} className="h-10 bg-white border rounded-xl px-4 text-sm" />
        {loading && <div className="animate-spin h-5 w-5 border-2 border-orange-500 border-t-transparent rounded-full" />}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${tab === t.key ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && !Object.keys(stats).length ? (
        <div className="flex justify-center py-10"><div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>
      ) : (<>

        {/* DASHBOARD */}
        {tab === 'dashboard' && stats.dash && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'CA période', value: `${fmt(stats.dash.chiffreAffairesJour)} ${devise}`, icon: '💰', bg: 'bg-green-50', color: 'text-green-600' },
              { label: 'Commandes', value: stats.dash.commandesJour ?? '—', icon: '📋', bg: 'bg-blue-50', color: 'text-blue-600' },
              { label: 'Tables totales', value: stats.dash.totalTables ?? '—', icon: '🪑', bg: 'bg-purple-50', color: 'text-purple-600' },
              { label: 'Panier moyen', value: `${fmt(stats.dash.panierMoyen)} ${devise}`, icon: '🛒', bg: 'bg-amber-50', color: 'text-amber-600' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-2xl p-5 shadow-sm border`}>
                <span className="text-2xl">{s.icon}</span>
                <p className={`text-2xl font-extrabold mt-2 ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* VENTES PAR JOUR */}
        {tab === 'ventes-jour' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b"><h3 className="font-bold text-gray-800">📅 Chiffre d'affaires par jour</h3></div>
            <table className="w-full">
              <thead><tr className="border-b bg-gray-50"><th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Date</th><th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Espèces</th><th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Mobile</th><th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Carte</th><th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Total</th><th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Nb</th></tr></thead>
              <tbody>
                {(stats.ventesJour || []).map((v: any, i: number) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-semibold text-gray-800 text-sm">{new Date(v.date).toLocaleDateString('fr-FR')}</td>
                    <td className="py-3 px-4 text-right text-sm">{fmt(v.especes)} {devise}</td>
                    <td className="py-3 px-4 text-right text-sm">{fmt(v.mobile)} {devise}</td>
                    <td className="py-3 px-4 text-right text-sm">{fmt(v.carte)} {devise}</td>
                    <td className="py-3 px-4 text-right font-bold">{fmt(v.total)} {devise}</td>
                    <td className="py-3 px-4 text-right text-sm text-gray-400">{v.nb}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* VENTES PAR MOIS */}
        {tab === 'ventes-mois' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b"><h3 className="font-bold text-gray-800">🗓️ Chiffre d'affaires par mois</h3></div>
            <div className="space-y-3 p-4">
              {(stats.ventesMois || []).map((v: any) => {
                const max = Math.max(...(stats.ventesMois || []).map((x: any) => x.total || 0), 1);
                const pct = ((v.total || 0) / max) * 100;
                return (
                  <div key={v.mois} className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-700 w-20">{v.mois}</span>
                    <div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full flex items-center justify-end pr-3" style={{ width: `${Math.max(2, pct)}%` }}>
                        <span className="text-xs font-bold text-white">{fmt(v.total)} {devise}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 w-12 text-right">{v.nb} cmd</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PLATS POPULAIRES */}
        {tab === 'plats' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b"><h3 className="font-bold text-gray-800">⭐ Plats les plus commandés</h3></div>
            <div className="divide-y">
              {(stats.platsPop || []).map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'}`}>{i + 1}</div>
                  <div className="flex-1"><p className="font-bold text-gray-800">{p.nom}</p></div>
                  <p className="font-extrabold text-lg text-orange-500">{p.quantite} ×</p>
                  <p className="text-sm text-gray-500">{fmt(p.montant)} {devise}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MOINS VENDUS */}
        {tab === 'moins-vendus' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b"><h3 className="font-bold text-gray-800">📉 Plats les moins commandés</h3></div>
            <div className="divide-y">
              {(stats.moinsVendus || []).map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-sm font-bold text-red-400">{p.quantite}</div>
                  <div className="flex-1"><p className="font-bold text-gray-800">{p.nom}</p></div>
                  <p className="text-sm text-gray-500">{fmt(p.montant)} {devise}</p>
                </div>
              ))}
              {(stats.moinsVendus || []).length === 0 && <p className="text-center text-gray-400 py-10">Aucune donnée</p>}
            </div>
          </div>
        )}

        {/* SERVEURS */}
        {tab === 'serveurs' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b"><h3 className="font-bold text-gray-800">👥 Performance des serveurs</h3></div>
            <div className="divide-y">
              {(stats.serveurs || []).map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                  <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-sm font-bold text-orange-500">{s.nom?.charAt(0)?.toUpperCase() || '?'}</div>
                  <div className="flex-1"><p className="font-bold text-gray-800">{s.nom}</p><p className="text-xs text-gray-400">{s.commandes} commandes</p></div>
                  <p className="font-extrabold text-lg text-green-600">{fmt(s.chiffreAffaires)} {devise}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MARGES */}
        {tab === 'marges' && stats.marge && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'CA Total', value: `${fmt(stats.marge.chiffreAffaires)} ${devise}`, bg: 'bg-green-50', color: 'text-green-600' },
                { label: 'Coût matière', value: `${fmt(stats.marge.coutMatiere)} ${devise}`, bg: 'bg-red-50', color: 'text-red-600' },
                { label: 'Marge brute', value: `${fmt(stats.marge.margeBrute)} ${devise}`, bg: 'bg-blue-50', color: 'text-blue-600' },
                { label: 'Taux de marge', value: `${stats.marge.tauxMarge}%`, bg: 'bg-purple-50', color: 'text-purple-600' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-2xl p-5 shadow-sm border`}>
                  <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b"><h3 className="font-bold text-gray-800">💎 Marge par plat</h3></div>
              <table className="w-full">
                <thead><tr className="border-b bg-gray-50"><th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Plat</th><th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Qté</th><th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">CA</th><th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Coût</th><th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Marge</th><th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">%</th></tr></thead>
                <tbody>
                  {(stats.marge.details || []).map((p: any) => (
                    <tr key={p.nom} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-semibold text-gray-800 text-sm">{p.nom}</td>
                      <td className="py-3 px-4 text-right text-sm">{p.qte}</td>
                      <td className="py-3 px-4 text-right text-sm">{fmt(p.ca)} {devise}</td>
                      <td className="py-3 px-4 text-right text-sm text-red-500">{fmt(p.cout)} {devise}</td>
                      <td className="py-3 px-4 text-right font-bold text-green-600">{fmt(p.marge)} {devise}</td>
                      <td className="py-3 px-4 text-right text-sm">{p.taux}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </>)}
    </div>
  );
}
