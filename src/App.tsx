import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { ToastProvider } from './lib/toast'
import { ConfirmProvider } from './lib/confirm'
import { BlobAvatarsProvider } from './lib/blobSettings'
import { ThemeProvider } from './lib/theme'
import IntroLoader from './components/IntroLoader'
import './index.css'
import './components/public/public.css'
import './components/admin/admin.css'

// Public layout is always loaded
import PublicLayout from './components/public/PublicLayout'

// Public pages — lazy
const HomePage = lazy(() => import('./pages/public/HomePage'))
const BackgroundPage = lazy(() => import('./pages/public/BackgroundPage'))
const TopicsPage = lazy(() => import('./pages/public/TopicsPage'))
const TopicDetailPage = lazy(() => import('./pages/public/TopicDetailPage'))
const NewsPage = lazy(() => import('./pages/public/NewsPage'))
const NewsDetailPage = lazy(() => import('./pages/public/NewsDetailPage'))
const TestimoniesPage = lazy(() => import('./pages/public/TestimoniesPage'))
const TestimonyDetailPage = lazy(() => import('./pages/public/TestimonyDetailPage'))
const MapPage = lazy(() => import('./pages/public/MapPage'))
const TimelinePage = lazy(() => import('./pages/public/TimelinePage'))
const DocumentsPage = lazy(() => import('./pages/public/DocumentsPage'))
const MediaPage = lazy(() => import('./pages/public/MediaPage'))
const PressPage = lazy(() => import('./pages/public/PressPage'))
const FaqPage = lazy(() => import('./pages/public/FaqPage'))
const ContactPage = lazy(() => import('./pages/public/ContactPage'))
const CustomPage = lazy(() => import('./pages/public/CustomPage'))

// Admin pages — lazy
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'))
const AdminResetPassword = lazy(() => import('./pages/admin/AdminResetPassword'))
const AdminGuard = lazy(() => import('./pages/admin/AdminGuard'))
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'))
const AdminDrafts = lazy(() => import('./pages/admin/AdminDrafts'))
const AdminTopics = lazy(() => import('./pages/admin/AdminTopics'))
const AdminTopicEdit = lazy(() => import('./pages/admin/AdminTopicEdit'))
const AdminNews = lazy(() => import('./pages/admin/AdminNews'))
const AdminNewsEdit = lazy(() => import('./pages/admin/AdminNewsEdit'))
const AdminTestimonies = lazy(() => import('./pages/admin/AdminTestimonies'))
const AdminDocuments = lazy(() => import('./pages/admin/AdminDocuments'))
const AdminDocumentEdit = lazy(() => import('./pages/admin/AdminDocumentEdit'))
const AdminMedia = lazy(() => import('./pages/admin/AdminMedia'))
const AdminMediaEdit = lazy(() => import('./pages/admin/AdminMediaEdit'))
const AdminMap = lazy(() => import('./pages/admin/AdminMap'))
const AdminMapEdit = lazy(() => import('./pages/admin/AdminMapEdit'))
const AdminMapAreaEdit = lazy(() => import('./pages/admin/AdminMapAreaEdit'))
const IntranetGuard = lazy(() => import('./pages/intranet/IntranetGuard'))
const IntranetNotices = lazy(() => import('./pages/intranet/IntranetNotices'))
const IntranetDocuments = lazy(() => import('./pages/intranet/IntranetDocuments'))
const IntranetNotes = lazy(() => import('./pages/intranet/IntranetNotes'))
const IntranetTasks = lazy(() => import('./pages/intranet/IntranetTasks'))
const AdminTimeline = lazy(() => import('./pages/admin/AdminTimeline'))
const AdminTimelineEdit = lazy(() => import('./pages/admin/AdminTimelineEdit'))
const AdminFaq = lazy(() => import('./pages/admin/AdminFaq'))
const AdminContacts = lazy(() => import('./pages/admin/AdminContacts'))
const AdminNavigation = lazy(() => import('./pages/admin/AdminNavigation'))
const AdminPages = lazy(() => import('./pages/admin/AdminPages'))
const AdminPageEdit = lazy(() => import('./pages/admin/AdminPageEdit'))
const AdminHero = lazy(() => import('./pages/admin/AdminHero'))
const AdminFooter = lazy(() => import('./pages/admin/AdminFooter'))
const AdminCustomPages = lazy(() => import('./pages/admin/AdminCustomPages'))
const AdminCustomPageEdit = lazy(() => import('./pages/admin/AdminCustomPageEdit'))
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'))
const AdminAdmins = lazy(() => import('./pages/admin/AdminAdmins'))
const AdminBackground = lazy(() => import('./pages/admin/AdminBackground'))
const AdminSponsors = lazy(() => import('./pages/admin/AdminSponsors'))
const AdminHandbook = lazy(() => import('./pages/admin/AdminHandbook'))
const AdminChangelog = lazy(() => import('./pages/admin/AdminChangelog'))

function PageSpinner() {
  return <div className="loading"><div className="spinner" /></div>
}

function NotFound() {
  return (
    <div className="notfound">
      <div className="notfound-badge" aria-hidden="true">404</div>
      <h1 className="notfound-title">Här växer bara skog</h1>
      <p className="notfound-text">
        Sidan du letade efter finns inte – eller så har den flyttat. Ingen fara, det mesta om
        Rögleskogen hittar du från startsidan.
      </p>
      <div className="notfound-actions">
        <Link to="/" className="btn btn-primary">Till startsidan</Link>
        <Link to="/karta" className="btn btn-secondary">Se kartan</Link>
        <Link to="/kontakt" className="btn btn-ghost">Kontakta initiativet</Link>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <IntroLoader />
      <BlobAvatarsProvider>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              {/* Public routes */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/bakgrund" element={<BackgroundPage />} />
                <Route path="/amnen" element={<TopicsPage />} />
                <Route path="/amnen/:slug" element={<TopicDetailPage />} />
                <Route path="/nyheter" element={<NewsPage />} />
                <Route path="/nyheter/:slug" element={<NewsDetailPage />} />
                <Route path="/vittnesmal" element={<TestimoniesPage />} />
                <Route path="/vittnesmal/:id" element={<TestimonyDetailPage />} />
                <Route path="/karta" element={<MapPage />} />
                <Route path="/tidslinje" element={<TimelinePage />} />
                <Route path="/dokument" element={<DocumentsPage />} />
                <Route path="/media" element={<MediaPage />} />
                <Route path="/press" element={<PressPage />} />
                <Route path="/fragor-och-svar" element={<FaqPage />} />
                <Route path="/kontakt" element={<ContactPage />} />
                {/* Egna sidor: fångar omatchade toppnivå-adresser (explicita rutter vinner). */}
                <Route path="/:slug" element={<CustomPage />} />
              </Route>

              {/* Admin routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/aterstall-losenord" element={<AdminResetPassword />} />
              <Route path="/admin" element={<AdminGuard />}>
                <Route index element={<AdminOverview />} />
                <Route path="utkast" element={<AdminDrafts />} />
                <Route path="amnen" element={<AdminTopics />} />
                <Route path="amnen/ny" element={<AdminTopicEdit />} />
                <Route path="amnen/:id" element={<AdminTopicEdit />} />
                <Route path="nyheter" element={<AdminNews />} />
                <Route path="nyheter/ny" element={<AdminNewsEdit />} />
                <Route path="nyheter/:id" element={<AdminNewsEdit />} />
                <Route path="vittnesmal" element={<AdminTestimonies />} />
                <Route path="dokument" element={<AdminDocuments />} />
                <Route path="dokument/ny" element={<AdminDocumentEdit />} />
                <Route path="dokument/:id" element={<AdminDocumentEdit />} />
                <Route path="media" element={<AdminMedia />} />
                <Route path="media/ny" element={<AdminMediaEdit />} />
                <Route path="media/:id" element={<AdminMediaEdit />} />
                <Route path="karta" element={<AdminMap />} />
                <Route path="karta/omrade/ny" element={<AdminMapAreaEdit />} />
                <Route path="karta/omrade/:id" element={<AdminMapAreaEdit />} />
                <Route path="karta/ny" element={<AdminMapEdit />} />
                <Route path="karta/:id" element={<AdminMapEdit />} />
                <Route path="tidslinje" element={<AdminTimeline />} />
                <Route path="tidslinje/ny" element={<AdminTimelineEdit />} />
                <Route path="tidslinje/:id" element={<AdminTimelineEdit />} />
                <Route path="faq" element={<AdminFaq />} />
                <Route path="kontakter" element={<AdminContacts />} />
                <Route path="sponsorer" element={<AdminSponsors />} />
                <Route path="meny" element={<AdminNavigation />} />
                <Route path="sidor" element={<AdminPages />} />
                <Route path="sidor/:slug" element={<AdminPageEdit />} />
                <Route path="hero" element={<AdminHero />} />
                <Route path="sidfot" element={<AdminFooter />} />
                <Route path="egna-sidor" element={<AdminCustomPages />} />
                <Route path="egna-sidor/ny" element={<AdminCustomPageEdit />} />
                <Route path="egna-sidor/:id" element={<AdminCustomPageEdit />} />
                <Route path="meddelanden" element={<AdminMessages />} />
                <Route path="bakgrund" element={<AdminBackground />} />
                <Route path="inställningar" element={<AdminSettings />} />
                <Route path="administratörer" element={<AdminAdmins />} />
                <Route path="handbok" element={<AdminHandbook />} />
                <Route path="andringslogg" element={<AdminChangelog />} />
              </Route>

              {/* Intranät — inloggningsskyddat arbetsrum för medlemmar och admins */}
              <Route path="/internt" element={<IntranetGuard />}>
                <Route index element={<IntranetNotices />} />
                <Route path="dokument" element={<IntranetDocuments />} />
                <Route path="anteckningar" element={<IntranetNotes />} />
                <Route path="uppgifter" element={<IntranetTasks />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
      </BlobAvatarsProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
