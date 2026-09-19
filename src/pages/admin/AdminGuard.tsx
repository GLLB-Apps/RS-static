import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import AdminLayout from '../../components/admin/AdminLayout'

export default function AdminGuard() {
  const { user, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  if (!isAdmin) {
    return (
      <div className="empty-state">
        <h1>Åtkomst nekad</h1>
        <p>Ditt konto har inte administratörsbehörighet.</p>
      </div>
    )
  }

  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  )
}
