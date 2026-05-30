import { useEffect, useState, useCallback } from 'react';
import { authApi } from '../services/api';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../store';
import { useToast } from '../services/toast';
import { useDialog } from '../services/dialog';

const PRESETS = [
  { label: '30 j', value: '30' }, { label: '1 an', value: '365' }, { label: '2 ans', value: '730' },
  { label: '3 ans', value: '1095' }, { label: '4 ans', value: '1460' }, { label: '5 ans', value: '1825' },
];

export default function SuperCodesPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const toast = useToast();
  const dialog = useDialog();
  const navigate = useNavigate();
  const [duree, setDuree] = useState('30');
  const [nombre, setNombre] = useState('5');
  const [generating, setGenerating] = useState(false);
  const [codes, setCodes] = useState<any[]>([]);
  const [tab, setTab] = useState<'dispo' | 'utilises'>('dispo');
  const [visibleIds, setVisibleIds] = useState<Set<number>>(new Set());
  const [generated, setGenerated] = useState<string[]>([]);
  const [showGenerated, setShowGenerated] = useState(false);

  const load = useCallback(async () => {
    try { const { data } = await authApi.listeCodes(); setCodes(data || []); } catch {}
  }, []);

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') { navigate('/'); return; }
    load();
  }, [user, navigate, load]);

  const toggleVisible = (id: number) => {
    setVisibleIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await authApi.genererCodes({ dureeJours: parseInt(duree), nombre: parseInt(nombre) });
      setGenerated(data.codes || []);
      setShowGenerated(false);
      load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
    finally { setGenerating(false); }
  };

  const handleDelete = async (id: number) => {
    dialog.confirm({ title: 'Supprimer ce code ?', message: 'Ce code ne pourra plus être utilisé.', danger: true, confirmLabel: 'Supprimer', onConfirm: async () => { try { await authApi.supprimerCode(id); toast.success('Code supprimé'); load(); } catch {} } });
  };

  const handleDashboard = async (restaurantId: number) => {
    try {
      const { data } = await authApi.getHistorique(restaurantId);
      toast.info(`Historique de ${data.restaurant?.nom} — ${data.historique?.length || 0} entrée(s)`);
    } catch {}
  };

  const filtered = tab === 'dispo' ? codes.filter((c: any) => !c.estUtilise) : codes.filter((c: any) => c.estUtilise);

  return (
    <div className="p-6 animate-fadeIn">
      <h1 className="text-2xl font-extrabold text-gray-800 mb-6">🔑 Générer des codes</h1>

      {/* Formulaire génération */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <label className="block text-sm font-semibold text-gray-600 mb-2">Durée</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {PRESETS.map(p => (
            <button key={p.value} onClick={() => setDuree(p.value)}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${duree === p.value ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Durée personnalisée (jours)</label>
        <input value={duree} onChange={e => setDuree(e.target.value)} type="number"
          placeholder="Ex: 90" className="w-full h-11 bg-gray-50 border rounded-xl px-4 text-sm mb-4 italic" />

        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Nombre de codes à générer</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} type="number" min={1} max={100}
          placeholder="Ex: 5"
          className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4" />

        <button onClick={handleGenerate} disabled={generating}
          className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold cursor-pointer hover:bg-orange-600 disabled:opacity-60">
          {generating ? 'Génération...' : `Générer ${nombre} code(s)`}
        </button>

        {/* Codes fraîchement générés */}
        {generated.length > 0 && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-green-700">{generated.length} code(s) généré(s)</p>
              <button onClick={() => setShowGenerated(!showGenerated)}
                className="text-sm font-semibold text-green-700 cursor-pointer hover:underline">
                {showGenerated ? '🙈 Masquer' : '👁 Afficher'}
              </button>
            </div>
            {showGenerated && (
              <div className="space-y-1">
                {generated.map((c) => (
                  <p key={c} className="text-sm font-mono font-bold text-gray-800 bg-white rounded-lg px-3 py-2 border">{c}</p>
                ))}
              </div>
            )}
            <button onClick={() => { setGenerated([]); setShowGenerated(false); }}
              className="mt-2 text-xs text-green-600 cursor-pointer hover:underline">Fermer</button>
          </div>
        )}
      </div>

      {/* Dashboard super admin */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">📊 Dashboard</h3>
          <button onClick={async () => {
            try { const { data } = await authApi.getDashboard();
              toast.info(`Total: ${data.totalRestos} restos | En règle: ${data.restosValides} | En essai: ${data.restosEssai} | Expirés: ${data.restosExpires}`);
            } catch {}
          }} className="text-sm text-orange-500 font-semibold cursor-pointer hover:underline">Stats rapides</button>
        </div>
        <p className="text-sm text-gray-500">🟢 {codes.filter((c: any) => !c.estUtilise).length} dispo · 🔴 {codes.filter((c: any) => c.estUtilise).length} utilisés · 📊 {codes.length} total</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button onClick={() => setTab('dispo')}
            className={`flex-1 py-3 text-sm font-bold cursor-pointer transition-colors ${tab === 'dispo' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-400 hover:text-gray-600'}`}>
            🟢 Disponibles ({codes.filter((c: any) => !c.estUtilise).length})
          </button>
          <button onClick={() => setTab('utilises')}
            className={`flex-1 py-3 text-sm font-bold cursor-pointer transition-colors ${tab === 'utilises' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-400 hover:text-gray-600'}`}>
            🔴 Utilisés ({codes.filter((c: any) => c.estUtilise).length})
          </button>
        </div>

        <div className="p-4">
          {filtered.map((c: any) => {
            const isVisible = visibleIds.has(c.id);
            return (
              <div key={c.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div className="flex-1">
                  <p className={`font-mono font-bold text-sm ${c.estUtilise ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {isVisible && c.codeClair ? c.codeClair : (c.codeMasque || 'RESTO-••••-••••-••••')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {c.dureeJours} jours
                    {c.estUtilise ? ` · Utilisé par ${c.restaurant?.nom || '—'}` : ' · Disponible'}
                    {c.dateUtilisation ? ` · ${new Date(c.dateUtilisation).toLocaleDateString('fr-FR')}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleVisible(c.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 cursor-pointer hover:bg-gray-200 text-sm">
                    {isVisible ? '🙈' : '👁'}
                  </button>
                  {c.estUtilise && c.restaurant?.id && (
                    <button onClick={() => handleDashboard(c.restaurant.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 cursor-pointer hover:bg-blue-100 text-sm">📜</button>
                  )}
                  {!c.estUtilise && (
                    <button onClick={() => handleDelete(c.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 cursor-pointer hover:bg-red-100 text-sm">🗑</button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-gray-400 py-6">Aucun code</p>}
        </div>
      </div>
    </div>
  );
}
