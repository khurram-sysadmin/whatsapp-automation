import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  showToast: (title: string, description?: string, type?: ToastType) => void;
  showSuccess: (title: string, description?: string) => void;
  showError: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const timers=useRef(new Map<string,ReturnType<typeof setTimeout>>());
  useEffect(()=>()=>{timers.current.forEach(clearTimeout);timers.current.clear();},[]);
  const removeToast = useCallback((id: string) => {
    const timer=timers.current.get(id);if(timer)clearTimeout(timer);timers.current.delete(id);
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((title: string, description?: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    const newToast: ToastMessage = { id, type, title, description };
    setToasts(prev => [...prev.slice(-4), newToast]);

    timers.current.set(id,setTimeout(() => {
      removeToast(id);
    }, 4500));
  }, [removeToast]);

  const showSuccess = useCallback((title: string, description?: string) => {
    showToast(title, description, 'success');
  }, [showToast]);

  const showError = useCallback((title: string, description?: string) => {
    showToast(title, description, 'error');
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-sm w-[calc(100%-2.5rem)] pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start p-4 rounded-xl shadow-lg border transition-all duration-300 transform translate-y-0 bg-white ${
              toast.type === 'success'
                ? 'border-emerald-200 text-emerald-950'
                : toast.type === 'error'
                ? 'border-rose-200 text-rose-950'
                : toast.type === 'warning'
                ? 'border-amber-200 text-amber-950'
                : 'border-zinc-200 text-zinc-950'
            }`}
          >
            <div className="mr-3 flex-shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-[#FF5533]" />}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold leading-tight">{toast.title}</h4>
              {toast.description && (
                <p className="text-xs mt-1 text-zinc-600 leading-snug">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-3 text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
