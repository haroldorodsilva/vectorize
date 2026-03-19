import { useEffect } from 'react'
import { cn } from '@/shared/lib/utils'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg',
              danger ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600',
            )}>
              {danger ? '⚠' : '⚠'}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors',
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
