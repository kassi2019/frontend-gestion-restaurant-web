import { useEffect, useState } from 'react';
import { authApi, restaurantApi } from '../services/api';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { updateUser } from '../store/authSlice';
import { useToast } from '../services/toast';
import { useDialog } from '../services/dialog';

export default function AbonnementPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch();
  const toast = useToast();
  const dialog = useDialog();
  const [abo, setAbo] = useState<any>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resto, setResto] = useState<any>(null);
  const [showCloture, setShowCloture] = useState(false);
  const [clotureDate, setClotureDate] = useState(new Date().toISOString().slice(0, 10));
  const [clotureHeure, setClotureHeure] = useState('08:00');

  // Nouveau système
  const [plans, setPlans] = useState<any[]>([]);
  const [configPaiement, setConfigPaiement] = useState<any>(null);
  const [paiements, setPaiements] = useState<any[]>([]);
  const [showPlans, setShowPlans] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [paiementInfos, setPaiementInfos] = useState('');
  const [paiementLoading, setPaiementLoading] = useState(false);

  const load = async () => {
    // Chargement principal (indépendant du nouveau système)
    try {
      const [aboRes, restoRes] = await Promise.all([
        authApi.getAbonnement(),
        user?.restaurantId ? restaurantApi.getInfo(user.restaurantId) : null,
      ]);
      setAbo(aboRes.data);
      if (restoRes) setResto(restoRes.data);
    } catch {}
    // Nouveau système : chargé séparément pour ne pas bloquer la page
    try { const { data } = await authApi.getPlans(); setPlans(data || []); } catch {}
    try { const { data } = await authApi.getConfigPaiement(); setConfigPaiement(data); } catch {}
    try { const { data } = await authApi.getMesPaiements(); setPaiements(data || []); } catch {}
  };
  useEffect(() => { load(); }, []);

  const handleActiver = async () => {
    if (!code) return;
    setLoading(true);
    try {
      const { data } = await authApi.activerCode({ telephone: user!.telephone, code });
      dispatch(updateUser({ typeAbonnement: data.typeAbonnement, dateFinAbonnement: data.dateFinAbonnement }));
      setCode(''); load();
      toast.success(data.message || 'Abonnement activé');
    } catch (err: any) { toast.error(err.response?.data?.message || 'Code invalide'); }
    finally { setLoading(false); }
  };

  const initierPaiement = async () => {
    if (!selectedPlan) return;
    setPaiementLoading(true);
    try {
      const { data } = await authApi.initierPaiement({ planId: selectedPlan.id, infosPaiement: paiementInfos });
      setShowPlans(false);
      setSelectedPlan(null);
      setPaiementInfos('');
      load();
      toast.success('Paiement déclaré ! Réf: ' + data.reference + '. Le Super Admin va vérifier.');
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
    finally { setPaiementLoading(false); }
  };

  const handleCloture = () => {
    setClotureDate(new Date().toISOString().slice(0, 10));
    setClotureHeure('08:00');
    setShowCloture(true);
  };

  const execCloture = () => {
    dialog.confirm({
      title: 'Fermer le restaurant ?',
      message: 'Les clients ne pourront plus commander.',
      danger: true, confirmLabel: 'Fermer',
      onConfirm: async () => {
        const dateReouv = `${clotureDate}T${clotureHeure}:00`;
        try {
          await restaurantApi.update(user!.restaurantId, { statut: 'FERME', dateReouverture: dateReouv } as any);
          load(); toast.success('Restaurant fermé'); setShowCloture(false);
        } catch { toast.error('Erreur'); }
      } });
  };

  const handleReopen = async () => {
    try {
      await restaurantApi.update(user!.restaurantId, { statut: 'OUVERT', dateReouverture: null } as any);
      load();
    } catch {}
  };

  if (!abo) return <div className="p-6">Chargement...</div>;

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  return (
    <div className="p-6 animate-fadeIn max-w-2xl">
      <h1 className="text-2xl font-extrabold text-gray-800 mb-6">⭐ Abonnement</h1>

      {/* Statut */}
      <div className={`rounded-2xl p-6 mb-6 border-2 ${abo.estActif ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-extrabold">{abo.estActif ? '✅ Abonnement ACTIF' : '❌ Abonnement EXPIRÉ'}</p>
            <p className="text-sm text-gray-500 mt-1">
              Type : {abo.typeAbonnement === 'TRIAL' ? '🆓 Période d\'essai' : abo.typeAbonnement === 'MENSUEL' ? '📅 Mensuel' : abo.typeAbonnement === 'TRIMESTRIEL' ? '⭐ Trimestriel' : '👑 Annuel'}
            </p>
            <p className="text-sm text-gray-500">
              Expire le : {abo.dateFinAbonnement ? new Date(abo.dateFinAbonnement).toLocaleString('fr-FR') : '—'}
            </p>
          </div>
          <div className="text-center">
            <p className={`text-4xl font-extrabold ${abo.estActif ? 'text-green-600' : 'text-red-600'}`}>{abo.joursRestants}</p>
            <p className="text-xs text-gray-500">jours restants</p>
          </div>
        </div>
      </div>

      {/* NOUVEAU : Acheter un abonnement */}
      {isAdmin && plans.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <h3 className="font-bold text-gray-800 mb-3">💎 Acheter un abonnement</h3>
          <p className="text-sm text-gray-500 mb-4">Choisissez votre plan, payez via Wave ou Orange Money, puis confirmez.</p>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {plans.map((plan: any) => (
              <button
                key={plan.id}
                onClick={() => { setSelectedPlan(plan); setShowPlans(true); }}
                className={`p-4 rounded-xl border-2 text-center transition-all cursor-pointer hover:border-orange-400 ${
                  selectedPlan?.id === plan.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                }`}
              >
                <p className="font-extrabold text-gray-800">{plan.nom}</p>
                <p className="text-xs text-gray-400">{plan.dureeJours} jours</p>
                <p className="text-lg font-extrabold text-orange-600 mt-1">{Number(plan.prix).toLocaleString('fr-FR')} F</p>
              </button>
            ))}
          </div>

          {/* Modal paiement */}
          {showPlans && selectedPlan && configPaiement && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowPlans(false)}>
              <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-slideUp" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-extrabold text-gray-800 mb-2">💳 Paiement</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Plan <strong>{selectedPlan.nom}</strong> — {selectedPlan.dureeJours} jours — <strong>{Number(selectedPlan.prix).toLocaleString('fr-FR')} F</strong>
                </p>

                <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
                  {configPaiement.waveNumero && (
                    <p>📱 <strong>Wave :</strong> {configPaiement.waveNumero}</p>
                  )}
                  {configPaiement.omNumero && (
                    <p>📱 <strong>Orange Money :</strong> {configPaiement.omNumero}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">{configPaiement.instructions}</p>
                </div>

                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Infos de transaction (optionnel)</label>
                <textarea
                  value={paiementInfos}
                  onChange={e => setPaiementInfos(e.target.value)}
                  placeholder="Ex: ID transaction Wave, numéro envoyeur..."
                  className="w-full h-20 bg-gray-50 border rounded-xl px-4 py-3 text-sm resize-none mb-4 focus:outline-none focus:border-orange-400"
                />

                <button
                  onClick={initierPaiement}
                  disabled={paiementLoading}
                  className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold cursor-pointer hover:bg-orange-600 disabled:opacity-60"
                >
                  {paiementLoading ? 'Envoi...' : '✅ J\'ai payé, confirmer'}
                </button>
                <button onClick={() => setShowPlans(false)} className="w-full mt-3 py-2 text-gray-400 cursor-pointer text-sm">
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activation par code (ancien système) */}
      {/* {isAdmin && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <h3 className="font-bold text-gray-800 mb-3">🔑 Activer un code</h3>
          <p className="text-xs text-gray-400 mb-3">Si vous avez reçu un code d'activation du Super Admin.</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="RESTO-XXXX-XXXX-XXXX"
                className="w-full h-12 bg-gray-50 border rounded-xl px-4 font-mono text-sm focus:outline-none focus:border-orange-400" />
            </div>
            <button onClick={handleActiver} disabled={loading}
              className="px-6 h-12 bg-orange-500 text-white rounded-xl font-bold cursor-pointer hover:bg-orange-600 disabled:opacity-60 whitespace-nowrap">
              {loading ? '...' : 'Activer'}
            </button>
          </div>
        </div>
      )} */}

      {/* Historique des paiements */}
      {paiements.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <h3 className="font-bold text-gray-800 mb-3">📋 Mes paiements</h3>
          <div className="space-y-2">
            {paiements.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-semibold">{p.plan?.nom} — {p.dureeJours}j</p>
                  <p className="text-xs text-gray-400">{p.reference} · {new Date(p.dateCreation).toLocaleString('fr-FR')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{Number(p.montant).toLocaleString('fr-FR')} F</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    p.statut === 'CONFIRME' ? 'bg-green-100 text-green-700' :
                    p.statut === 'REJETE' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {p.statut === 'EN_ATTENTE' ? 'En attente' : p.statut === 'CONFIRME' ? 'Confirmé' : 'Rejeté'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clôture globale */}
      {isAdmin && resto && (
        <div id="cloture-section" className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-3">🔒 Clôture Globale</h3>
          <div className="mb-4">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${resto.statut === 'FERME' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {resto.statut === 'FERME' ? '🔴 FERMÉ' : '🟢 OUVERT'}
            </span>
          </div>
          {resto.statut === 'FERME'
            ? <button onClick={handleReopen} className="w-full py-3 bg-green-500 text-white rounded-xl font-bold cursor-pointer hover:bg-green-600">🟢 Réouvrir le restaurant</button>
            : <button onClick={handleCloture} className="w-full py-3 bg-red-500 text-white rounded-xl font-bold cursor-pointer hover:bg-red-600">🔒 Fermer le restaurant</button>
          }
        </div>
      )}

      {/* Modal clôture */}
      {showCloture && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCloture(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">🔒 Fermer le restaurant</h3>
            <p className="text-sm text-gray-500 mb-4">Choisissez la date et l'heure de réouverture.</p>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Date de réouverture</label>
            <input type="date" value={clotureDate} onChange={e => setClotureDate(e.target.value)} className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3" />
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Heure de réouverture</label>
            <input type="time" value={clotureHeure} onChange={e => setClotureHeure(e.target.value)} className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-4" />
            <button onClick={execCloture} className="w-full py-2.5 bg-red-500 text-white rounded-xl font-bold cursor-pointer hover:bg-red-600">🔒 Fermer</button>
            <button onClick={() => setShowCloture(false)} className="w-full mt-3 py-2 text-gray-400 cursor-pointer">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
