import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'

const isAdmin = true

const MOCK_USERS = [
  { name: 'Navin Dhillon', email: 'navindhillon@gmail.com', teamId: '3321638', tier: 'Admin', lastActive: '2 mins ago', status: 'Active' },
  { name: 'Marcus Rashford', email: 'marcus.r@example.com', teamId: '98234', tier: 'Pro', lastActive: '1 hour ago', status: 'Active' },
  { name: 'Sarah Jenkins', email: 'sarah.j@example.com', teamId: '45112', tier: 'Free', lastActive: '2 days ago', status: 'Suspended' },
  { name: 'Alex Thompson', email: 'alex.t@example.com', teamId: '77821', tier: 'Pro', lastActive: '5 hours ago', status: 'Active' },
  { name: 'Jamie Carter', email: 'jamie.c@example.com', teamId: '12345', tier: 'Free', lastActive: '1 week ago', status: 'Active' },
  { name: 'Priya Patel', email: 'priya.p@example.com', teamId: '55678', tier: 'Pro', lastActive: '3 hours ago', status: 'Active' },
  { name: 'Tom Wilson', email: 'tom.w@example.com', teamId: '88901', tier: 'Free', lastActive: '4 days ago', status: 'Inactive' },
]

const KPIS = [
  { label: 'Total Users', value: '24,592', icon: 'fa-users', color: 'text-blue-400', badge: '+12%' },
  { label: 'Pro Subscribers', value: '3,845', icon: 'fa-crown', color: 'text-yellow-400', badge: '+8%' },
  { label: 'Email Open Rate', value: '42.8%', icon: 'fa-envelope-open-text', color: 'text-blue-400', badge: '+2.4%' },
  { label: 'System Health', value: '99.9%', icon: 'fa-server', color: 'text-green-400', badge: 'Live' },
]

export default function AdminConsole() {
  const [activeTab, setActiveTab] = useState('users')
  const [search, setSearch] = useState('')
  const [apiStatus, setApiStatus] = useState('checking')
  const [lastSync, setLastSync] = useState(null)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [debugLogs, setDebugLogs] = useState(false)

  // Check API/proxy status
  useEffect(() => {
    const checkApi = async () => {
      try {
        const res = await fetch('/fpl/bootstrap-static/', { method: 'HEAD' })
        setApiStatus(res.ok ? 'active' : 'error')
        setLastSync(new Date().toLocaleTimeString())
      } catch {
        setApiStatus('disconnected')
      }
    }
    checkApi()
    const interval = setInterval(checkApi, 30000)
    return () => clearInterval(interval)
  }, [])

  const filtered = MOCK_USERS.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.teamId.includes(search)
  )

  if (!isAdmin) return (
    <div className="min-h-screen bg-[#0F121D] flex items-center justify-center text-white">
      <div className="text-center">
        <i className="fa-solid fa-lock text-red-400 text-4xl mb-4"/>
        <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
        <p className="text-gray-400">You do not have admin privileges.</p>
      </div>
    </div>
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
        <main className="flex-1 overflow-y-auto custom-scroll p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">

          {/* Header */}
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Admin Console</h1>
              <p className="text-gray-400 text-lg">System management, user oversight, and monitoring</p>
            </div>
            <div className="flex gap-3">
              <button className="px-5 py-2.5 rounded-xl border border-gray-600 text-white font-medium hover:bg-[#1A1D2E] transition-all flex items-center gap-2 text-sm">
                <i className="fa-solid fa-download"/> Export Data
              </button>
              <button className="neon-button rounded-xl px-5 py-2.5 font-medium flex items-center gap-2 text-sm">
                <i className="fa-solid fa-sync"/> Sync
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {KPIS.map((k,i) => (
              <div key={i} className="glass-card rounded-[24px] p-6 border border-gray-700/50">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm text-gray-400 font-medium mb-1">{k.label}</p>
                    <h3 className="text-3xl font-bold text-white">{k.value}</h3>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[#1A1D2E] border border-gray-700 flex items-center justify-center">
                    <i className={`fa-solid ${k.icon} ${k.color}`}/>
                  </div>
                </div>
                <span className="text-xs text-blue-400 flex items-center gap-1">
                  <i className="fa-solid fa-arrow-up"/> {k.badge}
                </span>
              </div>
            ))}
          </div>

          {/* System Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
              <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                <i className="fa-solid fa-circle-nodes text-blue-400"/> System Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#0F121D]/50 rounded-xl">
                  <span className="text-sm text-gray-300">FPL API Connection</span>
                  <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                    apiStatus === 'active' ? 'bg-green-500/10 text-green-400' :
                    apiStatus === 'checking' ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      apiStatus === 'active' ? 'bg-green-400 animate-pulse' :
                      apiStatus === 'checking' ? 'bg-yellow-400 animate-pulse' :
                      'bg-red-400'
                    }`}/>
                    {apiStatus === 'active' ? 'Active' : apiStatus === 'checking' ? 'Checking...' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#0F121D]/50 rounded-xl">
                  <span className="text-sm text-gray-300">Last Data Sync</span>
                  <span className="text-xs text-blue-400 font-medium">{lastSync || 'Pending...'}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#0F121D]/50 rounded-xl">
                  <span className="text-sm text-gray-300">Clerk Auth</span>
                  <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-green-500/10 text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>Active
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#0F121D]/50 rounded-xl">
                  <span className="text-sm text-gray-300">Supabase DB</span>
                  <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-green-500/10 text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>Connected
                  </span>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
              <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                <i className="fa-solid fa-toggle-on text-blue-400"/> System Controls
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-[#0F121D]/50 rounded-xl">
                  <div>
                    <p className="text-sm text-white font-medium">Maintenance Mode</p>
                    <p className="text-[10px] text-gray-500">Shows overlay on all pages</p>
                  </div>
                  <button onClick={() => setMaintenanceMode(!maintenanceMode)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${maintenanceMode ? 'bg-yellow-500' : 'bg-gray-700'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${maintenanceMode ? 'right-0.5' : 'left-0.5'}`}/>
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#0F121D]/50 rounded-xl">
                  <div>
                    <p className="text-sm text-white font-medium">Debug Logs</p>
                    <p className="text-[10px] text-gray-500">Enable verbose console logging</p>
                  </div>
                  <button onClick={() => setDebugLogs(!debugLogs)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${debugLogs ? 'bg-blue-500' : 'bg-gray-700'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${debugLogs ? 'right-0.5' : 'left-0.5'}`}/>
                  </button>
                </div>
              </div>
              {maintenanceMode && (
                <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <p className="text-xs text-yellow-400"><i className="fa-solid fa-triangle-exclamation mr-1"/>Maintenance mode is ON — users will see the overlay</p>
                </div>
              )}
            </div>

            <div className="glass-card rounded-2xl p-6 border border-gray-700/50">
              <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                <i className="fa-solid fa-chart-line text-blue-400"/> Quick Stats
              </h3>
              <div className="space-y-3">
                {[
                  ['Active Sessions', '1,284', 'text-green-400'],
                  ['API Calls Today', '48,291', 'text-blue-400'],
                  ['Avg Response Time', '142ms', 'text-white'],
                  ['Error Rate', '0.02%', 'text-green-400'],
                  ['Storage Used', '2.4 GB', 'text-white'],
                ].map(([l,v,c]) => (
                  <div key={l} className="flex justify-between items-center p-2 bg-[#0F121D]/50 rounded-lg">
                    <span className="text-xs text-gray-400">{l}</span>
                    <span className={`text-sm font-bold ${c}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-800 mb-6">
            {[['users','User Management'],['marketing','Marketing & Email'],['logs','Audit Logs'],['settings','Settings']].map(([id,label]) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab===id ? 'text-blue-400 border-blue-400' : 'text-gray-400 border-transparent hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="glass-card rounded-2xl p-4 flex flex-col lg:flex-row gap-4 justify-between items-center border border-gray-700/50">
                <div className="relative w-full lg:w-96">
                  <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"/>
                  <input type="text" placeholder="Search by name, email, or Team ID..."
                    value={search} onChange={e=>setSearch(e.target.value)}
                    className="w-full bg-[#1A1D2E] border border-gray-700 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-blue-500/50 transition-colors text-sm"/>
                </div>
                <div className="flex gap-2">
                  <select className="bg-[#1A1D2E] border border-gray-700 text-white rounded-xl px-4 py-2 text-sm focus:outline-none">
                    <option>All Tiers</option><option>Admin</option><option>Pro</option><option>Free</option>
                  </select>
                  <select className="bg-[#1A1D2E] border border-gray-700 text-white rounded-xl px-4 py-2 text-sm focus:outline-none">
                    <option>All Status</option><option>Active</option><option>Suspended</option><option>Inactive</option>
                  </select>
                </div>
              </div>

              <div className="glass-card rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#1A1D2E]/50">
                      <tr className="text-xs uppercase tracking-wider text-gray-500 border-b border-gray-800">
                        {['User','Email','Team ID','Status','Tier','Last Active','Actions'].map(h => (
                          <th key={h} className="px-6 py-4 font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((u,i) => (
                        <tr key={i} className="border-b border-gray-800/50 hover:bg-[#1A1D2E]/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400">
                                {u.name.split(' ').map(n=>n[0]).join('')}
                              </div>
                              <p className="font-bold text-white whitespace-nowrap">{u.name}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{u.email}</td>
                          <td className="px-6 py-4 text-blue-400 font-mono text-xs">{u.teamId}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              u.status==='Active' ? 'bg-green-500/15 text-green-400 border border-green-500/30' :
                              u.status==='Suspended' ? 'bg-red-500/15 text-red-400 border border-red-500/30' :
                              'bg-gray-500/15 text-gray-400 border border-gray-500/30'
                            }`}>{u.status}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded text-xs font-medium border ${
                              u.tier==='Admin' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                              u.tier==='Pro' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                              'bg-gray-700/50 text-gray-400 border-gray-700'
                            }`}>{u.tier}</span>
                          </td>
                          <td className="px-6 py-4 text-gray-400 whitespace-nowrap text-xs">{u.lastActive}</td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button className="w-7 h-7 rounded-lg bg-[#1A1D2E] border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                                <i className="fa-solid fa-pen text-xs"/>
                              </button>
                              <button className="w-7 h-7 rounded-lg bg-[#1A1D2E] border border-gray-700 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors">
                                <i className="fa-solid fa-ban text-xs"/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t border-gray-800 flex items-center justify-between">
                  <p className="text-sm text-gray-400">Showing {filtered.length} of 24,592 users</p>
                  <div className="flex gap-1">
                    {[1,2,3].map(n => (
                      <button key={n} className={`w-8 h-8 rounded-lg border flex items-center justify-center text-sm ${n===1 ? 'bg-[#252A3F] border-blue-500/30 text-white font-medium' : 'bg-[#1A1D2E] border-gray-700 text-gray-400 hover:text-white'}`}>{n}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'users' && (
            <div className="glass-card rounded-2xl p-12 border border-gray-700/50 text-center">
              <i className="fa-solid fa-tools text-blue-400 text-4xl mb-4"/>
              <h3 className="text-xl font-bold mb-2">{activeTab.charAt(0).toUpperCase()+activeTab.slice(1)}</h3>
              <p className="text-gray-400">This section is coming soon.</p>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
