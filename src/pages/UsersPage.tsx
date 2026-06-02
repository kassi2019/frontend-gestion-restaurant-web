import { useEffect, useState } from 'react';
import { usersApi, authApi } from '../services/api';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { API_URL } from '../config';
import { useToast } from '../services/toast';
import { useDialog } from '../services/dialog';

export default function UsersPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const toast = useToast();
  const dialog = useDialog();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ nom: '', telephone: '', mot_de_passe: '123456', role: 'SERVEUR' });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await usersApi.getAll(); setUsers(data || []); } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => { setForm({ nom: '', telephone: '', mot_de_passe: '123456', role: 'SERVEUR' }); setSelectedImage(null); setEditing(null); };

  const handleSave = async () => {
    if (!form.nom || !form.telephone) { toast.error('Nom et téléphone requis'); return; }
    setSaving(true);
    try {
      if (editing) {
        await usersApi.update(editing.id, { nom: form.nom, role: form.role });
        if (selectedImage) {
          const fd = new FormData(); fd.append('image', selectedImage); await authApi.uploadPhoto(fd);
        }
        toast.success('Utilisateur modifié');
      } else {
        await authApi.register({ ...form, restaurantId: user?.restaurantId });
        toast.success('Utilisateur créé');
      }
      setShowForm(false); resetForm(); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handleStatut = async (id: number, statut: string) => {
    try { await usersApi.updateStatut(id, statut); load(); toast.success(`Utilisateur ${statut === 'ACTIF' ? 'activé' : 'désactivé'}`); } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const handleDelete = async (id: number) => {
    dialog.confirm({ title: 'Supprimer cet utilisateur ?', message: 'Cette action est définitive.', danger: true, confirmLabel: 'Supprimer', onConfirm: async () => {
      try { await usersApi.delete(id); load(); toast.success('Utilisateur supprimé'); } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur suppression'); }
    }});
  };

  const openEdit = (u: any) => {
    setEditing(u); setForm({ nom: u.nom, telephone: u.telephone, mot_de_passe: '', role: u.role }); setShowForm(true);
  };

  const roleColor = (r: string) => r === 'ADMIN' ? 'text-purple-600 bg-purple-50' : r === 'SUPER_ADMIN' ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-100';

  return (
    <div className="p-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-gray-800">👥 Utilisateurs</h1>
        {isAdmin && (
          <button onClick={() => { resetForm(); setShowForm(true); }} className="bg-orange-500 text-white px-5 py-2 rounded-xl font-semibold cursor-pointer hover:bg-orange-600">+ Ajouter</button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent" /></div>
        ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Photo</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Nom</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Téléphone</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Rôle</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Statut</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="py-3 px-4">
                  {u.photo ? (
                    <img src={u.photo.startsWith('http') ? u.photo : `${API_URL}${u.photo}`} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-gray-200" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-orange-50 border-2 border-orange-200 flex items-center justify-center text-xs font-bold text-orange-400">{u.nom?.charAt(0)?.toUpperCase() || '?'}</div>
                  )}
                </td>
                <td className="py-3 px-4 font-semibold text-gray-800">{u.nom}</td>
                <td className="py-3 px-4 text-gray-500">{u.telephone}</td>
                <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${roleColor(u.role)}`}>{u.role}</span></td>
                <td className="py-3 px-4"><span className={`text-xs font-semibold ${u.statut === 'ACTIF' ? 'text-green-600' : 'text-red-500'}`}>{u.statut}</span></td>
                <td className="py-3 px-4">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(u)} className="px-2 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 cursor-pointer">✏️</button>
                    {u.statut === 'ACTIF'
                      ? <button onClick={() => handleStatut(u.id, 'INACTIF')} className="px-2 py-1 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer">🔒</button>
                      : <button onClick={() => handleStatut(u.id, 'ACTIF')} className="px-2 py-1 text-xs rounded-lg bg-green-50 text-green-600 hover:bg-green-100 cursor-pointer">🔓</button>
                    }
                    <button onClick={() => handleDelete(u.id)} className="px-2 py-1 text-xs rounded-lg bg-red-50 hover:bg-red-100 cursor-pointer">🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
        {!loading && users.length === 0 && <p className="text-center text-gray-400 py-10">Aucun utilisateur</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-slideUp my-8" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editing ? '✏️ Modifier' : '+ Nouvel utilisateur'}</h3>

            {/* Photo */}
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Photo</label>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-gray-200">
                {selectedImage ? (
                  <img src={URL.createObjectURL(selectedImage)} alt="" className="w-full h-full object-cover" />
                ) : editing?.photo ? (
                  <img src={editing.photo.startsWith('http') ? editing.photo : `${API_URL}${editing.photo}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400 text-2xl">📷</span>
                )}
              </div>
              <input type="file" accept="image/*" onChange={e => setSelectedImage(e.target.files?.[0] || null)} className="text-sm" />
            </div>

            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Nom complet</label>
            <input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Ex: Jean Dupont" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />

            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Téléphone</label>
            <input value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} placeholder="Ex: 0990000000" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />

            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Mot de passe {editing ? '(laisser vide si inchangé)' : ''}</label>
            <input value={form.mot_de_passe} onChange={e => setForm({...form, mot_de_passe: e.target.value})} placeholder="Mot de passe" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />

            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Rôle</label>
            <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4">
              <option>SERVEUR</option><option>CUISINE</option><option>BAR</option><option>CAISSIER</option><option>RECEPTIONNISTE</option><option>MANAGER</option><option>ADMIN</option>
            </select>

            <button onClick={handleSave} disabled={saving}
              className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-bold cursor-pointer hover:bg-orange-600 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
              {editing ? 'Enregistrer' : 'Créer'}
            </button>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="w-full mt-3 py-2 text-gray-400 cursor-pointer">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
