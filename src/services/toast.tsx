import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }

interface ToastCtx {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastCtx>({ success: () => {}, error: () => {}, info: () => {} });

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((message: string, type: Toast['type']) => {
    const id = ++toastId;
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);

  const ctx: ToastCtx = {
    success: (msg) => add(msg, 'success'),
    error: (msg) => add(msg, 'error'),
    info: (msg) => add(msg, 'info'),
  };

  const bg = (t: Toast) => t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-blue-600';

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className={`${bg(t)} text-white px-5 py-3 rounded-xl shadow-lg pointer-events-auto animate-slideUp flex items-center gap-2 min-w-[280px] max-w-sm`}>
            <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
            <span className="text-sm font-semibold flex-1">{t.message}</span>
            <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className="text-white/70 hover:text-white ml-2 cursor-pointer">&times;</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
