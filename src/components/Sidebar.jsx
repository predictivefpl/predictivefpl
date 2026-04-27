import { Link, useLocation } from 'react-router-dom'
import { useClerk, useUser } from '@clerk/clerk-react'
import { useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'

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
  const isMobile    = useIsMobile()
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

  // ── MOBILE ─────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        {/* Overlay menu */}
        {mobileOpen && (
          <div style={{position:'fixed',inset:0,zIndex:50,display:'flex'}}>
            <div style={{width:260,height:'100%',display:'flex',flexDirection:'column',padding:'24px 12px',background:'#0F121D',borderRight:'1px solid rgba(255,255,255,0.07)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 8px',marginBottom:32}}>
                <span style={{fontWeight:800,color:'white',fontSize:15}}>Predictive<span style={{color:'#3b82f6'}}>FPL</span></span>
                <button onClick={() => setMobileOpen(false)}
                  style={{width:28,height:28,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:'#9ca3af',background:'rgba(255,255,255,0.07)',border:'none',cursor:'pointer'}}>
                  <i className="fa-solid fa-times" style={{fontSize:11}}/>
                </button>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:4,flex:1}}>
                {NAV.map(item => {
                  const active = location.pathname === item.path
                  return (
                    <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
                      style={{
                        display:'flex',alignItems:'center',gap:12,padding:'10px 16px',borderRadius:12,
                        textDecoration:'none',fontSize:13,fontWeight:600,
                        background: item.highlight ? 'linear-gradient(135deg,rgba(168,85,247,0.25),rgba(59,130,246,0.15))' : active ? 'rgba(255,255,255,0.06)' : 'transparent',
                        border: item.highlight ? '1px solid rgba(168,85,247,0.35)' : '1px solid transparent',
                        color: item.highlight ? 'white' : active ? 'white' : '#9ca3af',
                      }}>
                      <i className={`fa-solid ${item.icon}`} style={{color: item.highlight ? '#a855f7' : active ? '#3b82f6' : '#6b7280', width:16}}/>
                      {item.label}
                    </Link>
                  )
                })}
                {isAdmin && (
                  <Link to="/admin" onClick={() => setMobileOpen(false)}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',borderRadius:12,textDecoration:'none',fontSize:13,fontWeight:600,color:'#9ca3af',border:'1px solid transparent'}}>
                    <i className="fa-solid fa-crown" style={{color:'#f59e0b',width:16}}/>Admin
                  </Link>
                )}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 8px',borderTop:'1px solid rgba(255,255,255,0.06)',marginTop:16}}>
                <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(59,130,246,0.2)',border:'1px solid rgba(59,130,246,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#60a5fa'}}>{initials}</div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{margin:0,fontSize:12,fontWeight:600,color:'white',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.firstName || 'User'}</p>
                  <p style={{margin:0,fontSize:10,color:'#6b7280',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.primaryEmailAddress?.emailAddress}</p>
                </div>
                <button onClick={() => signOut()} style={{background:'none',border:'none',cursor:'pointer',color:'#6b7280',padding:4}}>
                  <i className="fa-solid fa-sign-out" style={{fontSize:12}}/>
                </button>
              </div>
            </div>
            <div style={{flex:1,background:'rgba(0,0,0,0.6)'}} onClick={() => setMobileOpen(false)}/>
          </div>
        )}

        {/* Bottom tab bar */}
        <nav style={{
          position:'fixed',bottom:0,left:0,right:0,zIndex:40,
          display:'flex',alignItems:'center',justifyContent:'space-around',
          background:'rgba(15,18,29,0.97)',borderTop:'1px solid rgba(255,255,255,0.08)',
          backdropFilter:'blur(16px)',height:60,
          paddingBottom:'env(safe-area-inset-bottom)',
        }}>
          {NAV.map(item => {
            const active = location.pathname === item.path
            return (
              <Link key={item.path} to={item.path}
                style={{
                  display:'flex',flexDirection:'column',alignItems:'center',gap:2,
                  padding:'6px 8px',borderRadius:10,flex:1,textDecoration:'none',
                  background: active ? (item.highlight ? 'rgba(168,85,247,0.15)' : 'rgba(59,130,246,0.12)') : 'transparent',
                }}>
                <i className={`fa-solid ${item.icon}`} style={{fontSize:16,color: active ? (item.highlight ? '#a855f7' : '#3b82f6') : '#4b5563'}}/>
                <span style={{fontSize:9,fontWeight:600,color: active ? (item.highlight ? '#a855f7' : '#60a5fa') : '#4b5563'}}>
                  {item.label === 'AI Optimizer' ? 'Oracle' : item.label.split(' ')[0]}
                </span>
              </Link>
            )
          })}
          <button onClick={() => setMobileOpen(true)}
            style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'6px 8px',borderRadius:10,flex:1,background:'none',border:'none',cursor:'pointer',color:'#4b5563'}}>
            <i className="fa-solid fa-bars" style={{fontSize:16}}/>
            <span style={{fontSize:9,fontWeight:600}}>More</span>
          </button>
        </nav>
      </>
    )
  }

  // ── DESKTOP ────────────────────────────────────────────────────────────────
  return (
    <aside style={{
      display:'flex',flexDirection:'column',height:'100vh',position:'sticky',top:0,flexShrink:0,
      width: collapsed ? 60 : 220,transition:'width 0.2s',
      background:'#0F121D',borderRight:'1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{display:'flex',alignItems:'center',height:64,flexShrink:0,borderBottom:'1px solid rgba(255,255,255,0.05)',justifyContent: collapsed ? 'center' : 'space-between',padding: collapsed ? 0 : '0 16px'}}>
        {!collapsed && (
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <i className="fa-solid fa-futbol" style={{color:'#3b82f6',fontSize:18}}/>
            <span style={{fontWeight:700,fontSize:13,color:'white'}}>Predictive<span style={{color:'#3b82f6'}}>FPL</span></span>
          </div>
        )}
        <button onClick={toggle} style={{width:28,height:28,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:'#9ca3af',background:'rgba(255,255,255,0.06)',border:'none',cursor:'pointer',flexShrink:0}}
          title={collapsed ? 'Expand' : 'Collapse'}>
          <i className={`fa-solid fa-chevron-${collapsed ? 'right' : 'left'}`} style={{fontSize:10}}/>
        </button>
      </div>
      <nav style={{display:'flex',flexDirection:'column',gap:4,flex:1,padding:'16px 8px',overflowY:'auto'}}>
        {NAV.map(item => {
          const active = location.pathname === item.path
          return (
            <Link key={item.path} to={item.path} title={collapsed ? item.label : undefined}
              style={{
                display:'flex',alignItems:'center',gap: collapsed ? 0 : 12,
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? 0 : '10px 12px',
                width: collapsed ? 40 : 'auto',height: collapsed ? 40 : 'auto',
                margin: collapsed ? '0 auto' : 0,
                borderRadius:10,textDecoration:'none',fontSize:13,fontWeight:500,
                transition:'all 0.15s',
                background: item.highlight ? 'linear-gradient(135deg,rgba(168,85,247,0.25),rgba(59,130,246,0.15))' : active ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: item.highlight ? '1px solid rgba(168,85,247,0.35)' : active ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                color: item.highlight ? 'white' : active ? 'white' : '#9ca3af',
              }}>
              <i className={`fa-solid ${item.icon}`} style={{color: item.highlight ? '#a855f7' : active ? '#3b82f6' : '#6b7280',flexShrink:0}}/>
              {!collapsed && item.label}
            </Link>
          )
        })}
        {isAdmin && (
          <Link to="/admin" title={collapsed ? 'Admin' : undefined}
            style={{
              display:'flex',alignItems:'center',gap: collapsed ? 0 : 12,justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? 0 : '10px 12px',width: collapsed ? 40 : 'auto',height: collapsed ? 40 : 'auto',
              margin: collapsed ? '0 auto' : 0,borderRadius:10,textDecoration:'none',fontSize:13,fontWeight:500,
              background: location.pathname==='/admin' ? 'rgba(255,255,255,0.06)' : 'transparent',
              border: location.pathname==='/admin' ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
              color:'#9ca3af',
            }}>
            <i className="fa-solid fa-crown" style={{color:'#f59e0b',flexShrink:0}}/>
            {!collapsed && 'Admin'}
          </Link>
        )}
      </nav>
      <div style={{flexShrink:0,borderTop:'1px solid rgba(255,255,255,0.05)',padding:12,display:'flex',flexDirection: collapsed ? 'column' : 'row',alignItems:'center',gap:8}}>
        <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(59,130,246,0.2)',border:'1px solid rgba(59,130,246,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#60a5fa',flexShrink:0}}>{initials}</div>
        {!collapsed && (
          <div style={{flex:1,minWidth:0}}>
            <p style={{margin:0,fontSize:12,fontWeight:600,color:'white',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.firstName || 'User'}</p>
            <p style={{margin:0,fontSize:10,color:'#6b7280',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
        )}
        <button onClick={() => signOut()} style={{background:'none',border:'none',cursor:'pointer',color:'#6b7280',padding:4,flexShrink:0}}>
          <i className="fa-solid fa-sign-out" style={{fontSize:12}}/>
        </button>
      </div>
    </aside>
  )
}
