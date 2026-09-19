// Delad definition av intranätets notiskällor. Neutralt modul (ingen React,
// inga providers) så att både intranätets och adminpanelens notissystem kan
// använda den utan cirkulära beroenden.

export type IntranetSource = 'notices' | 'notes' | 'tasks' | 'documents'

export interface IntranetSourceMeta {
  label: string
  path: string
  table: string
  titleField: string
  tsField: string
}

export const INTRANET_SOURCES: Record<IntranetSource, IntranetSourceMeta> = {
  notices: { label: 'Anslag', path: '/internt', table: 'intranet_notices', titleField: 'title', tsField: 'created_at' },
  notes: { label: 'Anteckning', path: '/internt/anteckningar', table: 'intranet_notes', titleField: 'title', tsField: 'updated_at' },
  tasks: { label: 'Uppgift', path: '/internt/uppgifter', table: 'intranet_tasks', titleField: 'text', tsField: 'created_at' },
  documents: { label: 'Dokument', path: '/internt/dokument', table: 'internal_documents', titleField: 'title', tsField: 'created_at' },
}

export const INTRANET_KEYS = Object.keys(INTRANET_SOURCES) as IntranetSource[]
