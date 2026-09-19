// Dokumentbanken i intranätet är samma funktion som admins "Interna dokument".
// Kollektionerna nås nu även av medlemmar (label:member), så komponenten
// återanvänds rakt av — en enda implementation att underhålla.
import AdminInternalDocs from '../admin/AdminInternalDocs'
import { useMarkIntranetRead } from '../../lib/intranetNotifications'

export default function IntranetDocuments() {
  // Wrappern äger ingen laddningsstatus; markera som läst en stund efter mount.
  useMarkIntranetRead('documents')
  return <AdminInternalDocs />
}
