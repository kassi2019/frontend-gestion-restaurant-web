import { useEffect, useState, useMemo } from 'react';
import { tablesApi } from '../services/api';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useToast } from '../services/toast';
import { useDialog } from '../services/dialog';

export default function TablesPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const toast = useToast();
  const dialog = useDialog();
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ numero: '', zone: 'Intérieur' });
  const [filterZone, setFilterZone] = useState('TOUS');
  const [filterStatut, setFilterStatut] = useState('TOUS');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await tablesApi.getAll(); setTables(data || []); } catch {} finally { setLoading(false); }
  };
  // Polling automatique (15 secondes)
  useEffect(() => { const interval = setInterval(() => { load(); }, 15000); return () => clearInterval(interval); }, []);
  useEffect(() => { load(); }, []);

  const uniqueTables = useMemo(() => {
    const seen = new Set();
    return tables.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
  }, [tables]);

  const filtered = useMemo(() => {
    return uniqueTables.filter(t => {
      if (filterZone !== 'TOUS' && t.zone !== filterZone) return false;
      if (filterStatut !== 'TOUS' && t.statut !== filterStatut) return false;
      return true;
    });
  }, [uniqueTables, filterZone, filterStatut]);

  const zones = useMemo(() => [...new Set(uniqueTables.map(t => t.zone))], [uniqueTables]);
  const statusColor = (s: string) => s === 'OCCUPEE' ? 'bg-red-100 text-red-700 border-red-200' : s === 'RESERVEE' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-green-100 text-green-700 border-green-200';
  const resetForm = () => { setForm({ numero: '', zone: 'Intérieur' }); setEditing(null); };

  const handleSave = async () => {
    if (!form.numero) { toast.error('Numéro requis'); return; }
    setSaving(true);
    try {
      if (editing) { await tablesApi.update(editing.id, form); toast.success('Table modifiée'); }
      else { await tablesApi.create({ ...form, restaurantId: user?.restaurantId }); toast.success('Table créée'); }
      setShowForm(false); resetForm(); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    dialog.confirm({ title: 'Supprimer cette table ?', message: 'Cette action est irréversible.', danger: true, confirmLabel: 'Supprimer', onConfirm: async () => { try { await tablesApi.delete(id); load(); toast.success('Table supprimée'); } catch { toast.error('Erreur suppression'); } } });
  };

  const handleStatut = async (id: number, s: string) => {
    try { await tablesApi.updateStatut(id, s); load(); toast.success(`Table ${s.toLowerCase()}`); } catch {}
  };

  return (
    <div className="p-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-2xl font-extrabold text-gray-800">🪑 Tables</h1><p className="text-gray-400 text-sm">{uniqueTables.length} table(s)</p></div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-orange-600 cursor-pointer shadow-sm">+ Ajouter</button>
      </div>
      <div className="flex gap-3 mb-6 flex-wrap">
        <select value={filterZone} onChange={e => setFilterZone(e.target.value)} className="h-10 bg-white border rounded-xl px-3 text-sm"><option value="TOUS">Toutes zones</option>{zones.map(z => <option key={z} value={z}>{z}</option>)}</select>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="h-10 bg-white border rounded-xl px-3 text-sm"><option value="TOUS">Tous statuts</option><option value="LIBRE">Libre</option><option value="OCCUPEE">Occupée</option><option value="RESERVEE">Réservée</option></select>
      </div>

      {loading ? <div className="flex justify-center py-10"><div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div> : (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filtered.map((t) => (
          <div key={t.id} className={`relative bg-white rounded-2xl p-4 border-2 transition-all hover:shadow-lg hover:-translate-y-0.5 ${t.statut === 'OCCUPEE' ? 'border-red-300' : t.statut === 'RESERVEE' ? 'border-amber-300' : 'border-green-200'}`}>
            <div className="text-center cursor-pointer" onClick={() => setSelected(t)}>
              <span className="text-3xl">🪑</span><h3 className="font-extrabold text-lg text-gray-800 mt-2">{t.numero}</h3>
              <p className="text-xs text-gray-400">{t.zone}</p>
              <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-semibold border ${statusColor(t.statut)}`}>{t.statut}</span>
            </div>
            <div className="flex justify-center gap-2 mt-3 pt-2 border-t border-gray-100">
              <button onClick={(e) => { e.stopPropagation(); setEditing(t); setForm({ numero: t.numero, zone: t.zone }); setShowForm(true); }} className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 cursor-pointer">✏️</button>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }} className="text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 cursor-pointer">🗑</button>
            </div>
          </div>
        ))}
      </div>)}
      {!loading && filtered.length === 0 && <p className="text-center text-gray-400 py-10">Aucune table</p>}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Table {selected.numero}</h3>
            <p className="text-gray-500 mb-2">Zone : {selected.zone}</p><p className="text-gray-500 mb-4">Statut : {selected.statut}</p>
            <div className="flex gap-2 flex-wrap mb-3">
              <button onClick={() => handleStatut(selected.id, 'LIBRE')} className="px-4 py-2 bg-green-100 text-green-700 rounded-xl font-semibold cursor-pointer">Libérer</button>
              <button onClick={() => handleStatut(selected.id, 'OCCUPEE')} className="px-4 py-2 bg-red-100 text-red-700 rounded-xl font-semibold cursor-pointer">Occuper</button>
              <button onClick={() => handleStatut(selected.id, 'RESERVEE')} className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl font-semibold cursor-pointer">Réserver</button>
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <button onClick={() => { setEditing(selected); setForm({ numero: selected.numero, zone: selected.zone }); setShowForm(true); setSelected(null); }} className="flex-1 py-2 bg-gray-100 rounded-xl font-semibold text-sm cursor-pointer">✏️ Modifier</button>
              <button onClick={() => { handleDelete(selected.id); setSelected(null); }} className="flex-1 py-2 bg-red-50 rounded-xl font-semibold text-sm text-red-600 cursor-pointer">🗑 Supprimer</button>
            </div>
            <button onClick={() => setSelected(null)} className="w-full mt-3 py-2 text-gray-400 cursor-pointer">Fermer</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editing ? '✏️ Modifier' : '+ Nouvelle table'}</h3>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Numéro</label>
            <input value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} placeholder="Ex: T12" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Zone</label>
            <select value={form.zone} onChange={e => setForm({...form, zone: e.target.value})} className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4"><option>Intérieur</option><option>Terrasse</option><option>VIP</option><option>Bar</option></select>
            <button onClick={handleSave} disabled={saving} className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-bold cursor-pointer hover:bg-orange-600 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}{editing ? 'Enregistrer' : 'Créer'}
            </button>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="w-full mt-3 py-2 text-gray-400 cursor-pointer">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
