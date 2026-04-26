import { Link, useLocation } from 'react-router-dom'
import { useClerk, useUser } from '@clerk/clerk-react'
import { useState } from 'react'

const ADMIN_EMAILS = ['predictivefpl@outlook.com', 'navindhillon@gmail.com']
const NAV = [
  { path: '/dashboard', icon: 'fa-gauge',     label: 'Dashboard' },
  { path: '/team',      icon: 'fa-shirt',      label: 'My Squad' },
  { path: '/insights',  icon: 'fa-chart-line', label: 'Insights' },
  { path: '/rivals',    icon: 'fa-trophy',     label: 'Rivals' },
  { path: '/oracle',    icon: 'fa-brain',      label: 'AI Optimizer', highlight: true },
]

export default function Sidebar() {
  const location    = useLocation()
  const { signOut } = useClerk()
  const { user }    = useUser()
  const isAdmin     = ADMIN_EMAILS.includes(user?.primaryEmailAddress?.emailAddress)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true' } catch { return false }
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggle = () => {
    const n = !collapsed
    setCollapsed(n)
    try { localStorage.setItem('sidebar_collapsed', String(n)) } catch {}
  }

  const initials = (user?.firstName?.[0] || user?.primaryEmailAddress?.emailAddress?.[0] || 'U').toUpperCase()

  return (
    <>
      {/* ── DESKTOP SIDEBAR (hidden on mobile via CSS) ──────────────────── */}
      <aside className="hidden md:flex flex-col h-screen sticky top-0 flex-shrink-0 transition-all duration-200"
        style={{width: collapsed ? 60 : 220, background:'#0F121D', borderRight:'1px solid rgba(255,255,255,0.07)'}}>

        {/* Logo + toggle */}
        <div className={`flex items-center h-16 flex-shrink-0 border-b border-white/5 ${collapsed ? 'justify-center' : 'justify-between px-4'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-futbol text-blue-500 text-lg"/>
              <span className="font-bold text-sm text-white">Predictive<span className="text-blue-500">FPL</span></span>
            </div>
          )}
          <button onClick={toggle}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors flex-shrink-0"
            style={{background:'rgba(255,255,255,0.06)'}}>
            <i className={`fa-solid fa-chevron-${collapsed ? 'right' : 'left'} text-[10px]`}/>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1 py-4 px-2 overflow-y-auto">
          {NAV.map(item => {
            const active = location.pathname === item.path
            if (item.highlight) return (
              <Link key={item.path} to={item.path} title={collapsed ? item.label : undefined}
                className={`flex items-center rounded-xl font-bold text-sm text-white transition-all ${collapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2.5'}`}
                style={{background:'linear-gradient(135deg,rgba(168,85,247,0.25),rgba(59,130,246,0.15))',border:'1px solid rgba(168,85,247,0.35)'}}>
                <i className={`fa-solid ${item.icon} text-purple-400 flex-shrink-0`}/>
                {!collapsed && item.label}
              </Link>
            )
            return (
              <Link key={item.path} to={item.path} title={collapsed ? item.label : undefined}
                className={`flex items-center rounded-xl text-sm font-medium transition-all border ${collapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2.5'}
                  ${active ? 'text-white bg-white/8 border-white/10' : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'}`}>
                <i className={`fa-solid ${item.icon} flex-shrink-0 ${active ? 'text-blue-400' : ''}`}/>
                {!collapsed && item.label}
              </Link>
            )
          })}
          {isAdmin && (
            <Link to="/admin" title={collapsed ? 'Admin' : undefined}
              className={`flex items-center rounded-xl text-sm font-medium transition-all border ${collapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2.5'}
                ${location.pathname==='/admin' ? 'text-white bg-white/8 border-white/10' : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'}`}>
              <i className="fa-solid fa-crown flex-shrink-0 text-yellow-400"/>
              {!collapsed && 'Admin'}
            </Link>
          )}
        </nav>

        {/* User */}
        <div className={`flex-shrink-0 border-t border-white/5 p-3 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
          {collapsed ? (
            <>
              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400">{initials}</div>
              <button onClick={() => signOut()} title="Sign out" className="text-gray-500 hover:text-red-400 transition-colors"><i className="fa-solid fa-sign-out text-xs"/></button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">{initials}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.firstName || 'User'}</p>
                <p className="text-[10px] text-gray-500 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
              </div>
              <button onClick={() => signOut()} className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"><i className="fa-solid fa-sign-out text-xs"/></button>
            </div>
          )}
        </div>
      </aside>

      {/* ── MOBILE OVERLAY (hidden on desktop) ──────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-64 h-full flex flex-col py-6 px-3" style={{background:'#0F121D',borderRight:'1px solid rgba(255,255,255,0.07)'}}>
            <div className="flex items-center justify-between px-3 mb-8">
              <span className="font-bold text-white">Predictive<span className="text-blue-500">FPL</span></span>
              <button onClick={() => setMobileOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400" style={{background:'rgba(255,255,255,0.07)'}}>
                <i className="fa-solid fa-times text-xs"/>
              </button>
            </div>
            <div className="flex flex-col gap-1 flex-1">
              {NAV.map(item => {
                const active = location.pathname === item.path
                return item.highlight ? (
                  <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-white"
                    style={{background:'linear-gradient(135deg,rgba(168,85,247,0.25),rgba(59,130,246,0.15))',border:'1px solid rgba(168,85,247,0.35)'}}>
                    <i className={`fa-solid ${item.icon} text-purple-400`}/>{item.label}
                  </Link>
                ) : (
                  <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border ${active ? 'text-white bg-white/8 border-white/10' : 'text-gray-400 border-transparent'}`}>
                    <i className={`fa-solid ${item.icon} ${active ? 'text-blue-400' : ''}`}/>{item.label}
                  </Link>
                )
              })}
              {isAdmin && (
                <Link to="/admin" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-400 border border-transparent">
                  <i className="fa-solid fa-crown text-yellow-400"/>Admin
                </Link>
              )}
            </div>
            <div className="flex items-center gap-3 px-3 pt-4 border-t border-white/5">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400">{initials}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.firstName || 'User'}</p>
                <p className="text-[10px] text-gray-500 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
              </div>
              <button onClick={() => signOut()} className="text-gray-500 hover:text-red-400"><i className="fa-solid fa-sign-out text-xs"/></button>
            </div>
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setMobileOpen(false)}/>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV (hidden on desktop) ───────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden items-center justify-around"
        style={{background:'rgba(15,18,29,0.97)',borderTop:'1px solid rgba(255,255,255,0.08)',backdropFilter:'blur(16px)',height:60,paddingBottom:'env(safe-area-inset-bottom)'}}>
        {NAV.map(item => {
          const active = location.pathname === item.path
          return (
            <Link key={item.path} to={item.path}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl flex-1 transition-all"
              style={{background: active ? (item.highlight ? 'rgba(168,85,247,0.15)' : 'rgba(59,130,246,0.12)') : 'transparent'}}>
              <i className={`fa-solid ${item.icon} text-base`}
                style={{color: active ? (item.highlight ? '#a855f7' : '#3b82f6') : '#4b5563'}}/>
              <span className="text-[9px] font-semibold"
                style={{color: active ? (item.highlight ? '#a855f7' : '#60a5fa') : '#4b5563'}}>
                {item.label === 'AI Optimizer' ? 'Oracle' : item.label.split(' ')[0]}
              </span>
            </Link>
          )
        })}
        <button onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl flex-1"
          style={{color:'#4b5563'}}>
          <i className="fa-solid fa-bars text-base"/>
          <span className="text-[9px] font-semibold">More</span>
        </button>
      </nav>
    </>
  )
}
