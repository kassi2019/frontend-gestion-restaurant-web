import { useEffect, useState, useRef } from 'react';
import { restaurantApi, authApi, zonesApi } from '../services/api';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { updateUser } from '../store/authSlice';
import { API_URL } from '../config';
import { useToast } from '../services/toast';

function ZonesManager() {
  const [zones, setZones] = useState<any[]>([]);
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);
  const [zoneForm, setZoneForm] = useState({ nom: '', coefficient: '1.0' });
  const toast = useToast();

  const loadZones = () => {
    zonesApi.getAll().then(r => setZones(r.data || [])).catch(() => {});
  };
  useEffect(() => { loadZones(); }, []);

  const handleSaveZone = async () => {
    if (!zoneForm.nom) { toast.error('Nom requis'); return; }
    const c = parseFloat(zoneForm.coefficient) || 1.0;
    try {
      if (editingZone) { await zonesApi.update(editingZone.id, { nom: zoneForm.nom, coefficient: c }); toast.success('Zone modifiée'); }
      else { await zonesApi.create({ nom: zoneForm.nom, coefficient: c }); toast.success('Zone créée'); }
      setShowZoneForm(false); setEditingZone(null); setZoneForm({ nom: '', coefficient: '1.0' }); loadZones();
    } catch { toast.error('Erreur'); }
  };

  const handleDeleteZone = async (id: number) => { if (confirm('Supprimer cette zone ?')) { await zonesApi.delete(id); loadZones(); } };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-600 mb-1.5">🏷️ Zones tarifaires</label>
      <div className="bg-gray-50 rounded-xl p-4 mb-4">
        {zones.map(zone => (
          <div key={zone.id} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-gray-700">{zone.nom}</span>
              <span className="text-sm bg-white px-2 py-0.5 rounded-full border">x{Number(zone.coefficient).toFixed(1)}</span>
              <span className="text-xs text-gray-400">({zone.tables?.length || 0} tables)</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setEditingZone(zone); setZoneForm({ nom: zone.nom, coefficient: String(zone.coefficient) }); setShowZoneForm(true); }}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer">✏️</button>
              <button onClick={() => handleDeleteZone(zone.id)} className="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-500 rounded-lg cursor-pointer">🗑</button>
            </div>
          </div>
        ))}
        {zones.length === 0 && <p className="text-xs text-gray-400 py-2">Aucune zone. Créez des zones (ex: VIP, VVIP) et assignez-leur des tables.</p>}
        <button onClick={() => { setEditingZone(null); setZoneForm({ nom: '', coefficient: '1.0' }); setShowZoneForm(true); }}
          className="mt-3 px-4 py-2 bg-orange-100 text-orange-600 rounded-xl text-sm font-semibold cursor-pointer hover:bg-orange-200">+ Ajouter une zone</button>
      </div>
      {showZoneForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowZoneForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editingZone ? 'Modifier' : 'Nouvelle'} zone</h3>
            <input value={zoneForm.nom} onChange={e => setZoneForm({...zoneForm, nom: e.target.value})} placeholder="Nom (ex: VIP)" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />
            <label className="block text-sm font-semibold text-gray-600 mb-1">Coefficient</label>
            <input type="number" step="0.1" min="0.5" max="5" value={zoneForm.coefficient} onChange={e => setZoneForm({...zoneForm, coefficient: e.target.value})}
              className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4" />
            <p className="text-xs text-gray-400 mb-3">1.0 = prix normal · 1.2 = +20% · 1.5 = +50%</p>
            <button onClick={handleSaveZone} className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-bold cursor-pointer hover:bg-orange-600">Enregistrer</button>
            <button onClick={() => setShowZoneForm(false)} className="w-full mt-3 py-2 text-gray-400 cursor-pointer">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ParametresPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch();
  const toast = useToast();
  const [form, setForm] = useState({ nom: '', adresse: '', telephone: '', devise: '', logo: '', modeGestion: 'RECEPTION', zonesTarifaires: '{}' });
  const [loading, setLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (user?.restaurantId) {
      restaurantApi.getInfo(user.restaurantId).then(({ data }) => {
        setForm({ nom: data.nom || '', adresse: data.adresse || '', telephone: data.telephone || '', devise: data.devise || '', logo: data.logo || '', modeGestion: data.modeGestion || 'RECEPTION', zonesTarifaires: data.zonesTarifaires || '{}' });
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.restaurantId) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await restaurantApi.uploadLogo(user.restaurantId, fd);
      setForm({ ...form, logo: data.logoUrl });
      toast.success('Logo mis à jour');
    } catch { toast.error('Erreur upload logo'); }
    finally { setLogoUploading(false); }
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

        {/* Logo du restaurant */}
        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Logo du restaurant</label>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative cursor-pointer" onClick={() => logoRef.current?.click()} title="Cliquer pour changer le logo">
            {form.logo ? (
              <img src={form.logo.startsWith('http') ? form.logo : `${API_URL}${form.logo}`} alt="" className="w-24 h-24 rounded-2xl object-cover border-2 border-gray-200" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-3xl text-gray-400">
                🏪
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs">📷</div>
          </div>
          <div>
            <p className="text-sm text-gray-500">Format JPEG, PNG ou WEBP</p>
            {logoUploading && <p className="text-xs text-orange-500 mt-1">Upload en cours...</p>}
          </div>
        </div>
        <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />

        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Nom du restaurant</label>
        <input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Ex: Restaurant Chez Pedro" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4" />

        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Adresse</label>
        <textarea value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} placeholder="Ex: 123 Avenue du Restaurant, Kinshasa" rows={3} className="w-full bg-gray-50 border rounded-xl px-4 py-3 mb-4 resize-none" />

        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Téléphone</label>
        <input value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} placeholder="Ex: +243990000000" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4" />

        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Devise</label>
        <input value={form.devise} onChange={e => setForm({...form, devise: e.target.value})} maxLength={10} placeholder="Ex: €, FC, $" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4" />

        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Mode de gestion des commandes</label>
        <select value={form.modeGestion} onChange={e => setForm({...form, modeGestion: e.target.value})} className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4">
          <option value="RECEPTION">📋 Centralisé — La réception valide les commandes</option>
          <option value="SERVEUR">👤 Serveur — Les serveurs valident leurs commandes</option>
        </select>

        <ZonesManager />


        <button onClick={handleSave} disabled={loading}
          className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold cursor-pointer hover:bg-orange-600 disabled:opacity-60 transition-colors">
          {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </button>
      </div>
    </div>
  );
}
