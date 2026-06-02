import { useEffect, useState, useCallback } from 'react';
import { reservationsApi, tablesApi } from '../services/api';
import { useToast } from '../services/toast';
import { useDialog } from '../services/dialog';

export default function ReservationsPage() {
  const toast = useToast();
  const dialog = useDialog();

  const [reservations, setReservations] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({ nomClient: '', telephone: '', nbPersonnes: 1, dateReservation: '', tableId: 0, notes: '' });

  const load = useCallback(async () => {
    try {
      const [rRes, tRes] = await Promise.all([
        reservationsApi.getAll(dateFilter),
        tablesApi.getAll(),
      ]);
      setReservations(Array.isArray(rRes.data) ? rRes.data : []);
      setTables(Array.isArray(tRes.data) ? tRes.data : []);
    } catch {} finally { setLoading(false); }
  }, [dateFilter]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({ nomClient: '', telephone: '', nbPersonnes: 1, dateReservation: dateFilter, tableId: 0, notes: '' });
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.nomClient || !form.telephone) { toast.error('Nom et téléphone requis'); return; }
    try {
      if (editing) {
        await reservationsApi.update(editing.id, form);
        toast.success('Réservation modifiée');
      } else {
        await reservationsApi.create({ ...form, dateReservation: form.dateReservation || dateFilter });
        toast.success('Réservation créée');
      }
      setShowForm(false); resetForm(); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const handleHonorer = async (id: number) => {
    dialog.confirm({ title: 'Honorer la réservation ?', message: 'Le client est arrivé. La table sera marquée OCCUPEE.', confirmLabel: 'Honorer', onConfirm: async () => {
      try { await reservationsApi.honorer(id); load(); toast.success('Réservation honorée'); } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
    }});
  };

  const handleAnnuler = async (id: number) => {
    try { await reservationsApi.annuler(id); load(); toast.success('Réservation annulée'); } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const handleDelete = async (id: number) => {
    dialog.confirm({ title: 'Supprimer ?', message: 'Cette réservation sera définitivement supprimée.', danger: true, confirmLabel: 'Supprimer', onConfirm: async () => {
      try { await reservationsApi.delete(id); load(); toast.success('Réservation supprimée'); } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
    }});
  };

  const statutColor = (s: string) => {
    switch (s) { case 'EN_ATTENTE': return 'bg-amber-100 text-amber-700'; case 'CONFIRMEE': return 'bg-blue-100 text-blue-700'; case 'HONOREE': return 'bg-green-100 text-green-700'; case 'ANNULEE': return 'bg-red-100 text-red-500'; default: return 'bg-gray-100'; }
  };
  const statutLabel = (s: string) => {
    switch (s) { case 'EN_ATTENTE': return 'En attente'; case 'CONFIRMEE': return 'Confirmée'; case 'HONOREE': return 'Honorée'; case 'ANNULEE': return 'Annulée'; default: return s; }
  };

  return (
    <div className="p-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-gray-800">🪑 Réservations</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-orange-500 text-white px-5 py-2 rounded-xl font-semibold cursor-pointer hover:bg-orange-600">+ Nouvelle</button>
      </div>

      {/* Filtre date */}
      <div className="mb-4">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="h-10 bg-white border rounded-xl px-4 text-sm" />
      </div>

      {/* Liste */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent" /></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Client</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Tél</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Date/Heure</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Pers.</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Table</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Statut</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map(r => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-3 px-4 font-semibold text-gray-800">{r.nomClient}</td>
                  <td className="py-3 px-4 text-gray-500">{r.telephone}</td>
                  <td className="py-3 px-4 text-gray-500 text-sm">{new Date(r.dateReservation).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="py-3 px-4 text-gray-500">{r.nbPersonnes}</td>
                  <td className="py-3 px-4 text-gray-500">{r.table?.numero || '—'}</td>
                  <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${statutColor(r.statut)}`}>{statutLabel(r.statut)}</span></td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      {r.statut === 'EN_ATTENTE' && (
                        <button onClick={() => handleHonorer(r.id)} className="px-2 py-1 text-xs rounded-lg bg-green-50 text-green-600 hover:bg-green-100 cursor-pointer">✅</button>
                      )}
                      {(r.statut === 'EN_ATTENTE' || r.statut === 'CONFIRMEE') && (
                        <button onClick={() => handleAnnuler(r.id)} className="px-2 py-1 text-xs rounded-lg bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer">✕</button>
                      )}
                      <button onClick={() => { setEditing(r); setForm({ nomClient: r.nomClient, telephone: r.telephone, nbPersonnes: r.nbPersonnes, dateReservation: r.dateReservation ? new Date(r.dateReservation).toISOString().slice(0, 16) : '', tableId: r.tableId || 0, notes: r.notes || '' }); setShowForm(true); }}
                        className="px-2 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 cursor-pointer">✏️</button>
                      <button onClick={() => handleDelete(r.id)} className="px-2 py-1 text-xs rounded-lg bg-red-50 hover:bg-red-100 cursor-pointer">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && reservations.length === 0 && <p className="text-center text-gray-400 py-10">Aucune réservation</p>}
      </div>

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editing ? '✏️ Modifier' : '+ Nouvelle réservation'}</h3>

            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Nom du client</label>
            <input value={form.nomClient} onChange={e => setForm({...form, nomClient: e.target.value})} placeholder="Ex: Jean Dupont" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />

            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Téléphone</label>
            <input value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} placeholder="Ex: 0990000000" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Nb personnes</label>
                <input type="number" value={form.nbPersonnes} onChange={e => setForm({...form, nbPersonnes: parseInt(e.target.value) || 1})} min={1} className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Date/Heure</label>
                <input type="datetime-local" value={form.dateReservation} onChange={e => setForm({...form, dateReservation: e.target.value})} className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />
              </div>
            </div>

            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Table (optionnel)</label>
            <select value={form.tableId} onChange={e => setForm({...form, tableId: parseInt(e.target.value) || 0})} className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3">
              <option value={0}>— Aucune table —</option>
              {tables.map((t: any) => (
                <option key={t.id} value={t.id}>{t.numero} ({t.zone}) — {t.statut}</option>
              ))}
            </select>

            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Notes éventuelles..." rows={2} className="w-full bg-gray-50 border rounded-xl px-4 py-3 mb-4 resize-none" />

            <button onClick={handleSave}
              className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-bold cursor-pointer hover:bg-orange-600">Enregistrer</button>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="w-full mt-3 py-2 text-gray-400 cursor-pointer">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
