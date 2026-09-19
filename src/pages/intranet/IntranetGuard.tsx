import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import IntranetLayout from '../../components/intranet/IntranetLayout'

// Släpper in medlemmar och admins (admins är ett superset av medlemmar).
export default function IntranetGuard() {
  const { user, isMember, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  if (!isMember) {
    return (
      <div className="empty-state" style={{ maxWidth: 520, margin: '4rem auto', textAlign: 'center' }}>
        <h1>Inget intranätsåtkomst än</h1>
        <p>
          Ditt konto är inloggat men har inte fått åtkomst till intranätet ännu. En administratör
          behöver aktivera dig som medlem.
        </p>
      </div>
    )
  }

  return (
    <IntranetLayout>
      <Outlet />
    </IntranetLayout>
  )
}
