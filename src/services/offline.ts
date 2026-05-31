import api from './api';

// ==================== État connexion ====================
let onlineListeners: Array<(online: boolean) => void> = [];
let isOnline = navigator.onLine;

window.addEventListener('online', () => { isOnline = true; onlineListeners.forEach(fn => fn(true)); syncQueue(); });
window.addEventListener('offline', () => { isOnline = false; onlineListeners.forEach(fn => fn(false)); });

export function onConnectivityChange(fn: (online: boolean) => void) {
  onlineListeners.push(fn);
  return () => { onlineListeners = onlineListeners.filter(l => l !== fn); };
}

export function getIsOnline() { return isOnline; }

// ==================== File d'attente ====================
interface QueueItem {
  id: string;
  type: 'commande' | 'paiement';
  data: any;
  createdAt: string;
  retries: number;
}

function getQueue(): QueueItem[] {
  try { return JSON.parse(localStorage.getItem('offline_queue') || '[]'); } catch { return []; }
}

function saveQueue(queue: QueueItem[]) {
  localStorage.setItem('offline_queue', JSON.stringify(queue));
}

export function addToQueue(type: QueueItem['type'], data: any) {
  const queue = getQueue();
  const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  queue.push({ id, type, data, createdAt: new Date().toISOString(), retries: 0 });
  saveQueue(queue);
  return id;
}

export function getQueueItems(): QueueItem[] {
  return getQueue();
}

export function getQueueCount(): number {
  return getQueue().length;
}

export function removeFromQueue(id: string) {
  saveQueue(getQueue().filter(q => q.id !== id));
}

export function onQueueChange(fn: () => void) {
  const handler = () => fn();
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

// ==================== Synchronisation ====================
async function syncQueue() {
  if (!isOnline) return;

  const queue = getQueue();
  if (queue.length === 0) return;

  const remaining: QueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'commande') {
        await api.post('/commandes', item.data);
      } else if (item.type === 'paiement') {
        await api.post(`/paiements/payer/${item.data.commandeId}`, { mode: item.data.mode });
      }
      // Succès → ne pas remettre dans la file
    } catch (err: any) {
      // Si erreur réseau → garder dans la file
      if (!err.response || err.code === 'ERR_NETWORK') {
        remaining.push({ ...item, retries: item.retries + 1 });
      } else {
        // Si l'API a répondu (même une erreur métier), on considère que c'est traité
        // sauf si erreur serveur (500)
        if (err.response?.status >= 500) {
          remaining.push({ ...item, retries: item.retries + 1 });
        }
      }
    }
  }

  saveQueue(remaining);
}

// Écouter le retour de la connexion
window.addEventListener('online', () => { syncQueue(); });

// Réessayer périodiquement
setInterval(() => { syncQueue(); }, 30000); // Toutes les 30 secondes

export { syncQueue };

