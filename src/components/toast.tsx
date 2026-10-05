import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { errorMessage } from '../api/client';

interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error';
}

interface ToastApi {
  ok: (text: string) => void;
  error: (err: unknown) => void;
}

const ToastContext = createContext<ToastApi>({ ok: () => {}, error: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast['kind']) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 5000 : 2800);
  }, []);
  const [api] = useState<ToastApi>(() => ({
    ok: (text) => push(text, 'ok'),
    error: (err) => push(errorMessage(err), 'error'),
  }));
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.kind === 'error' ? ' error' : ''}`}>
            {t.kind === 'error' ? <CircleAlert /> : <CircleCheck />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
