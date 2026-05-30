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

  const load = async () => {
    try {
      const [aboRes, restoRes] = await Promise.all([
        authApi.getAbonnement(),
        user?.restaurantId ? restaurantApi.getInfo(user.restaurantId) : null,
      ]);
      setAbo(aboRes.data);
      if (restoRes) setResto(restoRes.data);
    } catch {}
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
              Type : {abo.typeAbonnement === 'TRIAL' ? '🆓 Période d\'essai' : abo.typeAbonnement === 'MENSUEL' ? '📅 Mensuel' : '📆 Annuel'}
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

      {/* Activation */}
      {isAdmin && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <h3 className="font-bold text-gray-800 mb-3">🔑 Activer un code</h3>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Code d'activation</label>
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
      )}

      {/* Clôture globale */}
      {isAdmin && resto && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
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
