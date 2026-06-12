import { useEffect, useState, useCallback } from 'react';
import { paiementApi, printerApi } from '../services/api';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useToast } from '../services/toast';
import { useDialog } from '../services/dialog';
import { API_URL } from '../config';
import { onNewCommande, onCommandeStatusChange } from '../services/socket';

export default function CaissePage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const token = useSelector((s: RootState) => s.auth.token);
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
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set());
  const [showRemise, setShowRemise] = useState(false);
  const [remiseForm, setRemiseForm] = useState({ type: 'POURCENTAGE', valeur: '', motif: '' });

  const [showPrinterConfig, setShowPrinterConfig] = useState(false);
  const [printerConfig, setPrinterConfig] = useState<any>(null);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN';

  const load = useCallback(async () => {
    try {
      const [cmdRes, caisseRes] = await Promise.all([paiementApi.getAPayer(), paiementApi.getCaisseJour()]);
      setCommandes(cmdRes.data || []); setCaisse(caisseRes.data || {});
    } catch {}
  }, []);

  // Polling automatique (15 secondes)
  useEffect(() => {
    const interval = setInterval(() => { load(); }, 15000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    load();
    const u1 = onNewCommande(() => load());
    const u2 = onCommandeStatusChange(() => load());
    return () => { u1(); u2(); };
  }, [load]);

  const payerTout = async (cmds: any[], modePaiement: string) => {
    let ok = 0, fail = 0;
    const factures: any[] = [];
    for (const c of cmds) {
      try {
        const { data } = await paiementApi.payer(c.id, modePaiement);
        if (data.facture?.id) factures.push(data.facture);
        ok++;
      } catch { fail++; }
    }
    if (fail === 0) toast.success(`${ok} commande(s) payée(s)`);
    else toast.error(`${ok} payée(s), ${fail} échec(s)`);
    load();
    // Imprimer les reçus sur l'imprimante physique
    factures.forEach(f => {
      printerApi.printFacture(f.id).catch(() => {});
    });
  };

  const handlePayerToutClick = (cmds: any[]) => {
    dialog.confirm({
      title: `Payer ${cmds.length} commande(s) ?`,
      message: `Total: ${format(cmds.reduce((s: number, c: any) => s + Number(c.montantTotal || 0), 0))} ${user?.devise || '€'}\n\nChoisir le mode de paiement :`,
      confirmLabel: '💵 Espèces',
      onConfirm: () => payerTout(cmds, 'ESPECES'),
      // On utilise le dialog pour choisir - pour simplifier, on fait espèces par défaut
      // L'utilisateur peut utiliser les boutons individuels pour choisir un autre mode
    });
  };

  const handleRemise = async () => {
    if (!selected) return;
    const v = parseFloat(remiseForm.valeur);
    if (isNaN(v) || v <= 0) { toast.error('Valeur invalide'); return; }
    try {
      const { data } = await paiementApi.appliquerRemise(selected.id, { type: remiseForm.type, valeur: v, motif: remiseForm.motif || undefined });
      setSelected({ ...selected, montantTotal: parseFloat(data.montantFinal) });
      setShowRemise(false);
      toast.success(`Remise appliquée : ${data.montantFinal} ${user?.devise || '€'}`);
      load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const handlePayer = async () => {
    if (!selected) return;
    try {
      const { data } = await paiementApi.payer(selected.id, mode);
      toast.success('Paiement effectué');
      if (data.facture?.id) {
        printerApi.printFacture(data.facture.id).catch(() => {});
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
    window.open(`${API_URL}/api/paiements/factures/${factureId}/imprimer?token=${token || ''}`, '_blank');
  };

  // Impression sur imprimante physique ESC/POS
  const handleImprimerPhysique = async (factureId: number) => {
    try {
      const { data } = await printerApi.printFacture(factureId);
      if (data.ok) toast.success('Reçu imprimé physiquement 🖨️');
      else toast.error(data.message || 'Erreur impression');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur impression physique');
    }
  };

  // Charger et afficher la config imprimante
  const openPrinterConfig = async () => {
    try {
      const { data } = await printerApi.getConfig();
      setPrinterConfig(data);
      setShowPrinterConfig(true);
    } catch (err: any) {
      toast.error('Impossible de charger la config imprimante');
    }
  };

  const savePrinterConfig = async () => {
    if (!printerConfig) return;
    try {
      const { data } = await printerApi.updateConfig(printerConfig);
      toast.success(data.message || 'Configuration sauvegardée');
      setShowPrinterConfig(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur sauvegarde');
    }
  };

  const handleTestPrint = async () => {
    try {
      const { data } = await printerApi.testPrint();
      if (data.testImpression?.ok) toast.success('Impression test réussie ! ✅');
      else toast.error(data.testConnexion?.message || data.testImpression?.message || 'Échec test');
    } catch (err: any) {
      toast.error('Erreur test impression');
    }
  };

  const handleImprimerRecuParCmd = (cmd: any) => {
    // Chercher une facture pour cette commande, sinon imprimer un ticket simple
    const facture = factures.find((f: any) => f.commandeId === cmd.id);
    if (facture) {
      handleImprimerRecu(facture.id);
    } else {
      // Générer un ticket HTML simple
      imprimerTicketCommande(cmd);
    }
  };

  const handleImprimerRecuParTable = (g: any) => {
    // Chercher les factures pour toutes les commandes de la table
    const cmds = g.commandes;
    const facturesTrouvees = factures.filter((f: any) => cmds.some((c: any) => c.id === f.commandeId));
    facturesTrouvees.forEach((f: any) => handleImprimerRecu(f.id));
    if (facturesTrouvees.length === 0 && cmds.length > 0) {
      imprimerTicketCommande(cmds[0]);
    }
  };

  const imprimerTicketCommande = (cmd: any) => {
    const total = format(cmd.montantTotal);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Commande CMD-${String(cmd.id).padStart(4, '0')}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;padding:20px;max-width:300px;margin:0 auto;color:#222}
h1{font-size:16px;text-align:center;font-weight:bold}
h2{font-size:12px;text-align:center;color:#888;margin:8px 0}
.line{border-top:1px dashed #aaa;margin:12px 0}
.article-name{flex:1;word-break:break-word;padding-right:4px}
.article-price{white-space:nowrap;font-weight:bold}
.total-row{display:flex;justify-content:space-between;font-size:16px;font-weight:bold}
@media print{
  body{padding:3mm;width:80mm;max-width:80mm;margin:0;color:#000!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .article-price{font-weight:bold!important}
  .total-row{font-weight:bold!important}
  h1{font-weight:bold!important}
}
</style></head><body>
<h1>${user?.restaurantNom || 'RestoPro'}</h1>
<h2>Table ${cmd.table?.numero || '?'} · CMD-${String(cmd.id).padStart(4, '0')}</h2>
<div class="line"></div>
${(cmd.details || []).map((d: any) => `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px"><span class="article-name">${d.quantite}x ${d.menu?.nom || 'Plat'}</span><span class="article-price">${(Number(d.prix||0)*d.quantite).toFixed(2)} ${user?.devise || '€'}</span></div>`).join('')}
<div class="line"></div>
<div class="total-row"><span>TOTAL</span><span>${total} ${user?.devise || '€'}</span></div>
<div style="text-align:center;margin-top:16px;font-size:10px;color:#aaa">RestoPro © ${new Date().getFullYear()}</div>
<script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}</script></body></html>`;
    const w = window.open('', '_blank', 'width=400,height=600');
    if (w) { w.document.write(html); w.document.close(); }
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
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={openPrinterConfig}
              className="h-10 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-1" title="Configurer l'imprimante">
              🖨️ Imprimante
            </button>
          )}
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="h-10 bg-white border rounded-xl px-3 text-sm" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
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
            className="w-auto px-6 py-2 bg-red-500 text-white rounded-xl font-semibold text-sm cursor-pointer hover:bg-red-600 flex items-center justify-center gap-2">
            🔒 Clôturer la caisse
          </button>
        </div>
      )}

      {/* Commandes à payer — groupées par table */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h3 className="font-bold text-gray-800">Commandes à payer ({commandesFiltrees.length})</h3>
          <input value={searchCmd} onChange={e => setSearchCmd(e.target.value)}
            placeholder="🔍 N° commande..."
            className="h-10 bg-white border rounded-xl px-3 text-sm w-36" />
        </div>
        {(() => {
          // Grouper par table
          const groupes: Record<number, any> = {};
          commandesFiltrees.forEach(c => {
            const tid = c.tableId;
            if (!groupes[tid]) groupes[tid] = { tableId: tid, tableNumero: c.table?.numero || '?', commandes: [], montantTotal: 0 };
            groupes[tid].commandes.push(c);
            groupes[tid].montantTotal += Number(c.montantTotal || 0);
          });
          return Object.values(groupes).map((g: any) => {
            const isExpanded = expandedTables.has(g.tableId);
            const nbCmd = g.commandes.length;
            return (
            <div key={`t${g.tableId}`}>
              <div className="flex items-center justify-between py-3 border-b border-gray-100 hover:bg-gray-50 px-2 rounded-lg">
                <div onClick={() => { if (nbCmd === 1) setSelected(g.commandes[0]); else setExpandedTables(prev => { const n = new Set(prev); if (n.has(g.tableId)) n.delete(g.tableId); else n.add(g.tableId); return n; }); }}
                  className="flex items-center justify-between flex-1 cursor-pointer">
                  <div>
                    <p className="font-bold text-sm">🪑 Table {g.tableNumero} · {nbCmd} cmd{nbCmd > 1 ? 's' : ''} {g.commandes[0]?.typeCommande === 'A_EMPORTER' ? '🥡' : '🍽️'}</p>
                    <p className="text-xs font-bold text-orange-500">
                      {g.commandes.map((c: any) => 'CMD-' + String(c.id).padStart(4, '0')).join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-extrabold text-lg">{format(g.montantTotal)} {user?.devise || '€'}</p>
                    {nbCmd > 1 && <span className="text-gray-400 text-base">{isExpanded ? '▲' : '▼'}</span>}
                    {nbCmd === 1 && <span className="text-gray-300 text-sm">▶</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <button onClick={(e) => { e.stopPropagation(); handleImprimerRecuParTable(g); }}
                    className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs cursor-pointer" title="Imprimer le reçu">
                    🖨
                  </button>
                  {nbCmd > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); handlePayerToutClick(g.commandes); }}
                      className="px-3 py-1.5 bg-green-500 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-green-600 transition-colors"
                      title="Payer toutes les commandes">
                      💰 Tout payer
                    </button>
                  )}
                </div>
              </div>
              {isExpanded && g.commandes.map((c: any) => (
                <div key={c.id} onClick={() => setSelected(c)}
                  className="flex items-center justify-between py-2 pl-4 border-b border-gray-50 cursor-pointer hover:bg-orange-50 ml-6 px-2 rounded">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">CMD-{String(c.id).padStart(4, '0')} · {c.statut}</p>
                    <p className="text-xs text-gray-400">{new Date(c.dateCommande).toLocaleTimeString('fr-FR')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{format(c.montantTotal)} {user?.devise || '€'}</p>
                    <button onClick={(e) => { e.stopPropagation(); handleImprimerRecuParCmd(c); }}
                      className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 rounded cursor-pointer">🖨</button>
                  </div>
                </div>
              ))}
            </div>
          )});
        })()}
        {commandesFiltrees.length === 0 && <p className="text-center text-gray-400 py-6">Aucune commande à payer</p>}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Paiement #{selected.id}</h3>
            <p className="text-3xl font-extrabold text-orange-500 mb-4">{format(selected.montantTotal)} {user?.devise || '€'}</p>
            <button onClick={() => { setShowRemise(true); }}
              className="w-full py-2 bg-amber-100 text-amber-700 rounded-xl font-semibold text-sm cursor-pointer hover:bg-amber-200 mb-3 transition-colors">
              🏷️ Appliquer une remise
            </button>
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

      {/* Modal Remise */}
      {showRemise && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowRemise(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">🏷️ Appliquer une remise</h3>
            <p className="text-sm text-gray-400 mb-4">Commande #{selected.id} · {format(selected.montantTotal)} {user?.devise || '€'}</p>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setRemiseForm({...remiseForm, type: 'POURCENTAGE'})}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold cursor-pointer ${remiseForm.type === 'POURCENTAGE' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                % Pourcentage
              </button>
              <button onClick={() => setRemiseForm({...remiseForm, type: 'MONTANT'})}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold cursor-pointer ${remiseForm.type === 'MONTANT' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {user?.devise || '€'} Montant
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <input type="number" value={remiseForm.valeur} onChange={e => setRemiseForm({...remiseForm, valeur: e.target.value})}
                placeholder={remiseForm.type === 'POURCENTAGE' ? 'Ex: 10' : 'Ex: 5000'} className="flex-1 h-11 bg-gray-50 border rounded-xl px-4" />
              <input value={remiseForm.motif} onChange={e => setRemiseForm({...remiseForm, motif: e.target.value})}
                placeholder="Motif (optionnel)" className="flex-[2] h-11 bg-gray-50 border rounded-xl px-4" />
            </div>
            <button onClick={handleRemise}
              className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold cursor-pointer hover:bg-amber-600 transition-colors">
              🏷️ Appliquer la remise
            </button>
            <button onClick={() => setShowRemise(false)} className="w-full mt-3 py-2 text-gray-400 cursor-pointer">Annuler</button>
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
                    <div className="flex items-center gap-1 justify-center">
                      <button onClick={() => handleImprimerRecu(f.id)}
                        className="px-2 py-1 text-xs bg-orange-50 text-orange-600 rounded-lg font-semibold cursor-pointer hover:bg-orange-100" title="Aperçu HTML / Navigateur">🖥️</button>
                      <button onClick={() => handleImprimerPhysique(f.id)}
                        className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded-lg font-semibold cursor-pointer hover:bg-green-100" title="Imprimante physique">🖨️</button>
                    </div>
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

      {/* Config Imprimante Modal */}
      {showPrinterConfig && printerConfig && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowPrinterConfig(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">🖨️ Configuration imprimante</h3>

            <label className="block text-sm font-semibold text-gray-600 mb-1">Type d'imprimante</label>
            <select value={printerConfig.type} onChange={e => setPrinterConfig({...printerConfig, type: e.target.value})}
              className="w-full h-11 bg-gray-50 border rounded-xl px-4 mb-3">
              <option value="WINDOWS">🪟 Windows / USB (imprimante partagée)</option>
              <option value="NETWORK">🌐 Réseau (Ethernet / WiFi)</option>
              <option value="NONE">❌ Aucune (désactivée)</option>
            </select>

            {printerConfig.type === 'NETWORK' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Adresse IP</label>
                  <input type="text" value={printerConfig.ip} onChange={e => setPrinterConfig({...printerConfig, ip: e.target.value})}
                    placeholder="192.168.1.100" className="w-full h-11 bg-gray-50 border rounded-xl px-4" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Port</label>
                  <input type="number" value={printerConfig.port} onChange={e => setPrinterConfig({...printerConfig, port: parseInt(e.target.value) || 9100})}
                    placeholder="9100" className="w-full h-11 bg-gray-50 border rounded-xl px-4" />
                </div>
              </div>
            )}

            {printerConfig.type === 'WINDOWS' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Nom exact de l'imprimante Windows</label>
                  <input type="text" value={printerConfig.name} onChange={e => setPrinterConfig({...printerConfig, name: e.target.value})}
                    placeholder="Ex: EPSON TM-T88V Receipt" className="w-full h-11 bg-gray-50 border rounded-xl px-4" />
                  <p className="text-xs text-gray-400 mt-1">Panneau de config → Périphériques et imprimantes</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Nom du partage (obligatoire pour USB)</label>
                  <input type="text" value={printerConfig.shareName || ''} onChange={e => setPrinterConfig({...printerConfig, shareName: e.target.value})}
                    placeholder="RECU" className="w-full h-11 bg-gray-50 border rounded-xl px-4" />
                  <p className="text-xs text-gray-400 mt-1">Clic droit sur l'imprimante → Propriétés → Partage → Nom du partage</p>
                </div>
              </div>
            )}

            {printerConfig.type !== 'NONE' && (
              <>
                <div className="mt-3">
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Largeur papier (caractères)</label>
                  <select value={printerConfig.charWidth} onChange={e => setPrinterConfig({...printerConfig, charWidth: parseInt(e.target.value)})}
                    className="w-full h-11 bg-gray-50 border rounded-xl px-4">
                    <option value={32}>32 — Papier 58mm</option>
                    <option value={42}>42 — Papier 80mm (standard)</option>
                    <option value={48}>48 — Papier 80mm (large)</option>
                  </select>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <label className="text-sm font-semibold text-gray-600">Impression automatique après paiement</label>
                  <button onClick={() => setPrinterConfig({...printerConfig, autoPrint: !printerConfig.autoPrint})}
                    className={`w-12 h-6 rounded-full transition-colors cursor-pointer ${printerConfig.autoPrint ? 'bg-green-500' : 'bg-gray-300'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${printerConfig.autoPrint ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </>
            )}

            <div className="flex gap-2 mt-6">
              <button onClick={handleTestPrint}
                className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-semibold text-sm cursor-pointer hover:bg-blue-600">
                🧪 Test impression
              </button>
              <button onClick={savePrinterConfig}
                className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl font-semibold text-sm cursor-pointer hover:bg-orange-600">
                💾 Sauvegarder
              </button>
            </div>
            <button onClick={() => setShowPrinterConfig(false)}
              className="w-full mt-3 py-2 text-gray-400 cursor-pointer text-sm">Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
