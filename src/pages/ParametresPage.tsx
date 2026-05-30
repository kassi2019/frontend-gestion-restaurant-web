import { useEffect, useState, useRef } from 'react';
import { restaurantApi, authApi } from '../services/api';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { updateUser } from '../store/authSlice';
import { API_URL } from '../config';
import { useToast } from '../services/toast';

export default function ParametresPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch();
  const toast = useToast();
  const [form, setForm] = useState({ nom: '', adresse: '', telephone: '', devise: '' });
  const [loading, setLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (user?.restaurantId) {
      restaurantApi.getInfo(user.restaurantId).then(({ data }) => {
        setForm({ nom: data.nom || '', adresse: data.adresse || '', telephone: data.telephone || '', devise: data.devise || '' });
      }).catch(() => {});
    }
  }, [user?.restaurantId]);

  const handleSave = async () => {
    if (!user?.restaurantId || !form.nom) return;
    setLoading(true);
    try {
      const { data } = await restaurantApi.update(user.restaurantId, form);
      dispatch(updateUser({ restaurantNom: data.nom, devise: data.devise, restaurantTelephone: data.telephone }));
      toast.success('Restaurant mis à jour');
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
    finally { setLoading(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await authApi.uploadPhoto(fd);
      dispatch(updateUser({ photo: data.photoUrl || data.url || data.photo }));
    } catch { toast.error('Erreur upload photo'); }
    finally { setPhotoUploading(false); }
  };

  const photoUrl = user?.photo
    ? (user.photo.startsWith('http') ? user.photo : `${API_URL}${user.photo}`)
    : null;

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <span className="text-4xl block mb-4">🔐</span>
          <p className="text-gray-500 font-semibold">Réservé à l'administrateur</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 animate-fadeIn max-w-2xl">
      <h1 className="text-2xl font-extrabold text-gray-800 mb-6">⚙️ Paramètres du restaurant</h1>

      {/* Profil utilisateur */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <h3 className="font-bold text-gray-800 mb-4">👤 Mon profil</h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative cursor-pointer" onClick={() => fileRef.current?.click()} title="Cliquer pour changer la photo">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-orange-200" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-orange-50 border-2 border-orange-200 flex items-center justify-center text-3xl font-bold text-orange-400">
                {user?.nom?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs">📷</div>
          </div>
          <div>
            <p className="font-bold text-gray-800">{user?.nom}</p>
            <p className="text-sm text-gray-400">{user?.role} · {user?.telephone}</p>
            {photoUploading && <p className="text-xs text-orange-500 mt-1">Upload en cours...</p>}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
      </div>

      {/* Infos restaurant */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4">🏪 Informations du restaurant</h3>

        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Nom du restaurant</label>
        <input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Ex: Restaurant Chez Pedro" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4" />

        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Adresse</label>
        <textarea value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} placeholder="Ex: 123 Avenue du Restaurant, Kinshasa" rows={3} className="w-full bg-gray-50 border rounded-xl px-4 py-3 mb-4 resize-none" />

        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Téléphone</label>
        <input value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} placeholder="Ex: +243990000000" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4" />

        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Devise</label>
        <input value={form.devise} onChange={e => setForm({...form, devise: e.target.value})} maxLength={10} placeholder="Ex: €, FC, $" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4" />

        <button onClick={handleSave} disabled={loading}
          className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold cursor-pointer hover:bg-orange-600 disabled:opacity-60 transition-colors">
          {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </button>
      </div>
    </div>
  );
}
