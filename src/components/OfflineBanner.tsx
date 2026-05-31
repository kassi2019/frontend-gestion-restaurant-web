import { useEffect, useState } from 'react';
import { getIsOnline, getQueueCount, onConnectivityChange, onQueueChange, syncQueue } from '../services/offline';

export default function OfflineBanner() {
  const [online, setOnline] = useState(getIsOnline());
  const [queueCount, setQueueCount] = useState(getQueueCount());

  useEffect(() => {
    const u1 = onConnectivityChange(setOnline);
    const u2 = onQueueChange(() => setQueueCount(getQueueCount()));
    // Rafraîchir périodiquement le compteur de file
    const interval = setInterval(() => setQueueCount(getQueueCount()), 5000);
    return () => { u1(); u2(); clearInterval(interval); };
  }, []);

  if (online && queueCount === 0) return null;

  return (
    <>
      {!online && (
        <div className="bg-red-500 text-white text-center py-2 px-4 text-sm font-bold flex items-center justify-center gap-2">
          <span>⚠️</span>
          <span>Mode hors-ligne — Les données seront synchronisées au retour de la connexion</span>
        </div>
      )}
      {online && queueCount > 0 && (
        <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-bold flex items-center justify-center gap-2">
          <span>🔄</span>
          <span>Synchronisation en cours ({queueCount} élément(s) en attente)...</span>
          <button onClick={syncQueue} className="bg-white text-amber-600 px-3 py-0.5 rounded-full text-xs font-bold cursor-pointer hover:bg-amber-50">
            Sync maintenant
          </button>
        </div>
      )}
    </>
  );
}
