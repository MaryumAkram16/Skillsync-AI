import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { CheckCircle2, AlertCircle, Info, X, Sparkles } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info' | 'ai'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  actionLabel?: string
  onAction?: () => void
}

interface ToastContextType {
  toast: (opts: Omit<Toast, 'id'>) => void
  success: (title: string, message?: string, actionLabel?: string, onAction?: () => void) => void
  error: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
  ai: (title: string, message?: string) => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// ── Single Toast Item ─────────────────────────────────────────────────────────

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), toast.duration ?? 4000)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onRemove])

  const styles: Record<ToastType, { bg: string; border: string; icon: React.ReactNode }> = {
    success: {
      bg: 'bg-[#1f2937]',
      border: 'border-l-4 border-l-[#10b981] border border-[#374151]',
      icon: <CheckCircle2 className="w-5 h-5 text-[#10b981] flex-shrink-0 mt-0.5" />,
    },
    error: {
      bg: 'bg-[#1f2937]',
      border: 'border-l-4 border-l-[#ef4444] border border-[#374151]',
      icon: <AlertCircle className="w-5 h-5 text-[#ef4444] flex-shrink-0 mt-0.5" />,
    },
    info: {
      bg: 'bg-[#1f2937]',
      border: 'border-l-4 border-l-[#f59e0b] border border-[#374151]',
      icon: <Info className="w-5 h-5 text-[#f59e0b] flex-shrink-0 mt-0.5" />,
    },
    ai: {
      bg: 'bg-[#1f2937]',
      border: 'border-l-4 border-l-[#10b981] border border-[#10b981]/30',
      icon: <Sparkles className="w-5 h-5 text-[#10b981] flex-shrink-0 mt-0.5 animate-pulse" />,
    },
  }

  const s = styles[toast.type]

  return (
    <motion.div
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl min-w-[280px] max-w-[360px] ${s.bg} ${s.border}`}
    >
      {s.icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#f3f4f6] leading-tight">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-[#9ca3af] mt-0.5 leading-snug">{toast.message}</p>
        )}
        {toast.actionLabel && toast.onAction && (
          <button
            onClick={() => {
              toast.onAction?.();
              onRemove(toast.id);
            }}
            className="mt-2 font-mono text-[10px] uppercase tracking-widest text-[#10b981] hover:text-[#10b981]/80 transition-colors flex items-center gap-1"
          >
            {toast.actionLabel}
          </button>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-[#9ca3af] hover:text-[#f3f4f6] transition-colors flex-shrink-0 mt-0.5"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

// ── Provider + Container ──────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const add = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev.slice(-4), { ...opts, id }]) // max 5 at once
  }, [])

  const ctx: ToastContextType = {
    toast: add,
    success: (title, message, actionLabel, onAction) => add({ type: 'success', title, message, actionLabel, onAction }),
    error: (title, message) => add({ type: 'error', title, message }),
    info: (title, message) => add({ type: 'info', title, message }),
    ai: (title, message) => add({ type: 'ai', title, message }),
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast Container — fixed bottom-centered on mobile, bottom-right on desktop */}
      <div className="fixed bottom-6 right-6 left-6 md:left-auto z-[9999] flex flex-col gap-3 pointer-events-none items-center md:items-end">
        <AnimatePresence mode="sync">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onRemove={remove} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}