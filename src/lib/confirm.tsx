import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

// App-wide replacement for the browser's native confirm()/alert() dialogs.
// `confirm(options)` returns a Promise<boolean>; `alertDialog(options)` resolves
// when dismissed. Works on both the public site and the CMS.

export interface ConfirmOptions {
  message: string
  title?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface Pending extends ConfirmOptions {
  resolve: (value: boolean) => void
  kind: 'confirm' | 'alert'
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  alertDialog: (options: Omit<ConfirmOptions, 'cancelText'>) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)

  const confirm = useCallback((options: ConfirmOptions) =>
    new Promise<boolean>(resolve => setPending({ ...options, resolve, kind: 'confirm' })), [])

  const alertDialog = useCallback((options: Omit<ConfirmOptions, 'cancelText'>) =>
    new Promise<boolean>(resolve => setPending({ ...options, resolve, kind: 'alert' })), [])

  const close = useCallback((result: boolean) => {
    setPending(prev => { prev?.resolve(result); return null })
  }, [])

  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
      else if (e.key === 'Enter') close(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, close])

  return (
    <ConfirmContext.Provider value={{ confirm, alertDialog }}>
      {children}
      {pending && (
        <div className="confirm-backdrop" onClick={() => close(false)}>
          <div className="confirm-dialog" role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            {pending.title && <h3 className="confirm-title">{pending.title}</h3>}
            <p className="confirm-message">{pending.message}</p>
            <div className="confirm-actions">
              {pending.kind === 'confirm' && (
                <button className="btn btn-ghost" onClick={() => close(false)}>
                  {pending.cancelText ?? 'Avbryt'}
                </button>
              )}
              <button
                className={pending.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={() => close(true)}
                autoFocus
              >
                {pending.confirmText ?? 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
