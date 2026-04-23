import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

const ENGINE_URL   = 'https://web-production-21545.up.railway.app'
const ORACLE_URL   = 'https://predictivefpl-production.up.railway.app'
const SUPABASE_URL = 'https://bpwopjvvalwuisbbvimj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd29wanZ2YWx3dWlzYmJ2aW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5MTI1NjMsImV4cCI6MjA1OTQ4ODU2M30.gFVi_DXbbQGBUSBkzFpbpN4GveDoVrGODOlGLsiSz6Q'
const ADMIN_EMAILS = ['predictivefpl@outlook.com', 'navindhillon@gmail.com']

// ── helpers ──────────────────────────────────────────────────────────────────
function Badge({ ok, label }) {
  return (
    <span className={'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ' +
      (ok ? 'bg-green-500/10 text-green-400 border border-green-500/20'
           : 'bg-red-500/10 text-red-400 border border-red-500/20')}>
      <span className={'w-1.5 h-1.5 rounded-full flex-shrink-0 ' + (ok ? 'bg-green-400 animate-pulse' : 'bg-red-400')} />
      {label || (ok ? 'Online' : 'Offline')}
    </span>
  )
}

function Card({ children, className = '' }) {
  return (
    <div className={'rounded-2xl border border-gray-700/40 bg-white/[0.02] ' + className}>
      {children}
    </div>
  )
}

function Row({ label, value, mono = false }) {
  return (
    <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-black/20 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className={mono ? 'font-mono text-white' : 'font-semibold text-white'}>{value}</span>
    </div>
  )
}

// ── component ─────────────────────────────────────────────────────────────────
export default function AdminConsole() {
  const { user }   = useUser()
  const navigate   = useNavigate()
  const isAdmin    = ADMIN_EMAILS.includes(user?.primaryEmailAddress?.emailAddress)

  const [tab,          setTab]          = useState('overview')
  const [engine,       setEngine]       = useState(null)    // ML engine status
  const [oracle,       setOracle]       = useState(null)    // Oracle engine status
  const [bootstrap,    setBootstrap]    = useState(null)    // FPL bootstrap
  const [users,        setUsers]        = useState(null)    // null = not fetched, [] = empty
  const [loading,      setLoading]      = useState({})
  const [search,       setSearch]       = useState('')
  const [syncTime,     setSyncTime]     = useState(null)

  // ── fetch all status ──────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setSyncTime(null)

    // Oracle (most important — runs the optimiser)
    fetch(ORACLE_URL + '/oracle/status')
      .then(r => r.json()).then(setOracle)
      .catch(() => setOracle({ status: 'error' }))

    // ML engine
    fetch(ENGINE_URL + '/status')
      .then(r => r.json()).then(setEngine)
      .catch(() =>
        // Try alternate path
        fetch(ENGINE_URL + '/api/status')
          .then(r => r.json()).then(setEngine)
          .catch(() => setEngine({ status: 'error' }))
      )

    // FPL bootstrap (via Vercel proxy)
    fetch('/api/fpl?path=' + encodeURIComponent('/bootstrap-static/'))
      .then(r => r.json())
      .then(d => { setBootstrap(d); setSyncTime(new Date().toLocaleTimeString()) })
      .catch(() => setBootstrap(null))
  }, [])

  useEffect(() => {
    if (!isAdmin) { navigate('/dashboard'); return }
    refresh()
    const iv = setInterval(refresh, 45000)
    return () => clearInterval(iv)
  }, [isAdmin])

  // ── fetch users when tab opens ────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'users' && users === null) fetchUsers()
  }, [tab])

  const fetchUsers = async () => {
    setLoading(l => ({ ...l, users: true }))
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/users?select=id,email,name,fpl_team_id,tier,created_at&order=created_at.desc&limit=500`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const data = await r.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch {
      setUsers([])
    }
    setLoading(l => ({ ...l, users: false }))
  }

  const retrain = async (which) => {
    const key = `retrain_${which}`
    setLoading(l => ({ ...l, [key]: true }))
    try {
      const url = which === 'oracle'
        ? ORACLE_URL + '/oracle/train'
        : ENGINE_URL + '/api/train'
      await fetch(url, { method: 'POST' })
      setTimeout(refresh, 4000)
    } catch { /* silent */ }
    setLoading(l => ({ ...l, [key]: false }))
  }

  // ── derived values — only show what we actually have ─────────────────────
  const curEvent    = bootstrap?.events?.find(e => e.is_current)
  const currentGW   = curEvent?.id
  const avgScore    = curEvent?.average_entry_score
  const topScore    = curEvent?.highest_score
  const totalFPL    = bootstrap?.total_players

  const oracleOnline = oracle?.status === 'ok'
  const engineOnline = engine?.status === 'ok' || engine?.status === 'online'
  const fplOnline    = !!bootstrap

  const filteredUsers = (users || []).filter(u =>
    [u.name, u.email, String(u.fpl_team_id || '')].join(' ')
      .toLowerCase().includes(search.toLowerCase())
  )

  // ── not admin ─────────────────────────────────────────────────────────────
  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-[#0F121D] flex text-white">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
            <div>
              <h1 className="text-4xl font-black">Admin Console</h1>
              {syncTime && <p className="text-xs text-gray-500 mt-1">Last synced {syncTime}</p>}
            </div>
            <button onClick={refresh}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all">
              <i className="fa-solid fa-rotate text-xs" /> Refresh
            </button>
          </div>

          {/* KPI row — only shown when we have real data */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Gameweek',   val: currentGW,                     icon: 'fa-calendar-week', col: 'text-blue-400' },
              { label: 'GW Average', val: avgScore,                       icon: 'fa-chart-bar',     col: 'text-green-400' },
              { label: 'GW Top Score',val: topScore,                      icon: 'fa-trophy',        col: 'text-yellow-400' },
              { label: 'FPL Players', val: totalFPL?.toLocaleString(),    icon: 'fa-users',         col: 'text-purple-400' },
            ].map(({ label, val, icon, col }) => (
              <Card key={label} className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <i className={`fa-solid ${icon} text-sm ${col}`} />
                </div>
                {val != null
                  ? <p className={`text-3xl font-black ${col}`}>{val}</p>
                  : <div className="h-8 w-16 rounded-lg bg-white/5 animate-pulse" />
                }
              </Card>
            ))}
          </div>

          {/* Status cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

            {/* FPL API */}
            <Card className="p-5">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-bold flex items-center gap-2">
                  <i className="fa-solid fa-futbol text-blue-400 text-xs" /> FPL API
                </span>
                {fplOnline !== null
                  ? <Badge ok={fplOnline} />
                  : <div className="h-5 w-16 rounded-full bg-white/5 animate-pulse" />
                }
              </div>
              <div className="space-y-1.5">
                {fplOnline ? (
                  <>
                    <Row label="Current GW"    value={currentGW ?? '—'} />
                    <Row label="GW Deadline"   value={curEvent?.deadline_time ? new Date(curEvent.deadline_time).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'} />
                    <Row label="Total Players" value={totalFPL?.toLocaleString() ?? '—'} />
                    <Row label="Teams"         value={bootstrap?.teams?.length ?? '—'} />
                  </>
                ) : (
                  <p className="text-xs text-gray-600 py-2">Waiting for FPL data...</p>
                )}
              </div>
            </Card>

            {/* Oracle Engine */}
            <Card className="p-5">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-bold flex items-center gap-2">
                  <i className="fa-solid fa-brain text-purple-400 text-xs" /> Oracle Engine
                </span>
                {oracle
                  ? <Badge ok={oracleOnline} />
                  : <div className="h-5 w-16 rounded-full bg-white/5 animate-pulse" />
                }
              </div>
              <div className="space-y-1.5 mb-3">
                {oracle ? (
                  <>
                    <Row label="Predictions" value={oracle.predictions_cached ? '✓ Cached' : '✗ Not cached'} />
                    <Row label="Models"      value={oracle.models_available   ? '✓ Loaded' : '✗ Missing'} />
                    <Row label="Training"    value={oracle.training_status ?? '—'} />
                    <Row label="GW"          value={oracle.current_gw ?? '—'} />
                    <Row label="Updated"     value={oracle.last_updated ? new Date(oracle.last_updated).toLocaleTimeString() : '—'} />
                  </>
                ) : (
                  [1,2,3].map(i => <div key={i} className="h-7 rounded-lg bg-white/5 animate-pulse" />)
                )}
              </div>
              <button
                onClick={() => retrain('oracle')}
                disabled={!!loading.retrain_oracle}
                className="w-full py-2 rounded-xl text-xs font-bold border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-all disabled:opacity-40">
                {loading.retrain_oracle ? <><i className="fa-solid fa-spinner fa-spin mr-1" />Retraining...</> : 'Force Retrain Oracle'}
              </button>
            </Card>

            {/* ML Engine */}
            <Card className="p-5">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-bold flex items-center gap-2">
                  <i className="fa-solid fa-robot text-green-400 text-xs" /> ML Engine
                </span>
                {engine
                  ? <Badge ok={engineOnline} />
                  : <div className="h-5 w-16 rounded-full bg-white/5 animate-pulse" />
                }
              </div>
              <div className="space-y-1.5 mb-3">
                {engine ? (
                  Object.entries(engine)
                    .filter(([k]) => !['status'].includes(k))
                    .slice(0, 5)
                    .map(([k, v]) => (
                      <Row key={k} label={k.replace(/_/g,' ')} value={String(v)} />
                    ))
                ) : (
                  [1,2,3].map(i => <div key={i} className="h-7 rounded-lg bg-white/5 animate-pulse" />)
                )}
                {engine?.status === 'error' && (
                  <p className="text-xs text-red-400 px-1">Engine unreachable. Check Railway logs.</p>
                )}
              </div>
              <button
                onClick={() => retrain('engine')}
                disabled={!!loading.retrain_engine}
                className="w-full py-2 rounded-xl text-xs font-bold border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-all disabled:opacity-40">
                {loading.retrain_engine ? <><i className="fa-solid fa-spinner fa-spin mr-1" />Retraining...</> : 'Force Retrain Engine'}
              </button>
            </Card>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              ['Clerk',     'fa-user-shield',  '#3b82f6', 'https://dashboard.clerk.com'],
              ['Supabase',  'fa-database',     '#10b981', 'https://supabase.com/dashboard'],
              ['Railway',   'fa-train',        '#a855f7', 'https://railway.app/dashboard'],
              ['Vercel',    'fa-triangle-exclamation', '#e5e7eb', 'https://vercel.com/dashboard'],
            ].map(([label, icon, col, url]) => (
              <a key={label} href={url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-gray-700/50 hover:border-gray-500/70 bg-white/[0.02] text-gray-400 hover:text-white transition-all group">
                <i className={`fa-solid ${icon} text-sm`} style={{ color: col }} />
                <span className="text-xs font-medium">{label}</span>
                <i className="fa-solid fa-arrow-up-right-from-square text-[9px] ml-auto opacity-30 group-hover:opacity-70" />
              </a>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-800/50 mb-6">
            {[['users', 'Users'], ['endpoints', 'Engine Endpoints']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={'px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ' +
                  (tab === id ? 'text-blue-400 border-blue-400' : 'text-gray-500 border-transparent hover:text-white')}>
                {label}
              </button>
            ))}
          </div>

          {/* Users tab */}
          {tab === 'users' && (
            <div>
              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <div className="relative">
                  <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs" />
                  <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search email, name, team ID..."
                    className="bg-white/3 border border-gray-700 rounded-xl pl-8 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 w-72"
                  />
                </div>
                {users !== null && (
                  <p className="text-xs text-gray-500 ml-auto">
                    {filteredUsers.length} of {users.length} users
                  </p>
                )}
              </div>

              {loading.users ? (
                <div className="flex items-center justify-center py-20 text-gray-600">
                  <i className="fa-solid fa-spinner fa-spin text-2xl" />
                </div>
              ) : users === null ? (
                <div className="flex items-center justify-center py-20 text-gray-600">
                  <p className="text-sm">Loading users...</p>
                </div>
              ) : users.length === 0 ? (
                <Card className="p-12 text-center">
                  <i className="fa-solid fa-database text-gray-700 text-3xl mb-3 block" />
                  <p className="text-gray-500 text-sm">No users found in Supabase.</p>
                  <p className="text-gray-600 text-xs mt-1">
                    Check that the <code className="bg-white/5 px-1 rounded">users</code> table exists and has Row Level Security configured.
                  </p>
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-800/60">
                        <tr className="text-[11px] text-gray-500 uppercase tracking-wider">
                          {['User', 'Email', 'FPL Team ID', 'Plan', 'Joined'].map(h => (
                            <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u, i) => (
                          <tr key={u.id || i} className="border-b border-gray-800/30 hover:bg-white/[0.02] transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-black text-blue-400 flex-shrink-0">
                                  {((u.name || u.email || '?')[0]).toUpperCase()}
                                </div>
                                <span className="font-medium text-white">{u.name || <span className="text-gray-600 italic text-xs">No name</span>}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-gray-400 text-xs">{u.email || '—'}</td>
                            <td className="px-5 py-3">
                              {u.fpl_team_id
                                ? <a href={`https://fantasy.premierleague.com/entry/${u.fpl_team_id}/history`} target="_blank" rel="noreferrer"
                                    className="font-mono text-xs text-blue-400 hover:text-blue-300 transition-colors">
                                    {u.fpl_team_id}
                                  </a>
                                : <span className="text-gray-600 text-xs italic">Not set</span>
                              }
                            </td>
                            <td className="px-5 py-3">
                              <span className={'px-2 py-0.5 rounded text-[10px] font-bold ' +
                                (u.tier === 'pro' ? 'bg-purple-500/15 text-purple-400' :
                                 u.tier === 'premium' ? 'bg-yellow-500/15 text-yellow-400' :
                                 'bg-gray-700/40 text-gray-500')}>
                                {u.tier ? u.tier.charAt(0).toUpperCase() + u.tier.slice(1) : 'Free'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-gray-500 text-xs">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Endpoints tab */}
          {tab === 'endpoints' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-5">
                <p className="text-sm font-bold mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-brain text-purple-400 text-xs" /> Oracle Engine
                  <span className="ml-auto text-[10px] font-mono text-gray-600 truncate">{ORACLE_URL}</span>
                </p>
                <div className="space-y-1.5">
                  {[
                    { path: '/oracle/status',      method: 'GET',  desc: 'Engine health + cache state' },
                    { path: '/oracle/predictions', method: 'GET',  desc: 'All player xP predictions' },
                    { path: '/oracle/fixtures',    method: 'GET',  desc: 'DGW/BGW fixture map' },
                    { path: '/oracle/optimise',    method: 'POST', desc: 'Run transfer optimiser' },
                    { path: '/oracle/train',       method: 'POST', desc: 'Trigger model retrain' },
                    { path: '/oracle/cron',        method: 'POST', desc: 'Daily cron retrain hook' },
                  ].map(({ path, method, desc }) => (
                    <a key={path} href={ORACLE_URL + path} target="_blank" rel="noreferrer"
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-black/20 hover:bg-white/5 transition-colors group">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0 ${method === 'GET' ? 'bg-green-500/15 text-green-400' : 'bg-blue-500/15 text-blue-400'}`}>
                        {method}
                      </span>
                      <span className="text-xs font-mono text-purple-300 group-hover:text-purple-200">{path}</span>
                      <span className="text-[10px] text-gray-600 ml-auto hidden md:block">{desc}</span>
                    </a>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <p className="text-sm font-bold mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-robot text-green-400 text-xs" /> ML Engine
                  <span className="ml-auto text-[10px] font-mono text-gray-600 truncate">{ENGINE_URL}</span>
                </p>
                <div className="space-y-1.5">
                  {[
                    { path: '/status',              method: 'GET',  desc: 'Engine health' },
                    { path: '/api/predictions',     method: 'GET',  desc: 'Player predictions' },
                    { path: '/api/captain',         method: 'GET',  desc: 'Captain picks' },
                    { path: '/api/differentials',   method: 'GET',  desc: 'Differential picks' },
                    { path: '/api/essentials',      method: 'GET',  desc: 'Essential transfers' },
                    { path: '/api/optimise',        method: 'POST', desc: 'Legacy optimiser' },
                    { path: '/api/train',           method: 'POST', desc: 'Trigger retrain' },
                  ].map(({ path, method, desc }) => (
                    <a key={path} href={ENGINE_URL + path} target="_blank" rel="noreferrer"
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-black/20 hover:bg-white/5 transition-colors group">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0 ${method === 'GET' ? 'bg-green-500/15 text-green-400' : 'bg-blue-500/15 text-blue-400'}`}>
                        {method}
                      </span>
                      <span className="text-xs font-mono text-green-300 group-hover:text-green-200">{path}</span>
                      <span className="text-[10px] text-gray-600 ml-auto hidden md:block">{desc}</span>
                    </a>
                  ))}
                </div>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
