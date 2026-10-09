import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { flush, setOnFlushed } from './lib/offline'
import { applyToCachedDays, prefetchUpcoming } from './lib/data'
import { todayISO } from './lib/dates'
import { APP_NAME } from './lib/supabase'
import SignIn from './pages/SignIn'
import NameSetup from './pages/NameSetup'
import WorkoutDay from './pages/WorkoutDay'
import History from './pages/History'
import ExerciseHistory from './pages/ExerciseHistory'
import Account from './pages/Account'
import AdminLayout from './pages/admin/AdminLayout'
import Schedule from './pages/admin/Schedule'
import WorkoutEditor from './pages/admin/WorkoutEditor'
import Exercises from './pages/admin/Exercises'
import People from './pages/admin/People'
import SyncStatus from './components/SyncStatus'
import { IconAccount, IconBoard, IconHistory, IconWrench } from './components/Icons'

setOnFlushed(applyToCachedDays)

export default function App() {
  const { state } = useAuth()

  if (state.status === 'loading') {
    return <div className="splash" aria-busy="true" aria-label="Loading" />
  }
  if (state.status === 'signedOut') return <SignIn />
  if (!state.profile?.display_name && navigator.onLine) {
    // Profile still loading from the server: wait rather than flash the name form.
    if (!state.profile) return <div className="splash" aria-busy="true" aria-label="Loading" />
    return <NameSetup />
  }
  return <SignedInApp uid={state.userId} isAdmin={!!state.profile?.is_admin} />
}

function SignedInApp({ uid, isAdmin }: { uid: string; isAdmin: boolean }) {
  const location = useLocation()
  useEffect(() => {
    // Upload anything logged offline, then save the coming week on the phone.
    void flush(uid).then(() => prefetchUpcoming(uid, todayISO()))
    const onOnline = () => void flush(uid)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void flush(uid)
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => void flush(uid), 30_000)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [uid])

  return (
    <div className="shell">
      <header className="topbar">
        <span className="wordmark">{APP_NAME}</span>
        <SyncStatus uid={uid} />
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<WorkoutDay />} />
          <Route path="/day/:date" element={<WorkoutDay />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:exerciseId" element={<ExerciseHistory />} />
          <Route path="/account" element={<Account />} />
          {isAdmin && (
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Schedule />} />
              <Route path="workout/:id" element={<WorkoutEditor />} />
              <Route path="exercises" element={<Exercises />} />
              <Route path="people" element={<People />} />
            </Route>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="tabbar" aria-label="Main">
        <NavLink to="/" end className={({ isActive }) => tabClass(isActive || location.pathname.startsWith('/day/'))}>
          <IconBoard />
          <span>Workout</span>
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => tabClass(isActive)}>
          <IconHistory />
          <span>History</span>
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => tabClass(isActive)}>
            <IconWrench />
            <span>Admin</span>
          </NavLink>
        )}
        <NavLink to="/account" className={({ isActive }) => tabClass(isActive)}>
          <IconAccount />
          <span>Account</span>
        </NavLink>
      </nav>
    </div>
  )
}

const tabClass = (active: boolean) => (active ? 'tab tab-active' : 'tab')
