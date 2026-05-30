import { useEffect, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { planningApi, usersApi } from '../services/api';
import { useToast } from '../services/toast';
import { useDialog } from '../services/dialog';
import { API_URL } from '../config';

export default function PlanningPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER';
  const toast = useToast();
  const dialog = useDialog();
  const [plannings, setPlannings] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterStatut, setFilterStatut] = useState('TOUS');
  const [filterEmploye, setFilterEmploye] = useState('TOUS');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ jour: new Date().toISOString().slice(0, 10), heureDebut: '08:00', heureFin: '18:00', utilisateurId: '', statut: 'ACTIF' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const isAdminUser = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER';
      if (isAdminUser) {
        const [pRes, uRes] = await Promise.all([planningApi.getAll(), usersApi.getAll()]);
        setPlannings(pRes.data || []);
        setUsers(uRes.data || []);
      } else {
        // Non-admin : voir uniquement son planning
        const { data } = await planningApi.getMine();
        setPlannings(data || []);
        setUsers([]);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [user?.id]);

  const todayPlannings = useMemo(() => {
    const selected = new Date(selectedDate);
    return plannings.filter(p => {
      const pDate = new Date(p.jour);
      return pDate.toLocaleDateString('fr-FR') === selected.toLocaleDateString('fr-FR');
    });
  }, [plannings, selectedDate]);

  const filtered = useMemo(() => {
    return todayPlannings.filter(p => {
      if (filterStatut !== 'TOUS' && p.statut !== filterStatut) return false;
      if (filterEmploye !== 'TOUS' && String(p.utilisateurId) !== filterEmploye) return false;
      return true;
    });
  }, [todayPlannings, filterStatut, filterEmploye]);

  const resetForm = () => {
    setForm({ jour: selectedDate, heureDebut: '08:00', heureFin: '18:00', utilisateurId: '', statut: 'ACTIF' });
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.heureDebut || !form.heureFin || !form.utilisateurId) {
      toast.error('Tous les champs sont requis'); return;
    }
    setSaving(true);
    try {
      const payload = {
        utilisateurId: parseInt(form.utilisateurId),
        jour: `${form.jour}T00:00:00.000Z`,
        heureDebut: form.heureDebut,
        heureFin: form.heureFin,
        statut: form.statut,
      };
      if (editing) {
        await planningApi.update(editing.id, payload);
        toast.success('Planning modifié');
      } else {
        await planningApi.create(payload);
        toast.success('Planning ajouté');
      }
      setShowForm(false); resetForm(); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    dialog.confirm({ title: 'Supprimer ce planning ?', message: 'Cette action est irréversible.', danger: true, confirmLabel: 'Supprimer', onConfirm: async () => { try { await planningApi.delete(id); load(); toast.success('Planning supprimé'); } catch {} } });
  };

  const getUser = (id: number) => users.find(u => u.id === id);

  const statutBadge = (s: string) => s === 'ACTIF' ? 'bg-green-100 text-green-700' : s === 'ABSENT' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
    catch { return d; }
  };

  const formatTime = (d: string) => {
    try { return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch { return d; }
  };

  // Stats du jour
  const nbActif = todayPlannings.filter(p => p.statut === 'ACTIF').length;
  const nbAbsent = todayPlannings.filter(p => p.statut !== 'ACTIF').length;
  const allPlannings = plannings.length;

  return (
    <div className="p-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800">📅 Planning</h1>
          <p className="text-gray-400 text-sm">{plannings.length} programme(s) · {todayPlannings.length} aujourd'hui</p>
        </div>
        {isAdmin && (
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-orange-600 cursor-pointer shadow-sm">
            + Ajouter
          </button>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Aujourd\'hui', value: todayPlannings.length, icon: '📅', bg: 'bg-blue-50', color: 'text-blue-600' },
          { label: 'Actifs', value: nbActif, icon: '✅', bg: 'bg-green-50', color: 'text-green-600' },
          { label: 'Absents/Congés', value: nbAbsent, icon: '⚠️', bg: 'bg-red-50', color: 'text-red-600' },
          { label: 'Total', value: allPlannings, icon: '📊', bg: 'bg-purple-50', color: 'text-purple-600' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-2xl p-4 shadow-sm border`}>
            <span className="text-lg">{c.icon}</span>
            <p className={`text-2xl font-extrabold mt-2 ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className="h-10 bg-white border rounded-xl px-3 text-sm font-semibold" />

        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          className="h-10 bg-white border rounded-xl px-3 text-sm">
          <option value="TOUS">Tous statuts</option>
          <option value="ACTIF">✅ Actif</option>
          <option value="ABSENT">❌ Absent</option>
          <option value="CONGE">🏖️ Congé</option>
        </select>

        {isAdmin && (
          <select value={filterEmploye} onChange={e => setFilterEmploye(e.target.value)}
            className="h-10 bg-white border rounded-xl px-3 text-sm min-w-[160px]">
            <option value="TOUS">Tous les employés</option>
            {users.map(u => <option key={u.id} value={String(u.id)}>{u.nom} ({u.role})</option>)}
          </select>
        )}

        <div className="text-sm text-gray-500 ml-auto">
          {formatDate(selectedDate)} · {filtered.length} personne(s)
        </div>
      </div>

      {/* Planning du jour */}
      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
          <span className="text-5xl block mb-4">📅</span>
          <p className="text-lg font-bold text-gray-800 mb-1">Aucun programme ce jour</p>
          <p className="text-gray-400 text-sm mb-4">Aucun programme pour le {formatDate(selectedDate)}</p>
          {isAdmin && (
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-semibold cursor-pointer hover:bg-orange-600">
              + Ajouter un planning
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => {
            const emp = getUser(p.utilisateurId);
            const photoUrl = emp?.photo
              ? (emp.photo.startsWith('http') ? emp.photo : `${API_URL}${emp.photo}`)
              : null;
            return (
              <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                {/* En-tête carte */}
                <div className="flex items-center gap-3 mb-3">
                  {photoUrl ? (
                    <img src={photoUrl} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-gray-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-orange-50 border-2 border-orange-200 flex items-center justify-center text-lg font-bold text-orange-400">
                      {emp?.nom?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{emp?.nom || `Employé #${p.utilisateurId}`}</p>
                    <p className="text-xs text-gray-400">{emp?.role || '—'}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statutBadge(p.statut)}`}>
                    {p.statut === 'ACTIF' ? '✅' : p.statut === 'ABSENT' ? '❌' : '🏖️'} {p.statut}
                  </span>
                </div>

                {/* Horaires */}
                <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-0.5">Début</p>
                    <p className="text-lg font-extrabold text-gray-800">{formatTime(p.heureDebut)}</p>
                  </div>
                  <div className="flex-1 mx-3">
                    <div className="h-1 bg-orange-200 rounded-full">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: '100%' }} />
                    </div>
                    <p className="text-center text-[10px] text-gray-400 mt-1">
                      {(() => {
                        try {
                          const start = new Date(p.heureDebut).getTime();
                          const end = new Date(p.heureFin).getTime();
                          const diff = (end - start) / (1000 * 60 * 60);
                          return `${diff.toFixed(1)}h`;
                        } catch { return '—'; }
                      })()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-0.5">Fin</p>
                    <p className="text-lg font-extrabold text-gray-800">{formatTime(p.heureFin)}</p>
                  </div>
                </div>

                {/* Actions (admin seulement) */}
                {isAdmin && (
                <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditing(p); setForm({ jour: selectedDate, heureDebut: formatTime(p.heureDebut), heureFin: formatTime(p.heureFin), utilisateurId: String(p.utilisateurId), statut: p.statut || 'ACTIF' }); setShowForm(true); }}
                    className="flex-1 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 font-semibold cursor-pointer">✏️ Modifier</button>
                  <button onClick={() => handleDelete(p.id)}
                    className="py-1.5 px-3 text-xs rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-semibold cursor-pointer">🗑</button>
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editing ? '✏️ Modifier le planning' : '+ Nouveau planning'}</h3>

            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Date</label>
            <input type="date" value={form.jour} onChange={e => setForm({...form, jour: e.target.value})}
              className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />

            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Heure début</label>
                <input type="time" value={form.heureDebut} onChange={e => setForm({...form, heureDebut: e.target.value})}
                  className="w-full h-11 bg-gray-50 border rounded-xl px-4" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Heure fin</label>
                <input type="time" value={form.heureFin} onChange={e => setForm({...form, heureFin: e.target.value})}
                  className="w-full h-11 bg-gray-50 border rounded-xl px-4" />
              </div>
            </div>

            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Employé</label>
            <select value={form.utilisateurId} onChange={e => setForm({...form, utilisateurId: e.target.value})}
              className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4">
              <option value="">Sélectionner...</option>
              {users.map(u => <option key={u.id} value={String(u.id)}>{u.nom} ({u.role})</option>)}
            </select>

            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Statut</label>
            <select value={form.statut} onChange={e => setForm({...form, statut: e.target.value})}
              className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4">
              <option value="ACTIF">✅ Actif</option>
              <option value="ABSENT">❌ Absent</option>
              <option value="CONGE">🏖️ Congé</option>
            </select>

            <button onClick={handleSave} disabled={saving}
              className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-bold cursor-pointer hover:bg-orange-600 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
              {editing ? 'Enregistrer' : 'Ajouter'}
            </button>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="w-full mt-3 py-2 text-gray-400 cursor-pointer">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
