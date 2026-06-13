import { useEffect, useState } from 'react';
import { serveurTablesApi, tablesApi, usersApi } from '../services/api';
import { useToast } from '../services/toast';
import { useDialog } from '../services/dialog';
import { API_URL } from '../config';

export default function AssignTablesPage() {
  const toast = useToast();
  const dialog = useDialog();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedServeur, setSelectedServeur] = useState<number>(0);
  const [selectedTables, setSelectedTables] = useState<number[]>([]);
  const [showReassign, setShowReassign] = useState(false);
  const [reassignFrom, setReassignFrom] = useState<number>(0);
  const [reassignTo, setReassignTo] = useState<number>(0);

  const load = async () => {
    setLoading(true);
    try {
      const [aRes, tRes, uRes] = await Promise.all([
        serveurTablesApi.getAll(),
        tablesApi.getAll(),
        usersApi.getAll(),
      ]);
      setAssignments(aRes.data || []);
      setTables(tRes.data || []);
      setUsers(uRes.data.filter((u: any) => u.role === 'SERVEUR' && u.statut === 'ACTIF'));
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const getAssignedServeur = (tableId: number) => {
    const a = assignments.find(a => a.tableId === tableId && a.statut === 'ACTIF');
    return a?.utilisateur || null;
  };

  const handleAssign = async () => {
    if (!selectedServeur || selectedTables.length === 0) {
      toast.error('Sélectionnez un serveur et au moins une table'); return;
    }
    try {
      if (selectedTables.length === 1) {
        await serveurTablesApi.assign({ utilisateurId: selectedServeur, tableId: selectedTables[0] });
      } else {
        await serveurTablesApi.assignBulk({ utilisateurId: selectedServeur, tableIds: selectedTables });
      }
      toast.success(`${selectedTables.length} table(s) assignée(s)`);
      setShowAssign(false); setSelectedTables([]); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const handleUnassign = (tableId: number) => {
    dialog.confirm({
      title: 'Désassigner cette table ?',
      message: 'La table n\'aura plus de serveur attitré.',
      danger: true, confirmLabel: 'Désassigner',
      onConfirm: async () => {
        try { await serveurTablesApi.unassign(tableId); load(); toast.success('Table désassignée'); } catch {}
      }
    });
  };

  const handleReassign = async () => {
    if (!reassignFrom || !reassignTo) { toast.error('Sélectionnez les serveurs'); return; }
    try {
      const { data } = await serveurTablesApi.reassign({ fromServeurId: reassignFrom, toServeurId: reassignTo });
      toast.success(`${data.reassigned} table(s) transférée(s)`);
      setShowReassign(false); setReassignFrom(0); setReassignTo(0); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const handleDailyCheck = async () => {
    dialog.confirm({
      title: 'Lancer la vérification journalière ?',
      message: 'Désactive les serveurs absents, libère leurs tables et redistribue.',
      confirmLabel: 'Lancer',
      onConfirm: async () => {
        try {
          const { data } = await serveurTablesApi.runDailyCheck();
          toast.success(`Vérification OK : ${data.serveursVerifies} serveurs, ${data.tablesRedistribuees || 0} tables redistribuées`);
          load();
        } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
      }
    });
  };

  const toggleTable = (id: number) => {
    setSelectedTables(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  return (
    <div className="p-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800">🔄 Affectation des tables</h1>
          <p className="text-gray-400 text-sm">{assignments.length} assignation(s) active(s)</p>
        </div>
        <div className="flex gap-2">
          {/* <button onClick={handleDailyCheck} className="bg-purple-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-purple-600 cursor-pointer">
            🤖 Vérification journalière
          </button>
          <button onClick={() => setShowReassign(true)} className="bg-amber-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-600 cursor-pointer">
            🔀 Transférer
          </button> */}
          <button onClick={() => { setSelectedTables([]); setShowAssign(true); }} className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-orange-600 cursor-pointer shadow-sm">
            + Assigner
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {tables.map(t => {
            const serveur = getAssignedServeur(t.id);
            return (
              <div key={t.id} className="bg-white rounded-2xl p-4 border shadow-sm hover:shadow-md transition-all">
                <div className="text-center mb-3">
                  <span className="text-3xl">🪑</span>
                  <h3 className="font-extrabold text-lg text-gray-800">{t.numero}</h3>
                  <p className="text-xs text-gray-400">{t.zone}</p>
                </div>

                {/* Serveur assigné */}
                {serveur ? (
                  <div className="bg-green-50 rounded-xl p-3">
                    <div className="flex items-center gap-2">
                      {serveur.photo ? (
                        <img src={serveur.photo.startsWith('http') ? serveur.photo : `${API_URL}${serveur.photo}`} alt="" className="w-8 h-8 rounded-full object-cover border border-green-200" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center text-xs font-bold text-green-600">{serveur.nom?.charAt(0)}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-green-700 truncate">{serveur.nom}</p>
                        <p className="text-[10px] text-green-500">{serveur.role}</p>
                      </div>
                    </div>
                    <button onClick={() => handleUnassign(t.id)}
                      className="w-full mt-2 py-1 text-xs text-red-500 bg-white rounded-lg font-semibold cursor-pointer hover:bg-red-50">
                      ✕ Désassigner
                    </button>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-400">Aucun serveur</p>
                    <button onClick={() => { setSelectedTables([t.id]); setShowAssign(true); }}
                      className="mt-1 text-xs text-orange-500 font-semibold cursor-pointer hover:underline">
                      + Assigner
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Assigner */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAssign(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg animate-slideUp max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">+ Assigner des tables</h3>

            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Serveur</label>
            <select value={selectedServeur} onChange={e => setSelectedServeur(parseInt(e.target.value))}
              className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4">
              <option value={0}>Sélectionner un serveur</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.nom}</option>)}
            </select>

            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Tables ({selectedTables.length} sélectionnée(s))</label>
            <div className="grid grid-cols-3 gap-2 mb-4 max-h-48 overflow-y-auto">
              {tables.map(t => {
                const already = getAssignedServeur(t.id);
                return (
                  <button key={t.id}
                    onClick={() => !already && toggleTable(t.id)}
                    disabled={!!already}
                    className={`p-2 rounded-xl text-sm font-semibold border transition-colors ${selectedTables.includes(t.id) ? 'bg-orange-500 text-white border-orange-500' : already ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-gray-600 border-gray-200 hover:bg-orange-50 cursor-pointer'}`}>
                    {t.numero} {already ? `(${already.nom})` : ''}
                  </button>
                );
              })}
            </div>

            <button onClick={handleAssign} className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-bold cursor-pointer">
              Assigner {selectedTables.length} table(s)
            </button>
            <button onClick={() => setShowAssign(false)} className="w-full mt-3 py-2 text-gray-400 cursor-pointer">Annuler</button>
          </div>
        </div>
      )}

      {/* Modal Transférer */}
      {showReassign && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowReassign(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">🔀 Transférer les tables</h3>
            <p className="text-sm text-gray-500 mb-4">Transfère toutes les tables d'un serveur à un autre.</p>

            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Depuis</label>
            <select value={reassignFrom} onChange={e => setReassignFrom(parseInt(e.target.value))}
              className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3">
              <option value={0}>Serveur source</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.nom}</option>)}
            </select>

            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Vers</label>
            <select value={reassignTo} onChange={e => setReassignTo(parseInt(e.target.value))}
              className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4">
              <option value={0}>Serveur cible</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.nom}</option>)}
            </select>

            <button onClick={handleReassign} className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-bold cursor-pointer">🔀 Transférer</button>
            <button onClick={() => setShowReassign(false)} className="w-full mt-3 py-2 text-gray-400 cursor-pointer">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
