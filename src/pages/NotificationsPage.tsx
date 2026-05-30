import { useEffect, useState } from 'react';
import { notificationsApi } from '../services/api';

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [filter, setFilter] = useState<'TOUS' | 'NON_LU' | 'LU'>('TOUS');

  const load = async () => {
    try { const { data } = await notificationsApi.getAll(); setNotifs(data || []); } catch {}
  };
  useEffect(() => { load(); }, []);

  const handleMarkRead = async (id: number) => {
    try { await notificationsApi.markAsRead(id); load(); } catch {}
  };

  const handleMarkAllRead = async () => {
    try { await notificationsApi.markAllAsRead(); load(); } catch {}
  };

  const filtered = filter === 'TOUS' ? notifs : filter === 'NON_LU' ? notifs.filter(n => !n.lu) : notifs.filter(n => n.lu);

  const nonLus = notifs.filter(n => !n.lu).length;

  return (
    <div className="p-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800">🔔 Notifications</h1>
          <p className="text-gray-400 text-sm">{nonLus} non lue(s)</p>
        </div>
        {nonLus > 0 && (
          <button onClick={handleMarkAllRead} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer hover:bg-orange-600">
            Tout marquer lu
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-6">
        {(['TOUS', 'NON_LU', 'LU'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${filter === f ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {f === 'TOUS' ? 'Toutes' : f === 'NON_LU' ? '🔵 Non lues' : '✅ Lues'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(n => (
          <div key={n.id}
            className={`bg-white rounded-2xl p-4 border shadow-sm transition-all hover:shadow-md ${!n.lu ? 'border-l-4 border-l-orange-500 bg-orange-50/30' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className={`text-sm ${!n.lu ? 'font-bold text-gray-800' : 'text-gray-600'}`}>{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(n.dateNotification).toLocaleString('fr-FR')}</p>
              </div>
              {!n.lu && (
                <button onClick={() => handleMarkRead(n.id)}
                  className="text-xs px-3 py-1 rounded-lg bg-orange-100 text-orange-600 font-semibold cursor-pointer hover:bg-orange-200 whitespace-nowrap">
                  Marquer lu
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-gray-400 py-10">Aucune notification</p>}
      </div>
    </div>
  );
}
