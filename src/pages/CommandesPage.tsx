import { useEffect, useState, useCallback } from 'react';
import { commandesApi, tablesApi, menuApi } from '../services/api';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useToast } from '../services/toast';
import { onNewCommande, onCommandeStatusChange } from '../services/socket';
import { addToQueue, getIsOnline } from '../services/offline';

const STATUTS = ['EN_ATTENTE', 'VALIDEE', 'EN_PREPARATION', 'PRETE', 'SERVIE', 'PAYEE'];

export default function CommandesPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const toast = useToast();
  const [commandes, setCommandes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('TOUS');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<any>(null);

  // Création commande
  const [showCreate, setShowCreate] = useState(false);
  const [tables, setTables] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [newCmd, setNewCmd] = useState({ tableId: 0, typeCommande: 'SUR_PLACE' });
  const [cart, setCart] = useState<{ menuId: number; nom: string; prix: number; quantite: number }[]>([]);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      const role = user?.role;
      if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MANAGER') {
        res = await commandesApi.getAll();
      } else if (role === 'SERVEUR') {
        res = await commandesApi.getByServeur();
      } else if (role === 'CUISINE') {
        res = await commandesApi.getByCuisine();
      } else if (role === 'BAR') {
        res = await commandesApi.getByBar();
      } else {
        res = await commandesApi.getAll();
      }
      setCommandes(res.data || []);
    } catch (err: any) {
      if (err.response?.status === 403) toast.error('Accès non autorisé');
    } finally { setLoading(false); }
  }, [user?.role]);

  const loadForCreate = async () => {
    try {
      const [tRes, cRes, mRes] = await Promise.all([tablesApi.getAll(), menuApi.getCategories(), menuApi.getMenus()]);
      setTables(tRes.data || []); setCategories(cRes.data || []); setMenus(mRes.data || []);
      if (cRes.data?.length > 0) setActiveCat(cRes.data[0].id);
    } catch {}
  };

  // Charger au montage + écouter les événements socket pour recharger en temps réel
  // Polling automatique (15 secondes)
  useEffect(() => {
    const interval = setInterval(() => { load(); }, 15000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    load();
    const u1 = onNewCommande(() => load());
    const u2 = onCommandeStatusChange(() => load());
    return () => { u1(); u2(); };
  }, [load]);

  const handleCreate = async () => {
    if (!newCmd.tableId) { toast.error('Sélectionnez une table'); return; }
    if (cart.length === 0) { toast.error('Ajoutez au moins un plat'); return; }
    setSaving(true);
    const details = cart.map(c => ({ menuId: c.menuId, quantite: c.quantite, prix: c.prix }));
    const orderData = { ...newCmd, details, serveurId: user?.id, restaurantId: user?.restaurantId };

    if (!getIsOnline()) {
      // Mode hors-ligne : sauvegarder en local
      addToQueue('commande', orderData);
      toast.success('Commande enregistrée en local (sync auto)');
      setShowCreate(false); resetCreate();
      setSaving(false);
      return;
    }

    try {
      await commandesApi.create(orderData);
      toast.success('Commande créée !');
      setShowCreate(false); resetCreate(); load();
    } catch (err: any) {
      if (!err.response || err.code === 'ERR_NETWORK') {
        addToQueue('commande', orderData);
        toast.success('Commande sauvegardée en local (connexion perdue)');
        setShowCreate(false); resetCreate();
      } else {
        toast.error(err.response?.data?.message || 'Erreur');
      }
    }
    finally { setSaving(false); }
  };

  const resetCreate = () => { setNewCmd({ tableId: 0, typeCommande: 'SUR_PLACE' }); setCart([]); setActiveCat(categories[0]?.id || null); };

  const addToCart = (m: any) => {
    setCart(prev => {
      const found = prev.find(c => c.menuId === m.id);
      if (found) return prev.map(c => c.menuId === m.id ? { ...c, quantite: c.quantite + 1 } : c);
      return [...prev, { menuId: m.id, nom: m.nom, prix: parseFloat(m.prix), quantite: 1 }];
    });
  };

  const removeFromCart = (menuId: number) => setCart(prev => prev.filter(c => c.menuId !== menuId));

  const handleStatut = async (id: number, statut: string) => {
    try { await commandesApi.updateStatut(id, statut); load(); toast.success(`Statut: ${statut.replace('_', ' ')}`);
      setSelected((prev: any) => prev?.id === id ? {...prev, statut} : prev); } catch {}
  };

  const filtered = (filter === 'TOUS' ? commandes : commandes.filter(c => c.statut === filter))
    .filter(c => !dateFilter || new Date(c.dateCommande).toLocaleDateString('fr-FR') === new Date(dateFilter).toLocaleDateString('fr-FR'));

  const statutColor = (s: string) => {
    const map: Record<string, string> = { EN_ATTENTE: 'bg-gray-100 text-gray-700', VALIDEE: 'bg-blue-100 text-blue-700', EN_PREPARATION: 'bg-amber-100 text-amber-700', PRETE: 'bg-green-100 text-green-700', SERVIE: 'bg-teal-100 text-teal-700', PAYEE: 'bg-purple-100 text-purple-700', ANNULEE: 'bg-red-100 text-red-700' };
    return map[s] || 'bg-gray-100';
  };

  const totalCart = cart.reduce((s, c) => s + c.prix * c.quantite, 0);

  return (
    <div className="p-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-gray-800">📋 Commandes</h1>
        <div className="flex items-center gap-3">
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="h-10 bg-white border rounded-xl px-3 text-sm" />
          <button onClick={load} className="text-orange-500 font-semibold cursor-pointer hover:underline">🔄</button>
          <button onClick={() => { loadForCreate(); setShowCreate(true); }}
            className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-orange-600 cursor-pointer shadow-sm">+ Nouvelle</button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        <button onClick={() => setFilter('TOUS')} className={`px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer ${filter === 'TOUS' ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600'}`}>Tous</button>
        {STATUTS.map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer ${filter === s ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600'}`}>{s.replace(/_/g, ' ')}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-10"><div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div> : (
      <div className="space-y-3">
        {filtered.map(c => (
          <div key={c.id} onClick={() => setSelected(c)} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md cursor-pointer transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.typeCommande === 'A_EMPORTER' ? '🥡' : '🍽️'}</span>
                <div>
                  <h3 className="font-bold text-gray-800">Table {c.table?.numero || '—'} · #{c.id}</h3>
                  <p className="text-xs text-gray-400">{c.details?.length || 0} article(s) · {new Date(c.dateCommande).toLocaleTimeString('fr-FR')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${statutColor(c.statut)}`}>{c.statut.replace(/_/g, ' ')}</span>
                <span className="font-bold text-gray-800">{parseFloat(c.montantTotal).toFixed(2)} {user?.devise || '€'}</span>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-gray-400 py-10">Aucune commande</p>}
      </div>)}

      {/* Modal détail */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Commande #{selected.id}</h3>
            <p className="text-sm text-gray-500">Table {selected.table?.numero} · {selected.statut.replace(/_/g, ' ')}</p>
            {selected.details?.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div><p className="font-semibold text-sm">{d.menu?.nom || '—'}</p><p className="text-xs text-gray-400">{d.quantite}x · {d.statutPreparation}</p></div>
                <p className="font-bold text-sm">{parseFloat(d.prix).toFixed(2)} {user?.devise || '€'}</p>
              </div>
            ))}
            <p className="text-right font-extrabold text-lg mt-4 mb-4">Total : {parseFloat(selected.montantTotal).toFixed(2)} {user?.devise || '€'}</p>
            <div className="flex gap-2 flex-wrap">
              {STATUTS.filter(s => s !== 'PAYEE').map(s => (
                <button key={s} onClick={() => handleStatut(selected.id, s)} className="px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer bg-white hover:bg-gray-50">{s.replace(/_/g, ' ')}</button>
              ))}
            </div>
            <button onClick={() => setSelected(null)} className="w-full mt-4 py-2 text-gray-400 cursor-pointer">Fermer</button>
          </div>
        </div>
      )}

      {/* Modal création commande */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={() => { setShowCreate(false); resetCreate(); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl my-4 animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">📝 Nouvelle commande</h3>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Colonne gauche: Tables + Menu */}
              <div className="lg:col-span-2">
                <div className="flex gap-3 mb-4">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-600 mb-1.5">Table</label>
                    <select value={newCmd.tableId} onChange={e => setNewCmd({...newCmd, tableId: parseInt(e.target.value)})}
                      className="w-full h-11 bg-gray-50 border rounded-xl px-4">
                      <option value={0}>Sélectionner une table</option>
                      {tables.map(t => <option key={t.id} value={t.id}>{t.numero} - {t.zone} ({t.statut})</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-600 mb-1.5">Type</label>
                    <select value={newCmd.typeCommande} onChange={e => setNewCmd({...newCmd, typeCommande: e.target.value})}
                      className="w-full h-11 bg-gray-50 border rounded-xl px-4">
                      <option value="SUR_PLACE">🍽️ Sur place</option>
                      <option value="A_EMPORTER">🥡 À emporter</option>
                    </select>
                  </div>
                </div>

                {/* Catégories */}
                <div className="flex gap-2 flex-wrap mb-4">
                  {categories.map(c => (
                    <button key={c.id} onClick={() => setActiveCat(c.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${activeCat === c.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {c.destination === 'BAR' ? '🍸' : c.destination === 'DESSERT' ? '🍰' : '🍳'} {c.nom}
                    </button>
                  ))}
                </div>

                {/* Plats */}
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {menus.filter(m => m.categorieId === activeCat).map(m => {
                    const indispo = m.disponibleDemain === 1;
                    return (
                    <button key={m.id} onClick={() => !indispo && addToCart(m)}
                      disabled={indispo}
                      className={`flex items-center justify-between p-3 rounded-xl text-left border transition-colors ${indispo ? 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed' : 'bg-gray-50 hover:bg-orange-50 cursor-pointer border-gray-100'}`}>
                      <div>
                        <p className={`font-semibold text-sm ${indispo ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{m.nom}</p>
                        <p className="text-xs text-gray-400">{m.tempsPreparation} min {indispo ? '· Indisponible' : ''}</p>
                      </div>
                      <p className={`font-bold text-sm ${indispo ? 'text-gray-400' : 'text-orange-500'}`}>{parseFloat(m.prix).toFixed(2)} {user?.devise || '€'}</p>
                    </button>
                  )})}
                </div>
              </div>

              {/* Colonne droite: Panier */}
              <div className="bg-gray-50 rounded-2xl p-4 flex flex-col">
                <h4 className="font-bold text-gray-800 mb-3">🛒 Panier ({cart.length})</h4>
                <div className="flex-1 space-y-2 overflow-y-auto max-h-64">
                  {cart.map(c => (
                    <div key={c.menuId} className="flex items-center justify-between bg-white rounded-xl p-3 border border-gray-100">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{c.nom}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <button onClick={() => setCart(prev => prev.map(x => x.menuId === c.menuId ? {...x, quantite: Math.max(1, x.quantite - 1)} : x))}
                            className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold cursor-pointer">−</button>
                          <span className="text-sm font-bold">{c.quantite}</span>
                          <button onClick={() => setCart(prev => prev.map(x => x.menuId === c.menuId ? {...x, quantite: x.quantite + 1} : x))}
                            className="w-6 h-6 rounded-full bg-orange-200 flex items-center justify-center text-xs font-bold cursor-pointer">+</button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">{(c.prix * c.quantite).toFixed(2)} {user?.devise || '€'}</p>
                        <button onClick={() => removeFromCart(c.menuId)} className="text-xs text-red-500 cursor-pointer hover:underline mt-1">🗑</button>
                      </div>
                    </div>
                  ))}
                  {cart.length === 0 && <p className="text-gray-400 text-sm text-center py-6">Cliquez sur un plat pour l'ajouter</p>}
                </div>
                <div className="border-t pt-3 mt-3">
                  <p className="text-lg font-extrabold text-gray-800 mb-3">Total : {totalCart.toFixed(2)} {user?.devise || '€'}</p>
                  <button onClick={handleCreate} disabled={saving}
                    className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold cursor-pointer hover:bg-orange-600 disabled:opacity-60 flex items-center justify-center gap-2">
                    {saving && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
                    ✅ Créer la commande
                  </button>
                </div>
              </div>
            </div>

            <button onClick={() => { setShowCreate(false); resetCreate(); }} className="w-full mt-4 py-2 text-gray-400 cursor-pointer">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
