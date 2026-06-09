import { useEffect, useState, useCallback } from 'react';
import { authApi } from '../services/api';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../store';
import { useToast } from '../services/toast';
import { useDialog } from '../services/dialog';

const PRESETS = [
  { label: '30 j', value: '30' }, { label: '1 an', value: '365' }, { label: '2 ans', value: '730' },
  { label: '3 ans', value: '1095' }, { label: '4 ans', value: '1460' }, { label: '5 ans', value: '1825' },
];

export default function SuperCodesPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const toast = useToast();
  const dialog = useDialog();
  const navigate = useNavigate();
  const [duree, setDuree] = useState('30');
  const [nombre, setNombre] = useState('5');
  const [generating, setGenerating] = useState(false);
  const [codes, setCodes] = useState<any[]>([]);
  const [tab, setTab] = useState<'dispo' | 'utilises'>('dispo');
  const [visibleIds, setVisibleIds] = useState<Set<number>>(new Set());
  const [generated, setGenerated] = useState<string[]>([]);
  const [showGenerated, setShowGenerated] = useState(false);

  const load = useCallback(async () => {
    try { const { data } = await authApi.listeCodes(); setCodes(data || []); } catch {}
  }, []);

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') { navigate('/'); return; }
    load();
  }, [user, navigate, load]);

  const toggleVisible = (id: number) => {
    setVisibleIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await authApi.genererCodes({ dureeJours: parseInt(duree), nombre: parseInt(nombre) });
      setGenerated(data.codes || []);
      setShowGenerated(false);
      load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
    finally { setGenerating(false); }
  };

  const handleDelete = async (id: number) => {
    dialog.confirm({ title: 'Supprimer ce code ?', message: 'Ce code ne pourra plus être utilisé.', danger: true, confirmLabel: 'Supprimer', onConfirm: async () => { try { await authApi.supprimerCode(id); toast.success('Code supprimé'); load(); } catch {} } });
  };

  const handleDashboard = async (restaurantId: number) => {
    try {
      const { data } = await authApi.getHistorique(restaurantId);
      toast.info(`Historique de ${data.restaurant?.nom} — ${data.historique?.length || 0} entrée(s)`);
    } catch {}
  };

  const filtered = tab === 'dispo' ? codes.filter((c: any) => !c.estUtilise) : codes.filter((c: any) => c.estUtilise);

  return (
    <div className="p-6 animate-fadeIn">
      <h1 className="text-2xl font-extrabold text-gray-800 mb-6">🔑 Générer des codes</h1>

      {/* Formulaire génération */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <label className="block text-sm font-semibold text-gray-600 mb-2">Durée</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {PRESETS.map(p => (
            <button key={p.value} onClick={() => setDuree(p.value)}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${duree === p.value ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Durée personnalisée (jours)</label>
        <input value={duree} onChange={e => setDuree(e.target.value)} type="number"
          placeholder="Ex: 90" className="w-full h-11 bg-gray-50 border rounded-xl px-4 text-sm mb-4 italic" />

        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Nombre de codes à générer</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} type="number" min={1} max={100}
          placeholder="Ex: 5"
          className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4" />

        <button onClick={handleGenerate} disabled={generating}
          className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold cursor-pointer hover:bg-orange-600 disabled:opacity-60">
          {generating ? 'Génération...' : `Générer ${nombre} code(s)`}
        </button>

        {/* Codes fraîchement générés */}
        {generated.length > 0 && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-green-700">{generated.length} code(s) généré(s)</p>
              <button onClick={() => setShowGenerated(!showGenerated)}
                className="text-sm font-semibold text-green-700 cursor-pointer hover:underline">
                {showGenerated ? '🙈 Masquer' : '👁 Afficher'}
              </button>
            </div>
            {showGenerated && (
              <div className="space-y-1">
                {generated.map((c) => (
                  <p key={c} className="text-sm font-mono font-bold text-gray-800 bg-white rounded-lg px-3 py-2 border">{c}</p>
                ))}
              </div>
            )}
            <button onClick={() => { setGenerated([]); setShowGenerated(false); }}
              className="mt-2 text-xs text-green-600 cursor-pointer hover:underline">Fermer</button>
          </div>
        )}
      </div>

      {/* Gestion des plans d'abonnement */}
      <GestionPlans />

      {/* Vérification des paiements */}
      <PaiementsEnAttente />

      {/* Dashboard super admin */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">📊 Dashboard</h3>
          <button onClick={async () => {
            try { const { data } = await authApi.getDashboard();
              toast.info(`Total: ${data.totalRestos} restos | En règle: ${data.restosValides} | En essai: ${data.restosEssai} | Expirés: ${data.restosExpires}`);
            } catch {}
          }} className="text-sm text-orange-500 font-semibold cursor-pointer hover:underline">Stats rapides</button>
        </div>
        <p className="text-sm text-gray-500">🟢 {codes.filter((c: any) => !c.estUtilise).length} dispo · 🔴 {codes.filter((c: any) => c.estUtilise).length} utilisés · 📊 {codes.length} total</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button onClick={() => setTab('dispo')}
            className={`flex-1 py-3 text-sm font-bold cursor-pointer transition-colors ${tab === 'dispo' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-400 hover:text-gray-600'}`}>
            🟢 Disponibles ({codes.filter((c: any) => !c.estUtilise).length})
          </button>
          <button onClick={() => setTab('utilises')}
            className={`flex-1 py-3 text-sm font-bold cursor-pointer transition-colors ${tab === 'utilises' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-400 hover:text-gray-600'}`}>
            🔴 Utilisés ({codes.filter((c: any) => c.estUtilise).length})
          </button>
        </div>

        <div className="p-4">
          {filtered.map((c: any) => {
            const isVisible = visibleIds.has(c.id);
            return (
              <div key={c.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div className="flex-1">
                  <p className={`font-mono font-bold text-sm ${c.estUtilise ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {isVisible && c.codeClair ? c.codeClair : (c.codeMasque || 'RESTO-••••-••••-••••')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {c.dureeJours} jours
                    {c.estUtilise ? ` · Utilisé par ${c.restaurant?.nom || '—'}` : ' · Disponible'}
                    {c.dateUtilisation ? ` · ${new Date(c.dateUtilisation).toLocaleDateString('fr-FR')}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleVisible(c.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 cursor-pointer hover:bg-gray-200 text-sm">
                    {isVisible ? '🙈' : '👁'}
                  </button>
                  {c.estUtilise && c.restaurant?.id && (
                    <button onClick={() => handleDashboard(c.restaurant.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 cursor-pointer hover:bg-blue-100 text-sm">📜</button>
                  )}
                  {!c.estUtilise && (
                    <button onClick={() => handleDelete(c.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 cursor-pointer hover:bg-red-100 text-sm">🗑</button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-gray-400 py-6">Aucun code</p>}
        </div>
      </div>
    </div>
  );
}

// Composant vérification des paiements
function PaiementsEnAttente() {
  const toast = useToast();
  const dialog = useDialog();
  const [paiements, setPaiements] = useState<any[]>([]);

  const load = async () => {
    try { const { data } = await authApi.getPaiementsEnAttente(); setPaiements(data || []); } catch {}
  };
  useEffect(() => { load(); }, []);

  const confirmer = (p: any) => {
    dialog.confirm({
      title: 'Confirmer le paiement ?',
      message: `${p.restaurant?.nom} — ${Number(p.montant).toLocaleString('fr-FR')} F — ${p.dureeJours}j. L'abonnement sera activé automatiquement.`,
      danger: false, confirmLabel: 'Confirmer',
      onConfirm: async () => {
        try {
          const { data } = await authApi.confirmerPaiement(p.id);
          toast.success(data.message || 'Activé !');
          load();
        } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
      }
    });
  };

  const rejeter = (p: any) => {
    dialog.confirm({
      title: 'Rejeter le paiement ?',
      message: `${p.restaurant?.nom} — ${Number(p.montant).toLocaleString('fr-FR')} F. Le restaurant pourra réessayer.`,
      danger: true, confirmLabel: 'Rejeter',
      onConfirm: async () => {
        try {
          await authApi.rejeterPaiement(p.id);
          toast.success('Paiement rejeté');
          load();
        } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
      }
    });
  };

  if (paiements.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-200 mb-6">
      <h3 className="font-bold text-gray-800 mb-4">💳 Paiements en attente ({paiements.length})</h3>
      <div className="space-y-3">
        {paiements.map((p: any) => (
          <div key={p.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-100">
            <div className="flex-1">
              <p className="font-semibold text-gray-800">{p.restaurant?.nom || '—'}</p>
              <p className="text-xs text-gray-500">
                {p.plan?.nom} · {p.dureeJours}j · Réf: {p.reference}
              </p>
              {p.infosPaiement && <p className="text-xs text-gray-400 mt-1">💬 {p.infosPaiement}</p>}
              <p className="text-xs text-gray-400">{new Date(p.dateCreation).toLocaleString('fr-FR')}</p>
            </div>
            <div className="text-right ml-4">
              <p className="font-extrabold text-orange-600 text-lg">{Number(p.montant).toLocaleString('fr-FR')} F</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => rejeter(p)}
                  className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-red-200">❌ Rejeter</button>
                <button onClick={() => confirmer(p)}
                  className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-green-600">✅ Confirmer</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Composant gestion des plans d'abonnement
function GestionPlans() {
  const toast = useToast();
  const dialog = useDialog();
  const [plans, setPlans] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ nom: '', dureeJours: '30', prix: '5000' });

  const load = async () => {
    try { const { data } = await authApi.getAllPlans(); setPlans(data || []); } catch {}
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ nom: '', dureeJours: '30', prix: '5000' }); setShowForm(true); };
  const openEdit = (p: any) => { setEditing(p); setForm({ nom: p.nom, dureeJours: String(p.dureeJours), prix: String(p.prix) }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.nom || !form.dureeJours || !form.prix) { toast.error('Tous les champs sont requis'); return; }
    try {
      if (editing) {
        await authApi.updatePlan(editing.id, { nom: form.nom, dureeJours: parseInt(form.dureeJours), prix: parseFloat(form.prix) });
        toast.success('Plan mis à jour');
      } else {
        await authApi.createPlan({ nom: form.nom, dureeJours: parseInt(form.dureeJours), prix: parseFloat(form.prix) });
        toast.success('Plan créé');
      }
      setShowForm(false); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const handleDelete = (p: any) => {
    dialog.confirm({
      title: 'Supprimer ce plan ?', message: `Le plan "${p.nom}" sera désactivé.`, danger: true, confirmLabel: 'Supprimer',
      onConfirm: async () => { try { await authApi.deletePlan(p.id); toast.success('Plan désactivé'); load(); } catch {} }
    });
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800">💎 Plans d'abonnement</h3>
        <button onClick={openNew} className="text-sm font-bold bg-orange-500 text-white px-4 py-2 rounded-xl cursor-pointer hover:bg-orange-600">
          + Nouveau plan
        </button>
      </div>

      <div className="space-y-2">
        {plans.map((p: any) => (
          <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-4">
              <span className="font-extrabold text-gray-800">{p.nom}</span>
              <span className="text-sm text-gray-500">{p.dureeJours} jours</span>
              <span className="text-sm font-bold text-orange-600">{Number(p.prix).toLocaleString('fr-FR')} F</span>
              {!p.actif && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">Inactif</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(p)} className="text-xs px-3 py-1 bg-gray-200 rounded-lg cursor-pointer hover:bg-gray-300">✏️</button>
              {p.actif && <button onClick={() => handleDelete(p)} className="text-xs px-3 py-1 bg-red-100 text-red-600 rounded-lg cursor-pointer hover:bg-red-200">🗑</button>}
            </div>
          </div>
        ))}
        {plans.length === 0 && <p className="text-center text-gray-400 py-4">Aucun plan</p>}
      </div>

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editing ? 'Modifier le plan' : 'Nouveau plan'}</h3>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Nom</label>
            <input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="Ex: Mensuel" className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Durée (jours)</label>
            <input type="number" value={form.dureeJours} onChange={e => setForm({ ...form, dureeJours: e.target.value })} className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Prix (FCFA)</label>
            <input type="number" value={form.prix} onChange={e => setForm({ ...form, prix: e.target.value })} className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4" />
            <button onClick={handleSave} className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-bold cursor-pointer hover:bg-orange-600">Enregistrer</button>
            <button onClick={() => setShowForm(false)} className="w-full mt-3 py-2 text-gray-400 cursor-pointer">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
