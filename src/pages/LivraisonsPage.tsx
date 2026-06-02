import { useEffect, useState, useCallback } from 'react';
import { commandesApi, usersApi } from '../services/api';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useToast } from '../services/toast';

export default function LivraisonsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const toast = useToast();
  const devise = user?.devise || '€';

  const [livraisons, setLivraisons] = useState<any[]>([]);
  const [livreurs, setLivreurs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [assignForm, setAssignForm] = useState({ livreurId: 0, adresse: '', frais: '' });

  const load = useCallback(async () => {
    try {
      const [lRes, uRes] = await Promise.all([
        commandesApi.getAll(),
        usersApi.findByRole('LIVREUR'),
      ]);
      const all = Array.isArray(lRes.data) ? lRes.data : [];
      setLivraisons(all.filter((c: any) => c.adresseLivraison || c.statutLivraison));
      setLivreurs(Array.isArray(uRes.data) ? uRes.data.filter((s: any) => s.statut === 'ACTIF') : []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAssign = async () => {
    if (!selectedId || !assignForm.livreurId) return;
    try {
      await commandesApi.assignerLivraison(selectedId, assignForm.livreurId, assignForm.adresse || undefined, parseFloat(assignForm.frais) || undefined);
      toast.success('Livraison assignée');
      setShowAssign(false); load();
    } catch (err: any) { toast.error('Erreur'); }
  };

  const handleStatut = async (id: number, statut: string) => {
    try { await commandesApi.updateStatutLivraison(id, statut); load(); toast.success(`Statut: ${statut}`); } catch { toast.error('Erreur'); }
  };

  const statutColor = (s: string) => {
    switch (s) { case 'A_LIVRER': return 'bg-amber-100 text-amber-700'; case 'EN_COURS': return 'bg-blue-100 text-blue-700'; case 'LIVREE': return 'bg-green-100 text-green-700'; case 'ECHEC': return 'bg-red-100 text-red-500'; default: return 'bg-gray-100'; }
  };
  const statutLabel = (s: string) => {
    switch (s) { case 'A_LIVRER': return 'À livrer'; case 'EN_COURS': return 'En cours'; case 'LIVREE': return 'Livrée'; case 'ECHEC': return 'Échec'; default: return s; }
  };

  const fmt = (n: any) => parseFloat(n || 0).toFixed(2);

  return (
    <div className="p-6 animate-fadeIn">
      <h1 className="text-2xl font-extrabold text-gray-800 mb-6">🚚 Livraisons</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent" /></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">CMD</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Adresse</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Livreur</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Statut</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Total</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {livraisons.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-3 px-4 font-semibold text-gray-800">#{String(c.id).padStart(4, '0')}</td>
                  <td className="py-3 px-4 text-sm text-gray-500 max-w-[200px] truncate">{c.adresseLivraison || '—'}</td>
                  <td className="py-3 px-4 text-sm">{c.livreur?.nom || '—'}</td>
                  <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${statutColor(c.statutLivraison)}`}>{statutLabel(c.statutLivraison)}</span></td>
                  <td className="py-3 px-4 text-right font-bold">{fmt(c.montantTotal)} {devise}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      {!c.statutLivraison && (
                        <button onClick={() => { setSelectedId(c.id); setAssignForm({ livreurId: c.livreurId || (livreurs[0]?.id || 0), adresse: c.adresseLivraison || '', frais: c.fraisLivraison ? String(c.fraisLivraison) : '' }); setShowAssign(true); }}
                          className="px-2 py-1 text-xs rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 cursor-pointer">🚚 Assigner</button>
                      )}
                      {c.statutLivraison === 'A_LIVRER' && (
                        <button onClick={() => handleStatut(c.id, 'EN_COURS')} className="px-2 py-1 text-xs rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer">▶ En cours</button>
                      )}
                      {c.statutLivraison === 'EN_COURS' && (
                        <>
                          <button onClick={() => handleStatut(c.id, 'LIVREE')} className="px-2 py-1 text-xs rounded-lg bg-green-50 text-green-600 hover:bg-green-100 cursor-pointer">✅ Livrée</button>
                          <button onClick={() => handleStatut(c.id, 'ECHEC')} className="px-2 py-1 text-xs rounded-lg bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer">✕ Échec</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && livraisons.length === 0 && <p className="text-center text-gray-400 py-10">Aucune livraison</p>}
      </div>

      {showAssign && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAssign(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">🚚 Assigner une livraison</h3>
            <select value={assignForm.livreurId} onChange={e => setAssignForm({...assignForm, livreurId: parseInt(e.target.value)})} className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3">
              <option value={0}>Choisir un livreur</option>
              {livreurs.map((l: any) => <option key={l.id} value={l.id}>{l.nom}</option>)}
            </select>
            <input value={assignForm.adresse} onChange={e => setAssignForm({...assignForm, adresse: e.target.value})} placeholder="Adresse de livraison" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />
            <input value={assignForm.frais} onChange={e => setAssignForm({...assignForm, frais: e.target.value})} placeholder="Frais de livraison (€)" type="number" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4" />
            <button onClick={handleAssign} className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold cursor-pointer hover:bg-orange-600">✅ Assigner</button>
            <button onClick={() => setShowAssign(false)} className="w-full mt-3 py-2 text-gray-400 cursor-pointer">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
