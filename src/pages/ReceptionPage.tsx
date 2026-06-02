import { useEffect, useState, useMemo } from 'react';
import { commandesApi, tablesApi, usersApi } from '../services/api';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { API_URL } from '../config';
import { useToast } from '../services/toast';
import { connectSocket, onNotification, onNewCommande, onCommandeStatusChange } from '../services/socket';

type TabType = 'arrivees' | 'validees' | 'payees';

export default function ReceptionPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const toast = useToast();
  const devise = user?.devise || '€';
  const modeGestion = user?.modeGestion || 'RECEPTION';
  const isModeServeur = modeGestion === 'SERVEUR';

  const [loading, setLoading] = useState(true);
  const [commandes, setCommandes] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [serveurs, setServeurs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('arrivees');
  const aujourdhui = new Date().toISOString().split('T')[0];

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Recherche
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState(aujourdhui);

  // Assignation serveur
  const [showAssign, setShowAssign] = useState(false);
  const [assignCmdId, setAssignCmdId] = useState<number | null>(null);
  const [assignServeurId, setAssignServeurId] = useState<number>(0);

  // Tickets
  const [showTickets, setShowTickets] = useState(false);
  const [ticketCmd, setTicketCmd] = useState<any>(null);

  const loadData = async () => {
    try {
      const [cmdRes, tRes, uRes] = await Promise.all([
        commandesApi.getAll(),
        tablesApi.getAll(),
        usersApi.findByRole('SERVEUR'),
      ]);
      setCommandes(Array.isArray(cmdRes.data) ? cmdRes.data : []);
      setTables(Array.isArray(tRes.data) ? tRes.data : []);
      const serveurList = (Array.isArray(uRes.data) ? uRes.data : [])
        .filter((s: any) => s.statut === 'ACTIF');
      setServeurs(serveurList);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  // Polling automatique en arrière-plan (toutes les 10 secondes)
  useEffect(() => {
    const interval = setInterval(() => { loadData(); }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Socket temps réel
  useEffect(() => {
    if (user?.id && user?.role) {
      connectSocket(user.id, user.role);
      const u1 = onNotification(() => loadData());
      const u2 = onNewCommande(() => loadData());
      const u3 = onCommandeStatusChange(() => loadData());
      return () => { u1(); u2(); u3(); };
    }
  }, [user?.id, user?.role]);

  // Charge serveurs (commandes du jour)
  const serveursAvecCharge = useMemo(() => {
    return serveurs.map((s: any) => {
      const charge = commandes.filter((c: any) => {
        if (!c || c.serveurId !== s.id) return false;
        if (c.statut !== 'EN_ATTENTE' && c.statut !== 'VALIDEE') return false;
        const d = new Date(c.dateCommande);
        const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        return dStr === aujourdhui;
      }).length;
      return { ...s, charge };
    }).sort((a: any, b: any) => a.charge - b.charge);
  }, [serveurs, commandes, aujourdhui]);

  // Filtres
  const filteredCommandes = commandes.filter((c: any) => {
    if (!c) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      const numCmd = `CMD-${String(c.id || 0).padStart(4, '0')}`.toLowerCase();
      if (!numCmd.includes(term) && !String(c.id).includes(term)) return false;
    }
    if (filterDate) {
      const d = new Date(c.dateCommande);
      const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (dStr !== filterDate) return false;
    }
    return true;
  });

  const arrivees = filteredCommandes.filter((c: any) => c.statut === 'EN_ATTENTE');
  const validees = filteredCommandes.filter((c: any) => c.statut === 'VALIDEE' || c.statut === 'SERVEUR_VALIDE' || c.statut === 'RECEPTION_VALIDE');
  const payees = filteredCommandes.filter((c: any) => c.statut === 'PAYEE' || c.statut === 'SERVIE');
  const isSearching = searchTerm.trim() !== '';

  // Grouper par table
  const grouperParTable = (cmds: any[]) => {
    const groupes: Record<number, any> = {};
    for (const c of cmds) {
      if (!c) continue;
      const tid = c.tableId;
      if (!groupes[tid]) {
        groupes[tid] = {
          tableId: tid, tableNumero: getTableNumero(tid), commandes: [], montantTotal: 0,
          serveurId: c.serveurId, typeCommande: c.typeCommande, statut: c.statut,
        };
      }
      groupes[tid].commandes.push(c);
      groupes[tid].montantTotal += Number(c.montantTotal || 0);
      if (c.statut === 'EN_ATTENTE') groupes[tid].statut = 'EN_ATTENTE';
      else if (c.statut === 'VALIDEE' && groupes[tid].statut !== 'EN_ATTENTE') groupes[tid].statut = 'VALIDEE';
    }
    return Object.values(groupes);
  };

  const rawData = isSearching ? filteredCommandes : (activeTab === 'arrivees' ? arrivees : activeTab === 'validees' ? validees : payees);
  const currentData = grouperParTable(rawData);

  const getTableNumero = (tableId: number) => tables.find((t: any) => t.id === tableId)?.numero || '?';
  const getServeurNom = (serveurId: number) => serveurs.find((s: any) => s.id === serveurId)?.nom || null;

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Assigner serveur
  const handleAssign = async () => {
    if (!assignCmdId || !assignServeurId) return;
    try {
      await commandesApi.assignServeur(assignCmdId, assignServeurId);
      toast.success('Serveur assigné');
      setShowAssign(false);
      loadData();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  // Valider → VALIDEE → tickets
  const handleValider = async (cmd: any) => {
    try {
      await commandesApi.updateStatut(cmd.id, 'RECEPTION_VALIDE');
      toast.success('Commande validée !');
      setTicketCmd({ ...cmd, statut: 'RECEPTION_VALIDE' });
      setShowTickets(true);
      loadData();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur validation'); }
  };

  // Tickets filtres
  const getDetailsCuisine = (cmd: any) => {
    if (!cmd?.details) return [];
    return cmd.details.filter((d: any) =>
      ['CUISINE', 'DESSERT'].includes(d.menu?.categorie?.destination)
    );
  };
  const getDetailsBar = (cmd: any) => {
    if (!cmd?.details) return [];
    return cmd.details.filter((d: any) =>
      d.menu?.categorie?.destination === 'BAR'
    );
  };

  const statutColor = (s: string) => {
    switch (s) { case 'EN_ATTENTE': return '#FF9800'; case 'VALIDEE': case 'SERVEUR_VALIDE': return '#2196F3'; case 'RECEPTION_VALIDE': return '#4CAF50'; case 'PAYEE': case 'SERVIE': return '#9C27B0'; default: return '#999'; }
  };
  const statutLabel = (s: string) => {
    switch (s) { case 'EN_ATTENTE': return 'En attente'; case 'VALIDEE': case 'SERVEUR_VALIDE': return 'Serv. validé'; case 'RECEPTION_VALIDE': return 'Récep. validé'; case 'PAYEE': case 'SERVIE': return 'Payée'; default: return s; }
  };

  const tabs = [
    { key: 'arrivees' as TabType, label: 'Arrivées', icon: '🔔', count: arrivees.length, color: '#FF9800' },
    { key: 'validees' as TabType, label: 'Validées', icon: '✅', count: validees.length, color: '#2196F3' },
    { key: 'payees' as TabType, label: 'Payées', icon: '💰', count: payees.length, color: '#4CAF50' },
  ];

  const formatPrix = (montant: any) => {
    const n = Number(montant || 0);
    return `${n.toFixed(2)} ${devise}`;
  };

  // Imprimer un ticket dans un nouvel onglet
  const imprimerTicket = (cmd: any, type: 'cuisine' | 'bar' | 'serveur' | 'caisse') => {
    const tableNumero = getTableNumero(cmd.tableId);
    const serveurNom = getServeurNom(cmd.serveurId) || '—';
    const dateStr = new Date(cmd.dateCommande).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const cmdRef = `CMD-${String(cmd.id).padStart(4, '0')}`;
    const logoUrl = user?.restaurantLogo
      ? (user.restaurantLogo.startsWith('http') ? user.restaurantLogo : `${API_URL}${user.restaurantLogo}`)
      : null;

    // Déterminer les articles selon le type de ticket
    let articles: any[] = [];
    let titre = '';
    let afficherPrix = false;
    let afficherTotal = false;

    switch (type) {
      case 'cuisine':
        titre = '🍳 TICKET CUISINE';
        articles = getDetailsCuisine(cmd);
        break;
      case 'bar':
        titre = '🍸 TICKET BAR';
        articles = getDetailsBar(cmd);
        break;
      case 'serveur':
        titre = '🧾 TICKET SERVEUR';
        articles = cmd.details || [];
        afficherPrix = true;
        afficherTotal = true;
        break;
      case 'caisse':
        titre = '💰 TICKET CAISSE';
        articles = cmd.details || [];
        afficherPrix = true;
        afficherTotal = true;
        break;
    }

    const pointilles = '<div style="border-top:2px dashed #aaa;margin:12px 0"></div>';
    const total = Number(cmd.montantTotal || 0).toFixed(2);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titre}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', monospace; padding: 20px; max-width: 300px; margin: 0 auto; color: #222; }
  .logo { width: 50px; height: 50px; border-radius: 12px; object-fit: cover; margin: 0 auto 8px; display: block; }
  .logo-placeholder { width: 50px; height: 50px; border-radius: 12px; background: linear-gradient(135deg, #f97316, #f59e0b); margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
  h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 12px; text-align: center; color: #888; margin-bottom: 10px; font-weight: 400; }
  h3 { font-size: 14px; text-align: center; margin-bottom: 2px; }
  .info { font-size: 11px; text-align: center; color: #888; margin-bottom: 2px; }
  .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 16px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
  ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="">` : '<div class="logo-placeholder">🍽</div>'}
  <h1>${user?.restaurantNom || 'RestoPro'}</h1>
  ${user?.restaurantTelephone ? `<h2>Tel: ${user.restaurantTelephone}</h2>` : ''}
  ${pointilles}
  <h3>${titre}</h3>
  <p class="info">Table: ${tableNumero}</p>
  <p class="info">${cmdRef} · ${dateStr}</p>
  ${type === 'serveur' || type === 'caisse' ? `<p class="info">Serveur: ${serveurNom}</p>` : ''}
  ${pointilles}
  ${articles.map(d => afficherPrix
    ? `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px"><span>${d.quantite}x ${d.menu?.nom || 'Plat'}</span><span style="font-weight:600">${(Number(d.prix||0)*d.quantite).toFixed(2)} ${devise}</span></div>`
    : `<div style="font-size:13px;padding:3px 0">${d.quantite}x ${d.menu?.nom || 'Plat'}</div>`
  ).join('')}
  ${articles.length === 0 ? '<p style="text-align:center;color:#aaa;font-style:italic;font-size:12px">Aucun article</p>' : ''}
  ${afficherTotal ? `${pointilles}<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:15px;font-weight:900"><span>TOTAL</span><span>${total} ${devise}</span></div>` : ''}
  ${type === 'caisse' ? `<p style="text-align:center;font-size:10px;font-weight:700;background:#FFF3E0;padding:4px 8px;border-radius:6px;margin-top:8px">Réf: ${cmdRef}</p>` : ''}
  ${pointilles}
  <p class="footer">RestoPro © ${new Date().getFullYear()}<br>Merci de votre visite</p>
  <script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}</script>
</body></html>`;

    const w = window.open('', '_blank', 'width=400,height=600');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  // Imprimer les 4 tickets d'un coup (format rouleau thermique)
  const imprimerTout = (item: any) => {
    // Si item groupé, fusionner toutes les commandes
    const commandes = item.commandes || [item];
    const tableNumero = item.tableNumero || getTableNumero(item.tableId);
    const serveurNom = getServeurNom(item.serveurId) || '—';
    const logoUrl = user?.restaurantLogo
      ? (user.restaurantLogo.startsWith('http') ? user.restaurantLogo : `${API_URL}${user.restaurantLogo}`)
      : null;

    // Fusionner tous les détails
    const allDetails: any[] = [];
    const allCuisine: any[] = [];
    const allBar: any[] = [];
    const refs: string[] = [];
    commandes.forEach((cmd: any) => {
      refs.push('CMD-' + String(cmd.id).padStart(4, '0'));
      allDetails.push(...(cmd.details || []));
      allCuisine.push(...getDetailsCuisine(cmd));
      allBar.push(...getDetailsBar(cmd));
    });
    const refStr = refs.join(' · ');
    const total = Number(commandes.reduce((s: number, c: any) => s + Number(c.montantTotal || 0), 0)).toFixed(2);

    const ligne = '<div style="border-top:1px dashed #000;margin:6px 0"></div>';
    const coupe = '<div style="text-align:center;padding:8px 0;font-size:10px;letter-spacing:8px">- - - - ✂ - - - -</div>';

    const blocTicket = (titre: string, items: any[], avecPrix: boolean, avecTotal: boolean, refCaisse?: boolean) => `
      <h3 style="text-align:center;font-size:13px;margin:4px 0">${titre}</h3>
      <p style="text-align:center;font-size:9px;color:#555">${refStr}</p>
      ${ligne}
      ${items.map(d => avecPrix
        ? `<div style="display:flex;justify-content:space-between;font-size:11px;padding:1px 0"><span>${d.quantite}x ${d.menu?.nom || 'Plat'}</span><span>${(Number(d.prix||0)*d.quantite).toFixed(2)} ${devise}</span></div>`
        : `<div style="font-size:11px;padding:1px 0">${d.quantite}x ${d.menu?.nom || 'Plat'}</div>`
      ).join('') || '<p style="text-align:center;color:#999;font-size:10px;font-style:italic">Aucun article</p>'}
      ${avecTotal ? `${ligne}<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:900;padding:2px 0"><span>TOTAL</span><span>${total} ${devise}</span></div>` : ''}
      ${refCaisse ? `<p style="text-align:center;font-size:9px;font-weight:700;margin-top:4px">Réf: ${refStr}</p>` : ''}
    `;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Commande ${refStr}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', monospace; padding: 10px; max-width: 280px; margin: 0 auto; color: #000; font-size: 11px; }
  .logo { width: 44px; height: 44px; border-radius: 10px; object-fit: cover; margin: 0 auto 4px; display: block; }
  .logo-placeholder { width: 44px; height: 44px; border-radius: 10px; background: #f97316; margin: 0 auto 4px; display: flex; align-items: center; justify-content: center; font-size: 22px; color: #fff; }
  @media print { body { width: 72mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
  ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="">` : '<div class="logo-placeholder">🍽</div>'}
  <h1 style="text-align:center;font-size:15px;margin-bottom:2px">${user?.restaurantNom || 'RestoPro'}</h1>
  ${user?.restaurantTelephone ? `<p style="text-align:center;font-size:9px;color:#555;margin-bottom:4px">Tel: ${user.restaurantTelephone}</p>` : ''}
  <p style="text-align:center;font-size:9px;color:#555">Table: ${tableNumero} · Serveur: ${serveurNom}</p>
  ${ligne}

  ${blocTicket('🍳 CUISINE', allCuisine, false, false)}
  ${coupe}
  ${blocTicket('🍸 BAR', allBar, false, false)}
  ${coupe}
  ${blocTicket('🧾 SERVEUR', allDetails, true, true)}
  ${coupe}
  ${blocTicket('💰 CAISSE', allDetails, true, true, true)}

  ${ligne}
  <p style="text-align:center;font-size:9px;color:#aaa;margin-top:4px">RestoPro © ${new Date().getFullYear()}</p>
  <p style="text-align:center;font-size:9px;color:#aaa">Merci de votre visite</p>
  <script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}</script>
</body></html>`;

    const w = window.open('', '_blank', 'width=320,height=700');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  return (
    <div className="p-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800">📋 Réception</h1>
          <p className="text-sm text-gray-400">Gestion des commandes</p>
        </div>
      </div>

      {/* Charge serveurs */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
        <h3 className="font-bold text-gray-700 text-sm mb-3">👤 Charge serveurs</h3>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {serveursAvecCharge.map((s: any) => (
            <div key={s.id} className={`flex-shrink-0 rounded-xl px-4 py-2 text-center min-w-[90px] ${s.charge >= 5 ? 'bg-orange-50' : 'bg-green-50'}`}>
              <p className="text-xs font-semibold text-gray-700">{s.nom}</p>
              <p className={`text-lg font-extrabold ${s.charge >= 5 ? 'text-orange-600' : 'text-green-600'}`}>
                🪑 {s.charge}
              </p>
            </div>
          ))}
          {serveursAvecCharge.length === 0 && <p className="text-sm text-gray-400">Aucun serveur actif</p>}
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="flex gap-3 mb-4">
        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder="🔍 N° commande..." className="h-10 bg-white border rounded-xl px-4 text-sm flex-1" />
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value || aujourdhui)}
          className="h-10 bg-white border rounded-xl px-4 text-sm w-44" />
      </div>

      {/* Onglets */}
      <div className="flex gap-2 mb-4">
        {tabs.map(tab => (
          <button key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSearchTerm(''); setFilterDate(''); }}
            className={`flex-1 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all ${activeTab === tab.key ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {tab.icon} {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Liste commandes */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-3">
          {currentData.map((item: any) => {
            const isExpanded = expandedIds.has(item.tableId);
            const serveurNom = getServeurNom(item.serveurId);
            const isEnAttente = item.statut === 'EN_ATTENTE';
            const isEmporter = item.typeCommande === 'A_EMPORTER';
            const nbCmd = item.commandes?.length || 1;

            return (
              <div key={`table-${item.tableId}`} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" style={{ borderLeft: `5px solid ${statutColor(item.statut)}` }}>
                {/* En-tête cliquable */}
                <div className="flex items-center p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggleExpand(item.tableId)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-800">
                        Table {item.tableNumero} · {nbCmd} commande{nbCmd > 1 ? 's' : ''}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg text-xs font-bold" style={{ backgroundColor: statutColor(item.statut) + '20', color: statutColor(item.statut) }}>
                        {statutLabel(item.statut)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {nbCmd > 1 ? '🛒 Commandes groupées' : isEmporter ? '🛍️ Comptoir' : serveurNom ? `👤 ${serveurNom}` : '⚠️ Sans serveur'}
                    </p>
                  </div>
                  <span className="font-bold text-gray-800 mr-3">{formatPrix(item.montantTotal)}</span>
                  {!isEnAttente && (
                    <button onClick={(e) => { e.stopPropagation(); imprimerTout(item); }}
                      className="mr-2 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors">
                      🖨
                    </button>
                  )}
                  <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Détails (déplié) — une section par commande */}
                {isExpanded && (
                  <div>
                    {(item.commandes || []).map((cmd: any) => (
                      <div key={cmd.id} className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs text-gray-400">#{String(cmd.id).padStart(4, '0')} · {new Date(cmd.dateCommande).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                          <button onClick={(e) => { e.stopPropagation(); imprimerTout(cmd); }}
                            className="px-2 py-0.5 bg-white border rounded text-xs cursor-pointer hover:bg-gray-100" title="Imprimer cette commande">
                            🖨
                          </button>
                        </div>
                        {(cmd.details || []).map((d: any) => (
                          <div key={d.id} className="flex justify-between py-1 text-sm">
                            <span className="text-gray-600">{d.quantite}x {d.menu?.nom || 'Plat'}</span>
                            <span className="font-semibold text-gray-700">{formatPrix(Number(d.prix) * d.quantite)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Mode 2 (RECEPTION) : EN_ATTENTE → Valider */}
                {!isModeServeur && isEnAttente && (
                  <div className="border-t border-gray-100 px-4 py-3 flex gap-3">
                    {!isEmporter && (
                      <button onClick={() => { const first = item.commandes?.[0]; setAssignCmdId(first?.id); setAssignServeurId(first?.serveurId || (serveurs[0]?.id || 0)); setShowAssign(true); }}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
                        👤 {item.serveurId ? 'Changer serveur' : 'Assigner serveur'}
                      </button>
                    )}
                    <button onClick={() => { item.commandes.forEach((c: any) => handleValider(c)); }}
                      className="flex-1 py-2 rounded-xl text-sm font-bold cursor-pointer text-white bg-green-500 hover:bg-green-600 transition-colors">
                      ✅ Valider + 🖨
                    </button>
                  </div>
                )}

                {/* Mode 1 (SERVEUR) : VALIDEE/SERVEUR_VALIDE → 2 boutons */}
                {isModeServeur && (item.statut === 'VALIDEE' || item.statut === 'SERVEUR_VALIDE') && (
                  <div className="border-t border-gray-100 px-4 py-3 flex gap-3">
                    <button onClick={() => { item.commandes.forEach((c: any) => handleValider(c)); }}
                      className="flex-1 py-2 rounded-xl text-sm font-bold cursor-pointer text-white bg-green-500 hover:bg-green-600 transition-colors">
                      ✅ Valider réception + 🖨
                    </button>
                    <button onClick={async () => {
                      await commandesApi.notifierPret(item.commandes?.[0]?.id);
                      toast.success('Serveur et client notifiés');
                    }}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold cursor-pointer bg-amber-100 hover:bg-amber-200 text-amber-700 transition-colors">
                      📢 Commande prête
                    </button>
                  </div>
                )}

                {/* Mode 1 (SERVEUR) : RECEPTION_VALIDE → bouton prêt seulement */}
                {isModeServeur && item.statut === 'RECEPTION_VALIDE' && (
                  <div className="border-t border-gray-100 px-4 py-3">
                    <button onClick={async () => {
                      await commandesApi.notifierPret(item.commandes?.[0]?.id);
                      toast.success('Serveur et client notifiés');
                    }}
                      className="w-full py-2 rounded-xl text-sm font-semibold cursor-pointer bg-amber-100 hover:bg-amber-200 text-amber-700 transition-colors">
                      📢 Commande prête
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {currentData.length === 0 && (
            <p className="text-center text-gray-400 py-10">
              {activeTab === 'arrivees' ? '🎉 Aucune commande en attente' : activeTab === 'validees' ? 'Aucune commande validée' : 'Aucune commande payée'}
            </p>
          )}
        </div>
      )}

      {/* Modal Assignation serveur */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAssign(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">👤 Assigner un serveur</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {serveursAvecCharge.map((s: any) => (
                <button key={s.id}
                  onClick={() => setAssignServeurId(s.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all cursor-pointer ${assignServeurId === s.id ? 'bg-orange-50 border border-orange-300' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'}`}>
                  <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-500">
                    {s.nom.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 font-semibold text-gray-700">{s.nom}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${s.charge >= 5 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                    🪑 {s.charge}
                  </span>
                  {assignServeurId === s.id && <span>✅</span>}
                </button>
              ))}
            </div>
            <button onClick={handleAssign}
              className="w-full mt-4 py-3 bg-green-500 text-white rounded-xl font-bold cursor-pointer hover:bg-green-600 transition-colors">
              ✅ Confirmer l'assignation
            </button>
            <button onClick={() => setShowAssign(false)}
              className="w-full mt-2 py-2 text-gray-400 cursor-pointer hover:text-gray-600">Annuler</button>
          </div>
        </div>
      )}

      {/* Modal 4 Tickets */}
      {showTickets && ticketCmd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowTickets(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto animate-slideUp" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-extrabold text-gray-800">
                🧾 Tickets — #{String(ticketCmd.id).padStart(4, '0')}
              </h3>
              <button onClick={() => imprimerTout(ticketCmd)}
                className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-orange-600 transition-colors whitespace-nowrap">
                🖨 Imprimer tout
              </button>
            </div>
            <p className="text-sm text-gray-400 text-center mb-4">
              Table {getTableNumero(ticketCmd.tableId)} · {getServeurNom(ticketCmd.serveurId) || 'Sans serveur'}
            </p>

            {/* Ticket CUISINE */}
            <div className="bg-gray-50 rounded-xl p-4 mb-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-extrabold text-sm text-gray-800">🍳 CUISINE</h4>
                <button onClick={() => imprimerTicket(ticketCmd, 'cuisine')}
                  className="px-3 py-1 bg-white border rounded-lg text-xs font-semibold cursor-pointer hover:bg-gray-100 transition-colors">
                  🖨 Imprimer
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-2">Table {getTableNumero(ticketCmd.tableId)}</p>
              {(getDetailsCuisine(ticketCmd).length > 0 ? getDetailsCuisine(ticketCmd) : []).map((d: any, i: number) => (
                <p key={i} className="text-sm py-0.5">{d.quantite}x {d.menu?.nom || 'Plat'}</p>
              ))}
              {getDetailsCuisine(ticketCmd).length === 0 && (
                <p className="text-sm text-gray-400 italic">Aucun plat cuisine</p>
              )}
            </div>

            {/* Ticket BAR */}
            <div className="bg-gray-50 rounded-xl p-4 mb-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-extrabold text-sm text-gray-800">🍸 BAR</h4>
                <button onClick={() => imprimerTicket(ticketCmd, 'bar')}
                  className="px-3 py-1 bg-white border rounded-lg text-xs font-semibold cursor-pointer hover:bg-gray-100 transition-colors">
                  🖨 Imprimer
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-2">Table {getTableNumero(ticketCmd.tableId)}</p>
              {getDetailsBar(ticketCmd).length > 0 ? getDetailsBar(ticketCmd).map((d: any, i: number) => (
                <p key={i} className="text-sm py-0.5">{d.quantite}x {d.menu?.nom || 'Plat'}</p>
              )) : <p className="text-sm text-gray-400 italic">Aucune boisson</p>}
            </div>

            {/* Ticket SERVEUR */}
            <div className="bg-gray-50 rounded-xl p-4 mb-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-extrabold text-sm text-gray-800">🧾 SERVEUR — {getServeurNom(ticketCmd.serveurId) || '?'}</h4>
                <button onClick={() => imprimerTicket(ticketCmd, 'serveur')}
                  className="px-3 py-1 bg-white border rounded-lg text-xs font-semibold cursor-pointer hover:bg-gray-100 transition-colors">
                  🖨 Imprimer
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-2">Table {getTableNumero(ticketCmd.tableId)}</p>
              {(ticketCmd.details || []).map((d: any, i: number) => (
                <div key={i} className="flex justify-between text-sm py-0.5">
                  <span>{d.quantite}x {d.menu?.nom || 'Plat'}</span>
                  <span className="font-semibold">{formatPrix(Number(d.prix) * d.quantite)}</span>
                </div>
              ))}
              <div className="border-t border-gray-300 mt-3 pt-3 flex justify-between">
                <span className="font-extrabold">TOTAL</span>
                <span className="font-extrabold text-lg text-orange-600">{formatPrix(ticketCmd.montantTotal)}</span>
              </div>
            </div>

            {/* Ticket CAISSE */}
            <div className="bg-amber-50 rounded-xl p-4 mb-3 border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-extrabold text-sm text-gray-800">💰 CAISSE</h4>
                <button onClick={() => imprimerTicket(ticketCmd, 'caisse')}
                  className="px-3 py-1 bg-amber-200 border border-amber-300 rounded-lg text-xs font-semibold cursor-pointer hover:bg-amber-300 transition-colors">
                  🖨 Imprimer
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-2">
                Table {getTableNumero(ticketCmd.tableId)} · #{String(ticketCmd.id).padStart(4, '0')} · Serveur {getServeurNom(ticketCmd.serveurId) || '?'}
              </p>
              {(ticketCmd.details || []).map((d: any, i: number) => (
                <div key={i} className="flex justify-between text-sm py-0.5">
                  <span>{d.quantite}x {d.menu?.nom || 'Plat'}</span>
                  <span className="font-semibold">{formatPrix(Number(d.prix) * d.quantite)}</span>
                </div>
              ))}
              <div className="border-t border-amber-300 mt-3 pt-3 flex justify-between">
                <span className="font-extrabold">TOTAL À PAYER</span>
                <span className="font-extrabold text-lg text-red-600">{formatPrix(ticketCmd.montantTotal)}</span>
              </div>
              <p className="text-center text-xs font-bold text-amber-700 bg-amber-100 rounded-lg py-1 mt-3">
                Réf : CMD-{String(ticketCmd.id).padStart(4, '0')}
              </p>
            </div>

            <button onClick={() => setShowTickets(false)}
              className="w-full py-3 bg-gray-100 rounded-xl font-semibold text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
