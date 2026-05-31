import { useEffect, useState, useMemo, useRef } from 'react';
import { menuApi } from '../services/api';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { API_URL } from '../config';
import { useToast } from '../services/toast';
import { useDialog } from '../services/dialog';

export default function MenuPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const toast = useToast();
  const dialog = useDialog();
  const [categories, setCategories] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nom: '', prix: '', categorieId: 0, tempsPreparation: 15 });
  const [editing, setEditing] = useState<any>(null);
  const [showCatForm, setShowCatForm] = useState(false);
  const [catForm, setCatForm] = useState({ nom: '', ordreService: 1, destination: 'CUISINE' });
  const [imageUploading, setImageUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  // Variantes
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [variantMenu, setVariantMenu] = useState<any>(null);
  const [variantForm, setVariantForm] = useState({ nom: '', prix: '', image: '' });
  const [variantSaving, setVariantSaving] = useState(false);
  const [variantImage, setVariantImage] = useState<File | null>(null);

  const load = async () => {
    try {
      const [catRes, menuRes] = await Promise.all([menuApi.getCategories(), menuApi.getMenus()]);
      setCategories(catRes.data || []); setMenus(menuRes.data || []);
      if (catRes.data?.length > 0 && !activeCat) setActiveCat(catRes.data[0].id);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = activeCat ? menus.filter(m => m.categorieId === activeCat) : menus;
    if (search) {
      list = list.filter(m => m.nom.toLowerCase().includes(search.toLowerCase()));
    }
    return list;
  }, [menus, activeCat, search]);

  const resetForm = () => {
    setForm({ nom: '', prix: '', categorieId: activeCat || 0, tempsPreparation: 15 });
    setEditing(null); setSelectedImage(null); setPreview(null);
  };

  const handleSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!form.nom || !form.prix) return;
    try {
      const payload = { ...form, prix: parseFloat(form.prix) };

      let menuId = editing?.id;
      if (editing) {
        await menuApi.updateMenu(editing.id, payload);
      } else {
        const { data: newMenu } = await menuApi.createMenu({ ...payload, categorieId: activeCat, restaurantId: user?.restaurantId });
        menuId = newMenu.id;
      }

      // Upload image after menu is created/updated
      if (selectedImage && menuId) {
        setImageUploading(true);
        const fd = new FormData();
        fd.append('image', selectedImage);
        try { await menuApi.uploadImage(menuId, fd); } catch {}
        setImageUploading(false);
      }

      setShowForm(false); resetForm(); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); setImageUploading(false); }
  };

  const handleDelete = async (id: number) => {
    dialog.confirm({ title: 'Supprimer ce plat ?', message: 'Cette action est irréversible.', danger: true, confirmLabel: 'Supprimer', onConfirm: async () => { try { await menuApi.deleteMenu(id); load(); toast.success('Plat supprimé'); } catch {} } });
  };

  // ---- Variantes ----
  const openVariants = (m: any) => { setVariantMenu(m); setShowVariantModal(true); setVariantForm({ nom: '', prix: '', image: '' }); setVariantImage(null); };

  const handleAddVariant = async () => {
    if (!variantForm.nom || !variantForm.prix) { toast.error('Nom et prix requis'); return; }
    setVariantSaving(true);
    try {
      let imageUrl = variantForm.image || '';
      if (variantImage && variantMenu?.id) {
        const fd = new FormData(); fd.append('image', variantImage);
        const { data: uploadData } = await menuApi.uploadImage(variantMenu.id, fd);
        imageUrl = uploadData.imageUrl || uploadData.url || '';
      }
      await menuApi.addVariant(variantMenu.id, { nom: variantForm.nom, prix: parseFloat(variantForm.prix), image: imageUrl });
      toast.success('Variante ajoutée');
      setVariantForm({ nom: '', prix: '', image: '' }); setVariantImage(null); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
    finally { setVariantSaving(false); }
  };

  const handleDeleteVariant = async (variantId: number) => {
    dialog.confirm({ title: 'Supprimer cette variante ?', message: 'Cette action est irréversible.', danger: true, confirmLabel: 'Supprimer', onConfirm: async () => {
      try { await menuApi.deleteVariant(variantId); load(); toast.success('Variante supprimée'); } catch {}
    }});
  };

  const handleAddCat = async () => {
    if (!catForm.nom) return;
    try { await menuApi.createCategorie({ ...catForm, restaurantId: user?.restaurantId }); setShowCatForm(false); setCatForm({ nom: '', ordreService: 1, destination: 'CUISINE' }); load(); } catch {}
  };

  const imgUrl = (path: string) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${API_URL}${path}`;
  };

  return (
    <div className="p-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-gray-800">🍽️ Menu</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowCatForm(true)} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl font-semibold cursor-pointer hover:bg-gray-50">+ Catégorie</button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="bg-orange-500 text-white px-5 py-2 rounded-xl font-semibold cursor-pointer hover:bg-orange-600">+ Plat</button>
          <a href={`${API_URL}/modele-menu.csv`} download className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl font-semibold cursor-pointer hover:bg-gray-200 no-underline">📄 Modèle</a>
          <label className="bg-green-500 text-white px-4 py-2 rounded-xl font-semibold cursor-pointer hover:bg-green-600">
            📥 Importer CSV
            <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const fd = new FormData();
              fd.append('file', file);
              try {
                const { data } = await menuApi.importCsv(fd);
                toast.success(data.message || 'Import réussi');
                load();
              } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur import'); }
              e.target.value = '';
            }} />
          </label>
        </div>
      </div>

      {/* Recherche */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Rechercher un plat..."
        className="w-full h-10 bg-white border rounded-xl px-4 text-sm mb-4" />

      {/* Catégories */}
      <div className="flex gap-2 flex-wrap mb-6">
        {categories.map(c => (
          <button key={c.id} onClick={() => setActiveCat(c.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${activeCat === c.id ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {c.destination === 'BAR' ? '🍸' : c.destination === 'DESSERT' ? '🍰' : '🍳'} {c.nom}
          </button>
        ))}
      </div>

      {/* Liste plats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(m => (
          <div key={m.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all">
            {/* Image */}
            <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
              {m.image && imgUrl(m.image) ? (
                <img src={imgUrl(m.image)!} alt={m.nom} className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl text-gray-300">🍽️</span>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-bold text-gray-800 mb-1">{m.nom}</h3>
              <p className="text-2xl font-extrabold text-orange-500 mb-2">{m.prix} {user?.devise || '€'}</p>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs text-gray-400">{m.tempsPreparation} min</p>
                <button onClick={async (e) => { e.stopPropagation(); try { await menuApi.toggleDisponibleDemain(m.id); load(); } catch {} }}
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold cursor-pointer hover:opacity-80 ${m.disponibleDemain === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {m.disponibleDemain === 0 ? '✅ Disponible' : '❌ Pas disponible'}
                </button>
              </div>
              {/* Variantes */}
              {m.variants?.length > 0 && (
                <div className="mb-3">
                  {m.variants.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between text-xs px-2 py-1 bg-gray-50 rounded-lg mb-1">
                      <span className="font-medium text-gray-700">{v.nom}</span>
                      <span className="font-bold text-orange-500">{parseFloat(v.prix).toFixed(2)} {user?.devise || '€'}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <button onClick={(e) => { e.stopPropagation(); openVariants(m); }}
                  className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg font-semibold cursor-pointer hover:bg-purple-100">📋 Variantes ({m.variants?.length || 0})</button>
                <button onClick={() => { setEditing(m); setForm({ nom: m.nom, prix: String(m.prix), categorieId: m.categorieId, tempsPreparation: m.tempsPreparation }); setShowForm(true); }}
                  className="text-xs px-3 py-1.5 bg-gray-100 rounded-lg font-semibold cursor-pointer hover:bg-gray-200">✏️ Modifier</button>
                <button onClick={() => handleDelete(m.id)} className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg font-semibold cursor-pointer hover:bg-red-100 ml-auto">🗑 Supprimer</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-center text-gray-400 py-10">Aucun plat trouvé</p>}

      {/* Modal plat */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-slideUp my-8" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editing ? '✏️ Modifier' : '+ Nouveau plat'}</h3>

            {/* Image preview + upload */}
            <div className="mb-4">
              <div className="h-40 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden mb-2 cursor-pointer" onClick={() => fileRef.current?.click()}>
                {preview ? (
                  <img src={preview} alt="" className="w-full h-full object-cover" />
                ) : editing?.image && imgUrl(editing.image) ? (
                  <img src={imgUrl(editing.image)!} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center text-gray-400">
                    <span className="text-4xl block mb-1">📷</span>
                    <span className="text-xs">Cliquer pour ajouter une image</span>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleSelectImage} className="hidden" />
              {(preview || editing?.image) && (
                <button onClick={() => { setSelectedImage(null); setPreview(null); if (editing) setEditing({...editing, image: ''}); }}
                  className="text-xs text-red-500 cursor-pointer hover:underline">Supprimer l'image</button>
              )}
            </div>

            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Image</label>
            {/* ... image upload div already exists above ... */}
            <label className="block text-sm font-semibold text-gray-600 mb-1.5 mt-4">Nom du plat</label>
            <input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Ex: Poulet DG" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Prix</label>
            <input value={form.prix} onChange={e => setForm({...form, prix: e.target.value})} type="number" step="0.01" placeholder="Ex: 15.00" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Temps de préparation (minutes)</label>
            <input value={form.tempsPreparation} onChange={e => setForm({...form, tempsPreparation: parseInt(e.target.value) || 0})} type="number" placeholder="Ex: 30" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4" />
            <button onClick={handleSave} disabled={imageUploading}
              className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-bold cursor-pointer hover:bg-orange-600 disabled:opacity-60">
              {imageUploading ? 'Upload image...' : editing ? 'Enregistrer' : 'Créer'}
            </button>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="w-full mt-3 py-2 text-gray-400 cursor-pointer">Annuler</button>
          </div>
        </div>
      )}

      {/* Modal catégorie */}
      {showCatForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCatForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">+ Catégorie</h3>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Nom</label>
            <input value={catForm.nom} onChange={e => setCatForm({...catForm, nom: e.target.value})} placeholder="Ex: Boissons" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Destination</label>
            <select value={catForm.destination} onChange={e => setCatForm({...catForm, destination: e.target.value})} className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4">
              <option>CUISINE</option><option>BAR</option><option>DESSERT</option>
            </select>
            <button onClick={handleAddCat} className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-bold cursor-pointer">Créer</button>
            <button onClick={() => setShowCatForm(false)} className="w-full mt-3 py-2 text-gray-400 cursor-pointer">Annuler</button>
          </div>
        </div>
      )}
      {/* Modal Variantes */}
      {showVariantModal && variantMenu && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowVariantModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">📋 Variantes</h3>
            <p className="text-sm text-gray-400 mb-4">{variantMenu.nom} — {variantMenu.variants?.length || 0} variante(s)</p>

            {variantMenu.variants?.length > 0 && (
              <div className="space-y-2 mb-4">
                {variantMenu.variants.map((v: any) => (
                  <div key={v.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border">
                    {(v.image || variantMenu.image) ? (
                      <img src={(v.image ? imgUrl(v.image) : imgUrl(variantMenu.image)) || ''} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-xs text-gray-400">🍽</div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-gray-800">{v.nom}</p>
                      <p className="font-bold text-sm text-orange-500">{parseFloat(v.prix).toFixed(2)} {user?.devise || '€'}</p>
                    </div>
                    <button onClick={() => handleDeleteVariant(v.id)}
                      className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-500 cursor-pointer hover:bg-red-100">🗑</button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-4">
              <h4 className="font-semibold text-gray-800 mb-3">+ Ajouter une variante</h4>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Nom</label>
              <input value={variantForm.nom} onChange={e => setVariantForm({...variantForm, nom: e.target.value})}
                placeholder="Ex: Avec alcool" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Prix</label>
              <input value={variantForm.prix} onChange={e => setVariantForm({...variantForm, prix: e.target.value})}
                type="number" step="0.01" placeholder="Ex: 4000" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Image (optionnel)</label>
              <input type="file" accept="image/*" onChange={e => setVariantImage(e.target.files?.[0] || null)}
                className="w-full text-sm mb-4" />
              <button onClick={handleAddVariant} disabled={variantSaving}
                className="w-full py-2.5 bg-purple-500 text-white rounded-xl font-bold cursor-pointer hover:bg-purple-600 disabled:opacity-60 flex items-center justify-center gap-2">
                {variantSaving && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
                Ajouter la variante
              </button>
            </div>
            <button onClick={() => setShowVariantModal(false)} className="w-full mt-3 py-2 text-gray-400 cursor-pointer">Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
