import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import Sidebar from '../components/Sidebar'

const ENGINE_URL = 'https://web-production-21545.up.railway.app'
const SUPABASE_URL = 'https://bpwopjvvalwuisbbvimj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd29wanZ2YWx3dWlzYmJ2aW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5MTI1NjMsImV4cCI6MjA1OTQ4ODU2M30.gFVi_DXbbQGBUSBkzFpbpN4GveDoVrGODOlGLsiSz6Q'
const ADMIN_EMAIL = 'predictivefpl@outlook.com'

export default function AdminConsole() {
  const { user } = useUser()
  const [activeTab, setActiveTab]         = useState('overview')
  const [search, setSearch]               = useState('')
  const [engineStatus, setEngineStatus]   = useState(null)
  const [fplStatus, setFplStatus]         = useState('checking')
  const [lastSync, setLastSync]           = useState(null)
  const [maintenanceMode, setMaintenance] = useState(false)
  const [users, setUsers]                 = useState([])
  const [usersLoading, setUsersLoading]   = useState(false)
  const [bootstrap, setBootstrap]         = useState(null)

  const isAdmin = user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL

  // ── Fetch engine status ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchEngine = async () => {
      try {
        const res = await fetch(ENGINE_URL + '/api/status')
        const data = await res.json()
        setEngineStatus(data)
      } catch { setEngineStatus({ status: 'error' }) }
    }
    fetchEngine()
    const iv = setInterval(fetchEngine, 30000)
    return () => clearInterval(iv)
  }, [])

  // ── Fetch FPL API status + bootstrap data ────────────────────────────────
  useEffect(() => {
    const checkFpl = async () => {
      try {
        const res = await fetch('/api/fpl?path=' + encodeURIComponent('/bootstrap-static/'))
        if (res.ok) {
          const data = await res.json()
          setBootstrap(data)
          setFplStatus('active')
          setLastSync(new Date().toLocaleTimeString())
        } else { setFplStatus('error') }
      } catch { setFplStatus('disconnected') }
    }
    checkFpl()
  }, [])

  // ── Fetch real users from Supabase ───────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'users') return
    setUsersLoading(true)
    fetch(SUPABASE_URL + '/rest/v1/users?select=*&order=created_at.desc&limit=100', {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
      }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setUsers(data)
        else setUsers([])
        setUsersLoading(false)
      })
      .catch(() => {
        // Supabase table may not exist yet - show current admin user
        setUsers([{
          name: user?.fullName || 'Admin',
          email: user?.primaryEmailAddress?.emailAddress || '',
          fpl_team_id: user?.unsafeMetadata?.fplTeamId || '—',
          tier: 'Admin',
          created_at: user?.createdAt,
          status: 'Active',
        }])
        setUsersLoading(false)
      })
  }, [activeTab])

  // ── Derived stats from real data ──────────────────────────────────────────
  const currentGW   = engineStatus?.current_gw || bootstrap?.events?.find(e => e.is_current)?.id || '—'
  const avgScore    = bootstrap?.events?.find(e => e.is_current)?.average_entry_score || '—'
  const topScore    = bootstrap?.events?.find(e => e.is_current)?.highest_score || '—'
  const totalPlayers = bootstrap?.total_players ? bootstrap.total_players.toLocaleString() : '—'

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return (u.name || '').toLowerCase().includes(q) ||
           (u.email || '').toLowerCase().includes(q) ||
           String(u.fpl_team_id || '').includes(q)
  })

  if (!isAdmin) return (
    <div className="min-h-screen bg-[#0F121D] flex items-center justify-center text-white">
      <div className="text-center">
        <i className="fa-solid fa-lock text-red-400 text-4xl mb-4"/>
        <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
        <p className="text-gray-400">Admin privileges required.</p>
      </div>
    </div>
  )

  const StatusDot = ({ ok }) => (
    <span className={'flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ' + (ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400')}>
      <span className={'w-1.5 h-1.5 rounded-full ' + (ok ? 'bg-green-400 animate-pulse' : 'bg-red-400')}/>
      {ok ? 'Active' : 'Error'}
    </span>
  )

  return (
    <div className="min-h-screen bg-[#0F121D] bg-grid flex text-white">
      {maintenanceMode && (
        <div className="fixed inset-0 bg-yellow-500/10 border-4 border-yellow-500/30 pointer-events-none z-50">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-6 py-2 rounded-full text-sm font-bold">
            <i className="fa-solid fa-triangle-exclamation mr-2"/>MAINTENANCE MODE ACTIVE
          </div>
        </div>
      )}
      <Sidebar/>
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <main className="flex-1 overflow-y-auto custom-scroll p-6 md:p-8 max-w-7xl mx-auto w-full">

          {/* Header */}
          <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-4xl font-bold mb-2">Admin Console</h1>
              <p className="text-gray-400">System management, user oversight, and monitoring</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => window.location.reload()}
                className="neon-button rounded-xl px-5 py-2.5 font-medium flex items-center gap-2 text-sm">
                <i className="fa-solid fa-sync"/> Refresh
              </button>
            </div>
          </div>

          {/* Real KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Current GW',       value: currentGW,    icon: 'fa-calendar',      color: 'text-blue-400' },
              { label: 'Avg GW Score',     value: avgScore,     icon: 'fa-chart-bar',     color: 'text-green-400' },
              { label: 'Top Score',        value: topScore,     icon: 'fa-trophy',         color: 'text-yellow-400' },
              { label: 'FPL Players',      value: totalPlayers, icon: 'fa-users',          color: 'text-purple-400' },
            ].map((k, i) => (
              <div key={i} className="glass-card rounded-2xl p-5 border border-gray-700/50">
                <div className="flex justify-between items-start mb-3">
                  <p className="text-xs text-gray-400 font-medium">{k.label}</p>
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <i className={'fa-solid ' + k.icon + ' text-sm ' + k.color}/>
                  </div>
                </div>
                <h3 className={'text-2xl font-black ' + k.color}>{value => value !== '—' ? value : <span className="text-gray-600">—</span>}{k.value}</h3>
              </div>
            ))}
          </div>

          {/* System Status Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

            {/* Service Health */}
            <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
              <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                <i className="fa-solid fa-circle-nodes text-blue-400"/> Service Health
              </h3>
              <div className="space-y-2">
                {[
                  ['FPL API', fplStatus === 'active'],
                  ['ML Engine', engineStatus?.status === 'ok'],
                  ['Models Loaded', engineStatus?.models_loaded === true],
                  ['Predictions Cached', engineStatus?.predictions_cached === true],
                  ['Clerk Auth', true],
                ].map(([label, ok]) => (
                  <div key={label} className="flex items-center justify-between p-3 bg-[#0F121D]/50 rounded-xl">
                    <span className="text-sm text-gray-300">{label}</span>
                    <StatusDot ok={ok}/>
                  </div>
                ))}
              </div>
            </div>

            {/* Engine Details */}
            <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
              <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                <i className="fa-solid fa-robot text-green-400"/> ML Engine
              </h3>
              <div className="space-y-2">
                {(engineStatus ? [
                  ['Status',       engineStatus.status || '—'],
                  ['Current GW',   engineStatus.current_gw || '—'],
                  ['Training',     engineStatus.training_status || '—'],
                  ['Last Updated', engineStatus.last_updated ? new Date(engineStatus.last_updated).toLocaleDateString() : '—'],
                  ['Last Sync',    lastSync || 'Pending...'],
                ] : [['Loading...', '—']]).map(([l, v]) => (
                  <div key={l} className="flex justify-between items-center p-2.5 bg-[#0F121D]/50 rounded-xl">
                    <span className="text-xs text-gray-400">{l}</span>
                    <span className="text-xs font-bold text-white">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
              <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                <i className="fa-solid fa-toggle-on text-blue-400"/> Controls
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#0F121D]/50 rounded-xl">
                  <div>
                    <p className="text-sm text-white font-medium">Maintenance Mode</p>
                    <p className="text-[10px] text-gray-500">Shows overlay on all pages</p>
                  </div>
                  <button onClick={() => setMaintenance(!maintenanceMode)}
                    className={'w-12 h-6 rounded-full relative transition-colors ' + (maintenanceMode ? 'bg-yellow-500' : 'bg-gray-700')}>
                    <div className={'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ' + (maintenanceMode ? 'right-0.5' : 'left-0.5')}/>
                  </button>
                </div>
                <a href={ENGINE_URL + '/api/status'} target="_blank" rel="noreferrer"
                  className="flex items-center justify-between p-3 bg-[#0F121D]/50 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
                  <div>
                    <p className="text-sm text-white font-medium">Engine API</p>
                    <p className="text-[10px] text-gray-500">Open Railway status endpoint</p>
                  </div>
                  <i className="fa-solid fa-arrow-up-right-from-square text-gray-400 text-xs"/>
                </a>
                <a href="https://dashboard.clerk.com" target="_blank" rel="noreferrer"
                  className="flex items-center justify-between p-3 bg-[#0F121D]/50 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
                  <div>
                    <p className="text-sm text-white font-medium">Clerk Dashboard</p>
                    <p className="text-[10px] text-gray-500">Manage auth & users</p>
                  </div>
                  <i className="fa-solid fa-arrow-up-right-from-square text-gray-400 text-xs"/>
                </a>
                <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer"
                  className="flex items-center justify-between p-3 bg-[#0F121D]/50 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
                  <div>
                    <p className="text-sm text-white font-medium">Supabase</p>
                    <p className="text-[10px] text-gray-500">Database & storage</p>
                  </div>
                  <i className="fa-solid fa-arrow-up-right-from-square text-gray-400 text-xs"/>
                </a>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-800 mb-6">
            {[['overview','Overview'],['users','Users'],['engine','Engine']].map(([id,label]) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={'px-6 py-3 text-sm font-medium transition-colors border-b-2 ' + (activeTab===id ? 'text-blue-400 border-blue-400' : 'text-gray-400 border-transparent hover:text-white')}>
                {label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && bootstrap && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                ['Total FPL Players',  bootstrap.total_players?.toLocaleString(), 'fa-users', 'text-blue-400'],
                ['Total Teams',        bootstrap.total_players?.toLocaleString(), 'fa-shield', 'text-green-400'],
                ['Current GW',         currentGW, 'fa-calendar', 'text-yellow-400'],
                ['Avg Score GW'+currentGW, avgScore, 'fa-chart-line', 'text-purple-400'],
                ['Top Score GW'+currentGW, topScore, 'fa-trophy', 'text-yellow-400'],
                ['Active Teams',       bootstrap.events?.find(e=>e.is_current)?.most_selected ? '—' : '—', 'fa-circle-check', 'text-green-400'],
              ].map(([l,v,ic,c]) => (
                <div key={l} className="glass-card rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <i className={'fa-solid ' + ic + ' text-sm ' + c}/>
                    <p className="text-xs text-gray-400 truncate">{l}</p>
                  </div>
                  <p className={'text-xl font-black ' + c}>{v || '—'}</p>
                </div>
              ))}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-4 flex flex-col lg:flex-row gap-4 justify-between items-center border border-gray-700/50">
                <div className="relative w-full lg:w-96">
                  <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"/>
                  <input type="text" placeholder="Search name, email or Team ID..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full bg-[#1A1D2E] border border-gray-700 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-blue-500/50 text-sm"/>
                </div>
                <p className="text-xs text-gray-500">{filtered.length} user{filtered.length !== 1 ? 's' : ''} found</p>
              </div>
              {usersLoading ? (
                <div className="flex items-center justify-center py-16">
                  <i className="fa-solid fa-spinner fa-spin text-blue-400 text-2xl"/>
                </div>
              ) : (
                <div className="glass-card rounded-2xl border border-gray-700/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#1A1D2E]/50">
                        <tr className="text-xs uppercase tracking-wider text-gray-500 border-b border-gray-800">
                          {['User','Email','Team ID','Tier','Joined','Status'].map(h => (
                            <th key={h} className="px-6 py-4 font-semibold whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                              <i className="fa-solid fa-users text-2xl mb-2 block opacity-30"/>
                              No users found. Connect the Supabase <code className="text-xs bg-white/5 px-1 rounded">users</code> table to populate this list.
                            </td>
                          </tr>
                        ) : filtered.map((u, i) => (
                          <tr key={i} className="border-b border-gray-800/50 hover:bg-[#1A1D2E]/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400">
                                  {(u.name || u.email || '?').charAt(0).toUpperCase()}
                                </div>
                                <p className="font-bold text-white whitespace-nowrap">{u.name || '—'}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{u.email || '—'}</td>
                            <td className="px-6 py-4 text-blue-400 font-mono text-xs">{u.fpl_team_id || '—'}</td>
                            <td className="px-6 py-4">
                              <span className={'px-3 py-1 rounded text-xs font-medium border ' + (u.tier === 'Admin' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : u.tier === 'Pro' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-gray-700/50 text-gray-400 border-gray-700')}>
                                {u.tier || 'Free'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-400 whitespace-nowrap text-xs">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-6 py-4">
                              <span className={'px-3 py-1 rounded-full text-xs font-bold ' + (u.status === 'Active' || !u.status ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-gray-500/15 text-gray-400 border border-gray-500/30')}>
                                {u.status || 'Active'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Engine Tab */}
          {activeTab === 'engine' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-robot text-green-400"/> ML Engine Status
                </h3>
                {engineStatus ? (
                  <div className="space-y-3">
                    {Object.entries(engineStatus).map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center p-3 bg-[#0F121D]/50 rounded-xl">
                        <span className="text-sm text-gray-400 capitalize">{k.replace(/_/g,' ')}</span>
                        <span className={'text-sm font-bold ' + (v === true ? 'text-green-400' : v === false ? 'text-red-400' : 'text-white')}>
                          {String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Loading engine status...</p>
                )}
              </div>
              <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-link text-blue-400"/> Engine Endpoints
                </h3>
                <div className="space-y-2">
                  {['/api/status','/api/predictions','/api/captain','/api/differentials','/api/essentials','/api/optimise'].map(ep => (
                    <a key={ep} href={ENGINE_URL + ep} target="_blank" rel="noreferrer"
                      className="flex items-center justify-between p-3 bg-[#0F121D]/50 rounded-xl hover:bg-white/5 transition-colors group">
                      <span className="text-xs font-mono text-blue-400 group-hover:text-blue-300">{ep}</span>
                      <i className="fa-solid fa-arrow-up-right-from-square text-gray-600 text-xs"/>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
