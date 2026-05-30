import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface DialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

interface DialogCtx {
  confirm: (opts: DialogOptions) => void;
}

const DialogContext = createContext<DialogCtx>({ confirm: () => {} });

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const [loading, setLoading] = useState(false);

  const confirm = useCallback((opts: DialogOptions) => setDialog(opts), []);

  const handleConfirm = async () => {
    setLoading(true);
    try { await dialog?.onConfirm(); } catch {} finally { setLoading(false); setDialog(null); }
  };

  return (
    <DialogContext.Provider value={{ confirm }}>
      {children}

      {dialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={() => setDialog(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slideUp overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={`p-6 text-center ${dialog.danger ? 'bg-red-50' : 'bg-orange-50'}`}>
              <span className="text-5xl block mb-2">{dialog.danger ? '⚠️' : '❓'}</span>
              <h3 className="text-lg font-extrabold text-gray-800">{dialog.title}</h3>
            </div>

            {/* Body */}
            <div className="p-6 text-center">
              <p className="text-gray-500 text-sm leading-relaxed">{dialog.message}</p>
            </div>

            {/* Actions */}
            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setDialog(null)}
                className="flex-1 py-4 text-gray-500 font-semibold hover:bg-gray-50 cursor-pointer transition-colors">
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className={`flex-1 py-4 font-bold cursor-pointer transition-colors flex items-center justify-center gap-2 ${dialog.danger ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-orange-500 text-white hover:bg-orange-600'} disabled:opacity-60`}>
                {loading && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
                {dialog.confirmLabel || 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  return useContext(DialogContext);
}
