import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

const ENGINE_URL   = 'https://web-production-21545.up.railway.app'
const ORACLE_URL   = 'https://predictivefpl-production.up.railway.app'
const SUPABASE_URL = 'https://bpwopjvvalwuisbbvimj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd29wanZ2YWx3dWlzYmJ2aW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5MTI1NjMsImV4cCI6MjA1OTQ4ODU2M30.gFVi_DXbbQGBUSBkzFpbpN4GveDoVrGODOlGLsiSz6Q'
const ADMIN_EMAILS = ['predictivefpl@outlook.com', 'navindhillon@gmail.com']

const TIERS = {
  free:    { label: 'Free',    color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  pro:     { label: 'Pro',     color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  premium: { label: 'Premium', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
}

// ── tiny helpers ──────────────────────────────────────────────────────────────
function Card({ children, className = '' }) {
  return <div className={'rounded-2xl border border-white/[0.06] bg-[#12151F] ' + className}>{children}</div>
}
function Kpi({ label, value, sub, icon, color, loading }) {
  return (
    <Card className="p-5">
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + '18' }}>
          <i className={'fa-solid ' + icon + ' text-sm'} style={{ color }} />
        </div>
      </div>
      {loading
        ? <div className="h-8 w-20 rounded-lg bg-white/5 animate-pulse" />
        : <p className="text-3xl font-black text-white tracking-tight">{value ?? '—'}</p>
      }
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </Card>
  )
}
function StatusDot({ ok }) {
  return <span className={'inline-block w-2 h-2 rounded-full flex-shrink-0 ' + (ok ? 'bg-green-400' : 'bg-red-400')} />
}

// ── main component ─────────────────────────────────────────────────────────────
export default function AdminConsole() {
  const { user } = useUser()
  const navigate = useNavigate()
  const isAdmin  = ADMIN_EMAILS.includes(user?.primaryEmailAddress?.emailAddress)

  const [tab,       setTab]       = useState('overview')
  const [oracle,    setOracle]    = useState(null)
  const [engine,    setEngine]    = useState(null)
  const [bootstrap, setBootstrap] = useState(null)
  const [users,     setUsers]     = useState(null)
  const [search,    setSearch]    = useState('')
  const [tierFilter,setTierFilter]= useState('all')
  const [busy,      setBusy]      = useState({})
  const [syncTime,  setSyncTime]  = useState(null)
  const [emailDraft,setEmailDraft]= useState({ subject:'', body:'' })
  const [emailSent, setEmailSent] = useState(false)

  const setB = (k, v) => setBusy(b => ({ ...b, [k]: v }))

  // ── fetch status ────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    fetch(ORACLE_URL + '/oracle/status').then(r => r.json()).then(setOracle).catch(() => setOracle({ status: 'error' }))
    fetch(ENGINE_URL + '/status').then(r => r.json()).then(setEngine)
      .catch(() => fetch(ENGINE_URL + '/api/status').then(r => r.json()).then(setEngine)
        .catch(() => setEngine({ status: 'error' })))
    fetch('/api/fpl?path=' + encodeURIComponent('/bootstrap-static/'))
      .then(r => r.json()).then(d => { setBootstrap(d); setSyncTime(new Date().toLocaleTimeString()) })
      .catch(() => {})
  }, [])

  // ── fetch users ─────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setB('users', true)
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/users?select=id,email,name,fpl_team_id,tier,created_at,last_sign_in&order=created_at.desc&limit=1000`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const d = await r.json()
      setUsers(Array.isArray(d) ? d : [])
    } catch { setUsers([]) }
    setB('users', false)
  }, [])

  useEffect(() => {
    if (!isAdmin) { navigate('/dashboard'); return }
    refresh()
    const iv = setInterval(refresh, 60000)
    return () => clearInterval(iv)
  }, [isAdmin])

  useEffect(() => { if (tab === 'users' && users === null) fetchUsers() }, [tab])

  // ── derived ─────────────────────────────────────────────────────────────────
  const curEvent    = bootstrap?.events?.find(e => e.is_current)
  const currentGW   = curEvent?.id
  const avgScore    = curEvent?.average_entry_score
  const topScore    = curEvent?.highest_score
  const totalFPL    = bootstrap?.total_players
  const oracleOk    = oracle?.status === 'ok'
  const engineOk    = engine?.status === 'ok' || engine?.status === 'online'
  const fplOk       = !!bootstrap

  const allUsers    = users || []
  const freeCount   = allUsers.filter(u => !u.tier || u.tier === 'free').length
  const proCount    = allUsers.filter(u => u.tier === 'pro').length
  const premCount   = allUsers.filter(u => u.tier === 'premium').length

  // signup trend: users joined in last 7 days
  const last7 = allUsers.filter(u => {
    if (!u.created_at) return false
    return (Date.now() - new Date(u.created_at)) < 7 * 86400000
  }).length

  const filtered = allUsers.filter(u => {
    const matchSearch = [u.name, u.email, String(u.fpl_team_id || '')].join(' ').toLowerCase().includes(search.toLowerCase())
    const matchTier   = tierFilter === 'all' || (u.tier || 'free') === tierFilter
    return matchSearch && matchTier
  })

  // ── retrain ─────────────────────────────────────────────────────────────────
  const retrain = async (which) => {
    setB('rt_' + which, true)
    try {
      await fetch((which === 'oracle' ? ORACLE_URL + '/oracle/train' : ENGINE_URL + '/api/train'), { method: 'POST' })
      setTimeout(refresh, 5000)
    } catch { }
    setB('rt_' + which, false)
  }

  // ── email marketing (mailto fallback until sendgrid added) ──────────────────
  const sendBroadcast = () => {
    const emails = allUsers.map(u => u.email).filter(Boolean).join(',')
    const mailto = `mailto:${emails}?subject=${encodeURIComponent(emailDraft.subject)}&body=${encodeURIComponent(emailDraft.body)}`
    window.open(mailto)
    setEmailSent(true)
    setTimeout(() => setEmailSent(false), 3000)
  }

  if (!isAdmin) return null

  // ── render ─────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'overview',    label: 'Overview',     icon: 'fa-chart-pie' },
    { id: 'users',       label: 'Users',        icon: 'fa-users' },
    { id: 'marketing',   label: 'Marketing',    icon: 'fa-envelope' },
    { id: 'systems',     label: 'Systems',      icon: 'fa-server' },
  ]

  return (
    <div className="min-h-screen bg-[#0B0D14] flex text-white">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">

          {/* ── Header ───────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#3b82f6,#a855f7)' }}>
                  <i className="fa-solid fa-crown text-white text-sm" />
                </div>
                <h1 className="text-3xl font-black">Business Dashboard</h1>
              </div>
              <p className="text-gray-500 text-sm ml-13">
                {syncTime ? `Last synced ${syncTime}` : 'Syncing...'} · Owner view only
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* status pills */}
              {[
                { label: 'FPL API', ok: fplOk },
                { label: 'Oracle',  ok: oracleOk },
                { label: 'Engine',  ok: engineOk },
              ].map(({ label, ok }) => (
                <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border"
                  style={{ background: ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderColor: ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: ok ? '#34d399' : '#f87171' }}>
                  <StatusDot ok={ok} />
                  {label}
                </div>
              ))}
              <button onClick={refresh} className="px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all">
                <i className="fa-solid fa-rotate mr-1 text-[10px]" /> Refresh
              </button>
            </div>
          </div>

          {/* ── Tabs ─────────────────────────────────────────────────────── */}
          <div className="flex gap-1 mb-8 p-1 rounded-2xl w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ' +
                  (tab === t.id ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white')}>
                <i className={'fa-solid ' + t.icon + ' text-xs'} />
                {t.label}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════════
              OVERVIEW TAB
          ══════════════════════════════════════════════════════════════ */}
          {tab === 'overview' && (
            <div className="space-y-6">

              {/* Business KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Kpi label="Total Users"    value={allUsers.length || null} sub={`+${last7} this week`}  icon="fa-users"      color="#3b82f6" loading={users === null} />
                <Kpi label="Pro Members"    value={proCount || null}  sub="Active subscriptions"         icon="fa-star"       color="#a855f7" loading={users === null} />
                <Kpi label="Premium Members"value={premCount || null} sub="Top tier"                     icon="fa-crown"      color="#f59e0b" loading={users === null} />
                <Kpi label="Free Users"     value={freeCount || null} sub="Conversion targets"           icon="fa-user"       color="#10b981" loading={users === null} />
              </div>

              {/* FPL + Oracle KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Kpi label="Current GW"      value={currentGW}         icon="fa-calendar-week" color="#3b82f6" loading={!bootstrap} />
                <Kpi label="GW Average"      value={avgScore}          icon="fa-chart-bar"     color="#10b981" loading={!bootstrap} />
                <Kpi label="GW Top Score"    value={topScore}          icon="fa-trophy"        color="#f59e0b" loading={!bootstrap} />
                <Kpi label="FPL Managers"    value={totalFPL?.toLocaleString()} icon="fa-globe" color="#a855f7" loading={!bootstrap} />
              </div>

              {/* Membership breakdown + growth */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Membership breakdown */}
                <Card className="p-6">
                  <h3 className="text-sm font-bold text-gray-300 mb-5 flex items-center gap-2">
                    <i className="fa-solid fa-chart-pie text-blue-400 text-xs" /> Membership Breakdown
                  </h3>
                  {users === null
                    ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 rounded-xl bg-white/5 animate-pulse" />)}</div>
                    : ['free','pro','premium'].map(tier => {
                        const count = allUsers.filter(u => (u.tier || 'free') === tier).length
                        const pct   = allUsers.length ? Math.round((count / allUsers.length) * 100) : 0
                        const t     = TIERS[tier]
                        return (
                          <div key={tier} className="mb-3">
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="font-bold" style={{ color: t.color }}>{t.label}</span>
                              <span className="text-gray-400">{count} users · {pct}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: pct + '%', background: t.color }} />
                            </div>
                          </div>
                        )
                      })
                  }
                </Card>

                {/* Recent signups */}
                <Card className="p-6">
                  <h3 className="text-sm font-bold text-gray-300 mb-5 flex items-center gap-2">
                    <i className="fa-solid fa-user-plus text-green-400 text-xs" /> Recent Signups
                  </h3>
                  {users === null
                    ? <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-10 rounded-xl bg-white/5 animate-pulse" />)}</div>
                    : allUsers.slice(0, 6).map((u, i) => (
                        <div key={i} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                            style={{ background: '#1e2235', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>
                            {((u.name || u.email || '?')[0]).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{u.email || '—'}</p>
                            <p className="text-[10px] text-gray-600">{u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—'}</p>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
                            style={{ background: TIERS[u.tier||'free'].bg, color: TIERS[u.tier||'free'].color }}>
                            {TIERS[u.tier||'free'].label}
                          </span>
                        </div>
                      ))
                  }
                </Card>
              </div>

              {/* Quick actions */}
              <Card className="p-6">
                <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-bolt text-yellow-400 text-xs" /> Quick Actions
                </h3>
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: 'Retrain Oracle',  icon: 'fa-brain',       col: '#a855f7', action: () => retrain('oracle'),  loading: busy.rt_oracle },
                    { label: 'Retrain Engine',  icon: 'fa-robot',       col: '#10b981', action: () => retrain('engine'),  loading: busy.rt_engine },
                    { label: 'View Users',      icon: 'fa-users',       col: '#3b82f6', action: () => setTab('users') },
                    { label: 'Send Broadcast',  icon: 'fa-envelope',    col: '#f59e0b', action: () => setTab('marketing') },
                    { label: 'Clerk Dashboard', icon: 'fa-user-shield', col: '#6366f1', action: () => window.open('https://dashboard.clerk.com') },
                    { label: 'Supabase',        icon: 'fa-database',    col: '#10b981', action: () => window.open('https://supabase.com/dashboard') },
                    { label: 'Railway',         icon: 'fa-train',       col: '#a855f7', action: () => window.open('https://railway.app/dashboard') },
                    { label: 'Vercel',          icon: 'fa-triangle-exclamation', col: '#e5e7eb', action: () => window.open('https://vercel.com/dashboard') },
                  ].map(({ label, icon, col, action, loading }) => (
                    <button key={label} onClick={action} disabled={!!loading}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all disabled:opacity-40"
                      style={{ borderColor: col + '33', color: col, background: col + '0d' }}
                      onMouseEnter={e => e.currentTarget.style.background = col + '22'}
                      onMouseLeave={e => e.currentTarget.style.background = col + '0d'}>
                      <i className={'fa-solid ' + icon + (loading ? ' fa-spin' : '') + ' text-[11px]'} />
                      {loading ? 'Working...' : label}
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              USERS TAB
          ══════════════════════════════════════════════════════════════ */}
          {tab === 'users' && (
            <div className="space-y-5">

              {/* Filter bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs" />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search email, name, team ID..."
                    className="bg-white/[0.04] border border-white/[0.08] rounded-xl pl-8 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 w-72 placeholder-gray-600" />
                </div>
                <div className="flex gap-1.5">
                  {['all','free','pro','premium'].map(t => (
                    <button key={t} onClick={() => setTierFilter(t)}
                      className={'px-3 py-2 rounded-xl text-xs font-bold border transition-all ' +
                        (tierFilter === t ? 'bg-white text-black border-white' : 'border-white/10 text-gray-500 hover:text-white hover:border-white/30')}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                      {t !== 'all' && users !== null && (
                        <span className="ml-1.5 opacity-60">
                          {t === 'free' ? freeCount : t === 'pro' ? proCount : premCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-3">
                  {users !== null && <p className="text-xs text-gray-500">{filtered.length} / {allUsers.length} users</p>}
                  <button onClick={fetchUsers} className="px-3 py-2 rounded-xl text-xs font-medium border border-gray-700 text-gray-400 hover:text-white transition-all">
                    <i className="fa-solid fa-rotate text-[10px] mr-1" /> Reload
                  </button>
                </div>
              </div>

              {/* Table */}
              {busy.users || users === null
                ? <div className="flex items-center justify-center py-24"><i className="fa-solid fa-spinner fa-spin text-2xl text-gray-600" /></div>
                : allUsers.length === 0
                  ? <Card className="p-16 text-center">
                      <i className="fa-solid fa-database text-gray-700 text-4xl mb-4 block" />
                      <p className="text-gray-400 font-semibold mb-1">No users found</p>
                      <p className="text-gray-600 text-sm">The Supabase <code className="bg-white/5 px-1 rounded">users</code> table may be empty or RLS may be blocking the query.</p>
                    </Card>
                  : <Card className="overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-white/[0.06]">
                            <tr className="text-[11px] text-gray-500 uppercase tracking-widest">
                              {['User','Email','FPL Team ID','Tier','Joined','Last Login'].map(h => (
                                <th key={h} className="px-5 py-4 text-left font-semibold">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((u, i) => {
                              const tier = TIERS[u.tier || 'free']
                              return (
                                <tr key={u.id || i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                                  <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                                        style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                                        {((u.name || u.email || '?')[0]).toUpperCase()}
                                      </div>
                                      <span className="font-semibold text-white text-xs">
                                        {u.name || <span className="text-gray-600 italic font-normal">No name</span>}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-5 py-3.5 text-gray-400 text-xs">{u.email || '—'}</td>
                                  <td className="px-5 py-3.5">
                                    {u.fpl_team_id
                                      ? <a href={`https://fantasy.premierleague.com/entry/${u.fpl_team_id}/history`} target="_blank" rel="noreferrer"
                                          className="font-mono text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors">
                                          {u.fpl_team_id}
                                        </a>
                                      : <span className="text-gray-700 text-xs italic">Not linked</span>
                                    }
                                  </td>
                                  <td className="px-5 py-3.5">
                                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg" style={{ background: tier.bg, color: tier.color }}>
                                      {tier.label}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3.5 text-gray-500 text-xs">
                                    {u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit'}) : '—'}
                                  </td>
                                  <td className="px-5 py-3.5 text-gray-500 text-xs">
                                    {u.last_sign_in ? new Date(u.last_sign_in).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
              }
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              MARKETING TAB
          ══════════════════════════════════════════════════════════════ */}
          {tab === 'marketing' && (
            <div className="space-y-6">

              {/* Email broadcast */}
              <Card className="p-6">
                <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
                  <i className="fa-solid fa-envelope text-blue-400 text-xs" /> Email Broadcast
                </h3>
                <p className="text-xs text-gray-500 mb-5">
                  Send to all {allUsers.filter(u => u.email).length} users with email addresses.
                  Opens your default mail client — connect SendGrid or Resend for one-click sends.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">Subject Line</label>
                    <input type="text" value={emailDraft.subject} onChange={e => setEmailDraft(d => ({ ...d, subject: e.target.value }))}
                      placeholder="e.g. 🔥 GW34 Transfer Deadline — Your AI Picks Are Ready"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 placeholder-gray-600" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">Message</label>
                    <textarea value={emailDraft.body} onChange={e => setEmailDraft(d => ({ ...d, body: e.target.value }))}
                      rows={8} placeholder="Write your message to users..."
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 placeholder-gray-600 resize-none" />
                  </div>
                  <div className="flex gap-3 items-center">
                    <button onClick={sendBroadcast} disabled={!emailDraft.subject || !emailDraft.body || users === null}
                      className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 flex items-center gap-2"
                      style={{ background: 'linear-gradient(135deg,#3b82f6,#a855f7)' }}>
                      <i className="fa-solid fa-paper-plane text-xs" />
                      Send to All Users
                    </button>
                    {emailSent && <span className="text-xs text-green-400 flex items-center gap-1"><i className="fa-solid fa-check" /> Email client opened</span>}
                  </div>
                </div>
              </Card>

              {/* Segment breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { tier: 'free',    icon: 'fa-user',  msg: 'Upsell to Pro — highlight Oracle AI picks and rival tracking.' },
                  { tier: 'pro',     icon: 'fa-star',  msg: 'Upsell to Premium — deeper analysis, chip timing advisor.' },
                  { tier: 'premium', icon: 'fa-crown', msg: 'Retain — exclusive features, early GW previews.' },
                ].map(({ tier, icon, msg }) => {
                  const t     = TIERS[tier]
                  const count = allUsers.filter(u => (u.tier || 'free') === tier).length
                  const emails = allUsers.filter(u => (u.tier || 'free') === tier && u.email).map(u => u.email)
                  return (
                    <Card key={tier} className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: t.bg }}>
                          <i className={'fa-solid ' + icon + ' text-xs'} style={{ color: t.color }} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{t.label} Users</p>
                          <p className="text-xs text-gray-500">{count} users · {emails.length} with email</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-4 leading-relaxed">{msg}</p>
                      <button
                        onClick={() => {
                          const mailto = `mailto:${emails.join(',')}?subject=${encodeURIComponent(emailDraft.subject||'Message from PredictiveFPL')}&body=${encodeURIComponent(emailDraft.body||'')}`
                          window.open(mailto)
                        }}
                        disabled={emails.length === 0}
                        className="w-full py-2 rounded-xl text-xs font-bold border transition-all disabled:opacity-30"
                        style={{ borderColor: t.color + '44', color: t.color }}
                        onMouseEnter={e => e.currentTarget.style.background = t.bg}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        Email {t.label} Segment
                      </button>
                    </Card>
                  )
                })}
              </div>

              {/* Future integrations */}
              <Card className="p-6">
                <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-plug text-gray-600 text-xs" /> Recommended Integrations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { name: 'Resend',     desc: 'Transactional email API. Free 3k/month. Best for one-click broadcasts.',  url: 'https://resend.com', col: '#000' },
                    { name: 'Stripe',     desc: 'Payments + subscriptions. Add Pro/Premium tiers with a single webhook.',   url: 'https://stripe.com',  col: '#635bff' },
                    { name: 'PostHog',    desc: 'Product analytics. See which features users actually use.',                url: 'https://posthog.com', col: '#f54e00' },
                  ].map(({ name, desc, url, col }) => (
                    <a key={name} href={url} target="_blank" rel="noreferrer"
                      className="flex flex-col gap-2 p-4 rounded-xl border border-white/[0.06] hover:border-white/20 bg-white/[0.02] transition-all group">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{name}</span>
                        <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-gray-600 group-hover:text-gray-400" />
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-gray-400 w-fit">Not yet integrated</span>
                    </a>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SYSTEMS TAB
          ══════════════════════════════════════════════════════════════ */}
          {tab === 'systems' && (
            <div className="space-y-6">

              {/* Live status cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* FPL */}
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold flex items-center gap-2"><i className="fa-solid fa-futbol text-blue-400 text-xs" /> FPL API</span>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: fplOk ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: fplOk ? '#10b981' : '#ef4444' }}>
                      <StatusDot ok={fplOk} /> {fplOk ? 'Online' : 'Offline'}
                    </div>
                  </div>
                  {bootstrap
                    ? <div className="space-y-1.5 text-xs">
                        {[
                          ['GW', currentGW],
                          ['Deadline', curEvent?.deadline_time ? new Date(curEvent.deadline_time).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'],
                          ['Total FPL Players', totalFPL?.toLocaleString()],
                          ['Teams', bootstrap?.teams?.length],
                        ].map(([k,v]) => (
                          <div key={k} className="flex justify-between px-3 py-2 rounded-lg bg-black/20">
                            <span className="text-gray-500">{k}</span>
                            <span className="text-white font-semibold">{v ?? '—'}</span>
                          </div>
                        ))}
                      </div>
                    : <p className="text-xs text-gray-600">Loading...</p>
                  }
                </Card>

                {/* Oracle */}
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold flex items-center gap-2"><i className="fa-solid fa-brain text-purple-400 text-xs" /> Oracle Engine</span>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: oracleOk ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: oracleOk ? '#10b981' : '#ef4444' }}>
                      <StatusDot ok={oracleOk} /> {oracleOk ? 'Online' : 'Offline'}
                    </div>
                  </div>
                  {oracle
                    ? <div className="space-y-1.5 text-xs">
                        {[
                          ['Predictions', oracle.predictions_cached ? '✓ Cached' : '✗ Not cached'],
                          ['Models',      oracle.models_available   ? '✓ Loaded' : '✗ Missing'],
                          ['Training',    oracle.training_status ?? '—'],
                          ['GW',          oracle.current_gw ?? '—'],
                          ['Updated',     oracle.last_updated ? new Date(oracle.last_updated).toLocaleTimeString() : '—'],
                        ].map(([k,v]) => (
                          <div key={k} className="flex justify-between px-3 py-2 rounded-lg bg-black/20">
                            <span className="text-gray-500">{k}</span>
                            <span className={v?.toString().startsWith('✗') ? 'text-red-400 font-semibold' : v?.toString().startsWith('✓') ? 'text-green-400 font-semibold' : 'text-white font-semibold'}>{v}</span>
                          </div>
                        ))}
                      </div>
                    : <p className="text-xs text-gray-600">Loading...</p>
                  }
                  <button onClick={() => retrain('oracle')} disabled={!!busy.rt_oracle}
                    className="w-full mt-3 py-2 rounded-xl text-xs font-bold border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-all disabled:opacity-40">
                    {busy.rt_oracle ? <><i className="fa-solid fa-spinner fa-spin mr-1" />Retraining...</> : 'Force Retrain'}
                  </button>
                </Card>

                {/* ML Engine */}
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold flex items-center gap-2"><i className="fa-solid fa-robot text-green-400 text-xs" /> ML Engine</span>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: engineOk ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: engineOk ? '#10b981' : '#ef4444' }}>
                      <StatusDot ok={engineOk} /> {engineOk ? 'Online' : 'Offline'}
                    </div>
                  </div>
                  {engine
                    ? <div className="space-y-1.5 text-xs">
                        {Object.entries(engine).filter(([k]) => k !== 'status').slice(0,5).map(([k,v]) => (
                          <div key={k} className="flex justify-between px-3 py-2 rounded-lg bg-black/20">
                            <span className="text-gray-500 capitalize">{k.replace(/_/g,' ')}</span>
                            <span className="text-white font-semibold truncate ml-2 max-w-[120px] text-right">{String(v)}</span>
                          </div>
                        ))}
                        {engine.status === 'error' && <p className="text-red-400 text-xs px-1 pt-1">Unreachable — check Railway logs.</p>}
                      </div>
                    : <p className="text-xs text-gray-600">Loading...</p>
                  }
                  <button onClick={() => retrain('engine')} disabled={!!busy.rt_engine}
                    className="w-full mt-3 py-2 rounded-xl text-xs font-bold border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-all disabled:opacity-40">
                    {busy.rt_engine ? <><i className="fa-solid fa-spinner fa-spin mr-1" />Retraining...</> : 'Force Retrain'}
                  </button>
                </Card>
              </div>

              {/* API endpoints */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-5">
                  <p className="text-sm font-bold mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-brain text-purple-400 text-xs" /> Oracle Endpoints
                    <code className="ml-auto text-[10px] text-gray-600 font-mono">predictivefpl-production.up.railway.app</code>
                  </p>
                  <div className="space-y-1.5">
                    {[
                      { path:'/oracle/status',      m:'GET',  d:'Engine health + cache state' },
                      { path:'/oracle/predictions', m:'GET',  d:'All player xP predictions' },
                      { path:'/oracle/fixtures',    m:'GET',  d:'DGW/BGW fixture map' },
                      { path:'/oracle/optimise',    m:'POST', d:'Run greedy transfer solver' },
                      { path:'/oracle/train',       m:'POST', d:'Trigger ML retrain' },
                      { path:'/oracle/cron',        m:'POST', d:'Daily cron hook' },
                    ].map(({ path, m, d }) => (
                      <a key={path} href={ORACLE_URL+path} target="_blank" rel="noreferrer"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/20 hover:bg-white/5 transition-colors group">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0 ${m==='GET'?'bg-green-500/15 text-green-400':'bg-blue-500/15 text-blue-400'}`}>{m}</span>
                        <span className="text-xs font-mono text-purple-300">{path}</span>
                        <span className="text-[10px] text-gray-600 ml-auto hidden lg:block">{d}</span>
                      </a>
                    ))}
                  </div>
                </Card>
                <Card className="p-5">
                  <p className="text-sm font-bold mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-robot text-green-400 text-xs" /> ML Engine Endpoints
                    <code className="ml-auto text-[10px] text-gray-600 font-mono">web-production-21545.up.railway.app</code>
                  </p>
                  <div className="space-y-1.5">
                    {[
                      { path:'/status',             m:'GET',  d:'Health check' },
                      { path:'/api/predictions',    m:'GET',  d:'Player predictions' },
                      { path:'/api/captain',        m:'GET',  d:'Captain picks' },
                      { path:'/api/differentials',  m:'GET',  d:'Differential picks' },
                      { path:'/api/essentials',     m:'GET',  d:'Essential transfers' },
                      { path:'/api/optimise',       m:'POST', d:'Legacy optimiser' },
                      { path:'/api/train',          m:'POST', d:'Trigger retrain' },
                    ].map(({ path, m, d }) => (
                      <a key={path} href={ENGINE_URL+path} target="_blank" rel="noreferrer"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/20 hover:bg-white/5 transition-colors group">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0 ${m==='GET'?'bg-green-500/15 text-green-400':'bg-blue-500/15 text-blue-400'}`}>{m}</span>
                        <span className="text-xs font-mono text-green-300">{path}</span>
                        <span className="text-[10px] text-gray-600 ml-auto hidden lg:block">{d}</span>
                      </a>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
