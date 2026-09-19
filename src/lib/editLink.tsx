import React, { createContext, useContext, useEffect, useState } from 'react'

// Lets a public page register the admin edit target for the floating
// "edit this page" button (shown to logged-in admins on desktop). Detail
// pages (e.g. a single topic) register a specific editor URL once loaded;
// list/section pages fall back to a path-based mapping in EditPageButton.
interface EditLinkValue {
  override: string | null
  setOverride: (to: string | null) => void
}

const EditLinkContext = createContext<EditLinkValue | null>(null)

export function EditLinkProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = useState<string | null>(null)
  return (
    <EditLinkContext.Provider value={{ override, setOverride }}>
      {children}
    </EditLinkContext.Provider>
  )
}

export function useEditLinkContext() {
  const ctx = useContext(EditLinkContext)
  if (!ctx) throw new Error('useEditLinkContext must be used within EditLinkProvider')
  return ctx
}

// Register a specific edit target for the current page; cleared on unmount.
export function useRegisterEditLink(to: string | null) {
  const { setOverride } = useEditLinkContext()
  useEffect(() => {
    setOverride(to)
    return () => setOverride(null)
  }, [to, setOverride])
}
