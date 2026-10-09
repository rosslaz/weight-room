import { NavLink, Outlet } from 'react-router-dom'
import { useOnline } from '../../lib/hooks'

export default function AdminLayout() {
  const online = useOnline()
  return (
    <div className="page">
      <nav className="subnav" aria-label="Admin">
        <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'subnav-link is-active' : 'subnav-link')}>
          Schedule
        </NavLink>
        <NavLink to="/admin/exercises" className={({ isActive }) => (isActive ? 'subnav-link is-active' : 'subnav-link')}>
          Exercises
        </NavLink>
        <NavLink to="/admin/people" className={({ isActive }) => (isActive ? 'subnav-link is-active' : 'subnav-link')}>
          People
        </NavLink>
      </nav>
      {!online && <p className="banner">You're offline. Admin changes need a connection.</p>}
      <Outlet />
    </div>
  )
}
