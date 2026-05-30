import { useEffect, useState, useCallback } from 'react';
import { paiementApi } from '../services/api';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useToast } from '../services/toast';
import { useDialog } from '../services/dialog';
import { API_URL } from '../config';
import { onNewCommande, onCommandeStatusChange } from '../services/socket';

export default function CaissePage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const toast = useToast();
  const dialog = useDialog();
  const [commandes, setCommandes] = useState<any[]>([]);
  const [caisse, setCaisse] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [mode, setMode] = useState('ESPECES');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState<'paiement' | 'factures' | 'clotures'>('paiement');
  const [factures, setFactures] = useState<any[]>([]);
  const [clotures, setClotures] = useState<any[]>([]);
  const [searchCmd, setSearchCmd] = useState('');

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN';

  const load = useCallback(async () => {
    try {
      const [cmdRes, caisseRes] = await Promise.all([paiementApi.getAPayer(), paiementApi.getCaisseJour()]);
      setCommandes(cmdRes.data || []); setCaisse(caisseRes.data || {});
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const u1 = onNewCommande(() => load());
    const u2 = onCommandeStatusChange(() => load());
    return () => { u1(); u2(); };
  }, [load]);

  const handlePayer = async () => {
    if (!selected) return;
    try {
      const { data } = await paiementApi.payer(selected.id, mode);
      toast.success('Paiement effectué');
      if (data.facture?.id) {
        window.open(`${API_URL}/api/paiements/factures/${data.facture.id}/imprimer`, '_blank');
      }
      setSelected(null); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur paiement'); }
  };

  const loadFactures = async () => {
    try { const { data } = await paiementApi.getFactures(); setFactures(data || []); } catch {}
  };

  const loadClotures = async () => {
    try { const { data } = await paiementApi.getHistoriqueClotures(); setClotures(data || []); } catch {}
  };

  const handleCloture = async () => {
    dialog.confirm({
      title: 'Clôturer la caisse ?',
      message: 'Vos transactions depuis la dernière clôture seront finalisées. Le restaurant reste ouvert.',
      danger: true, confirmLabel: 'Clôturer',
      onConfirm: async () => {
        try {
          const { data } = await paiementApi.cloturerCaisse();
          toast.success(`Caisse clôturée — ${parseFloat(data.totalGeneral).toFixed(2)} ${user?.devise || '€'}`);
          load();
        } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
      }
    });
  };

  const handleImprimerRecu = (factureId: number) => {
    window.open(`${API_URL}/api/paiements/factures/${factureId}/imprimer`, '_blank');
  };

  const format = (n: any) => parseFloat(n || 0).toFixed(2);

  const commandesFiltrees = commandes.filter(c => {
    if (!dateFilter) return true;
    return new Date(c.dateCommande).toLocaleDateString('fr-FR') === new Date(dateFilter).toLocaleDateString('fr-FR');
  }).filter(c => !searchCmd || `CMD-${String(c.id).padStart(4, '0')}`.includes(searchCmd) || String(c.id).includes(searchCmd));

  const facturesFiltrees = factures.filter(f => {
    if (!dateFilter) return true;
    return new Date(f.dateFacture).toLocaleDateString('fr-FR') === new Date(dateFilter).toLocaleDateString('fr-FR');
  });

  return (
    <div className="p-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-gray-800">💰 Caisse</h1>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="h-10 bg-white border rounded-xl px-3 text-sm" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('paiement')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer ${tab === 'paiement' ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600'}`}>💰 Paiements</button>
        <button onClick={() => { setTab('factures'); loadFactures(); }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer ${tab === 'factures' ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600'}`}>🧾 Factures</button>
        {isAdmin && (
          <button onClick={() => { setTab('clotures'); loadClotures(); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer ${tab === 'clotures' ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600'}`}>📋 Clôtures</button>
        )}
      </div>

      {tab === 'paiement' && (
      <>
      {/* Résumé caisse */}
      {caisse && (
        <div className="mb-6">
          {caisse.depuis && <p className="text-xs text-gray-400 mb-2">Depuis le {new Date(caisse.depuis).toLocaleString('fr-FR')}</p>}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Espèces', val: format(caisse.totalEspeces || caisse.details?.totalEspeces), icon: '💵', bg: 'bg-green-50' },
              { label: 'Mobile Money', val: format(caisse.totalMobile || caisse.details?.totalMobileMoney), icon: '📱', bg: 'bg-blue-50' },
              { label: 'Carte', val: format(caisse.totalCarte || caisse.details?.totalCarte), icon: '💳', bg: 'bg-purple-50' },
              { label: 'Total', val: format(caisse.totalGeneral), icon: '🧾', bg: 'bg-orange-50' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} rounded-2xl p-4`}>
                <span className="text-2xl">{c.icon}</span>
                <p className="text-2xl font-extrabold mt-2">{c.val} {user?.devise || '€'}</p>
                <p className="text-xs text-gray-500">{c.label}</p>
              </div>
            ))}
          </div>
          <button onClick={handleCloture}
            className="w-full py-3 bg-red-500 text-white rounded-xl font-bold cursor-pointer hover:bg-red-600 flex items-center justify-center gap-2">
            🔒 Clôturer la caisse
          </button>
        </div>
      )}

      {/* Commandes à payer */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h3 className="font-bold text-gray-800">Commandes à payer ({commandesFiltrees.length})</h3>
          <input value={searchCmd} onChange={e => setSearchCmd(e.target.value)}
            placeholder="🔍 N° commande..."
            className="h-10 bg-white border rounded-xl px-3 text-sm w-36" />
        </div>
        {commandesFiltrees.map(c => (
          <div key={c.id} onClick={() => setSelected(c)}
            className="flex items-center justify-between py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 px-2 rounded-lg">
            <div>
              <p className="font-bold text-sm">Table {c.table?.numero || '—'} · #{c.id} {c.typeCommande === 'A_EMPORTER' ? '🥡' : '🍽️'}</p>
              <p className="text-xs text-gray-400">{c.statutPaiement} · {new Date(c.dateCommande).toLocaleTimeString('fr-FR')}</p>
            </div>
            <p className="font-extrabold text-lg">{format(c.montantTotal)} {user?.devise || '€'}</p>
          </div>
        ))}
        {commandesFiltrees.length === 0 && <p className="text-center text-gray-400 py-6">Aucune commande à payer</p>}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Paiement #{selected.id}</h3>
            <p className="text-3xl font-extrabold text-orange-500 mb-4">{format(selected.montantTotal)} {user?.devise || '€'}</p>
            <div className="flex gap-2 mb-4">
              {['ESPECES', 'MOBILE_MONEY', 'CARTE_BANCAIRE'].map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold cursor-pointer ${mode === m ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {m === 'ESPECES' ? '💵' : m === 'MOBILE_MONEY' ? '📱' : '💳'} {m.replace('_', ' ')}
                </button>
              ))}
            </div>
            <button onClick={handlePayer} className="w-full py-3 bg-green-500 text-white rounded-xl font-bold cursor-pointer hover:bg-green-600">✅ Payer</button>
            <button onClick={() => setSelected(null)} className="w-full mt-3 py-2 text-gray-400 cursor-pointer">Annuler</button>
          </div>
        </div>
      )}
      </>
      )}

      {tab === 'factures' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">N°</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Date</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Mode</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Montant</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Caissier</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-500">Reçu</th>
              </tr>
            </thead>
            <tbody>
              {facturesFiltrees.map(f => (
                <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-3 px-4 font-semibold text-gray-800">#{f.numero}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">{new Date(f.dateFacture).toLocaleString('fr-FR')}</td>
                  <td className="py-3 px-4"><span className="text-xs font-semibold bg-gray-100 px-2 py-1 rounded-full">{f.modePaiement}</span></td>
                  <td className="py-3 px-4 text-right font-bold">{format(f.montantTotal)} {user?.devise || '€'}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">{f.caissier?.nom || '—'}</td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => handleImprimerRecu(f.id)}
                      className="px-3 py-1 text-xs bg-orange-50 text-orange-600 rounded-lg font-semibold cursor-pointer hover:bg-orange-100">🖨️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {facturesFiltrees.length === 0 && <p className="text-center text-gray-400 py-10">Aucune facture aujourd'hui</p>}
        </div>
      )}

      {tab === 'clotures' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Date</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Type</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-500">Caissier</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Espèces</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Mobile</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Carte</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {clotures.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-3 px-4 text-sm text-gray-500">{new Date(c.dateCloture).toLocaleString('fr-FR')}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.type === 'GLOBAL' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {c.type === 'GLOBAL' ? '🌍 Globale' : '👤 Caissier'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">{c.caissier?.nom || '—'}</td>
                  <td className="py-3 px-4 text-right text-sm">{format(c.totalEspeces)} €</td>
                  <td className="py-3 px-4 text-right text-sm">{format(c.totalMobile)} €</td>
                  <td className="py-3 px-4 text-right text-sm">{format(c.totalCarte)} €</td>
                  <td className="py-3 px-4 text-right font-bold">{format(c.totalGeneral)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
          {clotures.length === 0 && <p className="text-center text-gray-400 py-10">Aucune clôture</p>}
        </div>
      )}
    </div>
  );
}
