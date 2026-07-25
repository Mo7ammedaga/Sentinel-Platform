import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; message: string; }

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
}
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-success-400" />,
  error: <XCircle className="h-4 w-4 text-danger-400" />,
  info: <Info className="h-4 w-4 text-primary-400" />,
};
const BORDERS: Record<ToastKind, string> = {
  success: 'border-l-success-500',
  error: 'border-l-danger-500',
  info: 'border-l-primary-500',
};

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-80 animate-slideUp items-start gap-2.5 rounded-lg border-l-4
              border border-surface-700 bg-surface-900 px-3.5 py-3 shadow-elevated ${BORDERS[t.kind]}`}
          >
            {ICONS[t.kind]}
            <p className="flex-1 text-sm text-surface-200">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-surface-500 hover:text-surface-300">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
