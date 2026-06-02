import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config';

let socket: Socket | null = null;

// Sonnerie notification
let audioCtx: AudioContext | null = null;

function playBeep(freq: number, duration: number, type: OscillatorType = 'square') {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
}

export function playNotificationSound() {
  playBeep(880, 0.1, 'square');
  setTimeout(() => playBeep(1100, 0.15, 'square'), 100);
}

export function connectSocket(userId: number, role: string) {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, { transports: ['websocket'] });

  socket.on('connect', () => {
    socket?.emit('register', { userId, role });
  });

  socket.on('disconnect', () => {});
  socket.on('connect_error', () => {});

  // Jouer un son sur les événements de nouvelle commande
  socket.on('nouvelle_commande', playNotificationSound);
  socket.on('nouvelle_commande_cuisine', playNotificationSound);
  socket.on('nouvelle_commande_bar', playNotificationSound);
  socket.on('commande_status_change', playNotificationSound);
  socket.on('notification_user', playNotificationSound);
  socket.on('notification_admin', playNotificationSound);

  return socket;
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}

export function onNotification(callback: (data: any) => void) {
  socket?.on('notification_user', callback);
  socket?.on('notification_admin', callback);
  socket?.on('commande_prete', callback);
  return () => {
    socket?.off('notification_user', callback);
    socket?.off('notification_admin', callback);
    socket?.off('commande_prete', callback);
  };
}

export function onNewCommande(callback: (data: any) => void) {
  socket?.on('nouvelle_commande', callback);
  socket?.on('nouvelle_commande_cuisine', callback);
  socket?.on('nouvelle_commande_bar', callback);
  return () => {
    socket?.off('nouvelle_commande', callback);
    socket?.off('nouvelle_commande_cuisine', callback);
    socket?.off('nouvelle_commande_bar', callback);
  };
}

export function onCommandeStatusChange(callback: (data: any) => void) {
  socket?.on('commande_status_change', callback);
  socket?.on('commande_status', callback);
  return () => {
    socket?.off('commande_status_change', callback);
    socket?.off('commande_status', callback);
  };
}
